import type { Bar } from '../../shared/strategyConditions';
import type { StrategySpec } from '../../shared/strategySpec';
import { TIMEFRAME_MS } from '../../shared/specEngine';
import { fetchMarketJSON } from '../utils/fetchMarketJSON';

// Yahoo history per interval: intraday bars are limited to recent days by the provider.
export const BAR_SOURCES: Record<StrategySpec['timeframe'], { interval: string; range: string } | null> = {
 '1m': { interval: '1m', range: '7d' }, '3m': null, '5m': { interval: '5m', range: '60d' }, '15m': { interval: '15m', range: '60d' },
 '30m': { interval: '30m', range: '60d' }, '1h': { interval: '60m', range: '730d' }, '1d': { interval: '1d', range: '10y' },
};
const INDEX_SYMBOLS: Record<string, string> = { NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', FINNIFTY: 'NIFTY_FIN_SERVICE.NS', MIDCPNIFTY: 'NIFTY_MID_SELECT.NS' };
export const yahooSymbol = (u: StrategySpec['underlying']) => u.kind === 'index' ? INDEX_SYMBOLS[u.symbol] ?? null : u.symbol + (u.exchange === 'BSE' ? '.BO' : '.NS');

// Completed bars only (bar end not after now); invalid OHLC rows are counted, not repaired.
export function parseChartBars(json: unknown, timeframe: StrategySpec['timeframe'], now: number) {
 const r = (json as { chart?: { result?: { timestamp?: number[]; indicators?: { quote?: Record<string, (number | null)[]>[] } }[] } })?.chart?.result?.[0];
 const q = r?.indicators?.quote?.[0], ts = r?.timestamp;
 if (!q || !Array.isArray(ts)) return { bars: [] as Bar[], invalid: 0, incomplete: 0 };
 const tf = TIMEFRAME_MS[timeframe]; const bars: Bar[] = []; let invalid = 0, incomplete = 0;
 for (let i = 0; i < ts.length; i++) {
  const time = timeframe === '1d' ? Date.parse(new Date(ts[i] * 1000 + 19800000).toISOString().slice(0, 10) + 'T00:00:00+05:30') : ts[i] * 1000;
  const b = { time, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i], volume: q.volume?.[i] ?? 0 };
  if (![b.open, b.high, b.low, b.close].every(v => typeof v === 'number' && Number.isFinite(v)) || b.low! <= 0 || b.low! > Math.min(b.open!, b.close!) || b.high! < Math.max(b.open!, b.close!)) { invalid++; continue; }
  if ((timeframe === '1d' ? Date.parse(new Date(time + 19800000).toISOString().slice(0, 10) + 'T15:30:00+05:30') : time + tf) > now) { incomplete++; continue; }
  if (bars.length && time <= bars[bars.length - 1].time) { invalid++; continue; }
  bars.push(b as Bar);
 }
 return { bars, invalid, incomplete };
}
export async function fetchSpecBars(spec: StrategySpec, now = Date.now(), fetchJSON = fetchMarketJSON) {
 const source = BAR_SOURCES[spec.timeframe], symbol = yahooSymbol(spec.underlying);
 if (!source) throw new Error(`No history source for the ${spec.timeframe} timeframe`);
 if (!symbol) throw new Error(`No history symbol for ${spec.underlying.symbol}`);
 return { symbol, ...source, ...parseChartBars(await fetchJSON(`/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${source.interval}&range=${source.range}`), spec.timeframe, now) };
}
