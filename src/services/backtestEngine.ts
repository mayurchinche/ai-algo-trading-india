// ponytail: backtesting engine — runs all strategies on historical data, computes accuracy %
// This is how top 1% validate before going live: backtest everything, trust nothing untested

export interface BacktestConfig {
  symbol: string;
  startDate?: string;  // defaults to 1 year ago
  endDate?: string;    // defaults to today
  initialCapital?: number;  // defaults to ₹5,00,000
  riskPerTrade?: number;    // defaults to 2% (top 1% rule)
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
  profitFactor: number;
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
  if (idx < 20) return { direction: 'NONE', strategy: 'Smart Money', reason: '', stopLoss: 0, target: 0 };

  const avgVol = volumes.slice(Math.max(0, idx - 20), idx).reduce((a, b) => a + b, 0) / 20;
  const volRatio = volumes[idx] / (avgVol || 1);
  const sma50 = computeSMA(closes, idx, 50);
  const atr = computeATR(highs, lows, closes, idx);

  // Volume spike (2x+) with price above SMA50 and bullish candle
  if (volRatio >= 2 && closes[idx] > sma50 && closes[idx] > closes[idx - 1]) {
    return {
      direction: 'BUY',
      strategy: 'Smart Money',
      reason: `Volume spike ${volRatio.toFixed(1)}x + bullish candle above SMA50 (institutional accumulation)`,
      stopLoss: closes[idx] - atr * 2,
      target: closes[idx] + atr * 3,
    };
  }
  // Volume spike with price below SMA50 and bearish candle (distribution)
  if (volRatio >= 2 && closes[idx] < sma50 && closes[idx] < closes[idx - 1]) {
    return {
      direction: 'SELL',
      strategy: 'Smart Money',
      reason: `Volume spike ${volRatio.toFixed(1)}x + bearish candle below SMA50 (institutional distribution)`,
      stopLoss: closes[idx] + atr * 2,
      target: closes[idx] - atr * 3,
    };
  }
  return { direction: 'NONE', strategy: 'Smart Money', reason: '', stopLoss: 0, target: 0 };
}

// --- Main Backtest Engine ---

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult | null> {
  const { symbol, initialCapital = 500000, riskPerTrade = 0.02 } = config;

  // Fetch 1-year historical data
  const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
  const range = '1y';
  
  try {
    const res = await fetch(`/api/yahoo/v8/finance/chart/${yahooSymbol}?interval=1d&range=${range}`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    if (!quote) return null;

    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];
    const dates: string[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (quote.close[i] == null) continue;
      closes.push(quote.close[i]);
      highs.push(quote.high[i] || quote.close[i]);
      lows.push(quote.low[i] || quote.close[i]);
      volumes.push(quote.volume[i] || 0);
      dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10));
    }

    if (closes.length < 60) return null; // Need at least 60 days

    const stockName = result.meta?.longName || result.meta?.shortName || symbol;

    // Run backtest
    const allTrades: BacktestTrade[] = [];
    let capital = initialCapital;
    let openPosition: { entry: number; date: string; side: 'BUY' | 'SELL'; qty: number; sl: number; tp: number; strategy: string; reason: string } | null = null;
    const equityCurve: { date: string; equity: number; drawdown: number }[] = [];
    let peakEquity = initialCapital;

    for (let i = 50; i < closes.length; i++) {
      // Check if open position hit SL or TP
      if (openPosition) {
        const hitSL = openPosition.side === 'BUY' 
          ? lows[i] <= openPosition.sl 
          : highs[i] >= openPosition.sl;
        const hitTP = openPosition.side === 'BUY'
          ? highs[i] >= openPosition.tp
          : lows[i] <= openPosition.tp;

        if (hitSL || hitTP) {
          const exitPrice = hitTP ? openPosition.tp : openPosition.sl;
          const pnl = openPosition.side === 'BUY'
            ? (exitPrice - openPosition.entry) * openPosition.qty
            : (openPosition.entry - exitPrice) * openPosition.qty;
          const pnlPct = openPosition.side === 'BUY'
            ? ((exitPrice - openPosition.entry) / openPosition.entry) * 100
            : ((openPosition.entry - exitPrice) / openPosition.entry) * 100;

          allTrades.push({
            entryDate: openPosition.date,
            exitDate: dates[i],
            side: openPosition.side,
            entryPrice: openPosition.entry,
            exitPrice,
            quantity: openPosition.qty,
            pnl: Math.round(pnl),
            pnlPct: Math.round(pnlPct * 100) / 100,
            strategy: openPosition.strategy,
            reason: openPosition.reason,
            holdingDays: dates.indexOf(dates[i]) - dates.indexOf(openPosition.date),
          });
          capital += pnl;
          openPosition = null;
        }
      }

      // Generate signals (only if no open position)
      if (!openPosition) {
        const signals = [
          momentumSignal(closes, highs, lows, i),
          breakoutSignal(closes, highs, lows, volumes, i),
          trendFollowingSignal(closes, highs, lows, i),
          meanReversionSignal(closes, highs, lows, i),
          smartMoneySignal(closes, highs, lows, volumes, i),
        ].filter(s => s.direction !== 'NONE');

        if (signals.length > 0) {
          // Take the first valid signal (priority order)
          const signal = signals[0];
          const riskAmount = capital * riskPerTrade;
          const slDistance = Math.abs(closes[i] - signal.stopLoss);
          const qty = slDistance > 0 ? Math.floor(riskAmount / slDistance) : 0;

          if (qty > 0 && qty * closes[i] <= capital * 0.5) { // Max 50% capital per trade
            openPosition = {
              entry: closes[i],
              date: dates[i],
              side: signal.direction as 'BUY' | 'SELL',
              qty,
              sl: signal.stopLoss,
              tp: signal.target,
              strategy: signal.strategy,
              reason: signal.reason,
            };
          }
        }
      }

      // Track equity curve
      const unrealized = openPosition
        ? (openPosition.side === 'BUY' 
          ? (closes[i] - openPosition.entry) * openPosition.qty
          : (openPosition.entry - closes[i]) * openPosition.qty)
        : 0;
      const currentEquity = capital + unrealized;
      peakEquity = Math.max(peakEquity, currentEquity);
      const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
      
      equityCurve.push({ date: dates[i], equity: Math.round(currentEquity), drawdown: Math.round(drawdown * 100) / 100 });
    }

    // Close any remaining open position at last price
    if (openPosition) {
      const exitPrice = closes[closes.length - 1];
      const pnl = openPosition.side === 'BUY'
        ? (exitPrice - openPosition.entry) * openPosition.qty
        : (openPosition.entry - exitPrice) * openPosition.qty;
      allTrades.push({
        entryDate: openPosition.date,
        exitDate: dates[dates.length - 1],
        side: openPosition.side,
        entryPrice: openPosition.entry,
        exitPrice,
        quantity: openPosition.qty,
        pnl: Math.round(pnl),
        pnlPct: Math.round(((pnl / (openPosition.entry * openPosition.qty)) * 100) * 100) / 100,
        strategy: openPosition.strategy,
        reason: openPosition.reason,
        holdingDays: 0,
      });
      capital += pnl;
    }

    // Compute per-strategy results
    const strategyNames = ['Momentum', 'Breakout', 'Trend Following', 'Mean Reversion', 'Smart Money'];
    const strategies: StrategyResult[] = strategyNames.map(name => computeStrategyResult(name, allTrades.filter(t => t.strategy === name)));
    const combined = computeStrategyResult('Combined', allTrades);

    // Buy & hold comparison
    const buyAndHoldReturn = ((closes[closes.length - 1] - closes[50]) / closes[50]) * 100;
    const totalReturnPct = ((capital - initialCapital) / initialCapital) * 100;
    const totalDays = closes.length - 50;
    const annualizedReturn = totalReturnPct * (252 / totalDays);

    // Accuracy per signal type
    const accuracy = {
      overallSignalAccuracy: combined.winRate,
      buySignalAccuracy: computeDirectionAccuracy(allTrades, 'BUY'),
      sellSignalAccuracy: computeDirectionAccuracy(allTrades, 'SELL'),
      momentumAccuracy: strategies[0].winRate,
      breakoutAccuracy: strategies[1].winRate,
      trendAccuracy: strategies[2].winRate,
      meanReversionAccuracy: strategies[3].winRate,
      smartMoneyAccuracy: strategies[4].winRate,
    };

    return {
      symbol,
      stockName,
      period: `${dates[50]} to ${dates[dates.length - 1]}`,
      totalDays,
      initialCapital,
      finalCapital: Math.round(capital),
      totalReturn: Math.round(capital - initialCapital),
      totalReturnPct: Math.round(totalReturnPct * 100) / 100,
      annualizedReturn: Math.round(annualizedReturn * 100) / 100,
      buyAndHoldReturn: Math.round(buyAndHoldReturn * 100) / 100,
      alphaVsBuyHold: Math.round((totalReturnPct - buyAndHoldReturn) * 100) / 100,
      strategies,
      combined,
      equityCurve,
      trades: allTrades,
      accuracy,
    };
  } catch {
    return null;
  }
}

function computeStrategyResult(name: string, trades: BacktestTrade[]): StrategyResult {
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
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  // Sharpe (simplified: mean return / std of returns)
  const returns = trades.map(t => t.pnlPct);
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length);
  const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252 / (trades.length || 1)) : 0;

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
    profitFactor: Math.round(profitFactor * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDD),
    maxDrawdownPct: Math.round((maxDD / 500000) * 100 * 100) / 100, // vs initial capital
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
