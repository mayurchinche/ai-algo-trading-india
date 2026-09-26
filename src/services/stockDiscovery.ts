// ponytail: dynamic stock discovery engine — scans live market, applies multi-strategy analysis, picks top opportunities
// No hardcoded stocks. Discovers from Yahoo Finance screeners + computes technicals from historical data.
import { fetchMarketJSON } from '../utils/fetchMarketJSON';
import { istDate } from './tradingTime';
import { evaluateDiscoverySnapshot } from './discoveryScoring';
export { scoreStrategies } from './discoveryScoring';

export interface DiscoveredStock {
  generatedAt: string;
  firstSignalAt?: string;
  quoteTime?: string;
  signalId?: string;
  eligible: boolean;
  blockedReasons: string[];
  symbol: string;
  name: string;
  exchange: string;
  ltp: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  dayHigh: number | null;
  dayLow: number | null;
  open: number | null;
  prevClose: number;
  weekHigh52: number;
  weekLow52: number;
  sma50: number;
  sma200: number;
  marketCap: number | null;
  // Computed technicals
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  sma20: number;
  trend: 'STRONG_UP' | 'UP' | 'SIDEWAYS' | 'DOWN' | 'STRONG_DOWN';
  // Multi-strategy scoring
  scores: StrategyScores;
  overallScore: number;
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  reasons: string[];
  strategies: string[];
  // F&O analysis (computed from price action)
  foAnalysis: FOAnalysis;
}

export interface StrategyScores {
  momentum: number;       // RSI + MACD + price vs SMA
  meanReversion: number;  // Oversold/overbought + Bollinger band position
  breakout: number;       // Volume spike + 52w high/low proximity
  trendFollowing: number; // SMA alignment; volatility is not directional trend strength
  smartMoney: number;     // Volume ratio + institutional pattern detection
}

export interface FOAnalysis {
  expectedMove: number;      // ATR-based expected move %
  supportLevel: number;
  resistanceLevel: number;
  riskReward: number;
  suggestedStopLoss: number;
  suggestedTarget: number;
  optionStrategy: string;    // Suggested F&O strategy
  optionReason: string;
}

async function fetchScreener(scrId: string, count = 25, fetchJSON = fetchMarketJSON): Promise<any[]> {
  try {
    const d = await fetchJSON(`/api/yahoo/v1/finance/screener/predefined/saved?formatted=false&lang=en-IN&region=IN&scrIds=${scrId}&count=${count}`);
    return d?.finance?.result?.[0]?.quotes || [];
  } catch { return []; }
}

export async function fetchHistorical(symbol: string, fetchJSON = fetchMarketJSON) {
  const d = await fetchJSON(`/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y`);
  const result = d?.chart?.result?.[0];
  const q = result?.indicators?.quote?.[0];
  if (!q || !result.timestamp) return null;
  const rows = result.timestamp.map((time: number, i: number) => ({ time, close: q.close[i], high: q.high[i], low: q.low[i], volume: q.volume[i] }))
    .filter((r: any) => [r.time, r.close, r.high, r.low, r.volume].every(Number.isFinite) && r.time > 0 && r.volume >= 0 && r.low > 0 && r.low <= r.close && r.close <= r.high && istDate(r.time * 1000) < istDate());
  return { dates: rows.map((r: any) => istDate(r.time * 1000)) as string[], closes: rows.map((r: any) => r.close) as number[], highs: rows.map((r: any) => r.high) as number[], lows: rows.map((r: any) => r.low) as number[], volumes: rows.map((r: any) => r.volume) as number[], meta: result.meta };
}

export async function fetchQuotes(symbols: string[], fetchJSON = fetchMarketJSON) {
  const results = await Promise.allSettled([...new Set(symbols)].map(async symbol => {
    const data = await fetchJSON(`/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?interval=1m&range=1d`);
    const meta = data?.chart?.result?.[0]?.meta;
    if (!Number.isFinite(meta?.regularMarketPrice) || !Number.isFinite(meta?.regularMarketTime)) throw new Error('Missing quote time');
    return [symbol, { price: meta.regularMarketPrice, timestamp: new Date(meta.regularMarketTime * 1000).toISOString(), source: 'Yahoo research feed' }] as const;
  }));
  return new Map(results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []));
}

// --- Main Discovery Function ---

export async function discoverStocks(fetchJSON = fetchMarketJSON): Promise<DiscoveredStock[]> {
  // Step 1: Scan market — get top movers from multiple screeners
  const [actives, gainers, losers] = await Promise.all([
    fetchScreener('most_actives_in', 25, fetchJSON),
    fetchScreener('day_gainers_in', 15, fetchJSON),
    fetchScreener('day_losers_in', 10, fetchJSON),
  ]);

  // Deduplicate by symbol, prefer .NS over .BO
  const seen = new Map<string, any>();
  [...actives, ...gainers, ...losers].forEach(q => {
    const sym = q.symbol as string;
    if (!sym) return;
    // Filter: only NSE, price > ₹10, volume > 1L
    if (!sym.endsWith('.NS')) return;
    if ((q.regularMarketPrice || 0) < 10) return;
    if ((q.regularMarketVolume || 0) < 100000) return;
    if (!seen.has(sym)) seen.set(sym, q);
  });

  // Universe comes only from provider screener observations.
  const candidates = Array.from(seen.values()).slice(0, 40);
  const results: DiscoveredStock[] = [];

  const analyses = await Promise.allSettled(
    candidates.map(async (q) => {
      const symbol = q.symbol as string;
      const hist = await fetchHistorical(symbol, fetchJSON);
      if (!hist || hist.closes.length < 200) return null;

      return evaluateDiscoverySnapshot(symbol, hist, Date.now());
    })
  );

  analyses.forEach(r => {
    if (r.status === 'fulfilled' && r.value) results.push(r.value);
  });

  if (!results.length) {
    const failed = analyses.find(r => r.status === 'rejected');
    const detail = failed?.status === 'rejected' && failed.reason instanceof Error ? failed.reason.message : 'Data feed unavailable or incomplete.';
    throw new Error(`No stocks have sufficient valid history. ${detail} No signals generated.`);
  }

  // Sort by absolute score (strongest signals first, buy or sell)
  results.sort((a, b) => Math.abs(b.overallScore) - Math.abs(a.overallScore));
  return results;
}
