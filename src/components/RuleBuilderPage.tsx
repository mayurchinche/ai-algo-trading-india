import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { parseStrategySpec, INDICATOR_TYPES, COMPARATORS, PRICE_FIELDS, SOURCES, TIMEFRAMES, type StrategySpec, type Condition, type Operand, type IndicatorType, type Leg } from '../../shared/strategySpec';
import { runSpecBacktest, type BacktestResult } from '../../shared/specBacktest';
import { fetchSpecBars } from '../services/specBars';
import { loadSpecDraft, saveSpecDraft, downloadJson } from '../services/specDraft';
import { TEMPLATES, ALWAYS } from '../services/specTemplates';
import { createRun } from '../services/specPaper';
import { navigateTo } from '../services/specDraft';

type Draft = StrategySpec;
const always: Condition = ALWAYS;
const pct = (n: number | null | undefined) => n === null || n === undefined ? '—' : (n * 100).toFixed(1) + '%';
const num = (n: number | null | undefined, d = 2) => n === null || n === undefined ? '—' : n.toFixed(d);
const inr = (n: number | null | undefined) => n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const COMPARATOR_LABEL: Record<string, string> = { gt: 'is above', gte: 'is at or above', lt: 'is below', lte: 'is at or below', 'crosses-above': 'crosses above', 'crosses-below': 'crosses below' };
// A labelled form control: the label sits above the control so rows stay readable when they wrap.
const Field = ({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) => <label className={`field ${className}`}>{label}{children}</label>;
const Remove = ({ onClick, label }: { onClick: () => void; label: string }) => <button type="button" className="icon-btn" onClick={onClick} aria-label={label} title={label}><Trash2 size={16} /></button>;
const Add = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => <button type="button" className="btn btn-secondary btn-sm" onClick={onClick}><Plus size={14} />{children}</button>;

function OperandEditor({ value, onChange, indicators }: { value: Operand; onChange: (o: Operand) => void; indicators: Draft['indicators'] }) {
 const kind = 'indicator' in value ? 'indicator' : 'price' in value ? 'price' : 'value';
 const ind = 'indicator' in value ? indicators.find(i => i.id === value.indicator) : undefined;
 return <span className="operand">
  <Field label="Of" className="w-sm"><select value={kind} onChange={e => onChange(e.target.value === 'indicator' ? { indicator: indicators[0]?.id ?? '' } : e.target.value === 'price' ? { price: 'close' } : { value: 0 })}><option value="indicator">indicator</option><option value="price">price</option><option value="value">number</option></select></Field>
  {'indicator' in value && <><Field label="Indicator" className="w-sm"><select value={value.indicator} onChange={e => onChange({ indicator: e.target.value })}>{indicators.map(i => <option key={i.id} value={i.id}>{i.id}</option>)}</select></Field>
   {ind && INDICATOR_TYPES[ind.type].outputs.length > 1 && <Field label="Output" className="w-sm"><select value={value.output ?? INDICATOR_TYPES[ind.type].outputs[0]} onChange={e => onChange({ ...value, output: e.target.value })}>{INDICATOR_TYPES[ind.type].outputs.map(o => <option key={o}>{o}</option>)}</select></Field>}</>}
  {'price' in value && <Field label="Price" className="w-sm"><select value={value.price} onChange={e => onChange({ ...value, price: e.target.value as typeof value.price })}>{PRICE_FIELDS.map(p => <option key={p}>{p}</option>)}</select></Field>}
  {'value' in value && <Field label="Value" className="w-sm"><input type="number" step="any" value={value.value} onChange={e => onChange({ value: Number(e.target.value) })} /></Field>}
  {!('value' in value) && <Field label="Bars ago" className="w-xs"><input type="number" min={0} max={50} value={value.barsAgo ?? 0} onChange={e => onChange({ ...value, barsAgo: Number(e.target.value) || undefined } as Operand)} /></Field>}
 </span>;
}

export function ConditionEditor({ value, onChange, indicators, onRemove }: { value: Condition; onChange: (c: Condition) => void; indicators: Draft['indicators']; onRemove?: () => void }) {
 const remove = onRemove && <Remove onClick={onRemove} label="Remove condition" />;
 if ('compare' in value) {
  const c = value.compare;
  return <div className="field-row"><OperandEditor value={c.left} indicators={indicators} onChange={left => onChange({ compare: { ...c, left } })} />
   <Field label="Condition" className="w-md"><select value={c.op} onChange={e => onChange({ compare: { ...c, op: e.target.value as typeof c.op } })}>{COMPARATORS.map(o => <option key={o} value={o}>{COMPARATOR_LABEL[o] ?? o}</option>)}</select></Field>
   <OperandEditor value={c.right} indicators={indicators} onChange={right => onChange({ compare: { ...c, right } })} />{remove}</div>;
 }
 if ('not' in value) return <div className="builder-box nested"><div className="builder-box-head"><span className="op-word">NOT</span>{remove}</div><ConditionEditor value={value.not} indicators={indicators} onChange={not => onChange({ not })} /></div>;
 const key = 'all' in value ? 'all' : 'any', list = 'all' in value ? value.all : value.any;
 const set = (items: Condition[]) => onChange((key === 'all' ? { all: items } : { any: items }) as Condition);
 return <div className="builder-box nested">
  <div className="builder-box-head"><Field label="Match" className="w-md"><select value={key} onChange={e => onChange((e.target.value === 'all' ? { all: list } : { any: list }) as Condition)}><option value="all">ALL of</option><option value="any">ANY of</option></select></Field>{remove}</div>
  <div className="builder-list">{list.map((c, i) => <ConditionEditor key={i} value={c} indicators={indicators} onChange={n => set(list.map((x, k) => k === i ? n : x))} onRemove={list.length > 1 ? () => set(list.filter((_, k) => k !== i)) : undefined} />)}</div>
  <div className="add-row"><Add onClick={() => set([...list, always])}>Comparison</Add><Add onClick={() => set([...list, { all: [always] }])}>Group</Add><Add onClick={() => set([...list, { not: always }])}>Not</Add></div>
 </div>;
}

function LegEditor({ leg, onChange, onRemove, indexUnderlying }: { leg: Leg; onChange: (l: Leg) => void; onRemove?: () => void; indexUnderlying: boolean }) {
 const ins = leg.instrument, level = (key: 'stopLoss' | 'target', label: string) => <span className="field-row" style={{ gap: 6 }}>
  <Field label={label} className="w-sm"><input type="number" min={0} step="any" value={leg[key]?.value ?? ''} onChange={e => onChange({ ...leg, [key]: e.target.value === '' ? undefined : { unit: leg[key]?.unit ?? 'percent', value: Number(e.target.value) } })} /></Field>
  <Field label="Unit" className="w-xs"><select value={leg[key]?.unit ?? 'percent'} onChange={e => leg[key] && onChange({ ...leg, [key]: { ...leg[key]!, unit: e.target.value as 'percent' | 'points' } })}><option value="percent">%</option><option value="points">pts</option></select></Field></span>;
 return <div className="builder-box">
  <div className="field-row">
   <Field label="Leg ID" className="w-sm"><input value={leg.id} onChange={e => onChange({ ...leg, id: e.target.value })} /></Field>
   <Field label="Side" className="w-xs"><select value={leg.side} onChange={e => onChange({ ...leg, side: e.target.value as Leg['side'] })}><option>BUY</option><option>SELL</option></select></Field>
   <Field label="Instrument" className="w-sm"><select value={ins.type} onChange={e => onChange({ ...leg, instrument: e.target.value === 'equity' ? { type: 'equity' } : e.target.value === 'future' ? { type: 'future', expiry: 'current-month' } : { type: 'option', optionType: 'CE', expiry: indexUnderlying ? 'current-week' : 'current-month', strike: { mode: 'atm-offset', steps: 0 } }, quantity: e.target.value === 'equity' ? { units: 1 } : { lots: 1 } })}><option value="equity">equity</option><option value="future">future</option><option value="option">option</option></select></Field>
   {ins.type === 'option' && <><Field label="Option" className="w-xs"><select value={ins.optionType} onChange={e => onChange({ ...leg, instrument: { ...ins, optionType: e.target.value as 'CE' | 'PE' } })}><option>CE</option><option>PE</option></select></Field>
    <Field label="ATM offset" className="w-xs"><input type="number" value={ins.strike.mode === 'atm-offset' ? ins.strike.steps : 0} onChange={e => onChange({ ...leg, instrument: { ...ins, strike: { mode: 'atm-offset', steps: Number(e.target.value) } } })} /></Field></>}
   <Field label={'units' in leg.quantity ? 'Units' : 'Lots'} className="w-xs"><input type="number" min={1} value={'units' in leg.quantity ? leg.quantity.units : leg.quantity.lots} onChange={e => onChange({ ...leg, quantity: 'units' in leg.quantity ? { units: Number(e.target.value) } : { lots: Number(e.target.value) } })} /></Field>
   {onRemove && <Remove onClick={onRemove} label={`Remove leg ${leg.id}`} />}
  </div>
  <div className="field-row">{level('stopLoss', 'Stop-loss')}{level('target', 'Target')}
   <Field label="Trail every" className="w-xs"><input type="number" min={0} step="any" value={leg.trailingStop?.trigger ?? ''} onChange={e => onChange({ ...leg, trailingStop: e.target.value === '' ? undefined : { unit: leg.stopLoss?.unit ?? 'percent', trigger: Number(e.target.value), step: leg.trailingStop?.step ?? Number(e.target.value) } })} /></Field>
   <Field label="Trail by" className="w-xs"><input type="number" min={0} step="any" value={leg.trailingStop?.step ?? ''} onChange={e => leg.trailingStop && onChange({ ...leg, trailingStop: { ...leg.trailingStop, step: Number(e.target.value) } })} /></Field></div>
 </div>;
}

export function BacktestView({ result }: { result: BacktestResult }) {
 if (result.status === 'UNSUPPORTED_OPTION_LEGS') return <p className="text-sm">Not backtested: option legs ({result.legs.join(', ')}). {result.reason} Use a paper run to observe it forward.</p>;
 if (result.status !== 'OK') return <p className="text-sm">Not backtested: {result.status.replaceAll('_', ' ').toLowerCase()}.</p>;
 const m = result.metrics;
 if (m.status !== 'OK') return <p className="text-sm">No bars to evaluate.</p>;
 return <div className="space-y-3">
  <div className="flex items-center gap-3 flex-wrap"><span className="badge badge-blue">Grade {m.grade.grade}</span><span className="text-sm muted">score {m.grade.score.toFixed(0)} · {m.grade.note}</span></div>
  <dl className="fact-grid">
   <div><dt>Net return</dt><dd className={(m.totalReturn ?? 0) >= 0 ? 'positive' : 'negative'}>{pct(m.totalReturn)}</dd></div>
   <div><dt>CAGR</dt><dd>{pct(m.cagr)}</dd></div>
   <div><dt>Max drawdown</dt><dd>{pct(m.maxDrawdown)}</dd></div>
   <div><dt>Sharpe · Sortino · Calmar</dt><dd>{num(m.sharpe)} · {num(m.sortino)} · {num(m.calmar)}</dd></div>
   <div><dt>Trades</dt><dd>{m.trades.count}<small>win rate {pct(m.trades.winRate)}</small></dd></div>
   <div><dt>Profit factor</dt><dd>{num(m.trades.profitFactor)}</dd></div>
   <div><dt>Expectancy</dt><dd>{inr(m.trades.expectancy)}<small>per trade</small></dd></div>
   <div><dt>Avg MAE / MFE</dt><dd>{inr(m.trades.averageMae)} / {inr(m.trades.averageMfe)}</dd></div>
   <div><dt>Gross P&amp;L</dt><dd>{inr(m.gross.pnl)}</dd></div>
   <div><dt>Costs</dt><dd>{inr(m.gross.costs)}</dd></div>
   <div><dt>Net P&amp;L</dt><dd className={(m.gross.net ?? 0) >= 0 ? 'positive' : 'negative'}>{inr(m.gross.net)}</dd></div>
   <div><dt>Best month share</dt><dd>{pct(m.bestMonthShare)}<small>{result.orders} orders · {result.ambiguousBars} ambiguous bars</small></dd></div>
  </dl>
  {m.monteCarlo && <p className="card-note">Monte-Carlo ({m.monteCarlo.paths} resampled trade sequences): final return 5th/50th/95th percentile {pct(m.monteCarlo.finalReturn.p5)} / {pct(m.monteCarlo.finalReturn.p50)} / {pct(m.monteCarlo.finalReturn.p95)}; 95th-percentile drawdown {pct(m.monteCarlo.maxDrawdown.p95)}; {pct(m.monteCarlo.probabilityOfLoss)} of paths lose money.</p>}
  {!!m.grade.deductions.length && <ul className="bullet-list">{m.grade.deductions.map(d => <li key={d.reason}>−{d.points.toFixed(0)}: {d.reason}</li>)}</ul>}
  {!!m.flags.length && <ul className="notice text-sm">{m.flags.map(f => <li key={f.id}><strong>{f.id.replaceAll('_', ' ').toLowerCase()}</strong>: {f.detail}</li>)}</ul>}
  <ResponsiveContainer width="100%" height={220}><LineChart data={result.curve.map(p => ({ date: new Date(p.time + 19800000).toISOString().slice(0, 10), equity: p.equity }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}><CartesianGrid stroke="#edf0f5" vertical={false} /><XAxis dataKey="date" minTickGap={70} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} /><YAxis domain={['auto', 'auto']} width={64} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} /><Tooltip /><Line dataKey="equity" dot={false} stroke="#3158d8" strokeWidth={1.6} /></LineChart></ResponsiveContainer>
  <ul className="caption list-disc pl-5">{result.limitations.map(l => <li key={l}>{l}</li>)}</ul>
 </div>;
}

function PaperStart({ spec, options }: { spec: StrategySpec; options: { capital: number; costBps: number; costPerOrder: number; slippageBps: number } }) {
 const [state, setState] = useState(''); const [busy, setBusy] = useState(false);
 return <div className="card-section"><p className="section-label">Paper run</p><p className="text-sm muted">Run this spec forward as a paper run with the same capital. It trades like live: live order book fills, the broker’s margin check and the published broker charges; option strikes are resolved on the live chain at entry.</p>
  <button className="btn btn-secondary" disabled={busy} onClick={() => { setBusy(true); setState(''); createRun(spec, { capital: options.capital, slippageBps: options.slippageBps, maxUnitsPerOrder: null, costModel: 'broker-tariff', requireMargin: true }).then(() => navigateTo('Paper trading')).catch(e => setState(e instanceof Error ? e.message : 'Paper run not created')).finally(() => setBusy(false)); }}>{busy ? 'Starting…' : 'Start paper run'}</button>{state && <p className="notice text-sm">{state}</p>}</div>;
}

function BacktestPanel({ spec }: { spec: StrategySpec }) {
 const [opts, setOpts] = useState({ capital: 100000, costBps: 10, costPerOrder: 20, slippageBps: 5, lotSize: 0 });
 const [bars, setBars] = useState<Awaited<ReturnType<typeof fetchSpecBars>> | null>(null);
 const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
 const key = JSON.stringify([spec.underlying, spec.timeframe]);
 useEffect(() => { setBars(null); }, [key]);
 const result = useMemo(() => bars ? runSpecBacktest(spec, bars.bars, { ...opts, lotSize: opts.lotSize || null }) : null, [bars, spec, opts]);
 const slider = (k: keyof typeof opts, label: string, max: number, step = 1) => <label className="range-field"><span>{label}<b>{opts[k]}</b></span><input type="range" min={0} max={max} step={step} value={opts[k]} onChange={e => setOpts(o => ({ ...o, [k]: Number(e.target.value) }))} /></label>;
 return <section className="card grid gap-4"><div className="builder-box-head"><h3>Backtest</h3>
   <button className="btn btn-primary" disabled={loading} onClick={() => { setLoading(true); setError(''); fetchSpecBars(spec).then(setBars).catch(e => setError(e instanceof Error ? e.message : 'History unavailable')).finally(() => setLoading(false)); }}>{loading ? 'Loading bars…' : bars ? 'Reload bars' : 'Run backtest'}</button></div>
  <div className="field-grid">{slider('costBps', 'Cost per side (bps)', 50)}{slider('costPerOrder', 'Flat per order (₹)', 100)}{slider('slippageBps', 'Slippage (bps)', 50)}
   <Field label="Capital (₹)"><input type="number" value={opts.capital} onChange={e => setOpts(o => ({ ...o, capital: Number(e.target.value) }))} /></Field>
   {spec.legs.some(l => l.instrument.type === 'future') && <Field label="Lot size"><input type="number" value={opts.lotSize || ''} onChange={e => setOpts(o => ({ ...o, lotSize: Number(e.target.value) }))} /></Field>}</div>
  {error && <p className="notice text-sm">{error}</p>}
  {bars && <p className="caption">{bars.symbol} · {bars.interval} bars over {bars.range}: {bars.bars.length} completed{bars.invalid ? `, ${bars.invalid} invalid skipped` : ''}{bars.incomplete ? `, ${bars.incomplete} in-progress excluded` : ''}. Costs and slippage recalculate instantly.</p>}
  {result && <BacktestView result={result} />}
  <PaperStart spec={spec} options={opts} />
 </section>;
}

export function RuleBuilderPage() {
 const [draft, setDraft] = useState<Draft>(() => { const d = loadSpecDraft(); const p = parseStrategySpec(d); return p.ok ? structuredClone(p.spec) as Draft : (d && typeof d === 'object' ? d as Draft : structuredClone(TEMPLATES['RSI below 30 (daily)'])); });
 const [json, setJson] = useState(''); const [jsonError, setJsonError] = useState('');
 const parsed = useMemo(() => parseStrategySpec(draft), [draft]);
 useEffect(() => { try { saveSpecDraft(draft); } catch { /* storage unavailable */ } }, [draft]);
 const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }));
 const indicators = Array.isArray(draft.indicators) ? draft.indicators : [];
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Rule builder</h2><p>Build a strategy as conditions over the indicator catalogue, validate it, and backtest it on completed bars. Drafts stay in this browser.</p></div>
   <div className="flex flex-wrap gap-2"><select className="btn btn-secondary" value="" onChange={e => e.target.value && setDraft(structuredClone(TEMPLATES[e.target.value]))}><option value="">Start from template…</option>{Object.keys(TEMPLATES).map(t => <option key={t}>{t}</option>)}</select><button className="btn btn-secondary" onClick={() => downloadJson('strategy-spec.json', draft)}>Download JSON</button></div></div>
  <section className="notice text-sm" role="note">Research and paper simulation only; nothing here places broker orders.</section>
  <section className="card grid gap-4"><h3>Strategy</h3><div className="field-grid">
   <Field label="Name"><input value={draft.name ?? ''} onChange={e => set({ name: e.target.value })} /></Field>
   <Field label="Mode"><select value={draft.mode} onChange={e => set({ mode: e.target.value as Draft['mode'], schedule: { ...draft.schedule, squareOff: e.target.value === 'intraday' ? draft.schedule?.squareOff ?? '15:15' : undefined } })}><option value="intraday">intraday</option><option value="positional">positional</option></select></Field>
   <Field label="Underlying"><input value={draft.underlying?.symbol ?? ''} onChange={e => set({ underlying: { ...draft.underlying, symbol: e.target.value.toUpperCase() } })} /></Field>
   <Field label="Kind"><select value={draft.underlying?.kind} onChange={e => set({ underlying: { ...draft.underlying, kind: e.target.value as 'equity' | 'index' } })}><option value="equity">equity</option><option value="index">index</option></select></Field>
   <Field label="Timeframe"><select value={draft.timeframe} onChange={e => set({ timeframe: e.target.value as Draft['timeframe'] })}>{TIMEFRAMES.map(t => <option key={t}>{t}</option>)}</select></Field>
   <Field label="Entry from (IST)"><input value={draft.schedule?.entryStart ?? ''} onChange={e => set({ schedule: { ...draft.schedule, entryStart: e.target.value } })} /></Field>
   <Field label="Entry until (IST)"><input value={draft.schedule?.entryEnd ?? ''} onChange={e => set({ schedule: { ...draft.schedule, entryEnd: e.target.value } })} /></Field>
   {draft.mode === 'intraday' && <Field label="Square off (IST)"><input value={draft.schedule?.squareOff ?? ''} onChange={e => set({ schedule: { ...draft.schedule, squareOff: e.target.value } })} /></Field>}
  </div></section>
  <section className="card grid gap-4"><div><h3>Indicators</h3><p className="caption">Each indicator gets an ID that conditions refer to.</p></div>
   <div className="builder-list">{indicators.map((ind, i) => <div key={i} className="builder-box"><div className="field-row">
    <Field label="ID" className="w-sm"><input value={ind.id} onChange={e => set({ indicators: indicators.map((x, k) => k === i ? { ...x, id: e.target.value } : x) })} /></Field>
    <Field label="Type" className="w-md"><select value={ind.type} onChange={e => { const type = e.target.value as IndicatorType, def = INDICATOR_TYPES[type]; set({ indicators: indicators.map((x, k) => k === i ? { id: x.id, type, params: Object.fromEntries(Object.entries(def.params).map(([p, [min]]) => [p, Math.max(min, p === 'length' ? 14 : p === 'multiplier' ? 3 : p === 'fast' ? 12 : p === 'slow' ? 26 : p === 'signal' ? 9 : min)])), ...(def.source ? { source: 'close' as const } : {}) } : x) }); }}>{Object.keys(INDICATOR_TYPES).map(t => <option key={t}>{t}</option>)}</select></Field>
    {Object.keys(INDICATOR_TYPES[ind.type]?.params ?? {}).map(p => <Field key={p} label={p[0].toUpperCase() + p.slice(1)} className="w-xs"><input type="number" step="any" value={ind.params?.[p] ?? ''} onChange={e => set({ indicators: indicators.map((x, k) => k === i ? { ...x, params: { ...x.params, [p]: Number(e.target.value) } } : x) })} /></Field>)}
    {INDICATOR_TYPES[ind.type]?.source && <Field label="Source" className="w-sm"><select value={ind.source ?? 'close'} onChange={e => set({ indicators: indicators.map((x, k) => k === i ? { ...x, source: e.target.value as typeof x.source } : x) })}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></Field>}
    <Remove onClick={() => set({ indicators: indicators.filter((_, k) => k !== i) })} label={`Remove indicator ${ind.id}`} /></div></div>)}</div>
   <div className="add-row"><Add onClick={() => set({ indicators: [...indicators, { id: 'ind' + (indicators.length + 1), type: 'ema', params: { length: 20 }, source: 'close' }] })}>Indicator</Add></div></section>
  <section className="card grid gap-4"><h3>Entry when</h3><ConditionEditor value={draft.entry ?? always} indicators={indicators} onChange={entry => set({ entry })} />
   <h3>Exit when <span className="faint text-sm font-normal">optional</span></h3>{draft.exit ? <ConditionEditor value={draft.exit} indicators={indicators} onChange={exit => set({ exit })} onRemove={() => set({ exit: undefined })} /> : <div className="add-row"><Add onClick={() => set({ exit: { all: [always] } })}>Exit condition</Add></div>}</section>
  <section className="card grid gap-4"><h3>Legs</h3><div className="builder-list">{(draft.legs ?? []).map((leg, i) => <LegEditor key={i} leg={leg} indexUnderlying={draft.underlying?.kind === 'index'} onChange={l => set({ legs: draft.legs.map((x, k) => k === i ? l : x) })} onRemove={draft.legs.length > 1 ? () => set({ legs: draft.legs.filter((_, k) => k !== i) }) : undefined} />)}</div>
   {(draft.legs?.length ?? 0) < 6 && <div className="add-row"><Add onClick={() => set({ legs: [...(draft.legs ?? []), { id: 'leg' + ((draft.legs?.length ?? 0) + 1), side: 'BUY', instrument: { type: 'equity' }, quantity: { units: 1 } }] })}>Leg</Add></div>}
   <p className="section-label">Strategy risk</p>
   <div className="field-grid"><Field label="Max loss (₹)"><input type="number" value={draft.risk?.maxLoss?.value ?? ''} onChange={e => set({ risk: { ...draft.risk, maxLoss: e.target.value ? { unit: 'amount', value: Number(e.target.value) } : undefined } })} /></Field>
    <Field label="Target (₹)"><input type="number" value={draft.risk?.target?.value ?? ''} onChange={e => set({ risk: { ...draft.risk, target: e.target.value ? { unit: 'amount', value: Number(e.target.value) } : undefined } })} /></Field>
    <Field label="Re-entries after stop-loss per day"><input type="number" min={0} max={10} value={draft.risk?.reEntry?.maxCount ?? 0} onChange={e => set({ risk: { ...draft.risk, reEntry: Number(e.target.value) ? { maxCount: Number(e.target.value), after: 'stop-loss' } : undefined } })} /></Field></div></section>
  <section className="card grid gap-3"><div className="builder-box-head"><h3>Validation</h3><span className={`badge ${parsed.ok ? 'badge-green' : 'badge-red'}`}>{parsed.ok ? 'Valid spec' : `${parsed.issues.length} issue${parsed.issues.length === 1 ? '' : 's'}`}</span></div>
   {!parsed.ok && <ul className="card-note warn list-disc pl-6">{parsed.issues.map(i => <li key={i.path + i.message}>{i.path}: {i.message}</li>)}</ul>}
   <details className="card-disclosure"><summary>Edit as JSON</summary><div><textarea className="w-full h-64 font-mono text-xs border rounded-lg p-3" value={json || JSON.stringify(draft, null, 2)} onChange={e => setJson(e.target.value)} />
    <div className="card-actions"><button className="btn btn-secondary" onClick={() => { try { setDraft(JSON.parse(json || JSON.stringify(draft))); setJson(''); setJsonError(''); } catch (e) { setJsonError(e instanceof Error ? e.message : 'Invalid JSON'); } }}>Apply JSON</button>{jsonError && <span className="text-sm negative">{jsonError}</span>}</div></div></details></section>
  {parsed.ok && <BacktestPanel spec={parsed.spec as StrategySpec} />}
 </div>;
}
