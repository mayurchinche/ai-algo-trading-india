import { useCallback, useEffect, useState } from 'react';
import { listRuns, stopRun, type PaperRunSummary } from '../services/specPaper';
import { formatIST } from '../services/tradingTime';

const rupees = (n: number) => (n < 0 ? '−₹' : '₹') + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const when = (ms: number | null) => ms === null ? '—' : formatIST(new Date(ms).toISOString());
export function RunDetail({ run, onStop }: { run: PaperRunSummary; onStop?: () => void }) {
 return <section className="card space-y-3">
  <div className="page-title"><div><h3>{run.name}</h3><p>{run.underlying.symbol} · {run.timeframe} · {run.status.toLowerCase()} · capital {rupees(run.options.capital)} · costs {run.options.costBps} bps + ₹{run.options.costPerOrder}/order</p></div>{run.status === 'ACTIVE' && onStop && <button className="btn btn-secondary" onClick={onStop}>Stop run</button>}</div>
  <p className="text-sm">Net P&L {rupees(run.netPnl)} (realised {rupees(run.realized)}, costs {rupees(run.costs)}) · {run.trades} closed trades, {run.wins} winners · {run.orders} orders · position {run.position.toLowerCase()}{run.pending ? ` · pending ${run.pending.kind.toLowerCase()}${run.pending.reason ? ' (' + run.pending.reason.replaceAll('_', ' ').toLowerCase() + ')' : ''}` : ''}</p>
  <p className="text-xs">Cycles {run.paper.cycles} · last bar {when(run.paper.lastBarTime)} · last cycle {run.paper.lastCycleAt ? formatIST(run.paper.lastCycleAt) : 'none yet'}{run.paper.missedBars ? ` · ${run.paper.missedBars} bars passed between cycles without a decision` : ''}{run.paper.droppedEvents ? ` · ${run.paper.droppedEvents} older events trimmed` : ''}</p>
  {!!run.legs.length && <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Leg</th><th>Contract</th><th className="text-right">Units</th><th className="text-right">Entry</th><th className="text-right">Mark</th><th className="text-right">Stop</th><th className="text-right">Target</th><th>State</th></tr></thead><tbody>{run.legs.map(l => <tr key={l.id}><td>{l.dir === 1 ? 'Long' : 'Short'} {l.id}</td><td>{l.contract ?? '—'}</td><td className="text-right">{l.units}</td><td className="text-right font-mono">{l.entry.toFixed(2)}</td><td className="text-right font-mono">{l.mark.toFixed(2)}</td><td className="text-right font-mono">{l.stop?.toFixed(2) ?? '—'}</td><td className="text-right font-mono">{l.target?.toFixed(2) ?? '—'}</td><td>{l.open ? 'open' : (l.exitReason ?? 'closed').replaceAll('_', ' ').toLowerCase()}</td></tr>)}</tbody></table></div>}
  {!!run.entries.length && <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Entered</th><th>Exited</th><th>Reason</th><th className="text-right">P&L</th><th className="text-right">MAE / MFE</th></tr></thead><tbody>{[...run.entries].reverse().map(e => <tr key={e.time}><td>{when(e.time)}</td><td>{when(e.exitTime)}</td><td>{(e.reason ?? 'open').replaceAll('_', ' ').toLowerCase()}</td><td className="text-right font-mono">{e.pnl === null ? '—' : rupees(e.pnl)}</td><td className="text-right font-mono">{rupees(e.mae)} / {rupees(e.mfe)}</td></tr>)}</tbody></table></div>}
  <details><summary className="text-sm">Recent events ({run.events.length})</summary><ul className="text-xs font-mono">{[...run.events].reverse().map((e, i) => <li key={i}>{when(e.time)} {e.kind} {Object.entries(e).filter(([k]) => !['time', 'kind'].includes(k)).map(([k, v]) => `${k}=${typeof v === 'number' ? Math.round(v * 100) / 100 : JSON.stringify(v)}`).join(' ')}</li>)}</ul></details>
 </section>;
}
export function SpecPaperPage() {
 const [runs, setRuns] = useState<PaperRunSummary[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<string>();
 const load = useCallback(() => { setLoading(true); listRuns().then(r => { setRuns(r); setError(''); }).catch(e => setError(e instanceof Error ? e.message : 'Runs unavailable')).finally(() => setLoading(false)); }, []);
 useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
 const detail = runs.find(r => r.id === selected) ?? runs[0];
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Strategy paper runs</h2><p>Specs from the rule builder or Options Wizard, run forward on live read-only market data by the scheduler. Shared user1 account.</p></div><button className="btn btn-secondary" disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button></div>
  <section className="notice text-sm" role="note">Paper simulation only: no broker orders. Fills use the live quote at the scheduler cycle after each decision (ask to buy, bid to sell); price moves between cycles are not observed, so stops can fill worse than in a backtest.</section>
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {!loading && !error && !runs.length && <p>No paper runs yet. Start one from the Rule builder.</p>}
  {!!runs.length && <section className="card"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Run</th><th>Status</th><th className="text-right">Net P&L</th><th className="text-right">Trades</th><th>Started</th></tr></thead><tbody>{runs.map(r => <tr key={r.id} aria-selected={detail?.id === r.id} onClick={() => setSelected(r.id)} style={{ cursor: 'pointer' }}><td className="font-semibold">{r.name}</td><td>{r.status.toLowerCase()}</td><td className="text-right font-mono">{rupees(r.netPnl)}</td><td className="text-right">{r.trades}</td><td>{formatIST(r.createdAt)}</td></tr>)}</tbody></table></div></section>}
  {detail && <RunDetail run={detail} onStop={() => stopRun(detail.id).then(r => setRuns(old => old.map(x => x.id === r.id ? r : x))).catch(e => setError(e instanceof Error ? e.message : 'Stop failed'))} />}
 </div>;
}
