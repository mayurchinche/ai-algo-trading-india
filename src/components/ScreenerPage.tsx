import { useEffect, useMemo, useState } from 'react';
import { fetchScorecards, readable, type Scorecards } from '../services/scorecards';
import { COLUMN_GROUPS, SCREENER_COLUMNS, columnsFor, csvFileName, filterCompanies, formatCell, parseColumnSelection, screenerCsv, sortCompanies, type SortState } from '../services/screener';
import { formatIST } from '../services/tradingTime';

const STORAGE_KEY = 'screener_columns_v1';
const storedColumns = () => { try { return parseColumnSelection(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { return parseColumnSelection(null); } };

export function ScreenerTable({ data, columnIds, sort, onSort, search = '', supportedOnly = false }: { data: Scorecards; columnIds: string[]; sort: SortState; onSort?: (s: SortState) => void; search?: string; supportedOnly?: boolean }) {
 const columns = columnsFor(columnIds), rows = sortCompanies(filterCompanies(data.companies, search, supportedOnly), sort);
 const header = (id: string, label: string) => <button aria-pressed={sort.column === id} onClick={() => onSort?.({ column: id, direction: sort.column === id && sort.direction === 'desc' ? 'asc' : 'desc' })}>{label}{sort.column === id ? (sort.direction === 'desc' ? ' ↓' : ' ↑') : ''}</button>;
 if (!rows.length) return <p className="py-8 text-sm text-[var(--text-muted)]">No companies match.</p>;
 return <div className="overflow-x-auto"><table className="data-table">
  <thead><tr><th>Symbol</th><th>Year end</th>{columns.map(c => <th key={c.id} className="text-right">{header(c.id, c.label)}</th>)}</tr></thead>
  <tbody>{rows.map(c => <tr key={c.symbol}>
   <td className="font-semibold">{c.symbol}</td>
   <td className="whitespace-nowrap">{c.basis ? `${c.basis.period.end} · ${c.basis.scope === 'Consolidated' ? 'cons.' : 'stand.'}` : <span className="text-[var(--text-muted)]">No supported filing</span>}</td>
   {columns.map(col => { const v = col.value(c); return <td key={col.id} className="text-right font-mono" title={v === null ? readable(col.status(c)) : undefined}>{formatCell(v, col.unit)}</td>; })}
  </tr>)}</tbody>
 </table></div>;
}

export function ScreenerPage() {
 const [data, setData] = useState<Scorecards | null>(null);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(true);
 const [revision, setRevision] = useState(0);
 const [columnIds, setColumnIds] = useState<string[]>(storedColumns);
 const [sort, setSort] = useState<SortState>({ column: 'score:value', direction: 'desc' });
 const [search, setSearch] = useState('');
 const [supportedOnly, setSupportedOnly] = useState(false);
 useEffect(() => {
  const controller = new AbortController(); setLoading(true); setError('');
  fetchScorecards('NIFTY50', controller.signal).then(d => { if (!controller.signal.aborted) setData(d); }).catch(e => { if (!controller.signal.aborted) { setData(null); setError(e instanceof Error ? e.message : 'Screener data unavailable'); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [revision]);
 useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(columnIds)); } catch { /* storage unavailable: selection lasts for this session */ } }, [columnIds]);
 const toggle = (id: string) => setColumnIds(ids => ids.includes(id) ? (ids.length > 1 ? ids.filter(x => x !== id) : ids) : SCREENER_COLUMNS.map(c => c.id).filter(x => x === id || ids.includes(x)));
 const visibleCount = useMemo(() => data ? filterCompanies(data.companies, search, supportedOnly).length : 0, [data, search, supportedOnly]);
 function exportCsv() {
  if (!data) return;
  const rows = sortCompanies(filterCompanies(data.companies, search, supportedOnly), sort);
  const url = URL.createObjectURL(new Blob([screenerCsv(rows, columnsFor(columnIds))], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = csvFileName(data); a.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
 }
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Screener</h2><p>{data ? `${data.universe.name} (NSE list of ${data.universe.asOf}) · computed ${formatIST(data.computedAt)}` : 'Fundamentals, growth, returns and style scores in one table.'}</p></div>
   <div className="flex gap-2"><button className="btn btn-secondary" disabled={!data} onClick={exportCsv}>Export CSV</button><button className="btn btn-secondary" disabled={loading} onClick={() => setRevision(r => r + 1)}>{loading ? 'Loading…' : 'Refresh'}</button></div></div>
  {data && <section className="notice" role="note"><p className="text-sm"><strong>{data.disclaimer}</strong> Blank cells are unavailable, not zero; hover for the reason. Market cap is in ₹ crore, from the previous close and filed paid-up capital ÷ face value; it may lag later splits, bonuses or buybacks.</p></section>}
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {data && <details className="card research-method"><summary>Columns ({columnIds.length} of {SCREENER_COLUMNS.length})</summary><div className="grid md:grid-cols-4 gap-4 text-sm">
   {COLUMN_GROUPS.map(group => <fieldset key={group}><legend className="font-semibold">{group}</legend>{SCREENER_COLUMNS.filter(c => c.group === group).map(c => <label key={c.id} className="flex gap-2 items-center"><input type="checkbox" checked={columnIds.includes(c.id)} onChange={() => toggle(c.id)} />{c.label}</label>)}</fieldset>)}
  </div></details>}
  {data && <section className="card space-y-3">
   <div className="research-filters"><label className="research-search">Search<input type="search" placeholder="Symbol or ISIN" value={search} onChange={e => setSearch(e.target.value)} /></label><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={supportedOnly} onChange={e => setSupportedOnly(e.target.checked)} />Only companies with a supported filing</label><span className="text-sm text-[var(--text-muted)]">{visibleCount} of {data.companies.length}</span></div>
   <ScreenerTable data={data} columnIds={columnIds} sort={sort} onSort={setSort} search={search} supportedOnly={supportedOnly} />
  </section>}
 </div>;
}
