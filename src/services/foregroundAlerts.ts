import type { DiscoveredStock } from './stockDiscovery';
import { DAY_MS, freshQuote, inSession, istDate, validLevels } from './tradingTime';
import { readRecords, writeRecords } from './journalStorage';
export interface ForegroundAlert {
  id: string; symbol: string; side: 'BUY' | 'SELL'; score: number;
  entry: number; stop: number; target: number; generatedAt: string; quoteTime: string; expiresAt: string;
}
const KEY = 'foreground_signal_alerts_v1';
export function getForegroundAlerts(now = Date.now()): ForegroundAlert[] {
  return readRecords<ForegroundAlert>(KEY).filter(a => now - Date.parse(a.generatedAt) <= 30 * DAY_MS);
}
export function collectForegroundAlerts(stocks: DiscoveredStock[], visible: boolean, marketOpen: boolean, now = Date.now()): ForegroundAlert[] {
  if (!visible || !marketOpen || !inSession(now)) return [];
  const history = getForegroundAlerts(now), ids = new Set(history.map(a => a.id));
  const added: ForegroundAlert[] = [];
  for (const s of stocks) {
    const side = s.overallScore > 0 ? 'BUY' : 'SELL';
    const age = now - Date.parse(s.generatedAt);
    if (!s.eligible || s.signal !== (side === 'BUY' ? 'STRONG_BUY' : 'STRONG_SELL') || !Number.isFinite(s.overallScore) || Math.abs(s.overallScore) < 70 || Math.abs(s.overallScore) > 100 || !Number.isFinite(age) || age < -5000 || age > 120000 || !freshQuote({ price: s.ltp, timestamp: s.quoteTime || '', source: 'research' }, now) || !validLevels(side, s.ltp, s.foAnalysis.suggestedStopLoss, s.foAnalysis.suggestedTarget)) continue;
    const id = `${istDate(now)}:${s.symbol}:${side}`;
    if (ids.has(id)) continue;
    ids.add(id);
    added.push({ id, symbol: s.symbol, side, score: s.overallScore, entry: s.ltp, stop: s.foAnalysis.suggestedStopLoss, target: s.foAnalysis.suggestedTarget, generatedAt: s.generatedAt, quoteTime: s.quoteTime!, expiresAt: new Date(Math.min(Date.parse(s.quoteTime!) + 120000, Date.parse(istDate(now) + 'T10:00:00Z'))).toISOString() });
  }
  writeRecords(KEY, [...added, ...history]);
  return added;
}
