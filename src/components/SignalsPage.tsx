import { useCallback, useEffect, useState } from 'react';
import { fetchSignals, paperTradeSignal, type SignalsResponse, type Signal, type StrategyStatus, type ReturnStats, type BoardRow } from '../services/signals';
import { navigateTo, openAnalysis } from '../services/specDraft';
import { formatIST } from '../services/tradingTime';
import { SEGMENTS } from '../../shared/tradingHorizon';
import { AutomationStatus } from './AutomationStatus';

const pct = (n: number | null | undefined, d = 2) => n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n.toFixed(d)}%`;
const num = (n: number | null | undefined, d = 2) => n === null || n === undefined ? '—' : n === Infinity ? '∞' : n.toFixed(d);
const STATUS: Record<StrategyStatus['status'], string> = { PASSED: 'Validated', FAILED: 'Failed validation', INSUFFICIENT_EVIDENCE: 'Not enough trades yet', NOT_VALIDATED_YET: 'Validation pending' };

function StatLine({ s, label }: { s: ReturnStats; label: string }) {
 return <p className="text-xs">{label}: {s.trades} trades · win rate {s.winRate === null ? '—' : (s.winRate * 100).toFixed(1) + '%'} · average trade {pct(s.expectancyPct)} after charges · profit factor {num(s.profitFactor)} · worst drawdown {pct(s.maxDrawdownPct, 1)}</p>;
}
const rupees = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signedPct = (n: number | null | undefined, d = 2) => n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(d)}%`;
// A daily bar starts at midnight IST, so its date is the session; an intraday bar is named by its closing time.
const istDay = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const istShort = (ms: number) => new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
const barLabel = (s: Signal) => s.timeframe === '1d' ? `close of ${istDay(s.barTime)}` : `${s.timeframe} bar closing ${istShort(s.decidedAt)} IST`;
function Level({ label, value, close }: { label: string; value: number | null | undefined; close: number }) {
 return <div><dt>{label}</dt><dd>{value === null || value === undefined ? '—' : rupees(value)}{value !== null && value !== undefined && <small>{signedPct((value / close - 1) * 100, 1)} from close</small>}</dd></div>;
}
function SignalCard({ s }: { s: Signal }) {
 const [capital, setCapital] = useState(100000); const [state, setState] = useState(''); const [busy, setBusy] = useState(false);
 const v = s.validation, on = 'stats' in v.onSymbol ? v.onSymbol : null, leg = s.legs[0], active = s.status === 'ACTIVE';
 const long = s.direction === 'LONG', st = on?.stats;
 return <article className="card data-card">
  <div className="data-card-head">
   <div><div className="data-card-title"><strong>{s.symbol}</strong><span className={`badge ${long ? 'badge-green' : 'badge-red'}`}>{s.direction === 'BEARISH' ? 'Bearish' : long ? 'Long' : 'Short'}</span><span className="badge badge-neutral">{SEGMENTS.find(x => x.id === s.segment)?.label}</span></div>
    <p className="data-card-sub">{s.strategyName} · signal on the {barLabel(s)}</p></div>
   <span className={`badge ${active ? 'badge-green' : 'badge-neutral'}`}>{active ? `Active until ${istShort(s.validUntil)}` : 'Expired'}</span>
  </div>
  <dl className="fact-grid">
   <div><dt>Signal close</dt><dd>{rupees(s.close)}</dd></div>
   <Level label="Stop" value={leg?.levels?.stop} close={s.close} />
   <Level label="Target" value={leg?.levels?.target} close={s.close} />
   <div><dt>Holding</dt><dd>{s.maxHoldingDays ? `≤ ${s.maxHoldingDays} days` : 'Until exit rule'}</dd></div>
  </dl>
  {st && on && <div className="grid gap-2">
   <p className="section-label">Track record on {s.symbol} · {new Date(on.period.from).getFullYear()}–{new Date(on.period.to).getFullYear()} · after charges</p>
   <dl className="fact-grid cols-5 plain">
    <div><dt>Trades</dt><dd>{st.trades}</dd></div>
    <div><dt>Win rate</dt><dd>{st.winRate === null ? '—' : (st.winRate * 100).toFixed(1) + '%'}</dd></div>
    <div><dt>Avg trade</dt><dd className={(st.expectancyPct ?? 0) >= 0 ? 'positive' : 'negative'}>{signedPct(st.expectancyPct)}</dd></div>
    <div><dt>Profit factor</dt><dd>{num(st.profitFactor)}</dd></div>
    <div><dt>Worst drawdown</dt><dd>{pct(st.maxDrawdownPct, 1)}</dd></div>
   </dl>
   <p className="caption">In the market {(on.timeInMarket * 100).toFixed(0)}% of the time; buy-and-hold over the same years {signedPct(on.buyHoldPct, 1)}. Levels are from the signal close; paper runs set them from the actual fill.</p>
  </div>}
  <details className="card-disclosure"><summary>Rule, universe results and source</summary><div>
   <p><strong>Rule:</strong> {s.rule}</p>
   <StatLine s={v.pooled.stats} label={`Across ${v.pooled.symbols} symbols`} />
   {v.validatedWith && <p>Validated through its underlying rule ({v.validatedWith}); option premiums for expired contracts are not available.</p>}
   <p>{s.reference}</p>
  </div></details>
  <div className="card-actions">
   <button className="btn btn-secondary" onClick={() => openAnalysis(s.symbol)}>Analyse {s.symbol}</button>
   {active && <><label>Capital ₹<input type="number" min={1000} step={1000} value={capital} onChange={e => setCapital(Number(e.target.value))} /></label>
    <button className="btn btn-primary" disabled={busy} onClick={() => { setBusy(true); setState(''); paperTradeSignal(s.id, capital).then(() => navigateTo('Paper trading')).catch(e => setState(e instanceof Error ? e.message : 'Paper run not started')).finally(() => setBusy(false)); }}>{busy ? 'Starting…' : 'Paper trade'}</button></>}
   {state && <span className="text-sm" role="status">{state}</span>}
  </div>
 </article>;
}
const STATUS_BADGE: Record<StrategyStatus['status'], string> = { PASSED: 'badge-green', FAILED: 'badge-red', INSUFFICIENT_EVIDENCE: 'badge-amber', NOT_VALIDATED_YET: 'badge-neutral' };
// One library rule: its validation status and pooled results; the rule, source and gate checks on demand.
function StrategyItem({ s, proxyName }: { s: StrategyStatus; proxyName: (id: string) => string }) {
 const p = s.pooled?.stats, n = s.symbols.validated.length;
 return <details className="rule-item">
  <summary>
   <div className="rule-item-head"><strong>{s.name}</strong><span className={`badge ${STATUS_BADGE[s.status]}`}>{s.status === 'PASSED' ? `Validated · ${n} ${n === 1 ? 'stock' : 'stocks'}` : STATUS[s.status]}</span></div>
   <div className="inline-facts">{p ? <><span>Trades <b>{p.trades}</b></span><span>Win rate <b>{p.winRate === null ? '—' : (p.winRate * 100).toFixed(1) + '%'}</b></span><span>Avg trade <b className={(p.expectancyPct ?? 0) >= 0 ? 'positive' : 'negative'}>{signedPct(p.expectancyPct)}</b></span><span>Profit factor <b>{num(p.profitFactor)}</b></span></> : <span>Validation runs automatically in market hours.</span>}<span className="faint">{s.timeframe} bars{s.validatedWith ? ` · timing validated on the ${proxyName(s.validatedWith)} rule` : ''}</span></div>
  </summary>
  <div className="rule-item-body">
   <p><strong>Rule:</strong> {s.rule}</p><p className="caption">{s.reference}</p>
   {s.pooled && <><StatLine s={s.pooled.halves.first} label="First half of history" /><StatLine s={s.pooled.halves.second} label="Second half of history" />{!!s.pooled.reasons.length && <ul className="bullet-list">{s.pooled.reasons.map(r => <li key={r}>Gate: {r}</li>)}</ul>}</>}
   {!!n && <p className="text-xs">Validated stocks: {s.symbols.validated.map(v => `${v.symbol} (${pct(v.stats?.expectancyPct)}/trade)`).join(', ')}</p>}
   <p className="text-xs">{s.symbols.unproven} with too few trades · {s.symbols.rejected} rejected{s.computedAt ? ` · computed ${formatIST(s.computedAt)}` : ''}</p>
  </div>
 </details>;
}
// Every rule in the library grouped by trading segment, so coverage (and its gaps) is visible at a glance.
function StrategyCoverage({ strategies, all }: { strategies: StrategyStatus[]; all: StrategyStatus[] }) {
 const groups = SEGMENTS.map(seg => ({ seg, rules: strategies.filter(s => s.segment === seg.id) })).filter(g => g.rules.length);
 return <section className="card grid gap-4">
  <div><h3>Strategy coverage</h3><p className="text-sm muted">Every rule in the library by segment, with results after charges pooled across its universe. Only validated rules produce signals; open a rule for its source and gate checks.</p></div>
  <div className="coverage-grid">{groups.map(({ seg, rules }) => { const passed = rules.filter(r => r.status === 'PASSED').length;
   return <div key={seg.id} className="coverage-seg"><div className="rule-item-head"><h4>{seg.label}</h4><span className={`badge ${passed ? 'badge-green' : 'badge-neutral'}`}>{passed} of {rules.length} validated</span></div>
    <div className="grid gap-2">{rules.map(r => <StrategyItem key={r.id} s={r} proxyName={id => all.find(x => x.id === id)?.name ?? id} />)}</div></div>; })}</div>
 </section>;
}
function Board({ rows, computedAt }: { rows: BoardRow[]; computedAt: string }) {
 const held = rows.filter(r => r.state === 'IN_POSITION').sort((a, b) => (b.since ?? 0) - (a.since ?? 0)), near = rows.filter(r => r.state === 'NEAR_TRIGGER').sort((a, b) => a.trigger!.distancePct - b.trigger!.distancePct);
 const day = (ms?: number) => ms ? new Date(ms + 19800000).toISOString().slice(0, 10) : '—';
 return <>
  <section className="card space-y-2"><h3>Near a trigger ({near.length})</h3><p className="text-sm">Stocks within {3}% of the price that would fire a validated rule. A signal is issued only if a daily close crosses the level.</p>
   {near.length ? <div className="overflow-x-auto"><table className="data-table text-sm"><thead><tr><th>Stock</th><th>Strategy</th><th className="text-right">Last close</th><th className="text-right">Trigger level</th><th className="text-right">Distance</th><th>Needs</th><th></th></tr></thead>
    <tbody>{near.map(r => <tr key={r.strategyId + r.symbol}><td className="font-semibold">{r.symbol}</td><td>{r.strategyName}</td><td className="text-right font-mono">{r.close.toFixed(2)}</td><td className="text-right font-mono">{r.trigger!.level.toFixed(2)}</td><td className="text-right">{r.trigger!.distancePct.toFixed(2)}%</td><td>{r.trigger!.condition}</td><td><button className="btn btn-secondary" onClick={() => openAnalysis(r.symbol)}>Analyse</button></td></tr>)}</tbody></table></div> : <p className="text-sm">No stock is within 3% of a trigger.</p>}</section>
  <section className="card space-y-2"><h3>Validated rules in a position now ({held.length})</h3><p className="text-sm">Trades the validated rules opened on earlier signals and still hold, replayed on daily closes to {day(rows[0]?.barTime)}. They show what a follower of each rule would be holding; new paper runs open only on fresh signals, not mid-trade.</p>
   {held.length ? <div className="overflow-x-auto"><table className="data-table text-sm"><thead><tr><th>Stock</th><th>Strategy</th><th>Entered</th><th className="text-right">Entry</th><th className="text-right">Last close</th><th className="text-right">Change</th><th className="text-right">Stop</th><th></th></tr></thead>
    <tbody>{held.map(r => <tr key={r.strategyId + r.symbol}><td className="font-semibold">{r.symbol}</td><td>{r.strategyName}{r.exitPending ? <small> · exit signal at last close</small> : null}</td><td>{day(r.since)}</td><td className="text-right font-mono">{r.entryPrice?.toFixed(2)}</td><td className="text-right font-mono">{r.close.toFixed(2)}</td><td className={`text-right ${(r.changePct ?? 0) >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>{pct(r.changePct)}</td><td className="text-right font-mono">{r.stop?.toFixed(2) ?? '—'}</td><td><button className="btn btn-secondary" onClick={() => openAnalysis(r.symbol)}>Analyse</button></td></tr>)}</tbody></table></div> : <p className="text-sm">No open positions.</p>}
   <p className="text-xs">Board computed {formatIST(computedAt)}.</p></section>
 </>;
}
export function SignalsPage() {
 const [data, setData] = useState<SignalsResponse>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [segment, setSegment] = useState('all'); const [showExpired, setShowExpired] = useState(true);
 const load = useCallback(() => { setLoading(true); fetchSignals().then(d => { setData(d); setError(''); }).catch(e => setError(e instanceof Error ? e.message : 'Signals unavailable')).finally(() => setLoading(false)); }, []);
 useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
 const inSeg = <T extends { segment: string }>(x: T) => segment === 'all' || x.segment === segment;
 const signals = (data?.signals ?? []).filter(inSeg).filter(s => showExpired || s.status === 'ACTIVE').sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE'));
 const strategies = (data?.strategies ?? []).filter(inSeg), passed = strategies.filter(s => s.status === 'PASSED');
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Signals</h2><p>Buy and sell signals from rules that have proven profitable after broker charges on 10 years of history. Every signal can be paper-traded{data?.autoPaper ? ', and each new signal is paper-traded automatically with ₹1 lakh so its live record builds up' : ''}.</p></div><button className="btn btn-secondary" disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button></div>
  <section className="notice text-sm" role="note">How a strategy earns signals: each rule runs with its published, fixed parameters over the full history of every stock in its universe, filling at the next bar with slippage and the itemised broker tariff. It must make money across the whole universe (at least 100 trades, profit factor 1.2 or more, positive in both halves of the history) and on the stock itself (at least 8 trades, profit factor 1.1 or more). Signals are produced only for stocks that pass both. Past results do not guarantee future returns; news, deals and fundamentals are shown in Analysis for your own judgement but do not change a validated rule.</section>
  <AutomationStatus state={data?.automation ?? null} />
  <nav className="segment-selector" aria-label="Segment">{[{ id: 'all', label: 'All segments' }, ...SEGMENTS].map(s => { const n = (data?.signals ?? []).filter(x => x.status === 'ACTIVE' && (s.id === 'all' || x.segment === s.id)).length; const rules = (data?.strategies ?? []).filter(x => s.id === 'all' || x.segment === s.id); return <button key={s.id} aria-pressed={segment === s.id} onClick={() => setSegment(s.id)}>{s.label}<small>{n} active · {(data?.board?.rows ?? []).filter(x => x.state === 'IN_POSITION' && (s.id === 'all' || x.segment === s.id)).length} held · {rules.filter(x => x.status === 'PASSED').length}/{rules.length} rules</small></button>; })}</nav>
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {data && segment !== 'all' && !passed.length && <section className="card"><p className="text-sm">No {SEGMENTS.find(s => s.id === segment)?.label.toLowerCase()} strategy has passed validation{strategies.some(s => s.status === 'NOT_VALIDATED_YET') ? ' yet (validation is still running)' : ''}, so this segment produces no signals: {strategies.filter(s => s.pooled).map(s => `${s.name} averaged ${pct(s.pooled!.stats.expectancyPct)} per trade after charges over ${s.pooled!.stats.trades} trades`).join('; ') || 'validation is still running'}. Publishing these as buy signals would knowingly lose money.{segment === 'options' ? ' Option strategies cannot be validated directly because prices of expired option contracts are not available; for leveraged exposure use the Futures segment, whose breakout rule is validated.' : ''}</p></section>}
  <div className="flex items-center gap-3"><h3>{showExpired ? 'Signals, last 10 sessions' : 'Active signals'} ({signals.length})</h3><label className="text-sm inline-flex items-center gap-2 whitespace-nowrap"><input type="checkbox" checked={showExpired} onChange={e => setShowExpired(e.target.checked)} /> include expired</label></div>
  {data && !signals.length && <p className="text-sm">No {showExpired ? '' : 'active '}signals{segment === 'all' ? '' : ' in this segment'}. Daily rules are checked on the previous session’s close at 09:16 IST (and again every 30 minutes); a signal is actionable for that session only.</p>}
  <div className="card-grid">{signals.map(s => <SignalCard key={s.id} s={s} />)}</div>
  {data?.board && <Board rows={data.board.rows.filter(inSeg)} computedAt={data.board.computedAt} />}
  <StrategyCoverage strategies={strategies} all={data?.strategies ?? []} />
 </div>;
}
