import { useCallback, useEffect, useMemo, useState } from 'react';
import { listRuns, stopRun, fetchLedger, ledgerCsv, type PaperRunSummary, type PaperEvent } from '../services/specPaper';
import { formatIST } from '../services/tradingTime';
import { SEGMENTS } from '../../shared/tradingHorizon';

const rupees = (n: number | null | undefined) => n === null || n === undefined || !Number.isFinite(n) ? '—' : (n < 0 ? '−₹' : '₹') + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const when = (ms: number | null | undefined) => ms === null || ms === undefined ? '—' : formatIST(new Date(ms).toISOString());
const pct = (n: number | null) => n === null ? '—' : (n * 100).toFixed(1) + '%';
const words = (s: string | null | undefined) => (s ?? '—').replaceAll('_', ' ').toLowerCase();
const tone = (n: number) => n > 0 ? 'text-[var(--green)]' : n < 0 ? 'text-[var(--red)]' : '';
const segmentLabel = (id: string | null) => SEGMENTS.find(s => s.id === id)?.label ?? 'Unclassified';

function download(name: string, body: string, type: string) {
 const url = URL.createObjectURL(new Blob([body], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function Stat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
 return <div className="metric-tile"><span className="text-xs text-[var(--text-muted)]">{label}</span><strong className={`font-mono ${className}`}>{value}</strong></div>;
}
function OrdersTable({ orders }: { orders: PaperEvent[] }) {
 if (!orders.length) return <p className="text-sm">No orders yet.</p>;
 return <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Time</th><th>Order</th><th>Contract</th><th>Side</th><th>Type</th><th>Purpose</th><th className="text-right">Qty</th><th className="text-right">Avg price</th><th className="text-right">Charges</th><th>Status</th></tr></thead>
  <tbody>{[...orders].reverse().map((o, i) => { const c = o.charges as { total: number } | undefined, trig = o.trigger as { at: number } | undefined; return <tr key={String(o.orderId ?? i)}>
   <td>{when(trig?.at ?? o.at ?? o.time)}</td><td className="font-mono">{String(o.orderId ?? '—')}</td><td>{String(o.contract ?? o.leg ?? '—')}</td><td>{String(o.side)}</td><td>{String(o.orderType ?? 'MARKET')}</td><td>{words(o.purpose as string)}</td>
   <td className="text-right">{String(o.filledUnits ?? o.units ?? '—')}</td><td className="text-right font-mono">{typeof o.avgPrice === 'number' ? o.avgPrice.toFixed(2) : '—'}</td><td className="text-right font-mono">{rupees(c?.total)}</td><td>{words(o.status as string)}</td></tr>; })}</tbody></table></div>;
}
export function RunDetail({ run, onStop }: { run: PaperRunSummary; onStop?: () => void }) {
 const [exporting, setExporting] = useState(''); const [open, setOpen] = useState<string | null>(null);
 const orders = run.events.filter(e => e.kind === 'ORDER'), rejected = run.events.filter(e => e.kind === 'ENTRY_CANCELLED'), s = run.stats, f = run.funds;
 const exportLedger = (format: 'csv' | 'json') => { setExporting('Exporting ledger…'); fetchLedger(run.id).then(rows => { download(`paper-${run.name}-${run.id.slice(0, 8)}.${format}`, format === 'csv' ? ledgerCsv(rows) : JSON.stringify(rows, null, 1), format === 'csv' ? 'text/csv' : 'application/json'); setExporting(`Exported ${rows.length} events.`); }).catch(e => setExporting(e instanceof Error ? e.message : 'Export failed')); };
 const openPnl = run.legs.filter(l => l.open).reduce((a, l) => a + (l.mark - l.entry) * l.units * l.dir, 0);
 return <section className="card space-y-4">
  <div className="page-title"><div><h3>{run.name}</h3><p>{segmentLabel(run.segment)} · {run.underlying.symbol} · {run.timeframe} · {run.status.toLowerCase()} · started {formatIST(run.createdAt)} · charges: {run.options.costModel === 'broker-tariff' ? 'published broker tariff' : `${run.options.costBps ?? 0} bps + ₹${run.options.costPerOrder ?? 0}/order`}{run.options.requireMargin ? ' · margin checked' : ''}</p></div>
   <div className="flex gap-2">{run.status === 'ACTIVE' && onStop && <button className="btn btn-secondary" onClick={onStop}>Stop run</button>}<button className="btn btn-secondary" onClick={() => exportLedger('csv')}>Export CSV</button><button className="btn btn-secondary" onClick={() => exportLedger('json')}>Export JSON</button></div></div>
  {exporting && <p className="text-xs" role="status">{exporting}</p>}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
   <Stat label="Net P&L (incl. open)" value={rupees(run.netPnl)} className={tone(run.netPnl)} />
   {f && <><Stat label="Equity" value={rupees(f.equity)} /><Stat label="Available funds" value={rupees(f.available)} /><Stat label="Margin blocked" value={rupees(f.blocked)} /></>}
   <Stat label="Realised gross" value={rupees(run.realized)} /><Stat label="Charges paid" value={rupees(run.costs)} /><Stat label="Open P&L (gross)" value={rupees(openPnl)} className={tone(openPnl)} /><Stat label="Orders" value={String(run.orders)} />
  </div>
  <div><h4>Performance (closed trades, after charges)</h4><div className="grid grid-cols-2 md:grid-cols-5 gap-2">
   <Stat label="Trades" value={`${s.trades} (${s.wins} won)`} /><Stat label="Win rate" value={pct(s.winRate)} /><Stat label="Expectancy / trade" value={rupees(s.expectancy)} className={tone(s.expectancy ?? 0)} /><Stat label="Profit factor" value={s.profitFactor === null ? '—' : s.profitFactor.toFixed(2)} /><Stat label="Max drawdown" value={rupees(-s.maxDrawdown)} />
   <Stat label="Avg win" value={rupees(s.avgWin)} /><Stat label="Avg loss" value={rupees(s.avgLoss)} /><Stat label="Best" value={rupees(s.bestTrade)} /><Stat label="Worst" value={rupees(s.worstTrade)} /><Stat label="Gross before charges" value={rupees(s.gross)} />
  </div>{s.trades < 30 && <p className="text-xs">{s.trades} closed trades: too few to judge whether the strategy has an edge.</p>}</div>
  <div><h4>Position {run.position === 'OPEN' && run.openTrade ? `· ${run.openTrade.tradeId}` : '· flat'}{run.pending ? ` · pending ${words(run.pending.kind)}` : ''}</h4>
   {run.legs.some(l => l.open) ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Leg</th><th>Contract</th><th className="text-right">Qty</th><th>Entered</th><th className="text-right">Entry</th><th className="text-right">LTP</th><th className="text-right">Stop</th><th className="text-right">Target</th><th className="text-right">P&L</th></tr></thead>
    <tbody>{run.legs.filter(l => l.open).map(l => { const p = (l.mark - l.entry) * l.units * l.dir; return <tr key={l.id}><td>{l.dir === 1 ? 'Long' : 'Short'} {l.id}</td><td>{l.contract ?? '—'}</td><td className="text-right">{l.units}</td><td>{when(l.entryTime)}</td><td className="text-right font-mono">{l.entry.toFixed(2)}</td><td className="text-right font-mono">{l.mark.toFixed(2)}</td><td className="text-right font-mono">{l.stop?.toFixed(2) ?? '—'}</td><td className="text-right font-mono">{l.target?.toFixed(2) ?? '—'}</td><td className={`text-right font-mono ${tone(p)}`}>{rupees(p)}</td></tr>; })}</tbody></table></div> : <p className="text-sm">No open position.</p>}</div>
  <div><h4>Closed trades</h4>{run.closedTrades.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Trade</th><th>Entry</th><th>Exit</th><th>Exit reason</th><th className="text-right">Gross</th><th className="text-right">Charges</th><th className="text-right">Net</th><th className="text-right">MAE / MFE</th></tr></thead>
   <tbody>{[...run.closedTrades].reverse().flatMap(t => { const key = t.tradeId ?? String(t.time); return [<tr key={key} onClick={() => setOpen(open === key ? null : key)} style={{ cursor: 'pointer' }} aria-expanded={open === key}><td className="font-mono">{t.tradeId ?? '—'}</td><td>{when(t.legs[0]?.entryTime ?? t.time)}</td><td>{when(t.exitTime)}</td><td>{words(t.reason)}</td><td className="text-right font-mono">{rupees(t.gross)}</td><td className="text-right font-mono">{rupees(t.charges)}</td><td className={`text-right font-mono ${tone(t.pnl)}`}>{rupees(t.pnl)}</td><td className="text-right font-mono">{rupees(t.mae)} / {rupees(t.mfe)}</td></tr>,
    ...(open === key ? [<tr key={key + 'd'}><td colSpan={8}><ul className="text-xs">{t.legs.map(l => <li key={l.leg}>{l.side} {l.units} × {l.contract ?? l.leg}: entry {l.entryPrice.toFixed(2)} at {when(l.entryTime)} → exit {l.exitPrice.toFixed(2)} at {when(l.exitTime)} ({words(l.exitReason)}) · gross {rupees(l.gross)} · charges {rupees(l.charges)}</li>)}</ul></td></tr>] : [])]; })}</tbody></table></div> : <p className="text-sm">No closed trades yet.</p>}</div>
  <div><h4>Recent orders</h4><OrdersTable orders={orders} /></div>
  {!!rejected.length && <div><h4>Rejected entries</h4><ul className="text-sm">{[...rejected].reverse().map((e, i) => <li key={i}>{when(e.at ?? e.time)} · {words(e.reason as string)}{e.required ? ` · margin ${rupees(e.required as number)} vs available ${rupees(e.available as number)}` : ''}</li>)}</ul></div>}
  <p className="text-xs">Cycles {run.paper.cycles} · last cycle {run.paper.lastCycleAt ? formatIST(run.paper.lastCycleAt) : 'none yet'} · last strategy bar {when(run.paper.lastBarTime)} · {run.paper.eventSeq ?? 0} ledger events{run.paper.missedBars ? ` · ${run.paper.missedBars} bars passed between cycles without a decision` : ''}</p>
 </section>;
}
export function PaperTradingPage() {
 const [runs, setRuns] = useState<PaperRunSummary[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<string>(); const [segment, setSegment] = useState('all');
 const load = useCallback(() => { setLoading(true); listRuns().then(r => { setRuns(r); setError(''); }).catch(e => setError(e instanceof Error ? e.message : 'Runs unavailable')).finally(() => setLoading(false)); }, []);
 useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
 const shown = useMemo(() => runs.filter(r => segment === 'all' || r.segment === segment), [runs, segment]);
 const detail = shown.find(r => r.id === selected) ?? shown[0];
 const totals = shown.reduce((a, r) => ({ net: a.net + r.netPnl, charges: a.charges + r.costs, trades: a.trades + r.trades, wins: a.wins + r.wins, active: a.active + (r.status === 'ACTIVE' ? 1 : 0) }), { net: 0, charges: 0, trades: 0, wins: 0, active: 0 });
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Paper trading</h2><p>Every strategy run in all segments, executed like live trading on live market data. Start runs from Signals or the Strategy lab.</p></div><button className="btn btn-secondary" disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button></div>
  <section className="notice text-sm" role="note">Paper simulation only: no order reaches a broker. Each minute the scheduler checks resting stop-loss (SL-M) and target (LIMIT) orders against the contract's 1-minute candles and the live price, squares off intraday positions on time, and executes new decisions at the live order book: market orders walk the visible 5-level depth, entries need the broker's margin quote and enough paper funds, and charges follow the published broker tariff (brokerage, STT, exchange, SEBI, stamp duty, GST, DP). Every order and trade is kept permanently in the run's ledger.</section>
  <nav className="segment-selector" aria-label="Segment">{[{ id: 'all', label: 'All segments' }, ...SEGMENTS].map(s => <button key={s.id} aria-pressed={segment === s.id} onClick={() => { setSegment(s.id); setSelected(undefined); }}>{s.label}<small>{s.id === 'all' ? `${runs.length} runs` : `${runs.filter(r => r.segment === s.id).length} runs`}</small></button>)}</nav>
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {!!shown.length && <div className="grid grid-cols-2 md:grid-cols-5 gap-2"><Stat label="Active runs" value={String(totals.active)} /><Stat label="Net P&L" value={rupees(totals.net)} className={tone(totals.net)} /><Stat label="Charges" value={rupees(totals.charges)} /><Stat label="Closed trades" value={String(totals.trades)} /><Stat label="Win rate" value={totals.trades ? pct(totals.wins / totals.trades) : '—'} /></div>}
  {!loading && !error && !shown.length && <section className="card"><p>No paper runs in this segment yet. Open Signals and choose “Paper trade” on a signal, or start a run from the Strategy lab.</p></section>}
  {!!shown.length && <section className="card"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Run</th><th>Segment</th><th>Underlying</th><th>Status</th><th>Position</th><th className="text-right">Net P&L</th><th className="text-right">Trades</th><th className="text-right">Win rate</th><th>Started</th></tr></thead>
   <tbody>{shown.map(r => <tr key={r.id} aria-selected={detail?.id === r.id} onClick={() => setSelected(r.id)} style={{ cursor: 'pointer' }}><td className="font-semibold">{r.name}</td><td>{segmentLabel(r.segment)}</td><td>{r.underlying.symbol}</td><td>{r.status.toLowerCase()}</td><td>{r.position.toLowerCase()}</td><td className={`text-right font-mono ${tone(r.netPnl)}`}>{rupees(r.netPnl)}</td><td className="text-right">{r.trades}</td><td className="text-right">{pct(r.stats.winRate)}</td><td>{formatIST(r.createdAt)}</td></tr>)}</tbody></table></div></section>}
  {detail && <RunDetail run={detail} onStop={() => stopRun(detail.id).then(r => setRuns(old => old.map(x => x.id === r.id ? r : x))).catch(e => setError(e instanceof Error ? e.message : 'Stop failed'))} />}
 </div>;
}
