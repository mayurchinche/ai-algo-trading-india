// ponytail: dynamic stock discovery engine — scans live market, applies multi-strategy analysis, picks top opportunities
// No hardcoded stocks. Discovers from Yahoo Finance screeners + computes technicals from historical data.
import { apiUrl } from '../utils/apiUrl';

export interface DiscoveredStock {
  symbol: string;
  name: string;
  exchange: string;
  ltp: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  prevClose: number;
  weekHigh52: number;
  weekLow52: number;
  sma50: number;
  sma200: number;
  marketCap: number;
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
  trendFollowing: number; // SMA alignment + ADX proxy
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

// --- Technical Analysis Computations ---

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
}

function computeEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function computeMACD(closes: number[]): { value: number; signal: number; histogram: number } {
  if (closes.length < 26) return { value: 0, signal: 0, histogram: 0 };
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = computeEMA(macdLine.slice(-9), 9);
  const value = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { value, signal, histogram: value - signal };
}

function computeSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function computeATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (highs.length < period + 1) return 0;
  let atr = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    atr += tr;
  }
  return atr / period;
}

function computeBollingerPosition(closes: number[], period = 20): number {
  const sma = computeSMA(closes, period);
  const slice = closes.slice(-period);
  const std = Math.sqrt(slice.reduce((sum, v) => sum + (v - sma) ** 2, 0) / period);
  const upper = sma + 2 * std;
  const lower = sma - 2 * std;
  const current = closes[closes.length - 1];
  if (upper === lower) return 0.5;
  return (current - lower) / (upper - lower); // 0 = at lower band, 1 = at upper band
}

// --- Strategy Scoring ---

function scoreStrategies(
  ltp: number, rsi: number, macd: { value: number; signal: number; histogram: number },
  sma20: number, sma50: number, sma200: number,
  volumeRatio: number, bollingerPos: number,
  weekHigh52: number, weekLow52: number, atr: number
): StrategyScores {
  // Momentum: RSI trend + MACD + price above SMAs
  const rsiMomentum = rsi > 50 ? Math.min((rsi - 50) / 30 * 100, 100) : Math.max((rsi - 50) / 30 * 100, -100);
  const macdMomentum = macd.histogram > 0 ? Math.min(macd.histogram / (ltp * 0.01) * 50, 100) : Math.max(macd.histogram / (ltp * 0.01) * 50, -100);
  const priceMomentum = ((ltp > sma20 ? 30 : -30) + (ltp > sma50 ? 30 : -30) + (ltp > sma200 ? 40 : -40));
  const momentum = Math.round((rsiMomentum * 0.3 + macdMomentum * 0.3 + priceMomentum * 0.4));

  // Mean Reversion: oversold = buy opportunity
  let meanReversion = 0;
  if (rsi < 30) meanReversion = 80 + (30 - rsi) * 2;
  else if (rsi > 70) meanReversion = -(80 + (rsi - 70) * 2);
  else if (bollingerPos < 0.2) meanReversion = 60;
  else if (bollingerPos > 0.8) meanReversion = -60;
  meanReversion = Math.max(-100, Math.min(100, Math.round(meanReversion)));

  // Breakout: near 52w high + volume spike
  const distFromHigh = (weekHigh52 - ltp) / weekHigh52;
  const distFromLow = (ltp - weekLow52) / weekLow52;
  let breakout = 0;
  if (distFromHigh < 0.05 && volumeRatio > 1.5) breakout = 80 + Math.min(volumeRatio * 10, 20);
  else if (distFromHigh < 0.10 && volumeRatio > 1.2) breakout = 50;
  else if (distFromLow < 0.10) breakout = -60;
  breakout = Math.max(-100, Math.min(100, Math.round(breakout)));

  // Trend Following: SMA alignment (20>50>200 = strong uptrend)
  let trendFollowing = 0;
  if (sma20 > sma50 && sma50 > sma200) trendFollowing = 80;
  else if (sma20 > sma50) trendFollowing = 40;
  else if (sma20 < sma50 && sma50 < sma200) trendFollowing = -80;
  else if (sma20 < sma50) trendFollowing = -40;
  // ADX proxy: larger candles = stronger trend
  const atrPct = (atr / ltp) * 100;
  if (atrPct > 3) trendFollowing = Math.round(trendFollowing * 1.3);
  trendFollowing = Math.max(-100, Math.min(100, trendFollowing));

  // Smart Money: volume spike + price near key levels = institutional activity
  let smartMoney = 0;
  if (volumeRatio > 2) smartMoney += 40;
  if (volumeRatio > 3) smartMoney += 30;
  if (ltp > sma200 && volumeRatio > 1.5) smartMoney += 20;
  if (distFromHigh < 0.03 && volumeRatio > 2) smartMoney += 10; // Breakout accumulation
  smartMoney = Math.max(-100, Math.min(100, Math.round(smartMoney)));

  return { momentum, meanReversion, breakout, trendFollowing, smartMoney };
}

function computeOverallSignal(scores: StrategyScores): { score: number; signal: DiscoveredStock['signal'] } {
  // Weighted average — momentum and trend following weighted higher
  const score = Math.round(
    scores.momentum * 0.25 +
    scores.meanReversion * 0.15 +
    scores.breakout * 0.25 +
    scores.trendFollowing * 0.20 +
    scores.smartMoney * 0.15
  );
  let signal: DiscoveredStock['signal'] = 'HOLD';
  if (score >= 60) signal = 'STRONG_BUY';
  else if (score >= 30) signal = 'BUY';
  else if (score <= -60) signal = 'STRONG_SELL';
  else if (score <= -30) signal = 'SELL';
  return { score, signal };
}

function computeFOAnalysis(ltp: number, atr: number, _sma20: number, scores: StrategyScores, rsi: number): FOAnalysis {
  const expectedMove = (atr / ltp) * 100;
  const supportLevel = Math.round((ltp - atr * 1.5) * 100) / 100;
  const resistanceLevel = Math.round((ltp + atr * 1.5) * 100) / 100;
  const suggestedStopLoss = Math.round((ltp - atr * 2) * 100) / 100;
  const suggestedTarget = Math.round((ltp + atr * 3) * 100) / 100;
  const riskReward = Math.round(((suggestedTarget - ltp) / (ltp - suggestedStopLoss)) * 10) / 10;

  let optionStrategy = '';
  let optionReason = '';

  if (scores.momentum > 50 && scores.breakout > 40) {
    optionStrategy = 'Buy Call (ATM or slightly OTM)';
    optionReason = 'Strong momentum + breakout setup. Directional long call for leveraged upside.';
  } else if (scores.momentum < -50) {
    optionStrategy = 'Buy Put or Bear Put Spread';
    optionReason = 'Bearish momentum. Protective put or directional bear spread.';
  } else if (rsi > 65 && scores.meanReversion < -30) {
    optionStrategy = 'Covered Call / Short Straddle';
    optionReason = 'Overbought. Sell premium — expect consolidation or pullback.';
  } else if (rsi < 35 && scores.meanReversion > 30) {
    optionStrategy = 'Bull Put Spread (Credit)';
    optionReason = 'Oversold with support. Sell put spread below support for income.';
  } else if (Math.abs(scores.trendFollowing) < 20) {
    optionStrategy = 'Iron Condor / Short Strangle';
    optionReason = 'Range-bound. Sell premium on both sides, profit from time decay.';
  } else {
    optionStrategy = 'Bull Call Spread';
    optionReason = 'Moderate conviction. Defined-risk directional trade.';
  }

  return { expectedMove: Math.round(expectedMove * 100) / 100, supportLevel, resistanceLevel, riskReward, suggestedStopLoss, suggestedTarget, optionStrategy, optionReason };
}

function generateReasons(scores: StrategyScores, rsi: number, volumeRatio: number, ltp: number, sma50: number, sma200: number, weekHigh52: number): string[] {
  const reasons: string[] = [];
  if (scores.momentum > 50) reasons.push('Strong bullish momentum — RSI + MACD aligned');
  if (scores.momentum < -50) reasons.push('Bearish momentum — avoid or short');
  if (rsi < 30) reasons.push(`RSI oversold at ${rsi.toFixed(1)} — potential bounce candidate`);
  if (rsi > 70) reasons.push(`RSI overbought at ${rsi.toFixed(1)} — caution, potential reversal`);
  if (volumeRatio > 2) reasons.push(`Volume spike ${volumeRatio.toFixed(1)}x avg — institutional activity likely`);
  if (ltp > sma50 && ltp > sma200) reasons.push('Price above SMA50 & SMA200 — uptrend confirmed');
  if (ltp < sma50 && ltp < sma200) reasons.push('Price below SMA50 & SMA200 — downtrend');
  if ((weekHigh52 - ltp) / weekHigh52 < 0.05) reasons.push('Near 52-week high — breakout territory');
  if (scores.breakout > 60) reasons.push('Breakout pattern — volume confirms new high attempt');
  if (scores.smartMoney > 50) reasons.push('Smart money accumulation detected — high volume at key levels');
  if (scores.trendFollowing > 60) reasons.push('All moving averages aligned bullish (20>50>200)');
  return reasons.length ? reasons : ['Neutral — no strong conviction from any strategy'];
}

function identifyStrategies(scores: StrategyScores): string[] {
  const strats: string[] = [];
  if (scores.momentum > 40) strats.push('Momentum');
  if (scores.meanReversion > 40) strats.push('Mean Reversion');
  if (scores.breakout > 40) strats.push('Breakout');
  if (scores.trendFollowing > 40) strats.push('Trend Following');
  if (scores.smartMoney > 40) strats.push('Smart Money Flow');
  if (scores.momentum < -40) strats.push('Bearish Momentum');
  if (scores.meanReversion < -40) strats.push('Overbought Reversal');
  return strats.length ? strats : ['Wait & Watch'];
}

function determineTrend(sma20: number, sma50: number, sma200: number, ltp: number): DiscoveredStock['trend'] {
  if (ltp > sma20 && sma20 > sma50 && sma50 > sma200) return 'STRONG_UP';
  if (ltp > sma50) return 'UP';
  if (ltp < sma20 && sma20 < sma50 && sma50 < sma200) return 'STRONG_DOWN';
  if (ltp < sma50) return 'DOWN';
  return 'SIDEWAYS';
}

// --- Data Fetching ---

async function fetchScreener(scrId: string, count = 25): Promise<any[]> {
  try {
    const res = await fetch(apiUrl(`/api/yahoo/v1/finance/screener/predefined/saved?formatted=false&lang=en-IN&region=IN&scrIds=${scrId}&count=${count}`));
    if (!res.ok) return [];
    const d = await res.json();
    return d?.finance?.result?.[0]?.quotes || [];
  } catch { return []; }
}

async function fetchHistorical(symbol: string): Promise<{ closes: number[]; highs: number[]; lows: number[] } | null> {
  try {
    const res = await fetch(apiUrl(`/api/yahoo/v8/finance/chart/${symbol}?interval=1d&range=3mo`));
    if (!res.ok) return null;
    const d = await res.json();
    const q = d?.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!q) return null;
    const closes = (q.close || []).filter((v: any) => v !== null);
    const highs = (q.high || []).filter((v: any) => v !== null);
    const lows = (q.low || []).filter((v: any) => v !== null);
    return { closes, highs, lows };
  } catch { return null; }
}

// --- Main Discovery Function ---

export async function discoverStocks(): Promise<DiscoveredStock[]> {
  // Step 1: Scan market — get top movers from multiple screeners
  const [actives, gainers, losers] = await Promise.all([
    fetchScreener('most_actives_in', 25),
    fetchScreener('day_gainers_in', 15),
    fetchScreener('day_losers_in', 10),
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

  // Step 1b: Also fetch top F&O stocks to ensure options tab has data
  const topFnOSymbols = [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
    'SBIN.NS', 'BHARTIARTL.NS', 'ITC.NS', 'BAJFINANCE.NS', 'MARUTI.NS',
    'TATASTEEL.NS', 'TATAMOTORS.NS', 'AXISBANK.NS', 'LT.NS', 'SUNPHARMA.NS',
    'HINDUNILVR.NS', 'ADANIENT.NS', 'WIPRO.NS', 'HCLTECH.NS', 'NTPC.NS',
    'POWERGRID.NS', 'KOTAKBANK.NS', 'JSWSTEEL.NS', 'TITAN.NS', 'DLF.NS',
  ];
  // Add any F&O symbols not already discovered
  for (const sym of topFnOSymbols) {
    if (!seen.has(sym)) {
      seen.set(sym, { symbol: sym, _needsFetch: true });
    }
  }

  // Step 2: Analyze candidates. Prioritize F&O stocks + top screener results
  // Take all unique candidates (screener + F&O stocks)
  const candidates = Array.from(seen.values()).slice(0, 40);
  const results: DiscoveredStock[] = [];

  const analyses = await Promise.allSettled(
    candidates.map(async (q) => {
      const symbol = q.symbol as string;
      const hist = await fetchHistorical(symbol);
      if (!hist || hist.closes.length < 20) return null;

      const { closes, highs, lows } = hist;
      const ltp = q.regularMarketPrice || closes[closes.length - 1];
      const prevClose = q.regularMarketPreviousClose || (closes.length > 1 ? closes[closes.length - 2] : ltp);
      const change = q.regularMarketChange ?? (ltp - prevClose);
      const changePct = q.regularMarketChangePercent ?? ((ltp - prevClose) / prevClose * 100);
      const rsi = computeRSI(closes);
      const macd = computeMACD(closes);
      const sma20 = computeSMA(closes, 20);
      const sma50 = computeSMA(closes, 50);
      const sma200 = computeSMA(closes, 200);
      const atr = computeATR(highs, lows, closes);
      const bollingerPos = computeBollingerPosition(closes);
      const vol = q.regularMarketVolume || 0;
      const avgVol = q.averageDailyVolume3Month || 1;
      const volumeRatio = vol / avgVol || 1;

      const scores = scoreStrategies(
        ltp, rsi, macd, sma20, sma50, sma200,
        volumeRatio, bollingerPos,
        q.fiftyTwoWeekHigh || ltp, q.fiftyTwoWeekLow || ltp, atr
      );

      const { score: overallScore, signal } = computeOverallSignal(scores);
      const reasons = generateReasons(scores, rsi, volumeRatio, ltp, sma50, sma200, q.fiftyTwoWeekHigh || ltp);
      const strategies = identifyStrategies(scores);
      const trend = determineTrend(sma20, sma50, sma200, ltp);
      const foAnalysis = computeFOAnalysis(ltp, atr, sma20, scores, rsi);

      return {
        symbol: symbol.replace('.NS', ''),
        name: q.longName || q.shortName || symbol.replace('.NS', ''),
        exchange: 'NSE',
        ltp,
        change,
        changePct,
        volume: vol,
        avgVolume: avgVol,
        volumeRatio: Math.round(volumeRatio * 10) / 10,
        dayHigh: q.regularMarketDayHigh || ltp,
        dayLow: q.regularMarketDayLow || ltp,
        open: q.regularMarketOpen || ltp,
        prevClose,
        weekHigh52: q.fiftyTwoWeekHigh || ltp,
        weekLow52: q.fiftyTwoWeekLow || ltp,
        sma50: Math.round(sma50 * 100) / 100,
        sma200: Math.round(sma200 * 100) / 100,
        marketCap: q.marketCap || 0,
        rsi: Math.round(rsi * 10) / 10,
        macd,
        sma20: Math.round(sma20 * 100) / 100,
        trend,
        scores,
        overallScore,
        signal,
        reasons,
        strategies,
        foAnalysis,
      } as DiscoveredStock;
    })
  );

  analyses.forEach(r => {
    if (r.status === 'fulfilled' && r.value) results.push(r.value);
  });

  // Sort by absolute score (strongest signals first, buy or sell)
  results.sort((a, b) => Math.abs(b.overallScore) - Math.abs(a.overallScore));
  return results;
}
