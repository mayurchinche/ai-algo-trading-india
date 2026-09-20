import type { DiscoveredStock } from './stockDiscovery';
import { DAY_MS, freshQuote, istDate, type MarketQuote } from './tradingTime';
import { SIGNAL_POLICY, strongSignalId, strongSignalRejection } from './strongSignalPolicy';
import { readRecords, writeRecords } from './journalStorage';

export interface StoredSignal {
  id: string; symbol: string; name: string; signal: DiscoveredStock['signal']; score: number;
  entryPrice: number; target: number; stopLoss: number; strategy: string; timestamp: string;
  quoteTime?: string; lastQuoteTime?: string; modelVersion?: string; monitoringGap?: boolean;
  outcome?: 'TARGET_HIT' | 'SL_HIT' | 'PENDING' | 'EXPIRED'; exitPrice?: number; exitDate?: string; pnlPct?: number;
}
const STORAGE_KEY = 'signal_history';
const loadSignals = () => readRecords<StoredSignal>(STORAGE_KEY);
const saveSignals = (signals: StoredSignal[]) => writeRecords(STORAGE_KEY, signals);
export function pruneSignalHistory(now = Date.now()): number {
  const signals = loadSignals();
  const kept = signals.filter(s => s.outcome === 'PENDING' || now - Date.parse(s.exitDate || s.timestamp) <= 30 * DAY_MS);
  saveSignals(kept); return signals.length - kept.length;
}
// Immutable first observation for each symbol/direction/session. Repeated scans reuse its ID/time.
export function recordSignals(stocks: DiscoveredStock[], now = Date.now()): void {
  const existing = loadSignals();
  for (const s of stocks) {
    if (strongSignalRejection(s, now)) continue;
    const id = strongSignalId(s, now);
    let stored = existing.find(x => x.id === id);
    if (!stored) {
      stored = { id, symbol: s.symbol, name: s.name, signal: s.signal, score: s.overallScore,
        entryPrice: s.ltp, target: s.foAnalysis.suggestedTarget, stopLoss: s.foAnalysis.suggestedStopLoss,
        strategy: s.strategies[0] || 'Composite', timestamp: s.generatedAt, quoteTime: s.quoteTime,
        lastQuoteTime: s.quoteTime, modelVersion: SIGNAL_POLICY, outcome: 'PENDING' };
      existing.push(stored);
    }
    s.signalId = stored.id;
    s.firstSignalAt = stored.timestamp;
  }
  saveSignals(existing);
}
export function updateOutcomes(quotes: Map<string, MarketQuote>, now = Date.now()): void {
  const signals = loadSignals();
  for (const s of signals) {
    if (s.outcome !== 'PENDING') continue;
    if (now - Date.parse(s.timestamp) > 15 * DAY_MS) {
      s.outcome = 'EXPIRED'; s.exitDate = new Date(now).toISOString(); continue;
    }
    const q = quotes.get(s.symbol);
    if (!freshQuote(q, now) || Date.parse(q.timestamp) <= Date.parse(s.lastQuoteTime || s.timestamp)) continue;
    if (Date.parse(q.timestamp) - Date.parse(s.lastQuoteTime || s.timestamp) > 120_000) s.monitoringGap = true;
    s.lastQuoteTime = q.timestamp;
    const buy = s.signal === 'BUY' || s.signal === 'STRONG_BUY';
    const stop = buy ? q.price <= s.stopLoss : q.price >= s.stopLoss;
    const target = buy ? q.price >= s.target : q.price <= s.target;
    if (stop || target) {
      s.outcome = stop ? 'SL_HIT' : 'TARGET_HIT'; s.exitPrice = q.price; s.exitDate = q.timestamp;
      s.pnlPct = (q.price - s.entryPrice) / s.entryPrice * 100 * (buy ? 1 : -1);
    }
  }
  saveSignals(signals);
}

// Get accuracy stats
export interface SignalAccuracy {
  total: number;
  resolved: number;
  pending: number;
  targetHit: number;
  slHit: number;
  expired: number;
  winRate: number;     // targetHit / (targetHit + slHit) %
  avgWinPct: number;
  avgLossPct: number;
  byStrategy: Record<string, { total: number; wins: number; winRate: number }>;
  byDay: { date: string; signals: number; wins: number; losses: number }[];
}

export function getSignalAccuracy(): SignalAccuracy {
  const signals = loadSignals();
  const resolved = signals.filter(s => (s.outcome === 'TARGET_HIT' || s.outcome === 'SL_HIT') && !s.monitoringGap && s.modelVersion === SIGNAL_POLICY);
  const targetHit = resolved.filter(s => s.outcome === 'TARGET_HIT');
  const slHit = resolved.filter(s => s.outcome === 'SL_HIT');
  const expired = signals.filter(s => s.outcome === 'EXPIRED');
  const pending = signals.filter(s => s.outcome === 'PENDING');

  const wins = targetHit.map(s => s.pnlPct || 0);
  const losses = slHit.map(s => s.pnlPct || 0);

  // By strategy
  const stratMap: Record<string, { total: number; wins: number }> = {};
  resolved.forEach(s => {
    if (!stratMap[s.strategy]) stratMap[s.strategy] = { total: 0, wins: 0 };
    stratMap[s.strategy].total++;
    if (s.outcome === 'TARGET_HIT') stratMap[s.strategy].wins++;
  });
  const byStrategy: Record<string, { total: number; wins: number; winRate: number }> = {};
  Object.entries(stratMap).forEach(([k, v]) => {
    byStrategy[k] = { ...v, winRate: v.total > 0 ? Math.round((v.wins / v.total) * 1000) / 10 : 0 };
  });

  // By day
  const dayMap: Record<string, { signals: number; wins: number; losses: number }> = {};
  resolved.forEach(s => {
    const day = istDate(s.timestamp);
    if (!dayMap[day]) dayMap[day] = { signals: 0, wins: 0, losses: 0 };
    dayMap[day].signals++;
    if (s.outcome === 'TARGET_HIT') dayMap[day].wins++;
    if (s.outcome === 'SL_HIT') dayMap[day].losses++;
  });
  const byDay = Object.entries(dayMap)
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  return {
    total: signals.length,
    resolved: resolved.length,
    pending: pending.length,
    targetHit: targetHit.length,
    slHit: slHit.length,
    expired: expired.length,
    winRate: (targetHit.length + slHit.length) > 0
      ? Math.round((targetHit.length / (targetHit.length + slHit.length)) * 1000) / 10
      : 0,
    avgWinPct: wins.length > 0 ? Math.round(wins.reduce((a, b) => a + b, 0) / wins.length * 100) / 100 : 0,
    avgLossPct: losses.length > 0 ? Math.round(losses.reduce((a, b) => a + b, 0) / losses.length * 100) / 100 : 0,
    byStrategy,
    byDay,
  };
}

export function getSignalHistory(): StoredSignal[] {
  return loadSignals().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function clearSignalHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
