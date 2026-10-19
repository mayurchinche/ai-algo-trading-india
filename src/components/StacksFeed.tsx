import { useEffect, useState } from 'react';
import { buildStacks, STACKS_VERSION, type Stack, type StackReason, type Stacks } from '../../shared/stacks';
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

// One reason a member qualifies: label, value and its peer percentile as a bar (higher is better).
function Reason({ r }: { r: StackReason }) {
 const level = r.percentile ?? (r.metric === 'score:composite' ? r.value : null);
 return <div className="min-w-0">
  <div className="flex flex-wrap justify-between gap-x-2 text-xs"><span className="muted truncate">{r.label}</span><span className="font-mono font-semibold">{r.display || '—'}</span></div>
  {level !== null && <div className={`meter mt-1 ${level >= 70 ? 'good' : level <= 30 ? 'weak' : ''}`} title={r.percentile !== null ? `Better than ${Math.round(r.percentile)}% of peers` : `Score ${Math.round(level)} of 100`}><span style={{ width: `${Math.max(3, Math.min(100, level))}%` }} /></div>}
  {r.percentile !== null && <div className="text-[11px] faint mt-0.5">beats {Math.round(r.percentile)}%<span className="hidden sm:inline"> of peers</span></div>}
 </div>;
}

export function StackCard({ stack, onSave }: { stack: Stack; onSave: (s: Stack) => void }) {
 const [lookback, setLookback] = useState(false);
 return <article id={`stack-${stack.id}`} className="card flex flex-col gap-4 scroll-mt-24">
  <header className="flex items-start justify-between gap-3">
   <div className="space-y-1"><h3>{stack.title}</h3><p className="text-sm muted">{stack.thesis}</p></div>
   <span className="badge badge-blue shrink-0">{stack.qualifying} {stack.qualifying === 1 ? 'company' : 'companies'}</span>
  </header>
  <p className="text-xs faint"><span className="font-semibold">Rule</span> · {stack.rule}{stack.qualifying > stack.members.length ? ` · top ${stack.members.length} shown` : ''}</p>
  <ol className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{stack.members.map((m, i) => {
   const warnings = [...new Set(m.why.flatMap(w => w.warnings))];
   return <li key={m.symbol} className="py-3 flex gap-3">
    <span className="w-6 h-6 shrink-0 rounded-full bg-[var(--bg-alt)] text-[11px] font-semibold flex items-center justify-center faint">{i + 1}</span>
    <div className="flex-1 min-w-0 space-y-2">
     <div className="flex items-center gap-2 flex-wrap">
      <button className="font-semibold hover:text-[var(--blue)]" onClick={() => openAnalysis(m.symbol)}>{m.symbol}</button>
      {m.industry && <span className="text-xs faint">{m.industry}</span>}
      {warnings.map(w => <span key={w} className="badge badge-amber" title={WARNING_TEXT[w] ?? w}>Filing note</span>)}
     </div>
     <div className={`grid gap-x-3 gap-y-2 ${m.why.length >= 3 ? 'grid-cols-3' : m.why.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>{m.why.map(r => <Reason key={r.metric} r={r} />)}</div>
     {warnings.map(w => <p key={w} className="text-[11px] text-[var(--amber)]">{WARNING_TEXT[w] ?? w.replaceAll('_', ' ').toLowerCase()}</p>)}
    </div>
   </li>;
  })}</ol>
  <footer className="flex gap-2 flex-wrap items-center mt-auto">
   <button className="btn-primary" onClick={() => onSave(stack)}>Save as basket</button>
   <button className="btn-ghost" aria-expanded={lookback} onClick={() => setLookback(v => !v)}>{lookback ? 'Hide past year' : 'Past year (hindsight)'}</button>
  </footer>
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
 return <section className="space-y-5">
  <div className="flex flex-wrap gap-2" aria-label="Jump to a stack">{listed.map(s => <a key={s.id} className="chip" href={`#stack-${s.id}`} onClick={e => { e.preventDefault(); document.getElementById(`stack-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}>{s.title}<span className="faint font-mono">{s.qualifying}</span></a>)}</div>
  {saved && <p role="status" className="notice text-sm flex flex-wrap gap-2 items-center">{saved}<button className="btn-ghost" onClick={() => onTab('Baskets')}>Open Baskets</button></p>}
  <div className="grid xl:grid-cols-2 gap-5 items-start">{listed.map(s => <StackCard key={s.id} stack={s} onSave={save} />)}</div>
  {!!empty.length && <details className="card text-sm"><summary className="font-semibold cursor-pointer">Stacks with fewer than two companies today ({empty.length})</summary>
   {empty.map(s => <p key={s.id} className="text-sm"><strong>{s.title}</strong>: {s.qualifying} qualifies{s.members.length ? ` (${s.members.map(m => m.symbol).join(', ')})` : ''}. Rule: {s.rule}</p>)}</details>}
 <p className="text-xs faint">{data.note} Scorecards computed {data.computedAt ? formatIST(data.computedAt) : 'at an unknown time'} for {data.companies} companies.</p>
 </section>;
}
