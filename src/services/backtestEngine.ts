// ponytail: backtesting engine — runs all strategies on historical data, computes accuracy %
// Exploratory simulation; does not validate the live composite scanner.
import { apiUrl } from '../utils/apiUrl';
import { estimatedCosts } from './paperTrading';
import { validLevels } from './tradingTime';

export interface BacktestConfig {
  symbol: string;
  startDate?: string;  // defaults to 1 year ago
  endDate?: string;    // defaults to today
  initialCapital?: number;  // defaults to ₹5,00,000
  riskPerTrade?: number;    // defaults to 0.5%, configurable up to 2%
  slippageBps?: number;
  strategies?: string[];     // defaults to all
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  strategy: string;
  reason: string;
  holdingDays: number;
}

export interface StrategyResult {
  name: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgHoldingDays: number;
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  expectancy: number; // (winRate * avgWin) - (lossRate * avgLoss)
}

export interface BacktestResult {
  symbol: string;
  stockName: string;
  period: string;
  totalDays: number;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturn: number;
  buyAndHoldReturn: number;  // comparison benchmark
  alphaVsBuyHold: number;
  // Per-strategy results
  strategies: StrategyResult[];
  // Combined results
  combined: StrategyResult;
  // Equity curve
  equityCurve: { date: string; equity: number; drawdown: number }[];
  // All trades
  trades: BacktestTrade[];
  // Accuracy metrics
  accuracy: {
    overallSignalAccuracy: number;
    buySignalAccuracy: number;
    sellSignalAccuracy: number;
    momentumAccuracy: number;
    breakoutAccuracy: number;
    trendAccuracy: number;
    meanReversionAccuracy: number;
    smartMoneyAccuracy: number;
  };
}

// --- Technical Analysis (reuse from stockDiscovery but standalone for backtest) ---

function computeRSI(closes: number[], idx: number, period = 14): number {
  if (idx < period) return 50;
  let gains = 0, losses = 0;
  for (let i = idx - period + 1; i <= idx; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
}

function computeSMA(closes: number[], idx: number, period: number): number {
  if (idx < period - 1) return closes[idx];
  let sum = 0;
  for (let i = idx - period + 1; i <= idx; i++) sum += closes[i];
  return sum / period;
}

function computeEMAAt(data: number[], idx: number, period: number): number {
  if (idx < period) return data[idx];
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i <= idx; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeATR(highs: number[], lows: number[], closes: number[], idx: number, period = 14): number {
  if (idx < period) return (highs[idx] - lows[idx]);
  let atr = 0;
  for (let i = idx - period + 1; i <= idx; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    atr += tr;
  }
  return atr / period;
}

function computeBollingerBands(closes: number[], idx: number, period = 20): { upper: number; lower: number; middle: number } {
  const sma = computeSMA(closes, idx, period);
  if (idx < period - 1) return { upper: sma * 1.02, lower: sma * 0.98, middle: sma };
  let sumSq = 0;
  for (let i = idx - period + 1; i <= idx; i++) sumSq += (closes[i] - sma) ** 2;
  const std = Math.sqrt(sumSq / period);
  return { upper: sma + 2 * std, lower: sma - 2 * std, middle: sma };
}

// --- Strategy Signal Generators ---

interface Signal {
  direction: 'BUY' | 'SELL' | 'NONE';
  strategy: string;
  reason: string;
  stopLoss: number;
  target: number;
}

function momentumSignal(closes: number[], highs: number[], lows: number[], idx: number): Signal {
  if (idx < 26) return { direction: 'NONE', strategy: 'Momentum', reason: '', stopLoss: 0, target: 0 };
  
  const rsi = computeRSI(closes, idx);
  const ema12 = computeEMAAt(closes, idx, 12);
  const ema26 = computeEMAAt(closes, idx, 26);
  const macdLine = ema12 - ema26;
  const prevMacd = computeEMAAt(closes, idx - 1, 12) - computeEMAAt(closes, idx - 1, 26);
  const sma20 = computeSMA(closes, idx, 20);
  const atr = computeATR(highs, lows, closes, idx);

  // BUY: RSI > 50, MACD crossing up, price > SMA20
  if (rsi > 50 && rsi < 75 && macdLine > 0 && prevMacd <= 0 && closes[idx] > sma20) {
    return {
      direction: 'BUY',
      strategy: 'Momentum',
      reason: `MACD bullish crossover + RSI ${rsi.toFixed(0)} + above SMA20`,
      stopLoss: closes[idx] - atr * 2,
      target: closes[idx] + atr * 3,
    };
  }
  // SELL: RSI < 50, MACD crossing down, price < SMA20
  if (rsi < 50 && rsi > 25 && macdLine < 0 && prevMacd >= 0 && closes[idx] < sma20) {
    return {
      direction: 'SELL',
      strategy: 'Momentum',
      reason: `MACD bearish crossover + RSI ${rsi.toFixed(0)} + below SMA20`,
      stopLoss: closes[idx] + atr * 2,
      target: closes[idx] - atr * 3,
    };
  }
  return { direction: 'NONE', strategy: 'Momentum', reason: '', stopLoss: 0, target: 0 };
}

function breakoutSignal(closes: number[], highs: number[], lows: number[], volumes: number[], idx: number): Signal {
  if (idx < 20) return { direction: 'NONE', strategy: 'Breakout', reason: '', stopLoss: 0, target: 0 };

  const atr = computeATR(highs, lows, closes, idx);
  const avgVol = volumes.slice(Math.max(0, idx - 20), idx).reduce((a, b) => a + b, 0) / 20;
  const volRatio = volumes[idx] / (avgVol || 1);
  
  // 20-day high breakout with volume
  let high20 = 0;
  for (let i = idx - 20; i < idx; i++) high20 = Math.max(high20, highs[i]);
  
  if (closes[idx] > high20 && volRatio > 1.5) {
    return {
      direction: 'BUY',
      strategy: 'Breakout',
      reason: `20-day high breakout + volume ${volRatio.toFixed(1)}x avg`,
      stopLoss: closes[idx] - atr * 2,
      target: closes[idx] + atr * 4,
    };
  }

  // 20-day low breakdown with volume
  let low20 = Infinity;
  for (let i = idx - 20; i < idx; i++) low20 = Math.min(low20, lows[i]);
  
  if (closes[idx] < low20 && volRatio > 1.5) {
    return {
      direction: 'SELL',
      strategy: 'Breakout',
      reason: `20-day low breakdown + volume ${volRatio.toFixed(1)}x avg`,
      stopLoss: closes[idx] + atr * 2,
      target: closes[idx] - atr * 4,
    };
  }
  return { direction: 'NONE', strategy: 'Breakout', reason: '', stopLoss: 0, target: 0 };
}

function trendFollowingSignal(closes: number[], highs: number[], lows: number[], idx: number): Signal {
  if (idx < 50) return { direction: 'NONE', strategy: 'Trend Following', reason: '', stopLoss: 0, target: 0 };

  const sma20 = computeSMA(closes, idx, 20);
  const sma50 = computeSMA(closes, idx, 50);
  const prevSma20 = computeSMA(closes, idx - 1, 20);
  const prevSma50 = computeSMA(closes, idx - 1, 50);
  const atr = computeATR(highs, lows, closes, idx);

  // Golden cross: SMA20 crosses above SMA50
  if (sma20 > sma50 && prevSma20 <= prevSma50 && closes[idx] > sma20) {
    return {
      direction: 'BUY',
      strategy: 'Trend Following',
      reason: `Golden cross (SMA20 > SMA50) + price above both`,
      stopLoss: closes[idx] - atr * 2.5,
      target: closes[idx] + atr * 5,
    };
  }
  // Death cross: SMA20 crosses below SMA50
  if (sma20 < sma50 && prevSma20 >= prevSma50 && closes[idx] < sma20) {
    return {
      direction: 'SELL',
      strategy: 'Trend Following',
      reason: `Death cross (SMA20 < SMA50) + price below both`,
      stopLoss: closes[idx] + atr * 2.5,
      target: closes[idx] - atr * 5,
    };
  }
  return { direction: 'NONE', strategy: 'Trend Following', reason: '', stopLoss: 0, target: 0 };
}

function meanReversionSignal(closes: number[], highs: number[], lows: number[], idx: number): Signal {
  if (idx < 20) return { direction: 'NONE', strategy: 'Mean Reversion', reason: '', stopLoss: 0, target: 0 };

  const rsi = computeRSI(closes, idx);
  const prevRsi = computeRSI(closes, idx - 1);
  const bb = computeBollingerBands(closes, idx);
  const atr = computeATR(highs, lows, closes, idx);

  // Oversold bounce: RSI crosses above 30 from below + at lower Bollinger
  if (rsi > 30 && prevRsi <= 30 && closes[idx] <= bb.lower * 1.01) {
    return {
      direction: 'BUY',
      strategy: 'Mean Reversion',
      reason: `RSI bounce from oversold (${prevRsi.toFixed(0)}→${rsi.toFixed(0)}) + at lower Bollinger Band`,
      stopLoss: closes[idx] - atr * 1.5,
      target: bb.middle,
    };
  }
  // Overbought reversal: RSI crosses below 70 from above + at upper Bollinger
  if (rsi < 70 && prevRsi >= 70 && closes[idx] >= bb.upper * 0.99) {
    return {
      direction: 'SELL',
      strategy: 'Mean Reversion',
      reason: `RSI reversal from overbought (${prevRsi.toFixed(0)}→${rsi.toFixed(0)}) + at upper Bollinger Band`,
      stopLoss: closes[idx] + atr * 1.5,
      target: bb.middle,
    };
  }
  return { direction: 'NONE', strategy: 'Mean Reversion', reason: '', stopLoss: 0, target: 0 };
}

function smartMoneySignal(closes: number[], highs: number[], lows: number[], volumes: number[], idx: number): Signal {
  if (idx < 20) return { direction: 'NONE', strategy: 'Volume Pattern', reason: '', stopLoss: 0, target: 0 };

  const avgVol = volumes.slice(Math.max(0, idx - 20), idx).reduce((a, b) => a + b, 0) / 20;
  const volRatio = volumes[idx] / (avgVol || 1);
  const sma50 = computeSMA(closes, idx, 50);
  const atr = computeATR(highs, lows, closes, idx);

  // Volume spike (2x+) with price above SMA50 and bullish candle
  if (volRatio >= 2 && closes[idx] > sma50 && closes[idx] > closes[idx - 1]) {
    return {
      direction: 'BUY',
      strategy: 'Volume Pattern',
      reason: `Volume spike ${volRatio.toFixed(1)}x + bullish candle above SMA50 (unusual volume; participants unverified)`,
      stopLoss: closes[idx] - atr * 2,
      target: closes[idx] + atr * 3,
    };
  }
  // Volume spike with price below SMA50 and bearish candle (distribution)
  if (volRatio >= 2 && closes[idx] < sma50 && closes[idx] < closes[idx - 1]) {
    return {
      direction: 'SELL',
      strategy: 'Volume Pattern',
      reason: `Volume spike ${volRatio.toFixed(1)}x + bearish candle below SMA50 (unusual volume; participants unverified)`,
      stopLoss: closes[idx] + atr * 2,
      target: closes[idx] - atr * 3,
    };
  }
  return { direction: 'NONE', strategy: 'Volume Pattern', reason: '', stopLoss: 0, target: 0 };
}

// --- Main Backtest Engine ---

export interface HistoricalBar { date: string; open: number; high: number; low: number; close: number; volume: number }
export function exitAtBar(side: 'BUY' | 'SELL', stop: number, target: number, bar: HistoricalBar): number | null {
  // Gaps execute at the opening price. Unknown intrabar order is resolved stop-first.
  if (side === 'BUY') {
    if (bar.open <= stop || bar.open >= target) return bar.open;
    if (bar.low <= stop) return stop;
    if (bar.high >= target) return target;
  } else {
    if (bar.open >= stop || bar.open <= target) return bar.open;
    if (bar.high >= stop) return stop;
    if (bar.low <= target) return target;
  }
  return null;
}
export async function runBacktest(config: BacktestConfig): Promise<BacktestResult | null> {
  const symbol = config.symbol.includes('.') ? config.symbol : `${config.symbol}.NS`;
  try {
    const res = await fetch(apiUrl(`/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y`));
    if (!res.ok) throw new Error(`History HTTP ${res.status}`);
    const result = (await res.json())?.chart?.result?.[0];
    const q = result?.indicators?.quote?.[0];
    if (!q || !result.timestamp) throw new Error('Historical data missing');
    const bars = result.timestamp.map((ts: number, i: number) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] }))
      .filter((b: HistoricalBar) => [b.open, b.high, b.low, b.close, b.volume].every(Number.isFinite) && b.low > 0 && b.low <= Math.min(b.open, b.close) && b.high >= Math.max(b.open, b.close) && b.date < new Date().toISOString().slice(0, 10));
    return simulateBacktest(bars, config, result.meta?.longName || config.symbol);
  } catch { return null; }
}
export function simulateBacktest(bars: HistoricalBar[], config: BacktestConfig, stockName = config.symbol): BacktestResult | null {
  const initialCapital = config.initialCapital ?? 500000;
  const riskPerTrade = config.riskPerTrade ?? .005;
  const slip = (config.slippageBps ?? 5) / 10000;
  if (!(initialCapital > 0) || !(riskPerTrade > 0 && riskPerTrade <= .02) || !(slip >= 0 && slip < .1)) throw new Error('Invalid risk configuration');
  if (bars.some((bar, i) => i > 0 && bar.date <= bars[i - 1].date)) throw new Error('Bars must be unique and chronological');
  const start = config.startDate || bars[Math.max(50, bars.length - 252)]?.date;
  const end = config.endDate || bars.at(-1)?.date;
  if (!start || !end || start > end) return null;
  const closes = bars.map(b => b.close), highs = bars.map(b => b.high), lows = bars.map(b => b.low), volumes = bars.map(b => b.volume);
  const indices = bars.map((_, i) => i).filter(i => i >= 51 && bars[i].date >= start && bars[i].date <= end);
  if (!indices.length) return null;
  const trades: BacktestTrade[] = [], equityCurve: BacktestResult['equityCurve'] = [];
  let capital = initialCapital, peak = initialCapital;
  let position: { entry: number; idx: number; qty: number; sl: number; tp: number; strategy: string; reason: string } | null = null;
  const close = (price: number, idx: number) => {
    const p = position!;
    const exit = price * (1 - slip);
    const pnl = (exit - p.entry) * p.qty - estimatedCosts(p.entry, exit, p.qty);
    trades.push({ entryDate: bars[p.idx].date, exitDate: bars[idx].date, side: 'BUY', entryPrice: p.entry, exitPrice: exit, quantity: p.qty, pnl, pnlPct: pnl / (p.entry * p.qty) * 100, strategy: p.strategy, reason: p.reason, holdingDays: idx - p.idx });
    capital += pnl; position = null;
  };
  for (const i of indices) {
    if (!position && capital > 0) {
      // Yesterday's completed bar creates today's order. Long-only cash-equity study.
      const j = i - 1;
      const signals = [momentumSignal(closes, highs, lows, j), breakoutSignal(closes, highs, lows, volumes, j), trendFollowingSignal(closes, highs, lows, j), meanReversionSignal(closes, highs, lows, j), smartMoneySignal(closes, highs, lows, volumes, j)]
        .filter(s => s.direction === 'BUY' && (!config.strategies || config.strategies.includes(s.strategy)));
      const signal = signals[0];
      const entry = bars[i].open * (1 + slip);
      if (signal && validLevels('BUY', entry, signal.stopLoss, signal.target)) {
        const risk = entry - signal.stopLoss;
        const qty = Math.floor(Math.min(capital * .5 / entry, Math.max(0, capital * riskPerTrade - 40) / (risk + entry * .001)));
        if (qty > 0) position = { entry, idx: i, qty, sl: signal.stopLoss, tp: signal.target, strategy: signal.strategy, reason: signal.reason };
      }
    }
    if (position) {
      const exit = exitAtBar('BUY', position.sl, position.tp, bars[i]);
      if (exit !== null) close(exit, i);
      else if (i === indices.at(-1)) close(bars[i].close, i);
    }
    const equity = capital + (position ? (bars[i].close - position.entry) * position.qty - estimatedCosts(position.entry, bars[i].close, position.qty) : 0);
    peak = Math.max(peak, equity);
    equityCurve.push({ date: bars[i].date, equity, drawdown: (peak - equity) / peak * 100 });
  }
  const names = ['Momentum', 'Breakout', 'Trend Following', 'Mean Reversion', 'Volume Pattern'];
  const strategies = names.map(name => computeStrategyResult(name, trades.filter(t => t.strategy === name), initialCapital));
  const combined = computeStrategyResult('Combined', trades, initialCapital);
  combined.maxDrawdownPct = Math.max(...equityCurve.map(p => p.drawdown));
  let peakValue = initialCapital;
  combined.maxDrawdown = equityCurve.reduce((max, p) => { peakValue = Math.max(peakValue, p.equity); return Math.max(max, peakValue - p.equity); }, 0);
  const returns = equityCurve.map((p, i) => p.equity / (i ? equityCurve[i - 1].equity : initialCapital) - 1);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
  combined.sharpeRatio = std > 0 ? mean / std * Math.sqrt(252) : 0;
  const first = indices[0], last = indices[indices.length - 1];
  const benchmarkEntry = bars[first].open * (1 + slip), benchmarkExit = bars[last].close * (1 - slip);
  const benchmarkQty = Math.floor(initialCapital / benchmarkEntry);
  const buyAndHoldReturn = ((benchmarkExit - benchmarkEntry) * benchmarkQty - estimatedCosts(benchmarkEntry, benchmarkExit, benchmarkQty)) / initialCapital * 100;
  const totalReturnPct = (capital / initialCapital - 1) * 100;
  return { symbol: config.symbol, stockName, period: `${bars[first].date} to ${bars[last].date}`, totalDays: indices.length, initialCapital, finalCapital: capital, totalReturn: capital - initialCapital, totalReturnPct,
    annualizedReturn: ((capital / initialCapital) ** (252 / indices.length) - 1) * 100, buyAndHoldReturn, alphaVsBuyHold: totalReturnPct - buyAndHoldReturn,
    strategies, combined, equityCurve, trades, accuracy: { overallSignalAccuracy: combined.winRate, buySignalAccuracy: computeDirectionAccuracy(trades, 'BUY'), sellSignalAccuracy: 0,
      momentumAccuracy: strategies[0].winRate, breakoutAccuracy: strategies[1].winRate, trendAccuracy: strategies[2].winRate, meanReversionAccuracy: strategies[3].winRate, smartMoneyAccuracy: strategies[4].winRate } };
}

function computeStrategyResult(name: string, trades: BacktestTrade[], initialCapital: number): StrategyResult {
  if (trades.length === 0) {
    return { name, totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, avgPnl: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, sharpeRatio: 0, maxDrawdown: 0, maxDrawdownPct: 0, avgHoldingDays: 0, bestTrade: 0, worstTrade: 0, consecutiveWins: 0, consecutiveLosses: 0, expectancy: 0 };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const winRate = (wins.length / trades.length) * 100;
  const totalPnl = trades.reduce((a, t) => a + t.pnl, 0);
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : 0;
  const grossProfit = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0;

  // Sharpe (simplified: mean return / std of returns)
  const returns = trades.map(t => t.pnlPct);
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length);
  const sharpeRatio = stdReturn > 0 ? meanReturn / stdReturn : 0; // Trade-return ratio; not annualized.

  // Max drawdown
  let peak = 0, maxDD = 0, cumPnl = 0;
  for (const t of trades) {
    cumPnl += t.pnl;
    peak = Math.max(peak, cumPnl);
    maxDD = Math.max(maxDD, peak - cumPnl);
  }

  // Consecutive wins/losses
  let maxConsWins = 0, maxConsLosses = 0, consWins = 0, consLosses = 0;
  for (const t of trades) {
    if (t.pnl > 0) { consWins++; consLosses = 0; maxConsWins = Math.max(maxConsWins, consWins); }
    else { consLosses++; consWins = 0; maxConsLosses = Math.max(maxConsLosses, consLosses); }
  }

  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

  return {
    name,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: Math.round(winRate * 10) / 10,
    totalPnl: Math.round(totalPnl),
    avgPnl: Math.round(totalPnl / trades.length),
    avgWin: Math.round(avgWin),
    avgLoss: Math.round(avgLoss),
    profitFactor: profitFactor === null ? null : Math.round(profitFactor * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDD),
    maxDrawdownPct: Math.round((maxDD / initialCapital) * 100 * 100) / 100, // vs initial capital
    avgHoldingDays: Math.round(trades.reduce((a, t) => a + t.holdingDays, 0) / trades.length),
    bestTrade: Math.max(...trades.map(t => t.pnl)),
    worstTrade: Math.min(...trades.map(t => t.pnl)),
    consecutiveWins: maxConsWins,
    consecutiveLosses: maxConsLosses,
    expectancy: Math.round(expectancy),
  };
}

function computeDirectionAccuracy(trades: BacktestTrade[], direction: 'BUY' | 'SELL'): number {
  const filtered = trades.filter(t => t.side === direction);
  if (filtered.length === 0) return 0;
  return Math.round((filtered.filter(t => t.pnl > 0).length / filtered.length) * 1000) / 10;
}
