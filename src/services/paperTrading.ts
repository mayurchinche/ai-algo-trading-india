// ponytail: realistic paper trading engine — persists to localStorage
// Entries happen ONLY when a signal fires during market hours
// Exits happen when SL/target hit on subsequent price checks, or EOD

import { isMarketOpenCached } from './marketStatus';

export interface PaperTradeRecord {
  id: string;
  symbol: string;
  name: string;
  type: 'EQUITY' | 'F&O';
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  entryTime: string; // ISO timestamp
  stopLoss: number;
  target: number;
  strategy: string;
  score: number;
  // Exit info (filled when closed)
  exitPrice?: number;
  exitTime?: string;
  status: 'OPEN' | 'TARGET_HIT' | 'SL_HIT' | 'EOD_EXIT' | 'EXPIRED';
  grossPnl?: number;
  brokerage?: number;
  netPnl?: number;
  pnlPct?: number;
}

const STORAGE_KEY = 'paper_trades_v2';
const MAX_EQUITY_PER_DAY = 3;
const MAX_FO_PER_DAY = 2;
const EQUITY_POSITION_SIZE = 5000; // ₹5K per equity trade
const FO_POSITION_SIZE = 7000;     // ₹7K per F&O trade
const CAPITAL = 20000;

function loadTrades(): PaperTradeRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveTrades(trades: PaperTradeRecord[]): void {
  // ponytail: keep last 200 trades max to avoid localStorage bloat
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades.slice(-200)));
}

function isMarketOpen(): boolean {
  // ponytail: use live NSE status (cached), fallback to time-based
  const live = isMarketOpenCached();
  if (live !== undefined) return live;
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const h = now.getHours();
  const m = now.getMinutes();
  const mins = h * 60 + m;
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function calcBrokerage(type: 'EQUITY' | 'F&O', turnover: number): number {
  if (type === 'EQUITY') {
    const brokerFee = Math.min(20 * 2, turnover * 0.0003 * 2);
    const sttExchange = turnover * 0.0005;
    return Math.round(brokerFee + sttExchange);
  }
  return Math.round(40 + turnover * 0.0002);
}

// Open new paper trades from discovered signals
export function openPaperTrades(signals: { symbol: string; name: string; overallScore: number; ltp: number; foAnalysis: { suggestedTarget: number; suggestedStopLoss: number; riskReward: number }; strategies: string[]; isFnO?: boolean }[]): PaperTradeRecord[] {
  if (!isMarketOpen()) return loadTrades();

  const trades = loadTrades();
  const today = todayStr();

  // Count today's trades
  const todayTrades = trades.filter(t => t.entryTime.startsWith(today));
  const todayEquity = todayTrades.filter(t => t.type === 'EQUITY').length;
  const todayFO = todayTrades.filter(t => t.type === 'F&O').length;

  // Check open position capital
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const deployedCapital = openTrades.reduce((sum, t) => sum + t.entryPrice * t.quantity, 0);

  // Filter high-conviction signals not already in open trades
  const openSymbols = new Set(openTrades.map(t => t.symbol));
  const candidates = signals
    .filter(s => Math.abs(s.overallScore) >= 40 && !openSymbols.has(s.symbol))
    .sort((a, b) => Math.abs(b.overallScore) - Math.abs(a.overallScore));

  let equityAdded = 0;
  let foAdded = 0;

  for (const s of candidates) {
    if (deployedCapital >= CAPITAL * 0.9) break; // Don't exceed 90% capital deployed

    const isFO = s.isFnO ?? false;
    if (isFO) {
      if (todayFO + foAdded >= MAX_FO_PER_DAY) continue;
    } else {
      if (todayEquity + equityAdded >= MAX_EQUITY_PER_DAY) continue;
    }

    const type: 'EQUITY' | 'F&O' = isFO ? 'F&O' : 'EQUITY';
    const posSize = isFO ? FO_POSITION_SIZE : EQUITY_POSITION_SIZE;
    const quantity = Math.max(1, Math.floor(posSize / s.ltp));
    const side: 'BUY' | 'SELL' = s.overallScore > 0 ? 'BUY' : 'SELL';

    const trade: PaperTradeRecord = {
      id: `${s.symbol}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      symbol: s.symbol,
      name: s.name,
      type,
      side,
      quantity,
      entryPrice: s.ltp, // ACTUAL live price at signal time
      entryTime: new Date().toISOString(),
      stopLoss: s.foAnalysis.suggestedStopLoss,
      target: s.foAnalysis.suggestedTarget,
      strategy: s.strategies[0] || 'Multi-Strategy',
      score: s.overallScore,
      status: 'OPEN',
    };

    trades.push(trade);
    if (isFO) foAdded++; else equityAdded++;
  }

  saveTrades(trades);
  return trades;
}

// Check open trades against current prices — close if SL/target hit
export function updatePaperTrades(currentPrices: Map<string, number>): PaperTradeRecord[] {
  const trades = loadTrades();
  let changed = false;

  for (const t of trades) {
    if (t.status !== 'OPEN') continue;

    const price = currentPrices.get(t.symbol);
    if (!price) continue;

    let hit: 'TARGET_HIT' | 'SL_HIT' | null = null;

    if (t.side === 'BUY') {
      if (price >= t.target) hit = 'TARGET_HIT';
      else if (price <= t.stopLoss) hit = 'SL_HIT';
    } else {
      if (price <= t.target) hit = 'TARGET_HIT';
      else if (price >= t.stopLoss) hit = 'SL_HIT';
    }

    if (hit) {
      t.status = hit;
      t.exitPrice = price;
      t.exitTime = new Date().toISOString();
      const turnover = t.entryPrice * t.quantity * 2;
      t.brokerage = calcBrokerage(t.type, turnover);
      t.grossPnl = t.side === 'BUY'
        ? (price - t.entryPrice) * t.quantity
        : (t.entryPrice - price) * t.quantity;
      t.netPnl = Math.round(t.grossPnl - t.brokerage);
      t.grossPnl = Math.round(t.grossPnl);
      t.pnlPct = Math.round(((t.side === 'BUY' ? price - t.entryPrice : t.entryPrice - price) / t.entryPrice) * 10000) / 100;
      changed = true;
    }
  }

  // EOD exit: close trades open from previous days
  const today = todayStr();
  for (const t of trades) {
    if (t.status !== 'OPEN') continue;
    if (t.entryTime.slice(0, 10) < today) {
      const price = currentPrices.get(t.symbol);
      if (!price) continue;
      t.status = 'EOD_EXIT';
      t.exitPrice = price;
      t.exitTime = new Date().toISOString();
      const turnover = t.entryPrice * t.quantity * 2;
      t.brokerage = calcBrokerage(t.type, turnover);
      t.grossPnl = t.side === 'BUY'
        ? (price - t.entryPrice) * t.quantity
        : (t.entryPrice - price) * t.quantity;
      t.netPnl = Math.round(t.grossPnl - t.brokerage);
      t.grossPnl = Math.round(t.grossPnl);
      t.pnlPct = Math.round(((t.side === 'BUY' ? price - t.entryPrice : t.entryPrice - price) / t.entryPrice) * 10000) / 100;
      changed = true;
    }
  }

  if (changed) saveTrades(trades);
  return trades;
}

// Get all trades (for UI)
export function getPaperTrades(): PaperTradeRecord[] {
  return loadTrades();
}

// Get summary stats
export function getPaperTradeSummary() {
  const trades = loadTrades();
  const closed = trades.filter(t => t.status !== 'OPEN');
  const open = trades.filter(t => t.status === 'OPEN');
  const wins = closed.filter(t => (t.netPnl ?? 0) > 0);
  const losses = closed.filter(t => (t.netPnl ?? 0) <= 0);
  const totalNet = closed.reduce((s, t) => s + (t.netPnl ?? 0), 0);
  const totalBrokerage = closed.reduce((s, t) => s + (t.brokerage ?? 0), 0);

  return {
    totalTrades: trades.length,
    openTrades: open.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0,
    totalNetPnl: totalNet,
    totalBrokerage,
    capital: CAPITAL,
    returnPct: Math.round((totalNet / CAPITAL) * 10000) / 100,
  };
}

// Reset all trades (fresh start)
export function clearPaperTrades(): void {
  localStorage.removeItem(STORAGE_KEY);
}
