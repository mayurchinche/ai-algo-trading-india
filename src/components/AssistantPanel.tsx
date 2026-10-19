import { useRef, useState } from 'react';
import { PROMPT_LIBRARY, parseQuestion } from '../../shared/researchAssistant';
import { NIFTY50_UNIVERSE } from '../../shared/universes';
import { answerPlan, type AssistantAnswer } from '../services/assistant';
import { fetchScorecards, readable, type Scorecards } from '../services/scorecards';
import { columnsFor, formatCell } from '../services/screener';
import { navigateTo, openAnalysis } from '../services/specDraft';
import type { AssistantPlan } from '../../shared/researchAssistant';

// Rows keep the answer's order (already ranked); a click opens the company's analysis.
export function AnswerTable({ answer }: { answer: Extract<AssistantAnswer, { kind: 'table' }> }) {
 const columns = columnsFor(answer.columns);
 if (!answer.rows.length) return <p className="text-sm">No companies match.</p>;
 return <div className="overflow-x-auto"><table className="data-table text-sm">
  <thead><tr><th>Symbol</th>{columns.map(c => <th key={c.id} className="text-right">{c.label}</th>)}</tr></thead>
  <tbody>{answer.rows.map(r => <tr key={r.symbol}><td><button className="underline font-semibold" onClick={() => openAnalysis(r.symbol)}>{r.symbol}</button></td>
   {columns.map(c => { const v = c.value(r); return <td key={c.id} className="text-right font-mono" title={v === null ? readable(c.status(r)) : undefined}>{formatCell(v, c.unit)}</td>; })}</tr>)}</tbody>
 </table></div>;
}

export function AnswerView({ plan, answer, onTab }: { plan: AssistantPlan; answer: AssistantAnswer; onTab: (tab: string) => void }) {
 return <div className="space-y-2">
  {!!plan.understood.length && <p className="text-xs opacity-70">Understood: {plan.understood.join(' · ')}</p>}
  {answer.kind === 'message' && <p>{answer.text}</p>}
  {answer.kind === 'route' && <p>{answer.text} <button className="underline" onClick={() => answer.tab === 'Portfolio fit' ? onTab(answer.tab) : navigateTo(answer.tab)}>Open {answer.tab}</button></p>}
  {answer.kind === 'analyse' && <div className="space-y-1">
   {answer.verdicts.map(v => <p key={v} className="text-sm">{v}</p>)}
   {!answer.scored && <p className="text-sm">No scorecard for {answer.symbol} (no supported annual filing, or a bank, which is not ranked against non-banks).</p>}
   <button className="underline" onClick={() => openAnalysis(answer.symbol)}>Open full analysis of {answer.symbol}</button>
  </div>}
  {answer.kind === 'table' && <div className="space-y-2">
   <AnswerTable answer={answer} />
   {answer.notes.map(n => <p key={n} className="text-sm">{n}</p>)}
   {Object.entries(answer.verdicts).map(([symbol, lines]) => <details key={symbol} className="text-sm"><summary>{symbol}: plus and minus by style</summary>{lines.map(l => <p key={l}>{l}</p>)}</details>)}
  </div>}
 </div>;
}

// Rule-based research assistant over this app's data. No AI model; answers state what was understood.
export function AssistantPanel({ onTab }: { onTab: (tab: string) => void }) {
 const [question, setQuestion] = useState('');
 const [data, setData] = useState<Scorecards | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [result, setResult] = useState<{ plan: AssistantPlan; answer: AssistantAnswer } | null>(null);
 const loading = useRef<Promise<Scorecards | null> | null>(null);
 const load = () => loading.current ??= fetchScorecards().then(d => { setData(d); return d; }, e => { setError(e instanceof Error ? e.message : String(e)); loading.current = null; return null; });
 const run = async (q: string) => {
  setQuestion(q);
  // Scorecards are fetched only for questions that need them.
  const plan = parseQuestion(q, { universe: NIFTY50_UNIVERSE.members });
  const d = ['ANALYSE', 'COMPARE', 'SCREEN'].includes(plan.intent) ? data ?? await load() : data;
  setResult({ plan, answer: answerPlan(plan, d, NIFTY50_UNIVERSE.members) });
 };
 return <section className="space-y-4">
  <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void run(question); }}>
   <input className="flex-1" aria-label="Ask a research question" placeholder="e.g. Banks with ROE above 15, or Compare TCS and INFY" value={question} onChange={e => setQuestion(e.target.value)} maxLength={500} />
   <button type="submit" className="btn-primary">Ask</button>
  </form>
  {error && <p role="alert">{error}</p>}
  {result && <div className="card"><AnswerView plan={result.plan} answer={result.answer} onTab={onTab} /></div>}
  <div className="grid md:grid-cols-2 gap-3">{PROMPT_LIBRARY.map(g => <div key={g.group} className="card space-y-1"><h4>{g.group}</h4>
   {g.prompts.map(p => <button key={p} className="block text-left underline text-sm" onClick={() => void run(p)}>{p}</button>)}</div>)}</div>
  <p className="text-xs opacity-70">Answers come from fixed rules over NIFTY 50 scorecards, signals and gaps in this app. No AI model is used. Research only, not investment advice.</p>
 </section>;
}
