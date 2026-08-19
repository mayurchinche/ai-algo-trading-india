// ponytail: live metals prices — Indian retail from GoodReturns + COMEX technicals from Yahoo Finance
// Gold/Silver: Indian retail prices (matching Gullak/PhonePe/CRED)
// Platinum/Palladium/Copper: COMEX converted (no Indian retail source)

export interface LiveMetal {
  name: string;
  symbol: string;
  ticker: string;
  icon: string;
  pricePerGram: number;
  pricePerOz: number;
  priceSource: 'Indian Retail (GoodReturns)' | 'COMEX Futures (converted)';
  priceUSD: number;
  change24h: number;
  change24hPct: number;
  change7dPct: number;
  change30dPct: number;
  high52w: number;
  low52w: number;
  signal: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
  trend: 'Uptrend' | 'Downtrend' | 'Sideways';
  rsi: number;
  sma20: number;
  sma50: number;
  support: number;
  resistance: number;
  aiScore: number;
  priceHistory: { date: string; price: number }[];
  reasons: string[];
  investmentThesis: string;
  bestForm: string;
  lastUpdated: Date;
}

interface MetalConfig {
  name: string;
  symbol: string;
  ticker: string;
  icon: string;
  ozPerUnit: number; // 1 for gold/silver/platinum/palladium, special for copper
  bestForm: string;
}

const METALS: MetalConfig[] = [
  { name: 'Gold', symbol: 'XAU', ticker: 'GC=F', icon: '🥇', ozPerUnit: 1, bestForm: 'Sovereign Gold Bonds (SGB) > Gold ETFs (GOLDBEES) > Digital Gold > Physical' },
  { name: 'Silver', symbol: 'XAG', ticker: 'SI=F', icon: '🥈', ozPerUnit: 1, bestForm: 'Silver ETFs (SILVERBEES) > Physical bars (1kg) > Digital Silver' },
  { name: 'Platinum', symbol: 'XPT', ticker: 'PL=F', icon: '💎', ozPerUnit: 1, bestForm: 'Physical coins > International ETFs (no India platinum ETF yet)' },
  { name: 'Palladium', symbol: 'XPD', ticker: 'PA=F', icon: '⚪', ozPerUnit: 1, bestForm: 'International ETFs only — not recommended for most investors' },
  { name: 'Copper', symbol: 'HG', ticker: 'HG=F', icon: '🟤', ozPerUnit: 0.03215, bestForm: 'Hindalco/Hindustan Copper stocks > MCX Copper futures' }, // HG=F is per pound, 1 lb = 0.03215 troy oz equivalent... actually per pound
];

// ponytail: copper is quoted in USD/lb, 1 lb = 453.592g
const GRAMS_PER_TROY_OZ = 31.1035;
const GRAMS_PER_LB = 453.592;

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

function computeSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function generateSignal(rsi: number, price: number, sma20: number, sma50: number, change7d: number): { signal: LiveMetal['signal']; trend: LiveMetal['trend']; score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  // Trend
  let trend: LiveMetal['trend'] = 'Sideways';
  if (price > sma20 && sma20 > sma50) { trend = 'Uptrend'; score += 10; reasons.push(`Price above 20 & 50-day SMA — confirmed uptrend`); }
  else if (price < sma20 && sma20 < sma50) { trend = 'Downtrend'; score -= 10; reasons.push(`Price below 20 & 50-day SMA — confirmed downtrend`); }
  else { reasons.push(`Mixed signals — price near moving averages, sideways consolidation`); }

  // RSI
  if (rsi > 70) { score -= 8; reasons.push(`RSI overbought at ${rsi} — potential pullback risk`); }
  else if (rsi > 60) { score += 5; reasons.push(`RSI bullish at ${rsi} — momentum building`); }
  else if (rsi < 30) { score += 10; reasons.push(`RSI oversold at ${rsi} — potential reversal opportunity`); }
  else if (rsi < 40) { score -= 5; reasons.push(`RSI weak at ${rsi} — momentum fading`); }
  else { reasons.push(`RSI neutral at ${rsi}`); }

  // 7-day momentum
  if (change7d > 3) { score += 8; reasons.push(`Strong 7-day rally of ${change7d.toFixed(1)}%`); }
  else if (change7d > 1) { score += 4; reasons.push(`Positive 7-day move of ${change7d.toFixed(1)}%`); }
  else if (change7d < -3) { score -= 8; reasons.push(`Sharp 7-day decline of ${change7d.toFixed(1)}%`); }
  else if (change7d < -1) { score -= 4; reasons.push(`Negative 7-day move of ${change7d.toFixed(1)}%`); }

  // Price vs SMA distance
  const sma20pct = ((price - sma20) / sma20) * 100;
  if (sma20pct > 5) { score += 3; reasons.push(`Trading ${sma20pct.toFixed(1)}% above 20-day avg — strong but extended`); }
  else if (sma20pct < -5) { score -= 3; reasons.push(`Trading ${Math.abs(sma20pct).toFixed(1)}% below 20-day avg — weak`); }

  score = Math.max(0, Math.min(100, score));

  let signal: LiveMetal['signal'];
  if (score >= 75) signal = 'STRONG BUY';
  else if (score >= 60) signal = 'BUY';
  else if (score >= 40) signal = 'HOLD';
  else if (score >= 25) signal = 'SELL';
  else signal = 'STRONG SELL';

  return { signal, trend, score, reasons };
}

function findSupportResistance(closes: number[]): { support: number; resistance: number } {
  const recent = closes.slice(-30);
  const sorted = [...recent].sort((a, b) => a - b);
  // ponytail: simple percentile-based S/R, upgrade to pivot points if needed
  const support = sorted[Math.floor(sorted.length * 0.15)];
  const resistance = sorted[Math.floor(sorted.length * 0.85)];
  return { support: Math.round(support * 100) / 100, resistance: Math.round(resistance * 100) / 100 };
}

function generateThesis(name: string, signal: string, rsi: number, _change7d: number, priceInr: number): string {
  if (signal.includes('BUY')) {
    return `${name} showing bullish setup. Consider accumulating at ₹${Math.round(priceInr * 0.97).toLocaleString()}/g dips. RSI at ${rsi} supports further upside.`;
  } else if (signal.includes('SELL')) {
    return `${name} under pressure. Avoid fresh positions. Wait for RSI to drop below 30 or price to stabilize before considering entry.`;
  }
  return `${name} in consolidation. No clear directional bias. Wait for breakout above resistance or breakdown below support for next trade.`;
}

// ponytail: fetch Indian retail gold/silver prices from GoodReturns (same source as Gullak/PhonePe/CRED)
interface IndianRetailPrices {
  gold24k: number | null;  // per gram
  gold22k: number | null;
  silver: number | null;    // per gram
}

async function fetchIndianRetailPrices(): Promise<IndianRetailPrices> {
  const result: IndianRetailPrices = { gold24k: null, gold22k: null, silver: null };
  try {
    const [goldHtml, silverHtml] = await Promise.all([
      fetch('/api/goodreturns/gold-rates/').then(r => r.text()).catch(() => ''),
      fetch('/api/goodreturns/silver-rates/').then(r => r.text()).catch(() => ''),
    ]);

    // Gold: parse currentMetalPrices JS variable
    const goldMatch = goldHtml.match(/currentMetalPrices\s*=\s*\{[^}]*'24'\s*:\s*(\d+)[^}]*'22'\s*:\s*(\d+)/);
    if (goldMatch) {
      result.gold24k = parseInt(goldMatch[1]);
      result.gold22k = parseInt(goldMatch[2]);
    } else {
      // Fallback: parse from text "₹15,497 per gram for 24 karat"
      const textMatch = goldHtml.match(/&#8377;([\d,]+)\s*per gram\s*for\s*24/);
      if (textMatch) result.gold24k = parseInt(textMatch[1].replace(/,/g, ''));
    }

    // Silver: parse from text
    const silverMatch = silverHtml.match(/&#8377;([\d,]+)\s*per gram/i)
      || silverHtml.match(/₹\s*([\d,]+)\s*per gram/i);
    if (silverMatch) result.silver = parseInt(silverMatch[1].replace(/,/g, ''));

    console.log('[Metals] Indian retail prices — Gold 24K:', result.gold24k, 'Silver:', result.silver);
  } catch (e) {
    console.warn('[Metals] GoodReturns fetch failed:', e);
  }
  return result;
}

async function fetchChart(ticker: string): Promise<{ closes: number[]; highs: number[]; lows: number[]; timestamps: number[]; meta: any } | null> {
  try {
    const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    const q = result.indicators.quote[0];
    return {
      closes: (q.close || []).map((v: any) => v ?? 0).filter(Boolean),
      highs: (q.high || []).map((v: any) => v ?? 0).filter(Boolean),
      lows: (q.low || []).map((v: any) => v ?? 0).filter(Boolean),
      timestamps: result.timestamp || [],
      meta: result.meta,
    };
  } catch { return null; }
}

export async function fetchLiveMetals(): Promise<LiveMetal[]> {
  // Fetch Indian retail prices + USDINR rate in parallel
  const [indianPrices, usdChart] = await Promise.all([
    fetchIndianRetailPrices(),
    fetchChart('USDINR=X'),
  ]);
  const usdInr = usdChart?.meta?.regularMarketPrice || 85;

  // Map Indian retail prices by metal name
  const indianPriceMap: Record<string, number> = {};
  if (indianPrices.gold24k) indianPriceMap['Gold'] = indianPrices.gold24k;
  if (indianPrices.silver) indianPriceMap['Silver'] = indianPrices.silver;

  // Fetch all metals in parallel
  const results = await Promise.allSettled(
    METALS.map(async (cfg): Promise<LiveMetal | null> => {
      const chart = await fetchChart(cfg.ticker);
      if (!chart || chart.closes.length < 20) return null;

      const { closes, timestamps, meta } = chart;
      const priceUSD = meta.regularMarketPrice || closes[closes.length - 1];
      const prevCloseUSD = meta.chartPreviousClose || meta.previousClose || closes[closes.length - 2] || priceUSD;

      // Convert to INR per gram (COMEX base)
      let comexPricePerGram: number;
      let pricePerOz: number;
      if (cfg.ticker === 'HG=F') {
        comexPricePerGram = (priceUSD * usdInr) / GRAMS_PER_LB;
        pricePerOz = priceUSD * usdInr;
      } else {
        pricePerOz = priceUSD * usdInr;
        comexPricePerGram = pricePerOz / GRAMS_PER_TROY_OZ;
      }

      // Use Indian retail price for Gold/Silver if available
      const hasIndianPrice = cfg.name in indianPriceMap;
      const pricePerGram = indianPriceMap[cfg.name] ?? comexPricePerGram;
      // ponytail: compute India premium multiplier to scale COMEX historical to Indian levels
      const indiaPremium = hasIndianPrice ? pricePerGram / comexPricePerGram : 1;

      // Convert all closes to INR/gram with India premium applied
      const closesInr = closes.map(c => {
        const base = cfg.ticker === 'HG=F' ? (c * usdInr) / GRAMS_PER_LB : (c * usdInr) / GRAMS_PER_TROY_OZ;
        return base * indiaPremium;
      });

      // Compute technicals (on India-adjusted prices for Gold/Silver)
      const rsi = computeRSI(closesInr);
      const sma20 = computeSMA(closesInr, 20);
      const sma50 = computeSMA(closesInr, 50);
      const { support, resistance } = findSupportResistance(closesInr);

      // Changes
      const change24hPct = ((priceUSD - prevCloseUSD) / prevCloseUSD) * 100;
      const change24h = (change24hPct / 100) * pricePerGram;
      const price7dAgo = closesInr[closesInr.length - 6] || closesInr[0];
      const price30dAgo = closesInr[closesInr.length - 23] || closesInr[0];
      const change7dPct = ((pricePerGram - price7dAgo) / price7dAgo) * 100;
      const change30dPct = ((pricePerGram - price30dAgo) / price30dAgo) * 100;

      // 52-week high/low from available data (3 months, best we have)
      const high52w = Math.max(...closesInr) * 1.02; // approximate
      const low52w = Math.min(...closesInr) * 0.98;

      // Signal
      const { signal, trend, score, reasons } = generateSignal(rsi, pricePerGram, sma20, sma50, change7dPct);

      // Price history for chart (last 60 days)
      const priceHistory = closesInr.slice(-60).map((p, i) => {
        const ts = timestamps[timestamps.length - 60 + i];
        const d = ts ? new Date(ts * 1000) : new Date();
        return { date: d.toISOString().slice(5, 10), price: Math.round(p * 100) / 100 };
      });

      const thesis = generateThesis(cfg.name, signal, rsi, change7dPct, pricePerGram);

      return {
        name: cfg.name,
        symbol: cfg.symbol,
        ticker: cfg.ticker,
        icon: cfg.icon,
        pricePerGram: Math.round(pricePerGram * 100) / 100,
        pricePerOz: Math.round(pricePerOz),
        priceSource: hasIndianPrice ? 'Indian Retail (GoodReturns)' as const : 'COMEX Futures (converted)' as const,
        priceUSD: Math.round(priceUSD * 100) / 100,
        change24h: Math.round(change24h * 100) / 100,
        change24hPct: Math.round(change24hPct * 100) / 100,
        change7dPct: Math.round(change7dPct * 100) / 100,
        change30dPct: Math.round(change30dPct * 100) / 100,
        high52w: Math.round(high52w * 100) / 100,
        low52w: Math.round(low52w * 100) / 100,
        signal, trend, rsi,
        sma20: Math.round(sma20 * 100) / 100,
        sma50: Math.round(sma50 * 100) / 100,
        support, resistance,
        aiScore: score,
        priceHistory,
        reasons,
        investmentThesis: thesis,
        bestForm: cfg.bestForm,
        lastUpdated: new Date(),
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<LiveMetal> => r.status === 'fulfilled' && r.value != null)
    .map(r => r.value!);
}
