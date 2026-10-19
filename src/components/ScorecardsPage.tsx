import { useEffect, useState } from 'react';
import { fetchScorecards, formatMetric, readable, scoreFor, sortScorecards, type CompanyScorecard, type Scorecards, type SortKey } from '../services/scorecards';
import { formatIST } from '../services/tradingTime';
import { StyleVerdicts } from './StyleVerdicts';
import { styleVerdicts } from '../../shared/styleVerdicts';

const columns: [string, string, '%' | 'x'][] = [['roce', 'ROCE', '%'], ['roe', 'ROE', '%'], ['debtToEquity', 'D/E', 'x'], ['pe', 'P/E', 'x'], ['revenueGrowth1y', 'Rev 1y', '%'], ['profitGrowth1y', 'Profit 1y', '%']];

function ScoreCell({ company, id }: { company: CompanyScorecard; id: SortKey }) {
 const score = scoreFor(company, id), style = company.styles.find(s => s.id === id);
 const title = id === 'composite' ? (company.composite.score === null ? `Needs at least 3 scored styles (${company.composite.styles.length})` : `Mean of ${company.composite.styles.join(', ')}`) : style ? `${Math.round(style.coverage * 100)}% of weight has data${style.missing.length ? '; missing ' + style.missing.join(', ') : ''}` : '';
 return <td className="text-center font-mono" title={title}>{score === null ? <span className="text-[var(--text-muted)]">—</span> : Math.round(score)}{style?.warnings.length ? ' *' : ''}</td>;
}

export function ScorecardTable({ data, sort, onSort, selected, onSelect }: { data: Scorecards; sort: SortKey; onSort?: (k: SortKey) => void; selected?: string; onSelect?: (symbol: string) => void }) {
 const head = (id: SortKey, label: string) => <th key={id} className="text-center"><button className={sort === id ? 'font-semibold underline' : ''} aria-pressed={sort === id} onClick={() => onSort?.(id)}>{label}</button></th>;
 return <div className="overflow-x-auto"><table className="data-table">
  <thead><tr><th>Symbol</th><th>Year end</th>{columns.map(([, l]) => <th key={l} className="text-right">{l}</th>)}{data.styles.map(s => head(s.id, s.label))}{head('composite', 'Composite')}</tr></thead>
  <tbody>{sortScorecards(data.companies, sort).map(c => <tr key={c.symbol} aria-selected={selected === c.symbol} onClick={() => onSelect?.(c.symbol)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
   <td className="font-semibold">{c.symbol}</td>
   <td>{c.basis ? `${c.basis.period.end} · ${c.basis.scope === 'Consolidated' ? 'cons.' : 'stand.'}` : <span className="text-[var(--text-muted)]">No supported annual filing</span>}</td>
   {columns.map(([key, l, unit]) => <td key={l} className="text-right font-mono" title={c.metrics[key]?.value === null ? readable(c.metrics[key]?.status ?? 'unavailable') : undefined}>{formatMetric(c.metrics[key], unit)}</td>)}
   {data.styles.map(s => <ScoreCell key={s.id} company={c} id={s.id} />)}<ScoreCell company={c} id="composite" />
  </tr>)}</tbody>
 </table></div>;
}

export function ScorecardDetail({ company }: { company: CompanyScorecard }) {
 return <section className="card space-y-4">
  <h3>{company.symbol} · {company.basis ? `${company.basis.scope}, year ending ${company.basis.period.end}, ${company.peerGroup?.size} companies in peer group` : 'no supported annual filing'}</h3>
  <StyleVerdicts verdicts={styleVerdicts(company)} />
  <div className="grid md:grid-cols-2 gap-4">{company.styles.map(s => <div key={s.id} className="border rounded-lg p-3 space-y-1">
   <p><strong>{s.label}</strong>: {s.score !== null ? Math.round(s.score) + ' / 100' : `not scored (${Math.round(s.coverage * 100)}% of weight has data${s.partialScore !== null ? `; partial ${Math.round(s.partialScore)}` : ''})`}</p>
   {s.criteria.map(c => <p className="text-sm" key={c.metric}>{c.label} ({c.weight}%, {c.direction} is better): {c.status === 'RANKED' ? `${c.value!.toFixed(2)} → percentile ${Math.round(c.percentile!)} of ${c.peers}` : c.status === 'TOO_FEW_PEERS' ? `only ${c.peers} peers have data` : readable(c.inputStatus)}</p>)}
   {!!s.warnings.length && <p className="text-xs">* Inputs filed under different symbols (rename, merger or demerger); values are not adjusted.</p>}
  </div>)}</div>
  {!!company.sources.length && <div className="text-sm space-y-1"><p className="font-semibold">Source filings</p>{company.sources.map(s => <p key={s.url}><a className="underline break-all" href={s.url} target="_blank" rel="noopener noreferrer">{s.symbol ?? company.symbol} · published {formatIST(s.publishedAt)}</a></p>)}</div>}
 </section>;
}

export function ScorecardsPage() {
 const [data, setData] = useState<Scorecards | null>(null);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(true);
 const [revision, setRevision] = useState(0);
 const [sort, setSort] = useState<SortKey>('value');
 const [selected, setSelected] = useState<string>();
 useEffect(() => {
  const controller = new AbortController(); setLoading(true); setError('');
  fetchScorecards('NIFTY50', controller.signal).then(d => { if (!controller.signal.aborted) setData(d); }).catch(e => { if (!controller.signal.aborted) { setData(null); setError(e instanceof Error ? e.message : 'Scorecards unavailable'); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [revision]);
 const detail = data?.companies.find(c => c.symbol === selected);
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Investor-style scorecards</h2><p>{data ? `${data.universe.name} (NSE list of ${data.universe.asOf}) · computed ${formatIST(data.computedAt)}` : 'Fundamentals from NSE filings, ranked within each financial year.'}</p></div><button className="btn btn-secondary" disabled={loading} onClick={() => setRevision(r => r + 1)}>{loading ? 'Loading…' : 'Refresh'}</button></div>
  {data && <section className="notice space-y-1" role="note"><p><strong>{data.disclaimer}</strong></p><p className="text-sm">{data.coverage.withAnnualPeriod} of {data.coverage.companies} companies have a supported annual filing; {data.coverage.withPrice} have price history. A style is scored only when at least {Math.round(data.rules.minCoverage * 100)}% of its weight has data and each criterion has at least {data.rules.minPeers} peers.</p></section>}
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {data && <details className="card research-method"><summary>How scores are calculated</summary><div className="text-sm space-y-2">
   <p>Each criterion is a {data.rules.percentile}, among {data.rules.peerGroup}. A style score is the weighted mean of its ranked criteria. Composite: {data.rules.composite}, when at least {data.rules.minStylesForComposite} styles are scored.</p>
   {data.styles.map(s => <p key={s.id}><strong>{s.label}</strong> — {s.inspiration}: {s.criteria.map(c => `${c.label} ${c.weight}%`).join(', ')}.</p>)}
   <ul className="list-disc pl-5">{data.limitations.map(l => <li key={l}>{l}</li>)}</ul>
  </div></details>}
  {data && <section className="card space-y-3"><ScorecardTable data={data} sort={sort} onSort={setSort} selected={selected} onSelect={setSelected} /></section>}
  {detail && <ScorecardDetail company={detail} />}
 </div>;
}
