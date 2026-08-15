// ponytail: mock data for Indian stock market paper trading dashboard

export interface Stock {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  ltp: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  status: 'OPEN' | 'CLOSED_PROFIT' | 'CLOSED_LOSS' | 'CLOSED_SL';
  pnl: number;
  strategy: string;
  confidence: number;
  timestamp: string;
  reason: string;
}

export interface Signal {
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strategy: string;
  reason: string;
  timestamp: string;
}

export interface PortfolioMetrics {
  totalValue: number;
  initialCapital: number;
  totalReturn: number;
  totalReturnPct: number;
  todayPnl: number;
  todayPnlPct: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  totalTrades: number;
  openPositions: number;
}

export const watchlist: Stock[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', ltp: 2847.50, change: 34.20, changePct: 1.22, volume: 8234500, high: 2865.00, low: 2810.30 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', ltp: 3892.15, change: -28.45, changePct: -0.73, volume: 3456200, high: 3920.00, low: 3875.60 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE', ltp: 1678.90, change: 12.65, changePct: 0.76, volume: 12890000, high: 1685.00, low: 1660.25 },
  { symbol: 'INFY', name: 'Infosys', exchange: 'NSE', ltp: 1567.30, change: -15.80, changePct: -1.00, volume: 6543200, high: 1590.00, low: 1560.00 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE', ltp: 1234.55, change: 8.90, changePct: 0.73, volume: 9876500, high: 1240.00, low: 1220.45 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', exchange: 'NSE', ltp: 2456.70, change: -5.30, changePct: -0.22, volume: 2345600, high: 2470.00, low: 2445.00 },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', ltp: 834.25, change: 11.45, changePct: 1.39, volume: 15678000, high: 840.00, low: 820.50 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', exchange: 'NSE', ltp: 978.60, change: 22.30, changePct: 2.33, volume: 11234500, high: 985.00, low: 952.40 },
  { symbol: 'NIFTY50', name: 'Nifty 50 Index', exchange: 'NSE', ltp: 24856.40, change: 156.30, changePct: 0.63, volume: 0, high: 24920.00, low: 24700.50 },
];

export const recentTrades: Trade[] = [
  { id: 'T001', symbol: 'RELIANCE', side: 'BUY', quantity: 50, entryPrice: 2812.30, exitPrice: null, stopLoss: 2756.05, takeProfit: 2924.79, status: 'OPEN', pnl: 1760, strategy: 'Mean Reversion + RSI', confidence: 0.78, timestamp: '2026-08-15T10:15:00', reason: 'RSI oversold at 28, price below 20-SMA, volume spike 1.8x' },
  { id: 'T002', symbol: 'SBIN', side: 'BUY', quantity: 200, entryPrice: 822.80, exitPrice: null, stopLoss: 806.34, takeProfit: 855.71, status: 'OPEN', pnl: 2290, strategy: 'LSTM Direction', confidence: 0.72, timestamp: '2026-08-15T09:45:00', reason: 'LSTM predicts 68% probability of upward move, confirmed by volume' },
  { id: 'T003', symbol: 'TATAMOTORS', side: 'BUY', quantity: 100, entryPrice: 956.30, exitPrice: null, stopLoss: 937.17, takeProfit: 994.55, status: 'OPEN', pnl: 2230, strategy: 'Mean Reversion + RSI', confidence: 0.81, timestamp: '2026-08-15T09:35:00', reason: 'Strong momentum + RSI divergence + sector rotation into auto' },
  { id: 'T004', symbol: 'INFY', side: 'SELL', quantity: 75, entryPrice: 1590.00, exitPrice: 1567.30, stopLoss: 1621.80, takeProfit: 1526.40, status: 'CLOSED_PROFIT', pnl: 1702.50, strategy: 'LSTM Direction', confidence: 0.69, timestamp: '2026-08-15T09:20:00', reason: 'LSTM bearish signal + IT sector weakness + weak global cues' },
  { id: 'T005', symbol: 'HDFCBANK', side: 'BUY', quantity: 100, entryPrice: 1652.40, exitPrice: 1678.90, stopLoss: 1619.35, takeProfit: 1718.50, status: 'CLOSED_PROFIT', pnl: 2650, strategy: 'Ensemble', confidence: 0.85, timestamp: '2026-08-14T14:30:00', reason: 'Both strategies agree bullish, banking sector momentum strong' },
  { id: 'T006', symbol: 'TCS', side: 'BUY', quantity: 40, entryPrice: 3940.00, exitPrice: 3892.15, stopLoss: 3861.20, takeProfit: 4097.60, status: 'CLOSED_SL', pnl: -1914, strategy: 'Mean Reversion + RSI', confidence: 0.62, timestamp: '2026-08-14T11:15:00', reason: 'RSI bounce expected at support, but sector dragged down' },
];

export const activeSignals: Signal[] = [
  { symbol: 'BAJFINANCE', direction: 'BUY', confidence: 0.74, strategy: 'Ensemble', reason: 'RSI at 32 + LSTM bullish + NBFC sector recovery', timestamp: '2026-08-15T10:40:00' },
  { symbol: 'WIPRO', direction: 'SELL', confidence: 0.66, strategy: 'LSTM Direction', reason: 'Bearish pattern detected, IT sector under pressure', timestamp: '2026-08-15T10:38:00' },
  { symbol: 'MARUTI', direction: 'BUY', confidence: 0.71, strategy: 'Mean Reversion + RSI', reason: 'Oversold bounce + auto sector momentum', timestamp: '2026-08-15T10:35:00' },
  { symbol: 'AXISBANK', direction: 'HOLD', confidence: 0.52, strategy: 'Ensemble', reason: 'Mixed signals, below confidence threshold', timestamp: '2026-08-15T10:30:00' },
];

export const portfolioMetrics: PortfolioMetrics = {
  totalValue: 1048560,
  initialCapital: 1000000,
  totalReturn: 48560,
  totalReturnPct: 4.86,
  todayPnl: 6280,
  todayPnlPct: 0.60,
  winRate: 68.4,
  sharpeRatio: 1.82,
  maxDrawdown: 4.2,
  profitFactor: 2.14,
  totalTrades: 57,
  openPositions: 3,
};

// Chart data (last 30 days portfolio value)
export const portfolioHistory = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 6, 16 + i);
  const base = 1000000 + (i * 1600) + (Math.random() - 0.3) * 5000;
  return {
    date: date.toISOString().slice(5, 10),
    value: Math.round(base),
    benchmark: Math.round(1000000 + i * 900 + (Math.random() - 0.4) * 3000),
  };
});

// Intraday NIFTY data for chart
export const niftyIntraday = Array.from({ length: 78 }, (_, i) => {
  const hour = 9 + Math.floor((i * 5 + 15) / 60);
  const min = (i * 5 + 15) % 60;
  const base = 24700 + i * 2 + Math.sin(i * 0.3) * 40 + (Math.random() - 0.4) * 30;
  return {
    time: `${hour}:${min.toString().padStart(2, '0')}`,
    price: Math.round(base * 100) / 100,
    volume: Math.round(50000 + Math.random() * 100000),
  };
});

// Strategy performance breakdown
export const strategyPerformance = [
  { name: 'Mean Reversion + RSI', trades: 28, winRate: 71.4, pnl: 32400, sharpe: 1.95 },
  { name: 'LSTM Direction', trades: 18, winRate: 61.1, pnl: 12800, sharpe: 1.45 },
  { name: 'Ensemble', trades: 11, winRate: 72.7, pnl: 3360, sharpe: 2.10 },
];
