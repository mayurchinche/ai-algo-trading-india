import { SCREENER_COLUMNS } from './screener';
import type { CompanyScorecard } from './scorecards';
import type { DailyCloses } from '../../shared/basketPerformance';
import { fetchHistorical } from './stockDiscovery';

export const BASKETS_KEY = 'baskets_v1';
export const MAX_BASKETS = 20, MAX_FILTERS = 8, MAX_MEMBERS = 30;
export interface ScreenFilter { column: string; op: 'gte' | 'lte'; value: number }
export interface Screen { filters: ScreenFilter[]; sortBy: string; limit: number }
export interface Basket { id: string; name: string; createdAt: string; universe: string; screen: Screen; members: { symbol: string; isin: string }[]; fdRatePct: number }

const columnIds = new Set(SCREENER_COLUMNS.map(c => c.id));
const columnOf = (id: string) => SCREENER_COLUMNS.find(c => c.id === id)!;
// A filter passes only on an available value: missing data never qualifies a company.
export function applyScreen(companies: CompanyScorecard[], screen: Screen) {
 const passes = (c: CompanyScorecard) => screen.filters.every(f => { const v = columnOf(f.column).value(c); return v !== null && (f.op === 'gte' ? v >= f.value : v <= f.value); });
 const sortCol = columnOf(screen.sortBy);
 return companies.filter(passes).filter(c => sortCol.value(c) !== null)
  .sort((a, b) => sortCol.value(b)! - sortCol.value(a)! || a.symbol.localeCompare(b.symbol)).slice(0, screen.limit);
}
export function validateScreen(s: unknown): Screen {
 if (!s || typeof s !== 'object') throw new Error('Invalid screen');
 const { filters, sortBy, limit } = s as Screen;
 if (!Array.isArray(filters) || filters.length > MAX_FILTERS) throw new Error(`Up to ${MAX_FILTERS} filters`);
 for (const f of filters) if (!f || !columnIds.has(f.column) || !['gte', 'lte'].includes(f.op) || typeof f.value !== 'number' || !Number.isFinite(f.value)) throw new Error('Invalid filter');
 if (!columnIds.has(sortBy)) throw new Error('Invalid sort column');
 if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMBERS) throw new Error(`Limit must be 1 to ${MAX_MEMBERS}`);
 return { filters: filters.map(f => ({ column: f.column, op: f.op, value: f.value })), sortBy, limit };
}
function validateBasket(b: unknown): Basket | null {
 try {
  const x = b as Basket;
  if (typeof x.id !== 'string' || typeof x.name !== 'string' || !x.name.trim() || x.name.length > 60 || !Number.isFinite(Date.parse(x.createdAt))) return null;
  if (!Array.isArray(x.members) || !x.members.length || x.members.length > MAX_MEMBERS || x.members.some(m => typeof m?.symbol !== 'string' || typeof m?.isin !== 'string')) return null;
  if (!(x.fdRatePct >= 0 && x.fdRatePct <= 20)) return null;
  return { ...x, screen: validateScreen(x.screen) };
 } catch { return null; }
}
// Stored baskets are re-validated on load; unusable entries are dropped.
export function loadBaskets(storage: Pick<Storage, 'getItem'> = localStorage): Basket[] {
 try { const v = JSON.parse(storage.getItem(BASKETS_KEY) ?? '[]'); return Array.isArray(v) ? v.map(validateBasket).filter((b): b is Basket => !!b).slice(0, MAX_BASKETS) : []; } catch { return []; }
}
export function saveBaskets(baskets: Basket[], storage: Pick<Storage, 'setItem'> = localStorage) { storage.setItem(BASKETS_KEY, JSON.stringify(baskets.slice(0, MAX_BASKETS))); }
export const istDate = (ms: number) => new Date(ms + 19800000).toISOString().slice(0, 10);

type History = Awaited<ReturnType<typeof fetchHistorical>>;
export async function loadCloses(symbols: string[], fetch: (yahooSymbol: string) => Promise<History> = s => fetchHistorical(s)) {
 const closes = new Map<string, DailyCloses>();let next = 0;
 await Promise.all(Array.from({ length: Math.min(5, symbols.length) }, async () => { while (next < symbols.length) { const s = symbols[next++]; try { const h = await fetch(s.startsWith('^') ? s : s + '.NS'); if (h?.dates.length) closes.set(s, { dates: h.dates, closes: h.closes }); } catch { /* missing history is reported by basketPerformance */ } } }));
 return closes;
}
