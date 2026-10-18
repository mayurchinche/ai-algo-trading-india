import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PRESETS, INDEX_UNDERLYINGS, buildWizardSpec, resolveLegs, payoff, type PresetId, type WizardInput, type Payoff } from '../../shared/optionsWizard';
import type { OptionChain } from '../../shared/optionChain';
import type { Expiry } from '../../shared/strategySpec';
import { NIFTY50_UNIVERSE } from '../../shared/universes';
import { apiUrl } from '../utils/apiUrl';
import { saveSpecDraft, downloadJson, navigateTo } from '../services/specDraft';

const rupees = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
export async function fetchChain(underlying: string, expiry: string, signal?: AbortSignal): Promise<OptionChain> {
 const r = await fetch(apiUrl(`/api/option-chain?underlying=${encodeURIComponent(underlying)}&expiry=${expiry}`), { signal: signal ?? AbortSignal.timeout(30000) });
 const b = await r.json().catch(() => ({ error: 'Option chain service returned a page instead of JSON' }));
 if (!r.ok) throw new Error(`${b.error ?? 'Option chain unavailable'}${b.reason ? ' (' + String(b.reason).replaceAll('_', ' ').toLowerCase() + ')' : ''}`);
 return b as OptionChain;
}

export function PayoffView({ result }: { result: Payoff }) {
 if (result.status !== 'OK') return <p className="text-sm">Payoff unavailable: {result.unresolved.map(l => `${l.id} (${l.status.replaceAll('_', ' ').toLowerCase()})`).join(', ')}.</p>;
 const g = result.greeks, bound = (m: { status: string; value: number }) => m.status === 'WITHIN_RANGE' ? '₹' + rupees(m.value) : `unlimited (₹${rupees(m.value)} at range edge)`;
 return <div className="space-y-2">
  <p className="text-sm">At {result.evaluatedAt ?? 'expiry'}: net premium {result.netPremium >= 0 ? 'received' : 'paid'} ₹{rupees(Math.abs(result.netPremium))}; max profit {bound(result.maxProfit)}; max loss {bound(result.maxLoss)}; breakevens {result.breakevens.map(b => rupees(b)).join(', ') || 'none in range'}.{result.lotSize === 'UNKNOWN_PER_UNIT' ? ' Lot size unknown: values are per unit.' : ''}</p>
  <p className="text-sm">Net Greeks now: delta {g.delta.toFixed(1)}, gamma {g.gamma.toFixed(4)}, theta {rupees(g.theta)}/day, vega {rupees(g.vega)} per IV point.</p>
  <ResponsiveContainer width="100%" height={240}><LineChart data={result.curve}><XAxis dataKey="price" type="number" domain={['dataMin', 'dataMax']} tickFormatter={v => rupees(v)} /><YAxis tickFormatter={v => rupees(v)} /><Tooltip formatter={v => typeof v === 'number' ? '₹' + rupees(v) : String(v)} labelFormatter={v => 'Underlying ' + rupees(Number(v))} /><ReferenceLine y={0} stroke="#888" /><Line dataKey="pnl" dot={false} stroke="#2563eb" name="P&L at expiry" /></LineChart></ResponsiveContainer>
  <ul className="text-xs list-disc pl-5">{result.notes.map(n => <li key={n}>{n}</li>)}</ul>
 </div>;
}

const underlyings = [...INDEX_UNDERLYINGS.map(u => ({ id: u, label: u, kind: 'index' as const })), ...NIFTY50_UNIVERSE.members.map(m => ({ id: 'NSE_EQ|' + m.isin, label: m.symbol, kind: 'equity' as const }))];
export function OptionsWizardPage() {
 const [input, setInput] = useState<WizardInput>({ preset: 'iron-condor', underlying: 'NIFTY', kind: 'index', expiry: 'current-week', lots: 1, w: 2, g: 2, mode: 'intraday', legStopLossPct: 50, maxLossAmount: 5000 });
 const [chains, setChains] = useState<Partial<Record<Expiry, OptionChain>>>({});
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const u = underlyings.find(x => x.id === input.underlying)!;
 const specKey = JSON.stringify({ ...input, underlying: u.label, kind: u.kind });
 const built = useMemo(() => buildWizardSpec(JSON.parse(specKey)), [specKey]);
 const expiryKey = built.ok ? [...new Set(built.spec.legs.flatMap(l => l.instrument.type === 'option' ? [l.instrument.expiry] : []))].join(',') : '';
 const chainUnderlying = input.underlying;
 useEffect(() => {
  if (!expiryKey) return;
  const controller = new AbortController(); setLoading(true); setError(''); setChains({});
  Promise.all(expiryKey.split(',').map(async e => [e, await fetchChain(chainUnderlying, e, controller.signal)] as const))
   .then(list => { if (!controller.signal.aborted) setChains(Object.fromEntries(list)); })
   .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Option chain unavailable'); })
   .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [chainUnderlying, expiryKey]);
 const legs = built.ok && Object.keys(chains).length ? resolveLegs(built.spec, chains) : null;
 const anyChain = Object.values(chains)[0];
 const result = legs && anyChain ? payoff(legs, { spot: anyChain.spot }) : null;
 const set = (patch: Partial<WizardInput>) => setInput(i => ({ ...i, ...patch }));
 const num = (key: keyof WizardInput, label: string, min: number, max: number, step = 1) => <label>{label}<input type="number" min={min} max={max} step={step} className="block w-full rounded-lg border p-2 mt-1" value={(input[key] as number | undefined) ?? ''} onChange={e => set({ [key]: e.target.value === '' ? undefined : Number(e.target.value) } as Partial<WizardInput>)} /></label>;
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Options Wizard</h2><p>Pick a standard structure; strikes are resolved on the live chain and the result is a strategy spec for the rule builder, backtester and paper runs.</p></div></div>
  <section className="notice text-sm" role="note">Research and paper simulation only. No orders are placed. Option prices come from a read-only chain without per-contract timestamps.</section>
  <section className="card space-y-3"><div className="grid sm:grid-cols-3 gap-3">
   <label>Structure<select className="block w-full rounded-lg border p-2 mt-1" value={input.preset} onChange={e => set({ preset: e.target.value as PresetId })}>{Object.entries(PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label} — {p.view}</option>)}</select></label>
   <label>Underlying<select className="block w-full rounded-lg border p-2 mt-1" value={input.underlying} onChange={e => { const n = underlyings.find(x => x.id === e.target.value)!; set({ underlying: n.id, kind: n.kind, expiry: n.kind === 'equity' && input.expiry.endsWith('week') ? 'current-month' : input.expiry }); }}>{underlyings.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
   <label>Expiry<select className="block w-full rounded-lg border p-2 mt-1" value={input.expiry} onChange={e => set({ expiry: e.target.value as Expiry })}>{(['current-week', 'next-week', 'current-month', 'next-month'] as const).filter(x => u.kind === 'index' || x.endsWith('month')).map(x => <option key={x} value={x}>{x.replace('-', ' ')}</option>)}</select></label>
   {num('lots', 'Lots', 1, 50)}{num('w', 'Distance from ATM (strikes)', 0, 20)}{num('g', 'Wing width (strikes)', 1, 20)}
   <label>Mode<select className="block w-full rounded-lg border p-2 mt-1" value={input.mode} onChange={e => set({ mode: e.target.value as 'intraday' | 'positional' })}><option value="intraday">Intraday (square off 15:15)</option><option value="positional">Positional (exit on expiry day)</option></select></label>
   {num('legStopLossPct', 'Leg stop-loss (% of premium)', 1, 1000)}{num('maxLossAmount', 'Strategy max loss (₹)', 1, 10000000, 100)}
  </div>
   {!built.ok && <ul className="notice text-sm">{built.issues.map(i => <li key={i.path}>{i.path}: {i.message}</li>)}</ul>}
  </section>
  {loading && <p className="text-sm" role="status">Loading option chain…</p>}
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {legs && <section className="card space-y-3"><h3>Legs</h3><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Leg</th><th>Side</th><th>Contract</th><th className="text-right">Lots</th><th className="text-right">Mid</th><th className="text-right">Model IV</th><th>Status</th></tr></thead><tbody>{legs.map(l => <tr key={l.id}><td>{l.id}</td><td>{l.sign === 1 ? 'Buy' : l.sign === -1 ? 'Sell' : '—'}</td><td>{l.kind === 'future' ? 'Future (at spot)' : l.strike ? `${l.strike} ${l.optionType} · ${l.expiry}` : '—'}</td><td className="text-right">{l.lots ?? '—'}</td><td className="text-right font-mono">{l.entry?.toFixed(2) ?? '—'}</td><td className="text-right font-mono">{l.iv ? (l.iv * 100).toFixed(1) + '%' : '—'}</td><td>{l.status.replaceAll('_', ' ').toLowerCase()}</td></tr>)}</tbody></table></div>
   {result && <PayoffView result={result} />}</section>}
  {built.ok && <section className="card space-y-2"><h3>Strategy spec</h3><p className="text-sm">Strikes are stored as ATM offsets, so the spec re-resolves them on each entry.</p>
   <div className="flex gap-2"><button className="btn btn-secondary" onClick={() => { saveSpecDraft(built.spec); navigateTo('Rule builder'); }}>Open in rule builder</button><button className="btn btn-secondary" onClick={() => downloadJson('strategy-spec.json', built.spec)}>Download JSON</button></div>
   <pre className="text-xs overflow-x-auto">{JSON.stringify(built.spec, null, 2)}</pre></section>}
 </div>;
}
