import { freshQuote, inSession, istDate, istMinutes, validLevels } from './tradingTime';

export const SIGNAL_POLICY = 'strong-equity-observed-v3';
export interface StrongCandidate {
  symbol: string; signal: string; overallScore: number; eligible: boolean;
  ltp: number; generatedAt: string; firstSignalAt?: string; quoteTime?: string;
  foAnalysis: { suggestedStopLoss: number; suggestedTarget: number };
}
export function strongSignalId(s: StrongCandidate, now: number): string {
  return `${istDate(now)}:${s.symbol}:${s.overallScore > 0 ? 'BUY' : 'SELL'}:${SIGNAL_POLICY}`;
}
// Exact shape the server paper cycle receives for an admitted signal.
export function toPaperCandidate(s: StrongCandidate & { generatedAt: string; reasons?: string[]; scores?: unknown; strategies?: string[] }, now: number) {
  return { symbol: s.symbol, signalId: strongSignalId(s, now), signalTime: s.generatedAt, side: s.overallScore > 0 ? 'BUY' : 'SELL', score: s.overallScore, stop: s.foAnalysis.suggestedStopLoss, target: s.foAnalysis.suggestedTarget, signalPrice: s.ltp, signalQuoteTime: s.quoteTime, strategy: { id: SIGNAL_POLICY, score: s.overallScore, signal: s.signal, reasons: s.reasons, components: s.scores, strategies: s.strategies, recordedAt: s.generatedAt } };
}
// Shared admission rules for research alerts, signal history and paper entries.
// Account constraints are applied separately by paper trading.
export function strongSignalRejection(s: StrongCandidate, now = Date.now()): string | null {
  if (!inSession(now)) return 'OUTSIDE_SESSION';
  if (istMinutes(now) >= 915) return 'ENTRY_CUTOFF_1515_IST';
  if (!s.eligible) return 'SCANNER_BLOCKED';
  if (!Number.isFinite(s.overallScore) || Math.abs(s.overallScore) > 100) return 'INVALID_SCORE';
  if (Math.abs(s.overallScore) < 70) return 'SCORE_BELOW_70';
  const side = s.overallScore > 0 ? 'BUY' : 'SELL';
  if (s.signal !== (side === 'BUY' ? 'STRONG_BUY' : 'STRONG_SELL')) return 'NOT_STRONG_DIRECTION';
  for (const time of [s.generatedAt, s.firstSignalAt || s.generatedAt]) {
    const age = now - Date.parse(time);
    if (!Number.isFinite(age) || age < -5000 || age > 120000) return 'SIGNAL_NOT_FRESH';
  }
  if (!freshQuote({ price: s.ltp, timestamp: s.quoteTime || '', source: 'research' }, now)) return 'QUOTE_NOT_FRESH';
  if (!validLevels(side, s.ltp, s.foAnalysis.suggestedStopLoss, s.foAnalysis.suggestedTarget)) return 'INVALID_RISK_LEVELS';
  return null;
}
