// ponytail: comprehensive mock data for Indian stock market AI trading platform

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  ltp: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  prevClose: number;
  volume: number;
  avgVolume: number;
  marketCap: string;
  pe: number;
  weekHigh52: number;
  weekLow52: number;
  rsi: number;
  sma20: number;
  sma50: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  aiScore: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  exitPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  status: 'OPEN' | 'TARGET_HIT' | 'SL_HIT' | 'MANUAL_EXIT';
  pnl: number;
  pnlPct: number;
  charges: number;
  netPnl: number;
  strategy: string;
  confidence: number;
  entryTime: string;
  exitTime: string | null;
  holdingDuration: string;
  reason: string;
  riskRewardRatio: number;
}

export interface StockAnalysis {
  symbol: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldingTime: string;
  sharpe: number;
  maxConsecutiveLosses: number;
  profitFactor: number;
}

export interface DailyPnl {
  date: string;
  pnl: number;
  trades: number;
  wins: number;
  cumulative: number;
}

export interface PortfolioSummary {
  totalCapital: number;
  currentValue: number;
  investedValue: number;
  availableMargin: number;
  totalPnl: number;
  totalPnlPct: number;
  realizedPnl: number;
  unrealizedPnl: number;
  todayPnl: number;
  todayPnlPct: number;
  totalTrades: number;
  openPositions: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgTradesPerDay: number;
  avgHoldingPeriod: string;
  riskRewardRatio: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  tradingDays: number;
  profitableDays: number;
}

export const portfolio: PortfolioSummary = {
  totalCapital: 1000000,
  currentValue: 1072840,
  investedValue: 287650,
  availableMargin: 785190,
  totalPnl: 72840,
  totalPnlPct: 7.28,
  realizedPnl: 66560,
  unrealizedPnl: 6280,
  todayPnl: 8420,
  todayPnlPct: 0.79,
  totalTrades: 84,
  openPositions: 4,
  winRate: 67.8,
  avgWin: 2840,
  avgLoss: -1560,
  largestWin: 12400,
  largestLoss: -5200,
  profitFactor: 2.31,
  sharpeRatio: 1.92,
  maxDrawdown: 34200,
  maxDrawdownPct: 3.42,
  avgTradesPerDay: 3.2,
  avgHoldingPeriod: '2h 45m',
  riskRewardRatio: 1.82,
  consecutiveWins: 7,
  consecutiveLosses: 3,
  tradingDays: 26,
  profitableDays: 19,
};

export const watchlist: Stock[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Energy', ltp: 2847.50, change: 34.20, changePct: 1.22, dayHigh: 2865.00, dayLow: 2810.30, open: 2815.00, prevClose: 2813.30, volume: 8234500, avgVolume: 6200000, marketCap: '19.2L Cr', pe: 28.4, weekHigh52: 3024.90, weekLow52: 2220.00, rsi: 62.4, sma20: 2798.00, sma50: 2745.00, signal: 'BULLISH', aiScore: 78 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', ltp: 3892.15, change: -28.45, changePct: -0.73, dayHigh: 3920.00, dayLow: 3875.60, open: 3918.00, prevClose: 3920.60, volume: 3456200, avgVolume: 2800000, marketCap: '14.1L Cr', pe: 32.1, weekHigh52: 4255.00, weekLow52: 3311.00, rsi: 44.2, sma20: 3945.00, sma50: 3880.00, signal: 'BEARISH', aiScore: 35 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Banking', ltp: 1678.90, change: 12.65, changePct: 0.76, dayHigh: 1685.00, dayLow: 1660.25, open: 1665.00, prevClose: 1666.25, volume: 12890000, avgVolume: 10500000, marketCap: '12.8L Cr', pe: 19.8, weekHigh52: 1794.00, weekLow52: 1363.00, rsi: 58.7, sma20: 1655.00, sma50: 1620.00, signal: 'BULLISH', aiScore: 72 },
  { symbol: 'INFY', name: 'Infosys Ltd', sector: 'IT', ltp: 1567.30, change: -15.80, changePct: -1.00, dayHigh: 1590.00, dayLow: 1560.00, open: 1585.00, prevClose: 1583.10, volume: 6543200, avgVolume: 5400000, marketCap: '6.5L Cr', pe: 26.3, weekHigh52: 1988.00, weekLow52: 1358.00, rsi: 38.5, sma20: 1610.00, sma50: 1595.00, signal: 'BEARISH', aiScore: 32 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Banking', ltp: 1234.55, change: 8.90, changePct: 0.73, dayHigh: 1240.00, dayLow: 1220.45, open: 1225.00, prevClose: 1225.65, volume: 9876500, avgVolume: 8200000, marketCap: '8.7L Cr', pe: 18.2, weekHigh52: 1352.00, weekLow52: 970.00, rsi: 61.3, sma20: 1218.00, sma50: 1195.00, signal: 'BULLISH', aiScore: 74 },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking', ltp: 834.25, change: 11.45, changePct: 1.39, dayHigh: 840.00, dayLow: 820.50, open: 823.00, prevClose: 822.80, volume: 15678000, avgVolume: 12000000, marketCap: '7.4L Cr', pe: 11.2, weekHigh52: 912.00, weekLow52: 600.00, rsi: 65.8, sma20: 815.00, sma50: 790.00, signal: 'BULLISH', aiScore: 81 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Auto', ltp: 978.60, change: 22.30, changePct: 2.33, dayHigh: 985.00, dayLow: 952.40, open: 955.00, prevClose: 956.30, volume: 11234500, avgVolume: 9000000, marketCap: '3.6L Cr', pe: 8.4, weekHigh52: 1079.00, weekLow52: 620.00, rsi: 71.2, sma20: 945.00, sma50: 910.00, signal: 'BULLISH', aiScore: 76 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', sector: 'NBFC', ltp: 7234.80, change: -45.60, changePct: -0.63, dayHigh: 7310.00, dayLow: 7200.00, open: 7280.00, prevClose: 7280.40, volume: 2345600, avgVolume: 2100000, marketCap: '4.5L Cr', pe: 35.6, weekHigh52: 8192.00, weekLow52: 5875.00, rsi: 48.9, sma20: 7310.00, sma50: 7180.00, signal: 'NEUTRAL', aiScore: 52 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India', sector: 'Auto', ltp: 12456.70, change: 178.90, changePct: 1.46, dayHigh: 12520.00, dayLow: 12280.00, open: 12290.00, prevClose: 12277.80, volume: 1234500, avgVolume: 980000, marketCap: '3.9L Cr', pe: 30.2, weekHigh52: 13680.00, weekLow52: 9738.00, rsi: 67.4, sma20: 12200.00, sma50: 11850.00, signal: 'BULLISH', aiScore: 73 },
  { symbol: 'WIPRO', name: 'Wipro Ltd', sector: 'IT', ltp: 456.80, change: -6.20, changePct: -1.34, dayHigh: 465.00, dayLow: 453.00, open: 463.00, prevClose: 463.00, volume: 8765400, avgVolume: 7200000, marketCap: '2.4L Cr', pe: 22.8, weekHigh52: 572.00, weekLow52: 382.00, rsi: 36.1, sma20: 472.00, sma50: 465.00, signal: 'BEARISH', aiScore: 28 },
];

export const allTrades: Trade[] = [
  { id: 'T001', symbol: 'SBIN', side: 'BUY', quantity: 300, entryPrice: 822.80, currentPrice: 834.25, exitPrice: null, stopLoss: 806.34, takeProfit: 855.71, status: 'OPEN', pnl: 3435, pnlPct: 1.39, charges: 124, netPnl: 3311, strategy: 'LSTM Direction', confidence: 0.82, entryTime: '2026-08-15 09:22:14', exitTime: null, holdingDuration: '1h 31m', reason: 'LSTM predicts 72% upward probability. Banking index strong. Sector rotation into PSU banks confirmed by FII flows.', riskRewardRatio: 2.0 },
  { id: 'T002', symbol: 'TATAMOTORS', side: 'BUY', quantity: 150, entryPrice: 956.30, currentPrice: 978.60, exitPrice: null, stopLoss: 937.17, takeProfit: 994.55, status: 'OPEN', pnl: 3345, pnlPct: 2.33, charges: 96, netPnl: 3249, strategy: 'Mean Reversion + RSI', confidence: 0.79, entryTime: '2026-08-15 09:35:42', exitTime: null, holdingDuration: '1h 18m', reason: 'RSI bounce from 35 + auto sector momentum + JLR results beat. Volume 1.6x avg confirms institutional interest.', riskRewardRatio: 2.0 },
  { id: 'T003', symbol: 'RELIANCE', side: 'BUY', quantity: 50, entryPrice: 2812.30, currentPrice: 2847.50, exitPrice: null, stopLoss: 2756.05, takeProfit: 2924.79, status: 'OPEN', pnl: 1760, pnlPct: 1.25, charges: 84, netPnl: 1676, strategy: 'Ensemble', confidence: 0.85, entryTime: '2026-08-15 10:05:33', exitTime: null, holdingDuration: '0h 48m', reason: 'Both LSTM and RSI agree bullish. Jio tariff hike positive. Brent crude stable. Multiple timeframe alignment.', riskRewardRatio: 2.0 },
  { id: 'T004', symbol: 'HDFCBANK', side: 'BUY', quantity: 100, entryPrice: 1665.40, currentPrice: 1678.90, exitPrice: null, stopLoss: 1632.09, takeProfit: 1731.22, status: 'OPEN', pnl: 1350, pnlPct: 0.81, charges: 78, netPnl: 1272, strategy: 'LSTM Direction', confidence: 0.74, entryTime: '2026-08-15 10:22:18', exitTime: null, holdingDuration: '0h 31m', reason: 'LSTM model shows 68% upward probability. Nifty Bank index breakout. Credit growth strong.', riskRewardRatio: 2.0 },
  { id: 'T005', symbol: 'INFY', side: 'SELL', quantity: 100, entryPrice: 1590.00, currentPrice: 1567.30, exitPrice: 1567.30, stopLoss: 1621.80, takeProfit: 1526.40, status: 'TARGET_HIT', pnl: 2270, pnlPct: 1.43, charges: 108, netPnl: 2162, strategy: 'LSTM Direction', confidence: 0.76, entryTime: '2026-08-15 09:18:05', exitTime: '2026-08-15 10:42:33', holdingDuration: '1h 24m', reason: 'IT sector weakness confirmed by TCS miss. LSTM bearish at 74%. USD/INR weakening hurts IT margin outlook.', riskRewardRatio: 1.8 },
  { id: 'T006', symbol: 'MARUTI', side: 'BUY', quantity: 12, entryPrice: 12180.00, currentPrice: 12456.70, exitPrice: 12456.70, stopLoss: 11936.40, takeProfit: 12667.20, status: 'TARGET_HIT', pnl: 3320, pnlPct: 2.27, charges: 142, netPnl: 3178, strategy: 'Mean Reversion + RSI', confidence: 0.81, entryTime: '2026-08-14 13:45:22', exitTime: '2026-08-15 09:48:11', holdingDuration: '20h 3m', reason: 'Auto sector momentum + rural recovery data + monsoon normal. RSI crossed above 50 from oversold.', riskRewardRatio: 2.0 },
  { id: 'T007', symbol: 'ICICIBANK', side: 'BUY', quantity: 200, entryPrice: 1210.40, currentPrice: 1234.55, exitPrice: 1234.55, stopLoss: 1186.19, takeProfit: 1258.82, status: 'TARGET_HIT', pnl: 4830, pnlPct: 2.00, charges: 156, netPnl: 4674, strategy: 'Ensemble', confidence: 0.88, entryTime: '2026-08-14 10:12:45', exitTime: '2026-08-14 14:55:18', holdingDuration: '4h 43m', reason: 'Strong consensus: both strategies aligned + banking sector breakout + NIM expansion expected in Q2.', riskRewardRatio: 2.0 },
  { id: 'T008', symbol: 'TCS', side: 'BUY', quantity: 40, entryPrice: 3940.00, currentPrice: 3892.15, exitPrice: 3892.15, stopLoss: 3861.20, takeProfit: 4097.60, status: 'SL_HIT', pnl: -1914, pnlPct: -1.21, charges: 98, netPnl: -2012, strategy: 'Mean Reversion + RSI', confidence: 0.62, entryTime: '2026-08-14 11:15:33', exitTime: '2026-08-14 13:42:08', holdingDuration: '2h 27m', reason: 'RSI oversold bounce expected at 3940 support. Failed due to sector-wide sell-off after Accenture guidance cut.', riskRewardRatio: 2.0 },
  { id: 'T009', symbol: 'BAJFINANCE', side: 'BUY', quantity: 25, entryPrice: 7180.00, currentPrice: 7234.80, exitPrice: 7310.00, stopLoss: 7036.40, takeProfit: 7467.20, status: 'TARGET_HIT', pnl: 3250, pnlPct: 1.81, charges: 118, netPnl: 3132, strategy: 'LSTM Direction', confidence: 0.71, entryTime: '2026-08-13 09:45:12', exitTime: '2026-08-13 14:22:45', holdingDuration: '4h 37m', reason: 'Consumer credit growth data positive + LSTM bullish signal + NBFC index at support.', riskRewardRatio: 2.0 },
  { id: 'T010', symbol: 'SBIN', side: 'BUY', quantity: 400, entryPrice: 808.50, currentPrice: 834.25, exitPrice: 822.80, stopLoss: 792.33, takeProfit: 840.84, status: 'TARGET_HIT', pnl: 5720, pnlPct: 1.77, charges: 186, netPnl: 5534, strategy: 'Mean Reversion + RSI', confidence: 0.84, entryTime: '2026-08-13 09:20:08', exitTime: '2026-08-13 12:15:44', holdingDuration: '2h 56m', reason: 'PSU bank rally continuation. Government capex push. RSI bouncing from 42. Strong volume support.', riskRewardRatio: 2.0 },
  { id: 'T011', symbol: 'WIPRO', side: 'SELL', quantity: 500, entryPrice: 468.00, currentPrice: 456.80, exitPrice: 455.20, stopLoss: 477.36, takeProfit: 449.28, status: 'TARGET_HIT', pnl: 6400, pnlPct: 2.74, charges: 212, netPnl: 6188, strategy: 'LSTM Direction', confidence: 0.77, entryTime: '2026-08-12 10:30:22', exitTime: '2026-08-12 15:12:55', holdingDuration: '4h 43m', reason: 'IT sector breakdown. Wipro weakest in peer group. LSTM 76% bearish. Deal pipeline concerns.', riskRewardRatio: 2.0 },
  { id: 'T012', symbol: 'RELIANCE', side: 'BUY', quantity: 60, entryPrice: 2780.00, currentPrice: 2847.50, exitPrice: 2812.30, stopLoss: 2724.40, takeProfit: 2891.20, status: 'MANUAL_EXIT', pnl: 1938, pnlPct: 1.16, charges: 92, netPnl: 1846, strategy: 'Ensemble', confidence: 0.72, entryTime: '2026-08-12 09:18:40', exitTime: '2026-08-12 14:45:22', holdingDuration: '5h 27m', reason: 'Jio subscriber addition data positive. Energy basket stable. Exited early due to market-wide volatility spike.', riskRewardRatio: 2.0 },
];

export const stockAnalysis: StockAnalysis[] = [
  { symbol: 'SBIN', totalTrades: 14, wins: 11, losses: 3, winRate: 78.6, totalPnl: 18240, avgPnl: 1303, bestTrade: 5720, worstTrade: -2100, avgHoldingTime: '2h 15m', sharpe: 2.34, maxConsecutiveLosses: 1, profitFactor: 3.12 },
  { symbol: 'RELIANCE', totalTrades: 12, wins: 8, losses: 4, winRate: 66.7, totalPnl: 14560, avgPnl: 1213, bestTrade: 4200, worstTrade: -3100, avgHoldingTime: '3h 10m', sharpe: 1.78, maxConsecutiveLosses: 2, profitFactor: 2.05 },
  { symbol: 'ICICIBANK', totalTrades: 10, wins: 7, losses: 3, winRate: 70.0, totalPnl: 12340, avgPnl: 1234, bestTrade: 4830, worstTrade: -2400, avgHoldingTime: '2h 45m', sharpe: 1.95, maxConsecutiveLosses: 1, profitFactor: 2.45 },
  { symbol: 'TATAMOTORS', totalTrades: 11, wins: 8, losses: 3, winRate: 72.7, totalPnl: 11200, avgPnl: 1018, bestTrade: 3800, worstTrade: -1900, avgHoldingTime: '1h 50m', sharpe: 2.10, maxConsecutiveLosses: 2, profitFactor: 2.78 },
  { symbol: 'HDFCBANK', totalTrades: 9, wins: 6, losses: 3, winRate: 66.7, totalPnl: 8900, avgPnl: 989, bestTrade: 3400, worstTrade: -2800, avgHoldingTime: '3h 30m', sharpe: 1.62, maxConsecutiveLosses: 2, profitFactor: 1.89 },
  { symbol: 'MARUTI', totalTrades: 7, wins: 5, losses: 2, winRate: 71.4, totalPnl: 8450, avgPnl: 1207, bestTrade: 3320, worstTrade: -1800, avgHoldingTime: '4h 20m', sharpe: 1.85, maxConsecutiveLosses: 1, profitFactor: 2.56 },
  { symbol: 'INFY', totalTrades: 8, wins: 5, losses: 3, winRate: 62.5, totalPnl: 4200, avgPnl: 525, bestTrade: 2800, worstTrade: -2200, avgHoldingTime: '2h 05m', sharpe: 1.22, maxConsecutiveLosses: 2, profitFactor: 1.64 },
  { symbol: 'WIPRO', totalTrades: 6, wins: 4, losses: 2, winRate: 66.7, totalPnl: 3800, avgPnl: 633, bestTrade: 6400, worstTrade: -3200, avgHoldingTime: '3h 40m', sharpe: 1.15, maxConsecutiveLosses: 1, profitFactor: 1.72 },
  { symbol: 'BAJFINANCE', totalTrades: 5, wins: 3, losses: 2, winRate: 60.0, totalPnl: 2100, avgPnl: 420, bestTrade: 3250, worstTrade: -2800, avgHoldingTime: '4h 15m', sharpe: 0.98, maxConsecutiveLosses: 2, profitFactor: 1.38 },
  { symbol: 'TCS', totalTrades: 7, wins: 3, losses: 4, winRate: 42.9, totalPnl: -1250, avgPnl: -179, bestTrade: 2400, worstTrade: -3100, avgHoldingTime: '2h 55m', sharpe: 0.45, maxConsecutiveLosses: 3, profitFactor: 0.82 },
];

export const dailyPnl: DailyPnl[] = [
  { date: '2026-07-14', pnl: 2340, trades: 3, wins: 2, cumulative: 2340 },
  { date: '2026-07-15', pnl: -1200, trades: 4, wins: 1, cumulative: 1140 },
  { date: '2026-07-16', pnl: 4560, trades: 3, wins: 3, cumulative: 5700 },
  { date: '2026-07-17', pnl: 1890, trades: 2, wins: 2, cumulative: 7590 },
  { date: '2026-07-18', pnl: -2340, trades: 4, wins: 1, cumulative: 5250 },
  { date: '2026-07-21', pnl: 3450, trades: 3, wins: 2, cumulative: 8700 },
  { date: '2026-07-22', pnl: 5670, trades: 4, wins: 4, cumulative: 14370 },
  { date: '2026-07-23', pnl: -890, trades: 3, wins: 1, cumulative: 13480 },
  { date: '2026-07-24', pnl: 2780, trades: 3, wins: 2, cumulative: 16260 },
  { date: '2026-07-25', pnl: 4120, trades: 4, wins: 3, cumulative: 20380 },
  { date: '2026-07-28', pnl: 1560, trades: 2, wins: 2, cumulative: 21940 },
  { date: '2026-07-29', pnl: -3200, trades: 4, wins: 1, cumulative: 18740 },
  { date: '2026-07-30', pnl: 6780, trades: 5, wins: 4, cumulative: 25520 },
  { date: '2026-07-31', pnl: 3450, trades: 3, wins: 3, cumulative: 28970 },
  { date: '2026-08-01', pnl: -1560, trades: 3, wins: 1, cumulative: 27410 },
  { date: '2026-08-04', pnl: 4890, trades: 4, wins: 3, cumulative: 32300 },
  { date: '2026-08-05', pnl: 2340, trades: 3, wins: 2, cumulative: 34640 },
  { date: '2026-08-06', pnl: 5670, trades: 4, wins: 4, cumulative: 40310 },
  { date: '2026-08-07', pnl: -2100, trades: 3, wins: 1, cumulative: 38210 },
  { date: '2026-08-08', pnl: 7890, trades: 5, wins: 4, cumulative: 46100 },
  { date: '2026-08-11', pnl: 3240, trades: 3, wins: 2, cumulative: 49340 },
  { date: '2026-08-12', pnl: 8340, trades: 4, wins: 4, cumulative: 57680 },
  { date: '2026-08-13', pnl: 5440, trades: 4, wins: 3, cumulative: 63120 },
  { date: '2026-08-14', pnl: 1300, trades: 3, wins: 2, cumulative: 64420 },
  { date: '2026-08-15', pnl: 8420, trades: 4, wins: 3, cumulative: 72840 },
];

// Nifty intraday for live chart
export const niftyIntraday = Array.from({ length: 78 }, (_, i) => {
  const hour = 9 + Math.floor((i * 5 + 15) / 60);
  const min = (i * 5 + 15) % 60;
  const base = 24700 + i * 2.1 + Math.sin(i * 0.25) * 45 + (Math.random() - 0.4) * 25;
  return { time: `${hour}:${min.toString().padStart(2, '0')}`, price: Math.round(base * 100) / 100, volume: Math.round(40000 + Math.random() * 120000) };
});

export const strategyStats = [
  { name: 'Mean Reversion + RSI', trades: 34, winRate: 70.6, pnl: 38200, avgReturn: 1.34, sharpe: 2.05, maxDD: 2.1 },
  { name: 'LSTM Direction', trades: 31, winRate: 64.5, pnl: 24800, avgReturn: 1.08, sharpe: 1.72, maxDD: 2.8 },
  { name: 'Ensemble', trades: 19, winRate: 73.7, pnl: 9840, avgReturn: 1.62, sharpe: 2.28, maxDD: 1.6 },
];
