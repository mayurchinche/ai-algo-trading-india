import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { parseStrategySpec, INDICATOR_TYPES, COMPARATORS, PRICE_FIELDS, SOURCES, TIMEFRAMES, type StrategySpec, type Condition, type Operand, type IndicatorType, type Leg } from '../../shared/strategySpec';
import { runSpecBacktest, type BacktestResult } from '../../shared/specBacktest';
import { fetchSpecBars } from '../services/specBars';
import { loadSpecDraft, saveSpecDraft, downloadJson } from '../services/specDraft';
import { TEMPLATES, ALWAYS } from '../services/specTemplates';
import { createRun } from '../services/specPaper';
import { navigateTo } from '../services/specDraft';

type Draft = StrategySpec;
const always: Condition = ALWAYS;
const input = 'rounded border p-1';
const pct = (n: number | null | undefined) => n === null || n === undefined ? '—' : (n * 100).toFixed(1) + '%';
const num = (n: number | null | undefined, d = 2) => n === null || n === undefined ? '—' : n.toFixed(d);

function OperandEditor({ value, onChange, indicators }: { value: Operand; onChange: (o: Operand) => void; indicators: Draft['indicators'] }) {
 const kind = 'indicator' in value ? 'indicator' : 'price' in value ? 'price' : 'value';
 const ind = 'indicator' in value ? indicators.find(i => i.id === value.indicator) : undefined;
 return <span className="inline-flex gap-1 flex-wrap">
  <select className={input} value={kind} onChange={e => onChange(e.target.value === 'indicator' ? { indicator: indicators[0]?.id ?? '' } : e.target.value === 'price' ? { price: 'close' } : { value: 0 })}><option value="indicator">indicator</option><option value="price">price</option><option value="value">number</option></select>
  {'indicator' in value && <><select className={input} value={value.indicator} onChange={e => onChange({ indicator: e.target.value })}>{indicators.map(i => <option key={i.id} value={i.id}>{i.id}</option>)}</select>
   {ind && INDICATOR_TYPES[ind.type].outputs.length > 1 && <select className={input} value={value.output ?? INDICATOR_TYPES[ind.type].outputs[0]} onChange={e => onChange({ ...value, output: e.target.value })}>{INDICATOR_TYPES[ind.type].outputs.map(o => <option key={o}>{o}</option>)}</select>}</>}
  {'price' in value && <select className={input} value={value.price} onChange={e => onChange({ ...value, price: e.target.value as typeof value.price })}>{PRICE_FIELDS.map(p => <option key={p}>{p}</option>)}</select>}
  {'value' in value && <input type="number" step="any" className={input + ' w-20'} value={value.value} onChange={e => onChange({ value: Number(e.target.value) })} />}
  {!('value' in value) && <label className="text-xs">bars ago<input type="number" min={0} max={50} className={input + ' w-14'} value={value.barsAgo ?? 0} onChange={e => onChange({ ...value, barsAgo: Number(e.target.value) || undefined } as Operand)} /></label>}
 </span>;
}

export function ConditionEditor({ value, onChange, indicators, onRemove }: { value: Condition; onChange: (c: Condition) => void; indicators: Draft['indicators']; onRemove?: () => void }) {
 const remove = onRemove && <button type="button" className="underline text-xs" onClick={onRemove}>remove</button>;
 if ('compare' in value) {
  const c = value.compare;
  return <div className="flex gap-2 items-center flex-wrap"><OperandEditor value={c.left} indicators={indicators} onChange={left => onChange({ compare: { ...c, left } })} />
   <select className={input} value={c.op} onChange={e => onChange({ compare: { ...c, op: e.target.value as typeof c.op } })}>{COMPARATORS.map(o => <option key={o}>{o}</option>)}</select>
   <OperandEditor value={c.right} indicators={indicators} onChange={right => onChange({ compare: { ...c, right } })} />{remove}</div>;
 }
 if ('not' in value) return <div className="border-l-2 pl-3 space-y-1"><span className="text-xs font-semibold">NOT</span> {remove}<ConditionEditor value={value.not} indicators={indicators} onChange={not => onChange({ not })} /></div>;
 const key = 'all' in value ? 'all' : 'any', list = 'all' in value ? value.all : value.any;
 const set = (items: Condition[]) => onChange((key === 'all' ? { all: items } : { any: items }) as Condition);
 return <div className="border-l-2 pl-3 space-y-2">
  <div className="flex gap-2 items-center"><select className={input} value={key} onChange={e => onChange((e.target.value === 'all' ? { all: list } : { any: list }) as Condition)}><option value="all">ALL of</option><option value="any">ANY of</option></select>{remove}</div>
  {list.map((c, i) => <ConditionEditor key={i} value={c} indicators={indicators} onChange={n => set(list.map((x, k) => k === i ? n : x))} onRemove={list.length > 1 ? () => set(list.filter((_, k) => k !== i)) : undefined} />)}
  <div className="flex gap-3 text-xs"><button type="button" className="underline" onClick={() => set([...list, always])}>+ comparison</button><button type="button" className="underline" onClick={() => set([...list, { all: [always] }])}>+ group</button><button type="button" className="underline" onClick={() => set([...list, { not: always }])}>+ not</button></div>
 </div>;
}

function LegEditor({ leg, onChange, onRemove, indexUnderlying }: { leg: Leg; onChange: (l: Leg) => void; onRemove?: () => void; indexUnderlying: boolean }) {
 const ins = leg.instrument, level = (key: 'stopLoss' | 'target', label: string) => <label className="text-xs">{label}<input type="number" min={0} step="any" className={input + ' w-20 ml-1'} value={leg[key]?.value ?? ''} onChange={e => onChange({ ...leg, [key]: e.target.value === '' ? undefined : { unit: leg[key]?.unit ?? 'percent', value: Number(e.target.value) } })} />
  <select className={input} value={leg[key]?.unit ?? 'percent'} onChange={e => leg[key] && onChange({ ...leg, [key]: { ...leg[key]!, unit: e.target.value as 'percent' | 'points' } })}><option value="percent">%</option><option value="points">pts</option></select></label>;
 return <div className="border rounded-lg p-2 space-y-2 text-sm"><div className="flex gap-2 flex-wrap items-center">
  <input className={input + ' w-24'} value={leg.id} onChange={e => onChange({ ...leg, id: e.target.value })} />
  <select className={input} value={leg.side} onChange={e => onChange({ ...leg, side: e.target.value as Leg['side'] })}><option>BUY</option><option>SELL</option></select>
  <select className={input} value={ins.type} onChange={e => onChange({ ...leg, instrument: e.target.value === 'equity' ? { type: 'equity' } : e.target.value === 'future' ? { type: 'future', expiry: 'current-month' } : { type: 'option', optionType: 'CE', expiry: indexUnderlying ? 'current-week' : 'current-month', strike: { mode: 'atm-offset', steps: 0 } }, quantity: e.target.value === 'equity' ? { units: 1 } : { lots: 1 } })}><option value="equity">equity</option><option value="future">future</option><option value="option">option</option></select>
  {ins.type === 'option' && <><select className={input} value={ins.optionType} onChange={e => onChange({ ...leg, instrument: { ...ins, optionType: e.target.value as 'CE' | 'PE' } })}><option>CE</option><option>PE</option></select>
   <label className="text-xs">ATM offset<input type="number" className={input + ' w-14 ml-1'} value={ins.strike.mode === 'atm-offset' ? ins.strike.steps : 0} onChange={e => onChange({ ...leg, instrument: { ...ins, strike: { mode: 'atm-offset', steps: Number(e.target.value) } } })} /></label></>}
  <label className="text-xs">{'units' in leg.quantity ? 'units' : 'lots'}<input type="number" min={1} className={input + ' w-20 ml-1'} value={'units' in leg.quantity ? leg.quantity.units : leg.quantity.lots} onChange={e => onChange({ ...leg, quantity: 'units' in leg.quantity ? { units: Number(e.target.value) } : { lots: Number(e.target.value) } })} /></label>
  {onRemove && <button type="button" className="underline text-xs" onClick={onRemove}>remove</button>}</div>
  <div className="flex gap-3 flex-wrap">{level('stopLoss', 'Stop-loss')}{level('target', 'Target')}
   <label className="text-xs">Trail every<input type="number" min={0} step="any" className={input + ' w-16 mx-1'} value={leg.trailingStop?.trigger ?? ''} onChange={e => onChange({ ...leg, trailingStop: e.target.value === '' ? undefined : { unit: leg.stopLoss?.unit ?? 'percent', trigger: Number(e.target.value), step: leg.trailingStop?.step ?? Number(e.target.value) } })} />by<input type="number" min={0} step="any" className={input + ' w-16 ml-1'} value={leg.trailingStop?.step ?? ''} onChange={e => leg.trailingStop && onChange({ ...leg, trailingStop: { ...leg.trailingStop, step: Number(e.target.value) } })} /></label></div>
 </div>;
}

export function BacktestView({ result }: { result: BacktestResult }) {
 if (result.status === 'UNSUPPORTED_OPTION_LEGS') return <p className="text-sm">Not backtested: option legs ({result.legs.join(', ')}). {result.reason} Use a paper run to observe it forward.</p>;
 if (result.status !== 'OK') return <p className="text-sm">Not backtested: {result.status.replaceAll('_', ' ').toLowerCase()}.</p>;
 const m = result.metrics;
 if (m.status !== 'OK') return <p className="text-sm">No bars to evaluate.</p>;
 return <div className="space-y-3">
  <p><strong>Grade {m.grade.grade}</strong> (score {m.grade.score.toFixed(0)}) · {m.grade.note}</p>
  <div className="grid sm:grid-cols-4 gap-2 text-sm">
   <span>Net return {pct(m.totalReturn)}</span><span>CAGR {pct(m.cagr)}</span><span>Max drawdown {pct(m.maxDrawdown)}</span><span>Sharpe {num(m.sharpe)} · Sortino {num(m.sortino)} · Calmar {num(m.calmar)}</span>
   <span>Trades {m.trades.count} · win {pct(m.trades.winRate)}</span><span>Profit factor {num(m.trades.profitFactor)}</span><span>Expectancy ₹{num(m.trades.expectancy, 0)}</span><span>Avg MAE ₹{num(m.trades.averageMae, 0)} / MFE ₹{num(m.trades.averageMfe, 0)}</span>
   <span>Gross ₹{num(m.gross.pnl, 0)} · costs ₹{num(m.gross.costs, 0)} · net ₹{num(m.gross.net, 0)}</span><span>Best month share {pct(m.bestMonthShare)}</span><span>Orders {result.orders}</span><span>Ambiguous bars {result.ambiguousBars}</span>
  </div>
  {m.monteCarlo && <p className="text-sm">Monte-Carlo ({m.monteCarlo.paths} resampled trade sequences): final return 5th/50th/95th percentile {pct(m.monteCarlo.finalReturn.p5)} / {pct(m.monteCarlo.finalReturn.p50)} / {pct(m.monteCarlo.finalReturn.p95)}; 95th-percentile drawdown {pct(m.monteCarlo.maxDrawdown.p95)}; {pct(m.monteCarlo.probabilityOfLoss)} of paths lose money.</p>}
  {!!m.grade.deductions.length && <ul className="text-sm list-disc pl-5">{m.grade.deductions.map(d => <li key={d.reason}>−{d.points.toFixed(0)}: {d.reason}</li>)}</ul>}
  {!!m.flags.length && <ul className="notice text-sm">{m.flags.map(f => <li key={f.id}><strong>{f.id.replaceAll('_', ' ').toLowerCase()}</strong>: {f.detail}</li>)}</ul>}
  <ResponsiveContainer width="100%" height={220}><LineChart data={result.curve.map(p => ({ date: new Date(p.time + 19800000).toISOString().slice(0, 10), equity: p.equity }))}><XAxis dataKey="date" minTickGap={60} /><YAxis domain={['auto', 'auto']} /><Tooltip /><Line dataKey="equity" dot={false} stroke="#2563eb" /></LineChart></ResponsiveContainer>
  <ul className="text-xs list-disc pl-5">{result.limitations.map(l => <li key={l}>{l}</li>)}</ul>
 </div>;
}

function PaperStart({ spec, options }: { spec: StrategySpec; options: { capital: number; costBps: number; costPerOrder: number; slippageBps: number } }) {
 const [state, setState] = useState(''); const [busy, setBusy] = useState(false);
 return <div className="border-t pt-3 space-y-1"><p className="text-sm">Run this spec forward as a paper run with the same capital and cost settings. The scheduler steps it on live read-only data; option strikes are resolved on the live chain at entry.</p>
  <button className="btn btn-secondary" disabled={busy} onClick={() => { setBusy(true); setState(''); createRun(spec, { capital: options.capital, costBps: options.costBps, costPerOrder: options.costPerOrder, slippageBps: options.slippageBps, maxUnitsPerOrder: null }).then(() => navigateTo('Spec paper')).catch(e => setState(e instanceof Error ? e.message : 'Paper run not created')).finally(() => setBusy(false)); }}>{busy ? 'Starting…' : 'Start paper run'}</button>{state && <p className="notice text-sm">{state}</p>}</div>;
}

function BacktestPanel({ spec }: { spec: StrategySpec }) {
 const [opts, setOpts] = useState({ capital: 100000, costBps: 10, costPerOrder: 20, slippageBps: 5, lotSize: 0 });
 const [bars, setBars] = useState<Awaited<ReturnType<typeof fetchSpecBars>> | null>(null);
 const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
 const key = JSON.stringify([spec.underlying, spec.timeframe]);
 useEffect(() => { setBars(null); }, [key]);
 const result = useMemo(() => bars ? runSpecBacktest(spec, bars.bars, { ...opts, lotSize: opts.lotSize || null }) : null, [bars, spec, opts]);
 const slider = (k: keyof typeof opts, label: string, max: number, step = 1) => <label className="text-sm">{label}: {opts[k]}<input type="range" min={0} max={max} step={step} value={opts[k]} onChange={e => setOpts(o => ({ ...o, [k]: Number(e.target.value) }))} className="block w-full" /></label>;
 return <section className="card space-y-3"><h3>Backtest</h3>
  <div className="grid sm:grid-cols-5 gap-3">{slider('costBps', 'Cost per side (bps)', 50)}{slider('costPerOrder', 'Flat per order (₹)', 100)}{slider('slippageBps', 'Slippage (bps)', 50)}
   <label className="text-sm">Capital (₹)<input type="number" className={input + ' block w-full'} value={opts.capital} onChange={e => setOpts(o => ({ ...o, capital: Number(e.target.value) }))} /></label>
   {spec.legs.some(l => l.instrument.type === 'future') && <label className="text-sm">Lot size<input type="number" className={input + ' block w-full'} value={opts.lotSize || ''} onChange={e => setOpts(o => ({ ...o, lotSize: Number(e.target.value) }))} /></label>}</div>
  <button className="btn btn-secondary" disabled={loading} onClick={() => { setLoading(true); setError(''); fetchSpecBars(spec).then(setBars).catch(e => setError(e instanceof Error ? e.message : 'History unavailable')).finally(() => setLoading(false)); }}>{loading ? 'Loading bars…' : bars ? 'Reload bars' : 'Run backtest'}</button>
  {error && <p className="notice text-sm">{error}</p>}
  {bars && <p className="text-xs">{bars.symbol} · {bars.interval} bars over {bars.range}: {bars.bars.length} completed{bars.invalid ? `, ${bars.invalid} invalid skipped` : ''}{bars.incomplete ? `, ${bars.incomplete} in-progress excluded` : ''}. Costs and slippage recalculate instantly.</p>}
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
   <div className="flex gap-2"><select className="btn btn-secondary" value="" onChange={e => e.target.value && setDraft(structuredClone(TEMPLATES[e.target.value]))}><option value="">Start from template…</option>{Object.keys(TEMPLATES).map(t => <option key={t}>{t}</option>)}</select><button className="btn btn-secondary" onClick={() => downloadJson('strategy-spec.json', draft)}>Download JSON</button></div></div>
  <section className="notice text-sm" role="note">Research and paper simulation only; nothing here places broker orders.</section>
  <section className="card space-y-3"><h3>Strategy</h3><div className="grid sm:grid-cols-4 gap-3 text-sm">
   <label>Name<input className={input + ' block w-full'} value={draft.name ?? ''} onChange={e => set({ name: e.target.value })} /></label>
   <label>Mode<select className={input + ' block w-full'} value={draft.mode} onChange={e => set({ mode: e.target.value as Draft['mode'], schedule: { ...draft.schedule, squareOff: e.target.value === 'intraday' ? draft.schedule?.squareOff ?? '15:15' : undefined } })}><option value="intraday">intraday</option><option value="positional">positional</option></select></label>
   <label>Underlying<input className={input + ' block w-full'} value={draft.underlying?.symbol ?? ''} onChange={e => set({ underlying: { ...draft.underlying, symbol: e.target.value.toUpperCase() } })} /></label>
   <label>Kind<select className={input + ' block w-full'} value={draft.underlying?.kind} onChange={e => set({ underlying: { ...draft.underlying, kind: e.target.value as 'equity' | 'index' } })}><option value="equity">equity</option><option value="index">index</option></select></label>
   <label>Timeframe<select className={input + ' block w-full'} value={draft.timeframe} onChange={e => set({ timeframe: e.target.value as Draft['timeframe'] })}>{TIMEFRAMES.map(t => <option key={t}>{t}</option>)}</select></label>
   <label>Entry from<input className={input + ' block w-full'} value={draft.schedule?.entryStart ?? ''} onChange={e => set({ schedule: { ...draft.schedule, entryStart: e.target.value } })} /></label>
   <label>Entry until<input className={input + ' block w-full'} value={draft.schedule?.entryEnd ?? ''} onChange={e => set({ schedule: { ...draft.schedule, entryEnd: e.target.value } })} /></label>
   {draft.mode === 'intraday' && <label>Square off<input className={input + ' block w-full'} value={draft.schedule?.squareOff ?? ''} onChange={e => set({ schedule: { ...draft.schedule, squareOff: e.target.value } })} /></label>}
  </div></section>
  <section className="card space-y-2"><h3>Indicators</h3>{indicators.map((ind, i) => <div key={i} className="flex gap-2 flex-wrap items-center text-sm">
   <input className={input + ' w-24'} value={ind.id} onChange={e => set({ indicators: indicators.map((x, k) => k === i ? { ...x, id: e.target.value } : x) })} />
   <select className={input} value={ind.type} onChange={e => { const type = e.target.value as IndicatorType, def = INDICATOR_TYPES[type]; set({ indicators: indicators.map((x, k) => k === i ? { id: x.id, type, params: Object.fromEntries(Object.entries(def.params).map(([p, [min]]) => [p, Math.max(min, p === 'length' ? 14 : p === 'multiplier' ? 3 : p === 'fast' ? 12 : p === 'slow' ? 26 : p === 'signal' ? 9 : min)])), ...(def.source ? { source: 'close' as const } : {}) } : x) }); }}>{Object.keys(INDICATOR_TYPES).map(t => <option key={t}>{t}</option>)}</select>
   {Object.keys(INDICATOR_TYPES[ind.type]?.params ?? {}).map(p => <label key={p} className="text-xs">{p}<input type="number" step="any" className={input + ' w-16 ml-1'} value={ind.params?.[p] ?? ''} onChange={e => set({ indicators: indicators.map((x, k) => k === i ? { ...x, params: { ...x.params, [p]: Number(e.target.value) } } : x) })} /></label>)}
   {INDICATOR_TYPES[ind.type]?.source && <select className={input} value={ind.source ?? 'close'} onChange={e => set({ indicators: indicators.map((x, k) => k === i ? { ...x, source: e.target.value as typeof x.source } : x) })}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select>}
   <button className="underline text-xs" onClick={() => set({ indicators: indicators.filter((_, k) => k !== i) })}>remove</button></div>)}
   <button className="underline text-sm" onClick={() => set({ indicators: [...indicators, { id: 'ind' + (indicators.length + 1), type: 'ema', params: { length: 20 }, source: 'close' }] })}>+ indicator</button></section>
  <section className="card space-y-2"><h3>Entry when</h3><ConditionEditor value={draft.entry ?? always} indicators={indicators} onChange={entry => set({ entry })} />
   <h3>Exit when (optional)</h3>{draft.exit ? <ConditionEditor value={draft.exit} indicators={indicators} onChange={exit => set({ exit })} onRemove={() => set({ exit: undefined })} /> : <button className="underline text-sm" onClick={() => set({ exit: { all: [always] } })}>+ exit condition</button>}</section>
  <section className="card space-y-2"><h3>Legs</h3>{(draft.legs ?? []).map((leg, i) => <LegEditor key={i} leg={leg} indexUnderlying={draft.underlying?.kind === 'index'} onChange={l => set({ legs: draft.legs.map((x, k) => k === i ? l : x) })} onRemove={draft.legs.length > 1 ? () => set({ legs: draft.legs.filter((_, k) => k !== i) }) : undefined} />)}
   {(draft.legs?.length ?? 0) < 6 && <button className="underline text-sm" onClick={() => set({ legs: [...(draft.legs ?? []), { id: 'leg' + ((draft.legs?.length ?? 0) + 1), side: 'BUY', instrument: { type: 'equity' }, quantity: { units: 1 } }] })}>+ leg</button>}
   <div className="flex gap-3 text-sm flex-wrap"><label>Strategy max loss (₹)<input type="number" className={input + ' w-24 ml-1'} value={draft.risk?.maxLoss?.value ?? ''} onChange={e => set({ risk: { ...draft.risk, maxLoss: e.target.value ? { unit: 'amount', value: Number(e.target.value) } : undefined } })} /></label>
    <label>Strategy target (₹)<input type="number" className={input + ' w-24 ml-1'} value={draft.risk?.target?.value ?? ''} onChange={e => set({ risk: { ...draft.risk, target: e.target.value ? { unit: 'amount', value: Number(e.target.value) } : undefined } })} /></label>
    <label>Re-entries after stop-loss per day<input type="number" min={0} max={10} className={input + ' w-16 ml-1'} value={draft.risk?.reEntry?.maxCount ?? 0} onChange={e => set({ risk: { ...draft.risk, reEntry: Number(e.target.value) ? { maxCount: Number(e.target.value), after: 'stop-loss' } : undefined } })} /></label></div></section>
  <section className="card space-y-2"><h3>Validation</h3>{parsed.ok ? <p className="text-sm">Valid strategy spec.</p> : <ul className="notice text-sm">{parsed.issues.map(i => <li key={i.path + i.message}>{i.path}: {i.message}</li>)}</ul>}
   <details><summary className="text-sm">Edit as JSON</summary><textarea className="w-full h-64 font-mono text-xs border rounded p-2" value={json || JSON.stringify(draft, null, 2)} onChange={e => setJson(e.target.value)} />
    <button className="btn btn-secondary" onClick={() => { try { setDraft(JSON.parse(json || JSON.stringify(draft))); setJson(''); setJsonError(''); } catch (e) { setJsonError(e instanceof Error ? e.message : 'Invalid JSON'); } }}>Apply JSON</button>{jsonError && <p className="text-sm">{jsonError}</p>}</details></section>
  {parsed.ok && <BacktestPanel spec={parsed.spec as StrategySpec} />}
 </div>;
}
