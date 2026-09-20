import { isMarketOpenCached } from './marketStatus';
import { DAY_MS, freshQuote, inSession, istDate, istMinutes, validLevels, type MarketQuote } from './tradingTime';
import { strongSignalRejection } from './strongSignalPolicy';
import { mergeDecisions, type CandidateDecision, type DecisionRecord } from './decisionJournal';
import { readRecords } from './journalStorage';

export interface PaperTradeRecord {
  id: string; symbol: string; name: string; type: 'EQUITY' | 'F&O'; side: 'BUY' | 'SELL';
  quantity: number; entryPrice: number; entryTime: string; stopLoss: number; target: number;
  strategy: string; score: number; exitPrice?: number; exitTime?: string;
  status: 'OPEN' | 'TARGET_HIT' | 'SL_HIT' | 'EOD_EXIT' | 'EXPIRED';
  grossPnl?: number; brokerage?: number; netPnl?: number; pnlPct?: number;
  signalId?: string; signalTime?: string; entryQuoteTime?: string; exitQuoteTime?: string;
  source?: string; lastQuoteTime?: string; lastPrice?: number; monitoringGap?: boolean;
  modelVersion?: string; events?: { at: string; quoteTime?: string; kind: string; price?: number; note: string }[];
}
interface Ledger { version: 3; trades: PaperTradeRecord[]; archivedNet: number; archivedCount: number; decisions?: DecisionRecord[] }
const KEY = 'paper_ledger_v3';
const CAPITAL = 20000;
export const MODEL_VERSION = 'paper-observed-equity-v5';
const round = (n: number) => Math.round(n * 100) / 100;
export function loadLedger(): Ledger {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const ledger = JSON.parse(raw) as Ledger;
    if (ledger.version !== 3 || !Array.isArray(ledger.trades) || !Number.isFinite(ledger.archivedNet) || (ledger.decisions !== undefined && !Array.isArray(ledger.decisions))) throw new Error('Invalid paper ledger; original data preserved.');
    return ledger;
  }
  return { version: 3, trades: readRecords<PaperTradeRecord>('paper_trades_v2'), archivedNet: 0, archivedCount: 0 };
}
function save(ledger: Ledger) { localStorage.setItem(KEY, JSON.stringify(ledger)); }
export function prunePaperTrades(now = Date.now()): number {
  const ledger = loadLedger();
  const expired = ledger.trades.filter(t => t.status !== 'OPEN' && !!t.exitTime && Date.parse(t.exitTime) < now - 30 * DAY_MS);
  const ids = new Set(expired.map(t => t.id));
  ledger.trades = ledger.trades.filter(t => !ids.has(t.id));
  ledger.archivedNet += expired.reduce((n, t) => n + (t.netPnl || 0), 0);
  ledger.archivedCount += expired.length;
  save(ledger); return expired.length;
}
// Explicit configurable approximation, not a broker contract note. 0.10% round-trip + ₹40.
export function estimatedCosts(entry: number, exit: number, quantity: number): number {
  return round(40 + (entry + exit) * quantity * 0.0005);
}
export interface PaperSignal {
  symbol: string; name: string; signal: string; blockedReasons?: string[]; overallScore: number; ltp: number; strategies: string[];
  foAnalysis: { suggestedTarget: number; suggestedStopLoss: number; riskReward: number };
  signalId?: string; firstSignalAt?: string; generatedAt: string; quoteTime?: string; eligible: boolean; isFnO?: boolean;
}
export function openPaperTrades(signals: PaperSignal[], now = Date.now()): PaperTradeRecord[] {
  const ledger = loadLedger();
  const decisions: CandidateDecision[] = [];
  const audit = (s: PaperSignal, reason: string, tradeId?: string) => decisions.push({
    symbol: s.symbol, side: s.overallScore > 0 ? 'BUY' : 'SELL', score: s.overallScore, reason,
    signalId: s.signalId, signalTime: s.firstSignalAt || s.generatedAt, quoteTime: s.quoteTime,
    blockedReasons: s.blockedReasons, tradeId, referencePrice: s.ltp,
    stopLoss: s.foAnalysis.suggestedStopLoss, target: s.foAnalysis.suggestedTarget, strategies: s.strategies,
  });
  const trades = ledger.trades;
  const day = istDate(now);
  const today = trades.filter(t => istDate(t.entryTime) === day);
  const realized = ledger.archivedNet + trades.reduce((n, t) => n + (t.netPnl || 0), 0);
  const equity = Math.max(0, CAPITAL + realized);
  const dailyNet = trades.filter(t => t.exitTime && istDate(t.exitTime) === day).reduce((n, t) => n + (t.netPnl || 0), 0);
  const accountBlock = dailyNet <= -CAPITAL * .02 ? 'DAILY_LOSS_LIMIT' : trades.some(t => t.status === 'OPEN' && istDate(t.entryTime) < day) ? 'OVERNIGHT_POSITION_UNRESOLVED' : null;
  let deployed = trades.filter(t => t.status === 'OPEN').reduce((n, t) => n + t.entryPrice * t.quantity + 40, 0);
  const symbols = new Set(today.map(t => t.symbol));
  let count = today.length;
  for (const s of [...signals].sort((a, b) => Math.abs(b.overallScore) - Math.abs(a.overallScore))) {
    const reason = strongSignalRejection(s, now) || (!isMarketOpenCached() ? 'MARKET_NOT_CONFIRMED_OPEN' : null) || accountBlock
      || (!s.signalId ? 'SIGNAL_NOT_RECORDED' : null) || (symbols.has(s.symbol) ? 'SYMBOL_ALREADY_TRADED' : null) || (count >= 3 ? 'DAILY_TRADE_LIMIT' : null);
    if (reason) { audit(s, reason); continue; }
    const quote = { price: s.ltp, timestamp: s.quoteTime || '', source: 'Yahoo research feed' };
    const side = s.overallScore > 0 ? 'BUY' : 'SELL';
    const entry = round(s.ltp * (side === 'BUY' ? 1.0005 : .9995));
    const stop = s.foAnalysis.suggestedStopLoss, target = s.foAnalysis.suggestedTarget;
    if (!validLevels(side, entry, stop, target)) { audit(s, 'INVALID_LEVELS_AFTER_SLIPPAGE'); continue; }
    const risk = Math.abs(entry - stop);
    const qty = Math.floor(Math.min(5000 / entry, (equity * .9 - deployed - 40) / entry, Math.max(0, equity * .005 - 40) / (risk + entry * .001)));
    if (qty < 1) { audit(s, 'INSUFFICIENT_CAPITAL_OR_RISK_BUDGET'); continue; }
    const at = new Date(now).toISOString();
    trades.push({ id: crypto.randomUUID(), symbol: s.symbol, name: s.name, type: 'EQUITY', side,
      quantity: qty, entryPrice: entry, entryTime: at, stopLoss: stop, target, strategy: s.strategies[0] || 'Composite', score: s.overallScore,
      status: 'OPEN', signalId: s.signalId, signalTime: s.firstSignalAt || s.generatedAt, entryQuoteTime: s.quoteTime,
      lastQuoteTime: s.quoteTime, lastPrice: s.ltp, source: quote.source, modelVersion: MODEL_VERSION,
      events: [{ at, quoteTime: s.quoteTime, kind: 'ENTRY', price: entry, note: 'Observed quote with adverse 5 bps slippage; equity simulation.' }] });
    audit(s, 'PAPER_ENTRY', trades[trades.length - 1].id);
    deployed += entry * qty + 40; symbols.add(s.symbol); count++;
  }
  ledger.decisions = mergeDecisions(ledger.decisions || [], decisions, now);
  // One atomic storage write: a paper entry and its decision cannot diverge.
  save(ledger); return trades;
}
export function updatePaperTrades(quotes: Map<string, MarketQuote>, now = Date.now()): PaperTradeRecord[] {
  const ledger = loadLedger();
  const at = new Date(now).toISOString();
  for (const t of ledger.trades) {
    if (t.status !== 'OPEN') continue;
    const q = quotes.get(t.symbol);
    if (!freshQuote(q, now) || Date.parse(q.timestamp) <= Date.parse(t.lastQuoteTime || t.entryTime)) continue;
    t.events ??= [];
    if (Date.parse(q.timestamp) - Date.parse(t.lastQuoteTime || t.entryTime) > 120_000) {
      if (!t.monitoringGap) t.events.push({ at, quoteTime: q.timestamp, kind: 'GAP', note: 'Missing observations: any earlier stop/target crossing is unknown.' });
      t.monitoringGap = true;
    }
    t.lastQuoteTime = q.timestamp; t.lastPrice = q.price;
    // Never backdate a missed close or call a next-day quote yesterday's EOD execution.
    const overdue = istDate(t.entryTime) < istDate(q.timestamp);
    const stop = t.side === 'BUY' ? q.price <= t.stopLoss : q.price >= t.stopLoss;
    const target = t.side === 'BUY' ? q.price >= t.target : q.price <= t.target;
    if (!overdue && !inSession(q.timestamp)) continue;
    const status = overdue ? 'EXPIRED' : istMinutes(q.timestamp) >= 925 ? 'EOD_EXIT' : stop ? 'SL_HIT' : target ? 'TARGET_HIT' : null;
    if (!status) continue;
    t.status = status;
    t.exitTime = at; t.exitQuoteTime = q.timestamp;
    t.exitPrice = round(q.price * (t.side === 'BUY' ? .9995 : 1.0005));
    t.grossPnl = round((t.exitPrice - t.entryPrice) * t.quantity * (t.side === 'BUY' ? 1 : -1));
    t.brokerage = estimatedCosts(t.entryPrice, t.exitPrice, t.quantity);
    t.netPnl = round(t.grossPnl - t.brokerage);
    t.pnlPct = round(t.netPnl / (t.entryPrice * t.quantity) * 100);
    t.events.push({ at, quoteTime: q.timestamp, kind: status, price: t.exitPrice, note: overdue ? 'Missed session close. Recovery at observed price; excluded from validated statistics.' : 'Exit observed at this quote; exact threshold-crossing time is unknown.' });
  }
  save(ledger); return ledger.trades;
}
export function getPaperTrades(): PaperTradeRecord[] { return loadLedger().trades; }
export function getPaperTradeSummary() {
  const ledger = loadLedger(), trades = ledger.trades;
  const closed = trades.filter(t => t.status !== 'OPEN');
  const evaluated = closed.filter(t => t.modelVersion === MODEL_VERSION && !t.monitoringGap && t.status !== 'EXPIRED');
  const wins = evaluated.filter(t => (t.netPnl || 0) > 0);
  const losses = evaluated.filter(t => (t.netPnl || 0) <= 0);
  const totalNetPnl = round(closed.reduce((n, t) => n + (t.netPnl || 0), 0));
  return { totalTrades: trades.length, openTrades: trades.filter(t => t.status === 'OPEN').length, closedTrades: closed.length,
    evaluated: evaluated.length, excluded: closed.length - evaluated.length, wins: wins.length, losses: losses.length,
    winRate: evaluated.length ? round(wins.length / evaluated.length * 100) : 0,
    totalNetPnl, totalBrokerage: round(closed.reduce((n, t) => n + (t.brokerage || 0), 0)), capital: CAPITAL,
    accountEquity: round(CAPITAL + ledger.archivedNet + totalNetPnl), archivedNet: ledger.archivedNet,
    returnPct: round((totalNetPnl + ledger.archivedNet) / CAPITAL * 100) };
}
