// ponytail: signal history — persists to localStorage, tracks accuracy over time
// Stores every signal generated, later checks if target/SL was hit

export interface StoredSignal {
  id: string;
  symbol: string;
  name: string;
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  score: number;
  entryPrice: number;  // LTP at signal time
  target: number;
  stopLoss: number;
  strategy: string;
  timestamp: string;   // ISO date
  // Outcome (filled later)
  outcome?: 'TARGET_HIT' | 'SL_HIT' | 'PENDING' | 'EXPIRED';
  exitPrice?: number;
  exitDate?: string;
  pnlPct?: number;
}

const STORAGE_KEY = 'signal_history';
const MAX_SIGNALS = 500; // ponytail: cap at 500, old ones auto-expire

function loadSignals(): StoredSignal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSignals(signals: StoredSignal[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(signals.slice(-MAX_SIGNALS)));
}

// Store new signals from the current scan
export function recordSignals(stocks: { symbol: string; name: string; signal: string; overallScore: number; ltp: number; foAnalysis: { suggestedTarget: number; suggestedStopLoss: number }; strategies: string[] }[]): void {
  const existing = loadSignals();
  const today = new Date().toISOString().slice(0, 10);

  // Only record signals with conviction (score ≥ 40) and only once per day per symbol
  const todaySymbols = new Set(existing.filter(s => s.timestamp.startsWith(today)).map(s => s.symbol));

  const newSignals: StoredSignal[] = stocks
    .filter(s => Math.abs(s.overallScore) >= 40 && !todaySymbols.has(s.symbol))
    .slice(0, 5) // Max 5 new signals per scan
    .map(s => ({
      id: `${s.symbol}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      symbol: s.symbol,
      name: s.name,
      signal: s.signal as StoredSignal['signal'],
      score: s.overallScore,
      entryPrice: s.ltp,
      target: s.foAnalysis.suggestedTarget,
      stopLoss: s.foAnalysis.suggestedStopLoss,
      strategy: s.strategies[0] || 'Multi-Strategy',
      timestamp: new Date().toISOString(),
      outcome: 'PENDING' as const,
    }));

  if (newSignals.length > 0) {
    saveSignals([...existing, ...newSignals]);
  }
}

// Check outcomes: did price hit target or SL since signal was given?
// Called with current prices to update pending signals
export function updateOutcomes(currentPrices: Map<string, number>): void {
  const signals = loadSignals();
  let changed = false;

  signals.forEach(s => {
    if (s.outcome !== 'PENDING') return;
    const currentPrice = currentPrices.get(s.symbol);
    if (!currentPrice) return;

    const isBuy = s.signal === 'STRONG_BUY' || s.signal === 'BUY';

    if (isBuy) {
      if (currentPrice >= s.target) {
        s.outcome = 'TARGET_HIT';
        s.exitPrice = currentPrice;
        s.exitDate = new Date().toISOString();
        s.pnlPct = ((currentPrice - s.entryPrice) / s.entryPrice) * 100;
        changed = true;
      } else if (currentPrice <= s.stopLoss) {
        s.outcome = 'SL_HIT';
        s.exitPrice = currentPrice;
        s.exitDate = new Date().toISOString();
        s.pnlPct = ((currentPrice - s.entryPrice) / s.entryPrice) * 100;
        changed = true;
      }
    } else if (s.signal === 'STRONG_SELL' || s.signal === 'SELL') {
      if (currentPrice <= s.target) {
        s.outcome = 'TARGET_HIT';
        s.exitPrice = currentPrice;
        s.exitDate = new Date().toISOString();
        s.pnlPct = ((s.entryPrice - currentPrice) / s.entryPrice) * 100;
        changed = true;
      } else if (currentPrice >= s.stopLoss) {
        s.outcome = 'SL_HIT';
        s.exitPrice = currentPrice;
        s.exitDate = new Date().toISOString();
        s.pnlPct = ((s.entryPrice - currentPrice) / s.entryPrice) * 100;
        changed = true;
      }
    }

    // Expire signals older than 15 days that haven't resolved
    const ageMs = Date.now() - new Date(s.timestamp).getTime();
    if (ageMs > 15 * 24 * 3600 * 1000 && s.outcome === 'PENDING') {
      s.outcome = 'EXPIRED';
      s.exitPrice = currentPrice;
      s.exitDate = new Date().toISOString();
      s.pnlPct = isBuy
        ? ((currentPrice - s.entryPrice) / s.entryPrice) * 100
        : ((s.entryPrice - currentPrice) / s.entryPrice) * 100;
      changed = true;
    }
  });

  if (changed) saveSignals(signals);
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
  const resolved = signals.filter(s => s.outcome !== 'PENDING');
  const targetHit = signals.filter(s => s.outcome === 'TARGET_HIT');
  const slHit = signals.filter(s => s.outcome === 'SL_HIT');
  const expired = signals.filter(s => s.outcome === 'EXPIRED');
  const pending = signals.filter(s => s.outcome === 'PENDING');

  const wins = targetHit.map(s => s.pnlPct || 0);
  const losses = slHit.map(s => s.pnlPct || 0);

  // By strategy
  const stratMap: Record<string, { total: number; wins: number }> = {};
  signals.filter(s => s.outcome !== 'PENDING').forEach(s => {
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
  signals.forEach(s => {
    const day = s.timestamp.slice(0, 10);
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
