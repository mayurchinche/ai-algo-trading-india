import { useCallback, useEffect, useState } from 'react';
import { fetchOpeningGaps, type GapsResponse, type GapRow } from '../services/openingGaps';
import { openAnalysis, navigateTo } from '../services/specDraft';
import { formatIST } from '../services/tradingTime';

const pc = (v: number | null | undefined, d = 2) => v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
const STATUS: Record<GapRow['status'], string> = { PRE_OPEN: 'pre-open', HOLDING: 'holding', EXTENDING: 'extending', FILLED: 'filled' };
const STRAT: Record<string, string> = { PASSED: 'Validated', FAILED: 'Failed validation', INSUFFICIENT_EVIDENCE: 'Not enough trades yet', NOT_VALIDATED_YET: 'Validation pending' };
function Row({ r }: { r: GapRow }) {
 const [open, setOpen] = useState(false);
 const gapRule = r.validated.includes('short-term-gap-continuation');
 return <><tr onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }} aria-expanded={open}>
  <td className="font-semibold">{r.symbol}</td><td className={`text-right font-mono ${r.gapPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>{pc(r.gapPct)}</td><td className="text-right font-mono">{r.prevClose.toFixed(2)} → {r.iep.toFixed(2)}</td>
  <td className="text-right">{r.imbalance === null ? '—' : `${(r.imbalance * 100).toFixed(0)}%`}</td><td>{STATUS[r.status]}{r.fromOpenPct !== null ? ` (${pc(r.fromOpenPct)} from open)` : ''}</td>
  <td>{r.nearYearHigh === null ? '—' : r.aboveYearHighPreOpen ? 'above 52w high' : `${r.nearYearHigh.toFixed(1)}% below`}</td>
  <td>{r.catalyst.length ? r.catalyst[0].subject : '—'}</td>
  <td>{[...r.rules.map(x => `${x.strategyName}: ${x.state === 'IN_POSITION' ? 'in position' : `${x.trigger?.distancePct.toFixed(1)}% to trigger`}`), gapRule ? 'gap rule validated on this stock' : ''].filter(Boolean).join(' · ') || '—'}</td>
  <td className="text-right">{r.composite === null ? '—' : r.composite.toFixed(0)}</td></tr>
  {open && <tr><td colSpan={9} className="text-sm space-y-1">
   <p>Pre-open: {r.preOpenQty?.toLocaleString('en-IN') ?? '—'} shares matched · buy orders {r.buyQty?.toLocaleString('en-IN') ?? '—'} vs sell {r.sellQty?.toLocaleString('en-IN') ?? '—'} · 52-week range {r.yearLow ?? '—'}–{r.yearHigh ?? '—'}{r.ltp !== null ? ` · open ${r.open?.toFixed(2) ?? '—'}, now ${r.ltp.toFixed(2)}` : ''}</p>
   {r.catalyst.map((c, i) => <p key={i}>{c.time} · <strong>{c.subject}</strong> {c.text}{c.url && <> · <a href={c.url} target="_blank" rel="noreferrer">document</a></>}</p>)}
   <button className="btn btn-secondary" onClick={() => openAnalysis(r.symbol)}>Full analysis of {r.symbol}</button></td></tr>}</>;
}
export function OpeningGapsPage() {
 const [data, setData] = useState<GapsResponse>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [dir, setDir] = useState<'UP' | 'DOWN' | 'ALL'>('ALL');
 const load = useCallback(() => { setLoading(true); fetchOpeningGaps().then(d => { setData(d); setError(''); }).catch(e => setError(e instanceof Error ? e.message : 'Unavailable')).finally(() => setLoading(false)); }, []);
 useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
 const rows = (data?.rows ?? []).filter(r => dir === 'ALL' || r.direction === dir);
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Opening gaps</h2><p>F&amp;O stocks opening at least 1% away from the previous close, from the NSE pre-open session (09:00–09:08 IST), with the catalyst, technical position, peer rank and where the validated rules stand. After 09:15 each gap shows whether it is holding or filling.</p></div><button className="btn btn-secondary" disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button></div>
  {data && <section className="card space-y-2"><h3>How gaps are traded here</h3><ul className="text-sm list-disc pl-4">
   {data.strategies.map(s => <li key={s.id}><strong>{s.name}</strong>: {STRAT[s.status]}{s.pooled ? ` · ${s.pooled.stats.trades} trades, ${pc(s.pooled.stats.expectancyPct)} average after charges, profit factor ${s.pooled.stats.profitFactor?.toFixed(2) ?? '—'}` : ''}{s.status === 'PASSED' ? ` · validated on ${s.symbols.validated.length} stocks; its signals are paper-traded automatically` : ''}</li>)}
  </ul><p className="text-xs">The validated gap rule acts after the gap day closes (a gap that held on high volume), entering the next session. Intraday gap rules trade only once they pass validation.</p>
   <button className="btn btn-secondary" onClick={() => navigateTo('Signals')}>Open signals</button></section>}
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {data && <div className="flex flex-wrap items-center gap-3"><p className="text-sm">Pre-open {data.preOpenUpdatedAt ?? '—'} · {data.summary.gapUp} up ≥1% · {data.summary.gapDown} down ≥1% · {data.summary.flat} within 1% · updated {formatIST(data.computedAt)}</p>
   <nav className="segment-selector" aria-label="Direction">{(['ALL', 'UP', 'DOWN'] as const).map(d => <button key={d} aria-pressed={dir === d} onClick={() => setDir(d)}>{d === 'ALL' ? 'All gaps' : d === 'UP' ? 'Gap up' : 'Gap down'}</button>)}</nav></div>}
  {data && (rows.length ? <section className="card"><div className="overflow-x-auto"><table className="data-table text-sm"><thead><tr><th>Stock</th><th className="text-right">Gap</th><th className="text-right">Prev close → IEP</th><th className="text-right">Order imbalance</th><th>Since open</th><th>52-week high</th><th>Catalyst</th><th>Validated rules</th><th className="text-right">Peer score</th></tr></thead>
   <tbody>{rows.map(r => <Row key={r.symbol} r={r} />)}</tbody></table></div><p className="text-xs">Click a row for pre-open depth and the announcements. Order imbalance is (buy − sell) / (buy + sell) of pre-open orders. Peer score is the NIFTY 50 scorecard composite.</p></section> : <p className="text-sm">No F&amp;O stock gapped 1% or more{dir === 'ALL' ? '' : ' in this direction'}.</p>)}
  {data && <details className="text-xs"><summary>Sources and limitations</summary><ul>{Object.entries(data.sources).map(([k, v]) => <li key={k}>{k}: {v}</li>)}{data.limitations.map(l => <li key={l}>{l}</li>)}</ul></details>}
 </div>;
}
