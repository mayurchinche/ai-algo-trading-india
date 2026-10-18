import type { CompanyScorecard, Scorecards, StyleId } from './scorecards';

export type ColumnGroup = 'Price and returns' | 'Scores' | 'Fundamentals' | 'Growth';
export interface ScreenerColumn { id: string; label: string; group: ColumnGroup; unit: '%' | 'x' | '₹' | '₹ cr' | 'score'; value: (c: CompanyScorecard) => number | null; status: (c: CompanyScorecard) => string }

const metric = (id: string, label: string, group: ColumnGroup, unit: ScreenerColumn['unit']): ScreenerColumn => ({
 id, label, group, unit,
 value: c => { const m = c.metrics[id]; return m && m.value !== null && Number.isFinite(m.value) ? m.value : null; },
 status: c => c.metrics[id]?.status ?? 'NOT_AVAILABLE',
});
const style = (id: StyleId | 'composite', label: string): ScreenerColumn => ({
 id: 'score:' + id, label, group: 'Scores', unit: 'score',
 value: c => id === 'composite' ? c.composite.score : c.styles.find(s => s.id === id)?.score ?? null,
 status: c => id === 'composite' ? c.composite.status : c.styles.find(s => s.id === id)?.status ?? 'NOT_AVAILABLE',
});
// One owner for every column's label, group, unit and value; the table and the CSV both read from here.
export const SCREENER_COLUMNS: readonly ScreenerColumn[] = Object.freeze([
 metric('close', 'Close', 'Price and returns', '₹'), { ...metric('marketCap', 'Market cap', 'Price and returns', '₹ cr'), value: c => { const m = c.metrics.marketCap; return m && m.value !== null && Number.isFinite(m.value) ? m.value / 1e7 : null; } }, metric('return12m', '12M return', 'Price and returns', '%'), metric('belowHigh', 'Below 52W high', 'Price and returns', '%'),
 style('value', 'Value'), style('garp', 'GARP'), style('growth', 'Growth'), style('compounder', 'Compounder'), style('momentum', 'Momentum'), style('composite', 'Composite'),
 metric('pe', 'P/E', 'Fundamentals', 'x'), metric('peg', 'PEG', 'Fundamentals', 'x'), metric('roce', 'ROCE', 'Fundamentals', '%'), metric('roe', 'ROE', 'Fundamentals', '%'), metric('debtToEquity', 'Debt/equity', 'Fundamentals', 'x'),
 metric('revenueGrowth1y', 'Sales 1Y', 'Growth', '%'), metric('revenueGrowth3y', 'Sales 3Y CAGR', 'Growth', '%'), metric('revenueGrowth5y', 'Sales 5Y CAGR', 'Growth', '%'),
 metric('profitGrowth1y', 'Profit 1Y', 'Growth', '%'), metric('profitGrowth3y', 'Profit 3Y CAGR', 'Growth', '%'), metric('profitGrowth5y', 'Profit 5Y CAGR', 'Growth', '%'),
]);
export const COLUMN_GROUPS: readonly ColumnGroup[] = ['Price and returns', 'Scores', 'Fundamentals', 'Growth'];
export const DEFAULT_COLUMNS: readonly string[] = ['close', 'marketCap', 'return12m', 'score:value', 'score:composite', 'pe', 'roce', 'roe', 'debtToEquity', 'revenueGrowth1y', 'profitGrowth1y'];
const byId = new Map(SCREENER_COLUMNS.map(c => [c.id, c]));
// Unknown or duplicate stored ids are dropped; an unusable selection falls back to the defaults.
export function parseColumnSelection(raw: unknown): string[] {
 if (!Array.isArray(raw)) return [...DEFAULT_COLUMNS];
 const ids = [...new Set(raw.filter((id): id is string => typeof id === 'string' && byId.has(id)))];
 return ids.length ? ids : [...DEFAULT_COLUMNS];
}
export const columnsFor = (ids: readonly string[]) => ids.map(id => byId.get(id)).filter((c): c is ScreenerColumn => !!c);

export type SortState = { column: string; direction: 'asc' | 'desc' };
// Unavailable values always sort last, whichever direction is chosen; ties keep symbol order.
export function sortCompanies(companies: CompanyScorecard[], sort: SortState) {
 const col = byId.get(sort.column), sign = sort.direction === 'asc' ? 1 : -1;
 return [...companies].sort((a, b) => {
  const x = col?.value(a) ?? null, y = col?.value(b) ?? null;
  if (x === null || y === null) return x === y ? a.symbol.localeCompare(b.symbol) : x === null ? 1 : -1;
  return (x - y) * sign || a.symbol.localeCompare(b.symbol);
 });
}
export function filterCompanies(companies: CompanyScorecard[], search: string, supportedOnly: boolean) {
 const q = search.trim().toUpperCase();
 return companies.filter(c => (!supportedOnly || c.basis) && (!q || c.symbol.includes(q) || c.isin.includes(q)));
}
export function formatCell(value: number | null, unit: ScreenerColumn['unit']) {
 if (value === null) return '—';
 if (unit === 'score') return String(Math.round(value));
 if (unit === '₹') return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
 if (unit === '₹ cr') return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
 return value.toFixed(unit === '%' ? 1 : 2) + (unit === '%' ? '%' : '');
}

// RFC 4180 quoting. Text that a spreadsheet would run as a formula is prefixed with an apostrophe;
// numbers are written raw so negative values stay numeric.
const csvText = (v: string) => { const safe = /^[=+\-@\t\r]/.test(v) ? "'" + v : v; return /[",\r\n]/.test(safe) ? '"' + safe.replaceAll('"', '""') + '"' : safe; };
const csvNumber = (v: number | null) => v === null ? '' : String(Math.round(v * 1e4) / 1e4);
export function screenerCsv(companies: CompanyScorecard[], columns: readonly ScreenerColumn[]) {
 const unit = (c: ScreenerColumn) => c.unit === 'score' ? ' (0-100)' : c.unit === '₹' ? ' (INR)' : c.unit === '₹ cr' ? ' (INR crore)' : c.unit === '%' ? ' (%)' : ' (x)';
 const header = ['Symbol', 'ISIN', 'Year end', 'Basis', ...columns.map(c => c.label + unit(c))];
 const rows = companies.map(c => [csvText(c.symbol), csvText(c.isin), csvText(c.basis?.period.end ?? ''), csvText(c.basis?.scope ?? 'No supported annual filing'), ...columns.map(col => csvNumber(col.value(c)))]);
 return [header.map(csvText), ...rows].map(r => r.join(',')).join('\r\n') + '\r\n';
}
export const csvFileName = (data: Scorecards) => `${data.universe.name.replace(/[^A-Za-z0-9]+/g, '').toLowerCase()}-screener-${data.computedAt.slice(0, 10)}.csv`;
