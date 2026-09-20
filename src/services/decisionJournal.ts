import { DAY_MS, istDate } from './tradingTime';
import { SIGNAL_POLICY } from './strongSignalPolicy';

export interface CandidateDecision {
  symbol: string; side: 'BUY' | 'SELL'; score: number; reason: string;
  signalId?: string; signalTime: string; quoteTime?: string; tradeId?: string;
  blockedReasons?: string[]; referencePrice: number; stopLoss: number; target: number; strategies: string[];
}
export interface DecisionRecord extends CandidateDecision {
  id: string; policy: string; firstObservedAt: string; lastObservedAt: string;
  observations: number; minScore: number; maxScore: number;
}
function retained(records: DecisionRecord[], now: number): DecisionRecord[] {
  return records.filter(d => Date.parse(d.lastObservedAt) >= now - 30 * DAY_MS)
    .sort((a, b) => b.lastObservedAt.localeCompare(a.lastObservedAt));
}
export function getDecisionJournal(now = Date.now()): DecisionRecord[] {
  const raw = localStorage.getItem('paper_ledger_v3');
  if (!raw) return [];
  const ledger = JSON.parse(raw);
  if (ledger.version !== 3 || !Array.isArray(ledger.trades) || !Number.isFinite(ledger.archivedNet)
    || (ledger.decisions !== undefined && !Array.isArray(ledger.decisions))) throw new Error('Invalid paper ledger; original data preserved.');
  return retained(ledger.decisions || [], now);
}
// Repeated identical outcomes are daily aggregates, not a claim of tick-by-tick history.
// Each paper entry retains its own immutable ledger event and trade ID.
export function mergeDecisions(existing: DecisionRecord[], decisions: CandidateDecision[], now: number): DecisionRecord[] {
  const records = retained(existing, now), byId = new Map(records.map(d => [d.id, d]));
  const at = new Date(now).toISOString();
  for (const d of decisions) {
    const id = JSON.stringify([istDate(now), d.symbol, d.side, d.reason, d.blockedReasons || [], SIGNAL_POLICY]);
    const previous = byId.get(id);
    if (previous) {
      previous.lastObservedAt = at; previous.observations++;
      previous.minScore = Math.min(previous.minScore, d.score);
      previous.maxScore = Math.max(previous.maxScore, d.score);
    } else {
      const record = { ...d, id, policy: SIGNAL_POLICY, firstObservedAt: at, lastObservedAt: at,
        observations: 1, minScore: d.score, maxScore: d.score };
      records.push(record); byId.set(id, record);
    }
  }
  return records;
}
