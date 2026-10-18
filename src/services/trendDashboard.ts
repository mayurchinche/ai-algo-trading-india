import { computeTrendScore, type TrendResult } from '../../shared/trendScore';
import { fetchHistorical } from './stockDiscovery';

export type TrendTab = 'ALL' | 'BULLISH' | 'TREND_START' | 'TREND_END';
export type TrendRow =
 | { symbol: string; status: 'SCORED'; trend: TrendResult }
 | { symbol: string; status: 'INSUFFICIENT_HISTORY' | 'DATA_UNAVAILABLE' | 'INVALID_HISTORY' };

type History = Awaited<ReturnType<typeof fetchHistorical>>;
// Completed daily bars only: fetchHistorical drops today's in-progress session.
export async function loadTrendRow(symbol: string, fetch: (yahooSymbol: string) => Promise<History> = s => fetchHistorical(s)): Promise<TrendRow> {
 let history: History;
 try { history = await fetch(symbol + '.NS'); } catch { return { symbol, status: 'DATA_UNAVAILABLE' }; }
 if (!history || !history.dates.length) return { symbol, status: 'DATA_UNAVAILABLE' };
 let trend: TrendResult;
 try { trend = computeTrendScore({ dates: history.dates, close: history.closes, high: history.highs, low: history.lows }); }
 catch { return { symbol, status: 'INVALID_HISTORY' }; }
 return trend.latest.status === 'SCORED' ? { symbol, status: 'SCORED', trend } : { symbol, status: 'INSUFFICIENT_HISTORY' };
}

// Bounded concurrency; each finished row is reported as soon as it is ready.
export async function loadTrendRows(symbols: readonly string[], onRow: (row: TrendRow) => void, { concurrency = 5, load = loadTrendRow }: { concurrency?: number; load?: (symbol: string) => Promise<TrendRow> } = {}) {
 let next = 0;
 await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, async () => {
  while (next < symbols.length) { const symbol = symbols[next++]; onRow(await load(symbol)); }
 }));
}

export function matchesTab(row: TrendRow, tab: TrendTab) {
 if (tab === 'ALL') return true;
 if (row.status !== 'SCORED' || row.trend.latest.status !== 'SCORED') return false;
 return tab === 'BULLISH' ? row.trend.latest.zone === 'BULLISH' : row.trend.latest.category === tab;
}
// Highest score first; rows without a score keep symbol order at the end.
export function sortTrendRows(rows: TrendRow[]) {
 const score = (r: TrendRow) => r.status === 'SCORED' && r.trend.latest.status === 'SCORED' ? r.trend.latest.score : -1;
 return [...rows].sort((a, b) => score(b) - score(a) || a.symbol.localeCompare(b.symbol));
}
// Truncate, never round: 6.97 must not display as 7.0 next to a neutral zone.
export const displayScore = (score: number) => (Math.floor(score * 10) / 10).toFixed(1);
