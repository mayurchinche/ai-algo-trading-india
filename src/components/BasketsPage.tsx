import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { basketPerformance, type BasketPerformance } from '../../shared/basketPerformance';
import { SCREENER_COLUMNS, formatCell } from '../services/screener';
import { fetchScorecards, type Scorecards } from '../services/scorecards';
import { applyScreen, istDate, loadBaskets, loadCloses, saveBaskets, validateScreen, MAX_BASKETS, MAX_FILTERS, type Basket, type Screen } from '../services/baskets';

const BENCHMARK = '^NSEI';
const pct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const yearAgo = () => istDate(Date.now() - 365 * 86400000);

export function PerformanceView({ perf, label }: { perf: BasketPerformance; label: string }) {
 if (perf.status === 'NO_BENCHMARK_DATA') return <p className="text-sm">NIFTY 50 history unavailable; no comparison made.</p>;
 if (perf.status === 'NO_MEMBER_DATA') return <p className="text-sm">No member has a close on {perf.baseDate}; no return measured.</p>;
 const s = perf.summary;
 return <div className="space-y-3">
  <p className="text-sm"><strong>{label}</strong>: {perf.baseDate} to {perf.endDate} ({perf.sessions} sessions). Basket {pct(s.basketPct)}, NIFTY 50 {pct(s.benchmarkPct)}, FD {pct(s.fdPct)}; versus NIFTY {pct(s.excessVsBenchmarkPct)}; max drawdown {s.maxDrawdownPct.toFixed(1)}%.</p>
  {perf.status === 'STARTED_TODAY' && <p className="text-sm">Only one completed session so far; returns accrue from here.</p>}
  {!!perf.excluded.length && <p className="text-sm">Not included: {perf.excluded.map(e => `${e.symbol} (${e.reason.replaceAll('_', ' ').toLowerCase()})`).join(', ')}.</p>}
  {perf.series.length > 1 && <ResponsiveContainer width="100%" height={240}><LineChart data={perf.series}><XAxis dataKey="date" minTickGap={60} /><YAxis domain={['auto', 'auto']} /><Tooltip formatter={v => typeof v === "number" ? v.toFixed(2) : String(v)} /><Legend /><Line dataKey="basket" name="Basket" dot={false} stroke="#2563eb" /><Line dataKey="benchmark" name="NIFTY 50" dot={false} stroke="#9333ea" /><Line dataKey="fd" name="FD" dot={false} stroke="#16a34a" strokeDasharray="4 4" /></LineChart></ResponsiveContainer>}
  <p className="text-xs">{perf.method}</p>
 </div>;
}

function BasketDetail({ basket, onDelete }: { basket: Basket; onDelete: () => void }) {
 const [state, setState] = useState<{ forward: BasketPerformance; hindsight: BasketPerformance } | null>(null);
 const [loading, setLoading] = useState(true);
 useEffect(() => {
  let active = true; setLoading(true);
  const symbols = basket.members.map(m => m.symbol);
  loadCloses([...symbols, BENCHMARK]).then(closes => {
   if (!active) return;
   const benchmark = closes.get(BENCHMARK) ?? { dates: [], closes: [] }, common = { members: symbols, closes, benchmark, fdRatePct: basket.fdRatePct };
   setState({ forward: basketPerformance({ ...common, startDate: istDate(Date.parse(basket.createdAt)) }), hindsight: basketPerformance({ ...common, startDate: yearAgo() }) });
  }).finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [basket]);
 return <section className="card space-y-4">
  <div className="page-title"><div><h3>{basket.name}</h3><p>Created {new Date(basket.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · {basket.members.length} members · FD rate {basket.fdRatePct}% a year (assumed)</p></div><button className="btn btn-secondary" onClick={onDelete}>Delete</button></div>
  <p className="text-sm">Members: {basket.members.map(m => m.symbol).join(', ')}</p>
  {loading && <p className="text-sm" role="status">Loading daily closes…</p>}
  {state && <><PerformanceView perf={state.forward} label="Since created" />
   <details><summary className="text-sm">Past year with today's members (hindsight)</summary><p className="notice text-sm">These members were chosen using today's data, so this past return was not achievable and overstates what the screen would have delivered.</p><PerformanceView perf={state.hindsight} label="Hindsight, last 12 months" /></details></>}
 </section>;
}

export function BasketsPage() {
 const [baskets, setBaskets] = useState<Basket[]>(() => loadBaskets());
 const [selected, setSelected] = useState<string>();
 const [data, setData] = useState<Scorecards | null>(null);
 const [error, setError] = useState('');
 const [name, setName] = useState('My basket');
 const [fdRatePct, setFd] = useState(7);
 const [screen, setScreen] = useState<Screen>({ filters: [{ column: 'roe', op: 'gte', value: 15 }, { column: 'debtToEquity', op: 'lte', value: 0.5 }], sortBy: 'score:value', limit: 10 });
 useEffect(() => { fetchScorecards('NIFTY50').then(setData).catch(e => setError(e instanceof Error ? e.message : 'Screen data unavailable')); }, []);
 useEffect(() => { try { saveBaskets(baskets); } catch { setError('Baskets could not be saved in this browser.'); } }, [baskets]);
 const preview = useMemo(() => data ? applyScreen(data.companies, screen) : [], [data, screen]);
 const setFilter = (i: number, patch: Partial<Screen['filters'][number]>) => setScreen(s => ({ ...s, filters: s.filters.map((f, k) => k === i ? { ...f, ...patch } : f) }));
 function create() {
  setError('');
  try {
   const valid = validateScreen(screen);
   if (!preview.length) throw new Error('The screen selects no companies.');
   if (baskets.length >= MAX_BASKETS) throw new Error(`Up to ${MAX_BASKETS} baskets.`);
   if (!name.trim() || name.length > 60) throw new Error('Name must be 1 to 60 characters.');
   const b: Basket = { id: crypto.randomUUID(), name: name.trim(), createdAt: new Date().toISOString(), universe: data!.universe.name, screen: valid, members: preview.map(c => ({ symbol: c.symbol, isin: c.isin })), fdRatePct };
   setBaskets(old => [b, ...old]); setSelected(b.id);
  } catch (e) { setError(e instanceof Error ? e.message : 'Basket not created'); }
 }
 const detail = baskets.find(b => b.id === selected);
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Baskets</h2><p>Save a screen as a dated basket and follow its equal-weight return against NIFTY 50 and a fixed-deposit line. Baskets are stored in this browser only.</p></div></div>
  <section className="notice text-sm" role="note">Research tracking, not model portfolios or recommendations. Members are fixed when you save; the basket is not rebalanced.</section>
  {error && <section className="card" role="status"><p>{error}</p></section>}
  <section className="card space-y-3"><h3>New basket from a screen</h3>
   <div className="grid sm:grid-cols-3 gap-3"><label>Name<input className="block w-full rounded-lg border p-2 mt-1" maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label>
    <label>Sort by<select className="block w-full rounded-lg border p-2 mt-1" value={screen.sortBy} onChange={e => setScreen(s => ({ ...s, sortBy: e.target.value }))}>{SCREENER_COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label>Top N<input type="number" min={1} max={30} className="block w-full rounded-lg border p-2 mt-1" value={screen.limit} onChange={e => setScreen(s => ({ ...s, limit: Number(e.target.value) }))} /></label>
    <label>FD rate (% a year)<input type="number" min={0} max={20} step={0.1} className="block w-full rounded-lg border p-2 mt-1" value={fdRatePct} onChange={e => setFd(Number(e.target.value))} /></label></div>
   {screen.filters.map((f, i) => <div key={i} className="flex gap-2 items-center text-sm">
    <select value={f.column} onChange={e => setFilter(i, { column: e.target.value })}>{SCREENER_COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
    <select value={f.op} onChange={e => setFilter(i, { op: e.target.value as 'gte' | 'lte' })}><option value="gte">at least</option><option value="lte">at most</option></select>
    <input type="number" step="any" className="border rounded p-1 w-24" value={f.value} onChange={e => setFilter(i, { value: Number(e.target.value) })} />
    <button className="underline" onClick={() => setScreen(s => ({ ...s, filters: s.filters.filter((_, k) => k !== i) }))}>Remove</button></div>)}
   {screen.filters.length < MAX_FILTERS && <button className="underline text-sm" onClick={() => setScreen(s => ({ ...s, filters: [...s.filters, { column: 'roce', op: 'gte', value: 15 }] }))}>Add filter</button>}
   <p className="text-sm">{data ? `${preview.length} companies match: ${preview.map(c => `${c.symbol} (${formatCell(SCREENER_COLUMNS.find(x => x.id === screen.sortBy)!.value(c), SCREENER_COLUMNS.find(x => x.id === screen.sortBy)!.unit)})`).join(', ') || 'none'}. Companies with missing data never pass a filter.` : 'Loading screen data…'}</p>
   <button className="btn btn-secondary" disabled={!data} onClick={create}>Save basket</button>
  </section>
  {!!baskets.length && <section className="card space-y-2"><h3>Saved baskets</h3>{baskets.map(b => <button key={b.id} className={`block text-left ${selected === b.id ? 'font-semibold' : ''}`} aria-pressed={selected === b.id} onClick={() => setSelected(b.id)}>{b.name} · {b.members.length} members · {istDate(Date.parse(b.createdAt))}</button>)}</section>}
  {detail && <BasketDetail key={detail.id} basket={detail} onDelete={() => { setBaskets(old => old.filter(b => b.id !== detail.id)); setSelected(undefined); }} />}
 </div>;
}
