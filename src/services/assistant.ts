import type { AssistantPlan } from '../../shared/researchAssistant';
import { styleVerdicts, verdictSentence } from '../../shared/styleVerdicts';
import { SCREENER_COLUMNS, sortCompanies } from './screener';
import type { CompanyScorecard, Scorecards } from './scorecards';

export type Member = { symbol: string; industry?: string };
export type AssistantAnswer =
 | { kind: 'message'; text: string }
 | { kind: 'route'; tab: string; text: string }
 | { kind: 'analyse'; symbol: string; verdicts: string[]; scored: boolean }
 | { kind: 'table'; title: string; rows: CompanyScorecard[]; columns: string[]; notes: string[]; verdicts: Record<string, string[]> };

export const COMPARE_COLUMNS = ['close', 'score:composite', 'score:value', 'score:garp', 'score:growth', 'score:compounder', 'score:momentum', 'pe', 'roe', 'roce', 'debtToEquity', 'revenueGrowth3y', 'profitGrowth3y', 'return12m'];
const known = new Set(SCREENER_COLUMNS.map(c => c.id)), columnOf = (id: string) => SCREENER_COLUMNS.find(c => c.id === id)!;
const sentences = (c: CompanyScorecard | undefined) => c ? styleVerdicts(c).map(verdictSentence) : [];

// Executes a parsed plan against the scorecards. Data-dependent intents need scorecards; routing intents do not.
// Every answer names what was matched and what was missing; nothing is filled in.
export function answerPlan(plan: AssistantPlan, data: Scorecards | null, universe: readonly Member[]): AssistantAnswer {
 switch (plan.intent) {
  case 'EMPTY': return { kind: 'message', text: 'Type a question or pick an example.' };
  case 'UNKNOWN': case 'NEEDS_INPUT': return { kind: 'message', text: plan.message ?? 'Not understood.' };
  case 'SIGNALS': return { kind: 'route', tab: 'Signals', text: 'Signals come only from strategies that passed validation after charges.' };
  case 'GAPS': return { kind: 'route', tab: 'Opening gaps', text: 'Opening gaps are read from the NSE pre-open session (09:00 to 09:08 IST).' };
  case 'PORTFOLIO_FIT': return { kind: 'route', tab: 'Portfolio fit', text: 'Enter or import your holdings to see how they fit each style.' };
 }
 if (!data) return { kind: 'message', text: 'Scorecards are unavailable, so this question cannot be answered now.' };
 const bySymbol = new Map(data.companies.map(c => [c.symbol, c]));
 if (plan.intent === 'ANALYSE') {
  const c = bySymbol.get(plan.symbols[0]);
  return { kind: 'analyse', symbol: plan.symbols[0], verdicts: sentences(c), scored: !!c?.basis };
 }
 if (plan.intent === 'COMPARE') {
  const rows = plan.symbols.map(s => bySymbol.get(s)).filter((c): c is CompanyScorecard => !!c);
  const missing = plan.symbols.filter(s => !bySymbol.has(s));
  return { kind: 'table', title: `Comparing ${plan.symbols.join(', ')}`, rows, columns: COMPARE_COLUMNS, notes: missing.length ? [`No scorecard for ${missing.join(', ')}.`] : [], verdicts: Object.fromEntries(rows.map(r => [r.symbol, sentences(r)])) };
 }
 // SCREEN: a filter passes only on an available value; missing data never qualifies a company.
 const screen = plan.screen!;
 if (![screen.sortBy, ...screen.filters.map(f => f.column)].every(id => known.has(id))) return { kind: 'message', text: 'The question uses a column this app does not have.' };
 const industryOf = new Map(universe.map(m => [m.symbol, m.industry]));
 const inSector = data.companies.filter(c => !plan.industry || industryOf.get(c.symbol) === plan.industry);
 const passing = inSector.filter(c => screen.filters.every(f => { const v = columnOf(f.column).value(c); return v !== null && (f.op === 'gte' ? v >= f.value : v <= f.value); }));
 const ranked = sortCompanies(passing.filter(c => columnOf(screen.sortBy).value(c) !== null), { column: screen.sortBy, direction: screen.sortDirection });
 const rows = ranked.slice(0, screen.limit);
 const columns = [...new Set(['close', screen.sortBy, ...screen.filters.map(f => f.column), 'score:composite'])];
 const notes = [`${passing.length} of ${inSector.length} companies${plan.industry ? ` in ${plan.industry}` : ''} meet the conditions${passing.length > ranked.length ? `; ${passing.length - ranked.length} have no ${columnOf(screen.sortBy).label} value to sort by` : ''}.`];
 if (plan.ignored.length) notes.push(`Not understood and not applied: ${plan.ignored.join('; ')}.`);
 return { kind: 'table', title: plan.understood.join(' · '), rows, columns, notes, verdicts: {} };
}

