import { fetchMarketJSON } from '../utils/fetchMarketJSON';

export interface LiveMetal {
  name: string; ticker: string; unit: string; priceUSD: number; quoteTime: string;
  priceHistory: { date: string; price: number }[];
  sma20: number; sma50: number; historyStart: string; historyEnd: string;
}
// Instrument identifiers are configuration, never substitute prices or contract terms.
const METALS = [
  { name: 'Gold', ticker: 'GC=F', unit: 'USD / troy ounce' },
  { name: 'Silver', ticker: 'SI=F', unit: 'USD / troy ounce' },
  { name: 'Platinum', ticker: 'PL=F', unit: 'USD / troy ounce' },
  { name: 'Palladium', ticker: 'PA=F', unit: 'USD / troy ounce' },
  { name: 'Copper', ticker: 'HG=F', unit: 'USD / pound' },
];
export function parseMetalChart(data: any, config: typeof METALS[number], now = Date.now()): LiveMetal {
  const result = data?.chart?.result?.[0], meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];
  if (!Number.isFinite(meta?.regularMarketPrice) || meta.regularMarketPrice <= 0
      || !Number.isFinite(meta?.regularMarketTime) || meta.regularMarketTime * 1000 > now + 5000
      || meta.currency !== 'USD' || !Array.isArray(result?.timestamp) || !Array.isArray(quote?.close)) {
    throw new Error(`${config.name}: provider price, timestamp, currency or history missing`);
  }
  // Filter complete aligned rows. Never fabricate dates for missing candles.
  const today = new Date(now).toISOString().slice(0, 10);
  const priceHistory = result.timestamp.flatMap((time: number, i: number) => {
    if (!Number.isFinite(time) || !Number.isFinite(quote.close[i]) || quote.close[i] <= 0) return [];
    const date = new Date(time * 1000).toISOString().slice(0, 10);
    return date < today ? [{date, price: quote.close[i]}] : [];
  });
  if (priceHistory.length < 50 || priceHistory.some((row: {date: string}, i: number) => i > 0 && row.date <= priceHistory[i-1].date)) throw new Error(`${config.name}: insufficient or unordered history`);
  const sma = (period: number) => priceHistory.slice(-period).reduce((sum: number, row: {price: number}) => sum + row.price, 0) / period;
  return { ...config, priceUSD: meta.regularMarketPrice, quoteTime: new Date(meta.regularMarketTime * 1000).toISOString(),
    priceHistory, sma20: sma(20), sma50: sma(50), historyStart: priceHistory[0].date, historyEnd: priceHistory.at(-1).date };
}
export async function fetchLiveMetals(): Promise<{metals: LiveMetal[]; errors: string[]}> {
  const results = await Promise.allSettled(METALS.map(async config => parseMetalChart(
    await fetchMarketJSON(`/api/yahoo/v8/finance/chart/${encodeURIComponent(config.ticker)}?interval=1d&range=1y`), config)));
  return {metals: results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []),
    errors: results.flatMap((r, i) => r.status === 'rejected' ? [`${METALS[i].name}: ${r.reason instanceof Error ? r.reason.message : 'Feed unavailable'}`] : [])};
}
