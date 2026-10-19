import { useCallback, useEffect, useState } from 'react';
import { fetchSignals, paperTradeSignal, type SignalsResponse, type Signal, type StrategyStatus, type ReturnStats } from '../services/signals';
import { navigateTo, openAnalysis } from '../services/specDraft';
import { formatIST } from '../services/tradingTime';
import { SEGMENTS } from '../../shared/tradingHorizon';
import { AutomationStatus } from './AutomationStatus';

const pct = (n: number | null | undefined, d = 2) => n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n.toFixed(d)}%`;
const num = (n: number | null | undefined, d = 2) => n === null || n === undefined ? '—' : n === Infinity ? '∞' : n.toFixed(d);
const when = (ms: number) => formatIST(new Date(ms).toISOString());
const STATUS: Record<StrategyStatus['status'], string> = { PASSED: 'Validated', FAILED: 'Failed validation', INSUFFICIENT_EVIDENCE: 'Not enough trades yet', NOT_VALIDATED_YET: 'Validation pending' };

function StatLine({ s, label }: { s: ReturnStats; label: string }) {
 return <p className="text-xs">{label}: {s.trades} trades · win rate {s.winRate === null ? '—' : (s.winRate * 100).toFixed(1) + '%'} · average trade {pct(s.expectancyPct)} after charges · profit factor {num(s.profitFactor)} · worst drawdown {pct(s.maxDrawdownPct, 1)}</p>;
}
function SignalCard({ s }: { s: Signal }) {
 const [capital, setCapital] = useState(100000); const [state, setState] = useState(''); const [busy, setBusy] = useState(false);
 const v = s.validation, on = 'stats' in v.onSymbol ? v.onSymbol : null, leg = s.legs[0];
 return <article className="card space-y-2">
  <div className="page-title"><div><h3>{s.symbol} · {s.direction.toLowerCase()} · {s.strategyName}</h3><p>{SEGMENTS.find(x => x.id === s.segment)?.label} · decided at the close of {when(s.barTime)} at ₹{s.close.toFixed(2)} · {s.status === 'ACTIVE' ? `valid until ${when(s.validUntil)}` : 'expired'}</p></div>
   <span className={`badge ${s.status === 'ACTIVE' ? 'badge-green' : ''}`}>{s.status === 'ACTIVE' ? 'Active' : 'Expired'}</span></div>
  <p className="text-sm"><strong>Rule:</strong> {s.rule}</p>
  {leg?.levels && (leg.levels.stop !== null || leg.levels.target !== null) && <p className="text-sm">Reference levels from the signal close: {leg.levels.stop !== null && <>stop ₹{leg.levels.stop.toFixed(2)}</>}{leg.levels.stop !== null && leg.levels.target !== null && ' · '}{leg.levels.target !== null && <>target ₹{leg.levels.target.toFixed(2)}</>}{s.maxHoldingDays ? ` · exit after ${s.maxHoldingDays} days at most` : ''}. Paper runs set levels from the actual fill.</p>}
  {on && <StatLine s={on.stats} label={`History on ${s.symbol} (${new Date(on.period.from).getFullYear()}–${new Date(on.period.to).getFullYear()}); buy-and-hold ${pct(on.buyHoldPct, 1)}, in market ${(on.timeInMarket * 100).toFixed(0)}% of the time`} />}
  <StatLine s={v.pooled.stats} label={`Across ${v.pooled.symbols} symbols`} />
  {v.validatedWith && <p className="text-xs">Validated through its underlying rule ({v.validatedWith}); option premiums for expired contracts are not available.</p>}
  <details><summary className="text-xs">Source of the rule</summary><p className="text-xs">{s.reference}</p></details>
  <div className="flex flex-wrap gap-2 items-center">
   <button className="btn btn-secondary" onClick={() => openAnalysis(s.symbol)}>Analyse {s.symbol}</button>
   {s.status === 'ACTIVE' && <><label className="text-sm">Capital ₹ <input type="number" min={1000} step={1000} value={capital} onChange={e => setCapital(Number(e.target.value))} style={{ width: 110 }} /></label>
    <button className="btn btn-primary" disabled={busy} onClick={() => { setBusy(true); setState(''); paperTradeSignal(s.id, capital).then(() => navigateTo('Paper trading')).catch(e => setState(e instanceof Error ? e.message : 'Paper run not started')).finally(() => setBusy(false)); }}>{busy ? 'Starting…' : 'Paper trade'}</button></>}
   {state && <span className="text-sm" role="status">{state}</span>}
  </div>
 </article>;
}
function StrategyRow({ s }: { s: StrategyStatus }) {
 const [open, setOpen] = useState(false);
 return <><tr onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }} aria-expanded={open}>
  <td className="font-semibold">{s.name}</td><td>{s.timeframe}</td><td>{STATUS[s.status]}</td><td className="text-right">{s.pooled?.stats.trades ?? '—'}</td><td className="text-right">{s.pooled ? (s.pooled.stats.winRate! * 100).toFixed(1) + '%' : '—'}</td><td className="text-right">{pct(s.pooled?.stats.expectancyPct)}</td><td className="text-right">{num(s.pooled?.stats.profitFactor)}</td><td className="text-right">{s.symbols.validated.length}</td><td>{s.computedAt ? formatIST(s.computedAt) : '—'}</td></tr>
  {open && <tr><td colSpan={9} className="text-sm space-y-1"><p><strong>Rule:</strong> {s.rule}</p><p className="text-xs">{s.reference}</p>
   {s.pooled && <><StatLine s={s.pooled.halves.first} label="First half of history" /><StatLine s={s.pooled.halves.second} label="Second half of history" />{!!s.pooled.reasons.length && <ul className="text-xs">{s.pooled.reasons.map(r => <li key={r}>Gate: {r}</li>)}</ul>}</>}
   {!!s.symbols.validated.length && <p className="text-xs">Validated symbols: {s.symbols.validated.map(v => `${v.symbol} (${pct(v.stats?.expectancyPct)}/trade)`).join(', ')}</p>}
   <p className="text-xs">{s.symbols.unproven} symbols with too few trades · {s.symbols.rejected} rejected</p></td></tr>}</>;
}
export function SignalsPage() {
 const [data, setData] = useState<SignalsResponse>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [segment, setSegment] = useState('all'); const [showExpired, setShowExpired] = useState(false);
 const load = useCallback(() => { setLoading(true); fetchSignals().then(d => { setData(d); setError(''); }).catch(e => setError(e instanceof Error ? e.message : 'Signals unavailable')).finally(() => setLoading(false)); }, []);
 useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
 const inSeg = <T extends { segment: string }>(x: T) => segment === 'all' || x.segment === segment;
 const signals = (data?.signals ?? []).filter(inSeg).filter(s => showExpired || s.status === 'ACTIVE');
 const strategies = (data?.strategies ?? []).filter(inSeg), passed = strategies.filter(s => s.status === 'PASSED');
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Signals</h2><p>Buy and sell signals from rules that have proven profitable after broker charges on 10 years of history. Every signal can be paper-traded{data?.autoPaper ? ', and each new signal is paper-traded automatically with ₹1 lakh so its live record builds up' : ''}.</p></div><button className="btn btn-secondary" disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button></div>
  <section className="notice text-sm" role="note">How a strategy earns signals: each rule runs with its published, fixed parameters over the full history of every stock in its universe, filling at the next bar with slippage and the itemised broker tariff. It must make money across the whole universe (at least 100 trades, profit factor 1.2 or more, positive in both halves of the history) and on the stock itself (at least 8 trades, profit factor 1.1 or more). Signals are produced only for stocks that pass both. Past results do not guarantee future returns; news, deals and fundamentals are shown in Analysis for your own judgement but do not change a validated rule.</section>
  <AutomationStatus state={data?.automation ?? null} />
  <nav className="segment-selector" aria-label="Segment">{[{ id: 'all', label: 'All segments' }, ...SEGMENTS].map(s => { const n = (data?.signals ?? []).filter(x => x.status === 'ACTIVE' && (s.id === 'all' || x.segment === s.id)).length; return <button key={s.id} aria-pressed={segment === s.id} onClick={() => setSegment(s.id)}>{s.label}<small>{n} active</small></button>; })}</nav>
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {data && segment !== 'all' && !passed.length && <section className="card"><p className="text-sm">No {SEGMENTS.find(s => s.id === segment)?.label.toLowerCase()} strategy has passed validation{strategies.some(s => s.status === 'NOT_VALIDATED_YET') ? ' yet (validation is still running)' : ''}, so this segment produces no signals. Rules that lose money after charges are not shown as signals. See the strategy table below for the measured results.</p></section>}
  <div className="flex items-center gap-3"><h3>{showExpired ? 'All signals' : 'Active signals'} ({signals.length})</h3><label className="text-sm"><input type="checkbox" checked={showExpired} onChange={e => setShowExpired(e.target.checked)} /> show expired</label></div>
  {data && !signals.length && <p className="text-sm">No {showExpired ? '' : 'active '}signals{segment === 'all' ? '' : ' in this segment'}. Daily strategies are scanned after the close (15:35 IST) and act in the next session.</p>}
  <div className="grid gap-4">{signals.map(s => <SignalCard key={s.id} s={s} />)}</div>
  <section className="card space-y-2"><h3>Strategy validation</h3><p className="text-sm">Results after charges, pooled across each strategy’s universe. Click a row for the rule, its source and the gate checks.</p>
   <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Strategy</th><th>Bars</th><th>Status</th><th className="text-right">Trades</th><th className="text-right">Win rate</th><th className="text-right">Avg trade</th><th className="text-right">Profit factor</th><th className="text-right">Validated stocks</th><th>Computed</th></tr></thead>
    <tbody>{strategies.map(s => <StrategyRow key={s.id} s={s} />)}</tbody></table></div></section>
 </div>;
}
