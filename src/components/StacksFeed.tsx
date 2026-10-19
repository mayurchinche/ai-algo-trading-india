import { useEffect, useState } from 'react';
import { buildStacks, STACKS_VERSION, type Stack, type Stacks } from '../../shared/stacks';
import { basketPerformance, type BasketPerformance } from '../../shared/basketPerformance';
import { NIFTY50_UNIVERSE } from '../../shared/universes';
import { fetchScorecards } from '../services/scorecards';
import { basketFromStack, loadBaskets, loadCloses, saveBaskets, MAX_BASKETS, BENCHMARK, yearAgo } from '../services/baskets';
import { openAnalysis } from '../services/specDraft';
import { formatIST } from '../services/tradingTime';
import { PerformanceView } from './BasketsPage';

const WARNING_TEXT: Record<string, string> = { FILED_SYMBOL_CHANGED: 'inputs span a symbol change (rename, merger or demerger)', FILED_UNDER_FORMER_ISIN: 'some inputs predate a share split or consolidation' };

function Lookback({ stack }: { stack: Stack }) {
 const [perf, setPerf] = useState<BasketPerformance | null>(null);
 useEffect(() => {
  let active = true;
  const symbols = stack.members.map(m => m.symbol);
  void loadCloses([...symbols, BENCHMARK]).then(closes => { if (active) setPerf(basketPerformance({ members: symbols, closes, benchmark: closes.get(BENCHMARK) ?? { dates: [], closes: [] }, startDate: yearAgo(), fdRatePct: 7 })); });
  return () => { active = false; };
 }, [stack]);
 return <div className="space-y-2">
  <p className="notice text-sm">Today's members were chosen with today's data, so this past return was not achievable{stack.priceSelected ? ', and this stack selects on recent price performance itself, which makes the look-back circular' : ''}. Save the stack as a basket to track it forward from now.</p>
  {perf ? <PerformanceView perf={perf} label="Hindsight, last 12 months, equal weight" /> : <p className="text-sm" role="status">Loading daily closes…</p>}
 </div>;
}

export function StackCard({ stack, onSave }: { stack: Stack; onSave: (s: Stack) => void }) {
 const [lookback, setLookback] = useState(false);
 return <article className="card space-y-3">
  <div className="flex justify-between gap-3 flex-wrap"><div><h3>{stack.title}</h3><p className="text-sm">{stack.thesis}</p></div>
   <span className="text-sm opacity-70">{stack.qualifying} qualify{stack.qualifying > stack.members.length ? `, top ${stack.members.length} shown` : ''}</span></div>
  <p className="text-xs opacity-70">Rule: {stack.rule}</p>
  <ul className="space-y-2">{stack.members.map(m => <li key={m.symbol} className="text-sm">
   <button className="underline font-semibold" onClick={() => openAnalysis(m.symbol)}>{m.symbol}</button>{m.industry ? <span className="opacity-70"> · {m.industry}</span> : null}
   <div className="opacity-90">{m.why.map(w => `${w.label}: ${w.text}`).join(' · ')}</div>
   {[...new Set(m.why.flatMap(w => w.warnings))].map(w => <div key={w} className="text-xs">* {WARNING_TEXT[w] ?? w.replaceAll('_', ' ').toLowerCase()}</div>)}
  </li>)}</ul>
  <div className="flex gap-3 flex-wrap">
   <button className="btn btn-primary" onClick={() => onSave(stack)}>Save as basket</button>
   <button className="btn btn-secondary" aria-expanded={lookback} onClick={() => setLookback(v => !v)}>{lookback ? 'Hide' : 'Show'} past year (hindsight)</button>
  </div>
  {lookback && <Lookback stack={stack} />}
 </article>;
}

// A feed of themed stock lists built from the NIFTY 50 scorecards by our own rules.
export function StacksFeed({ onTab }: { onTab: (tab: string) => void }) {
 const [data, setData] = useState<Stacks | null>(null);
 const [error, setError] = useState('');
 const [saved, setSaved] = useState('');
 useEffect(() => {
  const ctl = new AbortController();
  fetchScorecards('NIFTY50', ctl.signal).then(d => setData(buildStacks(d, NIFTY50_UNIVERSE.members)), e => { if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : String(e)); });
  return () => ctl.abort();
 }, []);
 const save = (stack: Stack) => {
  setSaved('');
  try {
   const baskets = loadBaskets();
   if (baskets.length >= MAX_BASKETS) throw new Error(`Up to ${MAX_BASKETS} baskets; delete one in Baskets first.`);
   saveBaskets([basketFromStack(stack, STACKS_VERSION, 'NIFTY50'), ...baskets]);
   setSaved(`Saved "${stack.title}" as a basket; it is tracked from today.`);
  } catch (e) { setError(e instanceof Error ? e.message : 'Basket not saved'); }
 };
 if (error) return <p role="alert" className="notice">{error}</p>;
 if (!data) return <p role="status">Building stacks…</p>;
 const listed = data.stacks.filter(s => s.status === 'LISTED'), empty = data.stacks.filter(s => s.status !== 'LISTED');
 return <section className="space-y-4">
  <p className="text-sm">{data.note} Scorecards computed {data.computedAt ? formatIST(data.computedAt) : 'at an unknown time'}; {data.companies} companies.</p>
  {saved && <p role="status" className="text-sm">{saved} <button className="underline" onClick={() => onTab('Baskets')}>Open Baskets</button></p>}
  <div className="grid lg:grid-cols-2 gap-4">{listed.map(s => <StackCard key={s.id} stack={s} onSave={save} />)}</div>
  {!!empty.length && <details className="card"><summary>Stacks with fewer than two companies today ({empty.length})</summary>
   {empty.map(s => <p key={s.id} className="text-sm"><strong>{s.title}</strong>: {s.qualifying} qualifies{s.members.length ? ` (${s.members.map(m => m.symbol).join(', ')})` : ''}. Rule: {s.rule}</p>)}</details>}
 </section>;
}
