import type { LiveStock } from '../services/liveData';

interface Signal {
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strategy: string;
  reason: string;
  timestamp: string;
  indicators: { rsi: number; smaSignal: string; volumeRatio: number; lstmProb?: number };
}

const signals: Signal[] = [
  { symbol: 'SBIN', direction: 'BUY', confidence: 0.82, strategy: 'LSTM Direction', reason: 'LSTM predicts 72% upward probability. PSU banking index breakout. FII net buyers in banking for 5 sessions. Volume confirms accumulation.', timestamp: '10:22:14', indicators: { rsi: 65.8, smaSignal: 'Price > SMA20 > SMA50', volumeRatio: 1.3, lstmProb: 0.72 } },
  { symbol: 'TMCV', direction: 'BUY', confidence: 0.79, strategy: 'Mean Reversion + RSI', reason: 'CV segment momentum. Fleet replacement cycle accelerating. RSI bounced from 42 with volume confirmation. Nifty Auto at all-time high.', timestamp: '09:35:42', indicators: { rsi: 48.0, smaSignal: 'Price > SMA20 > SMA50', volumeRatio: 1.6 } },
  { symbol: 'RELIANCE', direction: 'BUY', confidence: 0.85, strategy: 'Ensemble', reason: 'Both strategies aligned bullish. Jio tariff hike revenue uplift. Retail vertical strong. Multiple timeframe support. Institutional buying.', timestamp: '10:05:33', indicators: { rsi: 62.4, smaSignal: 'Price > SMA20 > SMA50', volumeRatio: 1.4, lstmProb: 0.68 } },
  { symbol: 'WIPRO', direction: 'SELL', confidence: 0.77, strategy: 'LSTM Direction', reason: 'IT sector breakdown continues. Wipro weakest in peer group. LSTM shows 76% downward probability. Deal pipeline concerns and margin pressure.', timestamp: '10:38:22', indicators: { rsi: 36.1, smaSignal: 'Price < SMA20 < SMA50', volumeRatio: 1.2, lstmProb: 0.24 } },
  { symbol: 'INFY', direction: 'SELL', confidence: 0.71, strategy: 'LSTM Direction', reason: 'IT sector weakness after TCS miss. USD/INR weakening hurts margins. Below all major moving averages. LSTM bearish at 71%.', timestamp: '09:18:05', indicators: { rsi: 38.5, smaSignal: 'Price < SMA20 < SMA50', volumeRatio: 1.1, lstmProb: 0.29 } },
  { symbol: 'MARUTI', direction: 'BUY', confidence: 0.74, strategy: 'Mean Reversion + RSI', reason: 'Rural recovery data positive. Monsoon normal supports demand. RSI crossed above 60. Auto index outperforming Nifty.', timestamp: '10:42:55', indicators: { rsi: 67.4, smaSignal: 'Price > SMA20 > SMA50', volumeRatio: 1.3 } },
  { symbol: 'BAJFINANCE', direction: 'HOLD', confidence: 0.52, strategy: 'Ensemble', reason: 'Mixed signals. LSTM marginally bullish but RSI neutral. Wait for clear directional move. NBFC sector in consolidation.', timestamp: '10:45:12', indicators: { rsi: 48.9, smaSignal: 'SMA20 ≈ Price', volumeRatio: 0.9, lstmProb: 0.54 } },
  { symbol: 'HDFCBANK', direction: 'BUY', confidence: 0.74, strategy: 'LSTM Direction', reason: 'Nifty Bank breakout. Credit growth strong at 16%. NIM expansion expected in Q2. LSTM bullish at 68%.', timestamp: '10:22:18', indicators: { rsi: 58.7, smaSignal: 'Price > SMA20 > SMA50', volumeRatio: 1.2, lstmProb: 0.68 } },
  { symbol: 'TCS', direction: 'HOLD', confidence: 0.48, strategy: 'Ensemble', reason: 'Below confidence threshold. IT sector weak but TCS near support. Wait for reversal confirmation or breakdown below 3860.', timestamp: '10:50:00', indicators: { rsi: 44.2, smaSignal: 'Price < SMA20, near SMA50', volumeRatio: 1.0, lstmProb: 0.46 } },
];

export function SignalsPage({ stocks }: { stocks: LiveStock[] }) {
  const buySignals = signals.filter(s => s.direction === 'BUY');
  const sellSignals = signals.filter(s => s.direction === 'SELL');
  const holdSignals = signals.filter(s => s.direction === 'HOLD');

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="card flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--green)] pulse"></span>
          <span className="text-xs font-medium">AI Engine Active</span>
        </div>
        <span className="text-xs text-[var(--text-secondary)]">
          Last scan: 10:50 IST • Next: 10:55 IST • Interval: 5 min
        </span>
        <div className="flex items-center gap-3 ml-auto text-xs">
          <span className="badge badge-green">{buySignals.length} BUY</span>
          <span className="badge badge-red">{sellSignals.length} SELL</span>
          <span className="badge badge-amber">{holdSignals.length} HOLD</span>
        </div>
      </div>

      {/* Signal cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {signals.sort((a, b) => b.confidence - a.confidence).map((sig) => {
          const stock = stocks.find(w => w.symbol === sig.symbol);
          return (
            <div key={sig.symbol} className={`card border-l-4 ${sig.direction === 'BUY' ? 'border-l-[var(--green)]' : sig.direction === 'SELL' ? 'border-l-[var(--red)]' : 'border-l-amber-400'}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{sig.symbol}</span>
                  <span className={`badge ${sig.direction === 'BUY' ? 'badge-green' : sig.direction === 'SELL' ? 'badge-red' : 'badge-amber'}`}>
                    {sig.direction}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-secondary)]">{sig.timestamp}</span>
              </div>

              {/* Price info */}
              <div className="flex items-center gap-3 mb-2 text-xs">
                <span className="text-[var(--text-secondary)]">LTP:</span>
                <span className="font-mono font-medium">₹{stock?.ltp.toLocaleString()}</span>
                <span className={stock && stock.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                  {stock && stock.changePct >= 0 ? '+' : ''}{stock?.changePct.toFixed(2)}%
                </span>
              </div>

              {/* Confidence bar */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-[var(--text-secondary)]">Confidence:</span>
                <div className="progress-bar flex-1">
                  <div
                    className={`progress-fill ${sig.confidence >= 0.8 ? 'bg-[var(--green)]' : sig.confidence >= 0.7 ? 'bg-blue-400' : sig.confidence >= 0.6 ? 'bg-amber-400' : 'bg-gray-500'}`}
                    style={{ width: `${sig.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold">{(sig.confidence * 100).toFixed(0)}%</span>
              </div>

              {/* Indicators */}
              <div className="grid grid-cols-2 gap-1 mb-2 text-[10px]">
                <div className="text-[var(--text-secondary)]">RSI: <span className={`font-medium ${sig.indicators.rsi > 70 ? 'text-[var(--red)]' : sig.indicators.rsi < 30 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>{sig.indicators.rsi}</span></div>
                <div className="text-[var(--text-secondary)]">Vol: <span className="text-[var(--text)] font-medium">{sig.indicators.volumeRatio}x</span></div>
                {sig.indicators.lstmProb !== undefined && (
                  <div className="text-[var(--text-secondary)]">LSTM: <span className={`font-medium ${sig.indicators.lstmProb >= 0.6 ? 'text-[var(--green)]' : sig.indicators.lstmProb <= 0.4 ? 'text-[var(--red)]' : 'text-amber-400'}`}>{(sig.indicators.lstmProb * 100).toFixed(0)}%</span></div>
                )}
                <div className="text-[var(--text-secondary)] truncate">{sig.indicators.smaSignal}</div>
              </div>

              {/* Reason */}
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)] pt-2 mt-2">
                {sig.reason}
              </p>

              {/* Strategy */}
              <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
                Strategy: <span className="text-blue-400 font-medium">{sig.strategy}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
