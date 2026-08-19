import { useStockDiscovery } from '../hooks/useStockDiscovery';
import type { DiscoveredStock } from '../services/stockDiscovery';
import { useState } from 'react';

function SignalBadge({ signal }: { signal: DiscoveredStock['signal'] }) {
  const cls = signal === 'STRONG_BUY' ? 'badge-green' : signal === 'BUY' ? 'badge-green' : signal === 'SELL' ? 'badge-red' : signal === 'STRONG_SELL' ? 'badge-red' : 'badge-amber';
  return <span className={`badge ${cls}`}>{signal.replace('_', ' ')}</span>;
}

function TrendBadge({ trend }: { trend: DiscoveredStock['trend'] }) {
  const cls = trend.includes('UP') ? 'text-[var(--green)]' : trend.includes('DOWN') ? 'text-[var(--red)]' : 'text-[var(--text-muted)]';
  const icon = trend.includes('UP') ? '↑' : trend.includes('DOWN') ? '↓' : '→';
  return <span className={`text-xs font-bold ${cls}`}>{icon} {trend.replace('_', ' ')}</span>;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const pct = Math.abs(score);
  const color = score > 40 ? 'bg-[var(--green)]' : score > 0 ? 'bg-emerald-300' : score > -40 ? 'bg-amber-400' : 'bg-[var(--red)]';
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-24 text-[var(--text-secondary)]">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`w-8 text-right font-mono font-bold ${score > 0 ? 'text-[var(--green)]' : score < 0 ? 'text-[var(--red)]' : 'text-[var(--text-muted)]'}`}>{score}</span>
    </div>
  );
}

function StockCard({ stock, expanded, onToggle }: { stock: DiscoveredStock; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="card hover:shadow-lg transition-shadow cursor-pointer" onClick={onToggle}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600">{stock.symbol.slice(0, 3)}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[var(--text)]" style={{ fontFamily: 'Poppins' }}>{stock.symbol}</h3>
              <SignalBadge signal={stock.signal} />
              <TrendBadge trend={stock.trend} />
            </div>
            <p className="text-[11px] text-[var(--text-muted)] max-w-[300px] truncate">{stock.name}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold" style={{ fontFamily: 'Poppins' }}>₹{stock.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div className={`text-sm font-bold ${stock.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
            {stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-secondary)]">
        <span>RSI: <b className={stock.rsi > 70 ? 'text-[var(--red)]' : stock.rsi < 30 ? 'text-[var(--green)]' : ''}>{stock.rsi}</b></span>
        <span>Vol: <b>{stock.volumeRatio}x</b> avg</span>
        <span>Score: <b className={stock.overallScore > 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>{stock.overallScore}</b></span>
        <span>Strategies: <b>{stock.strategies.join(', ')}</b></span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-6" onClick={e => e.stopPropagation()}>
          {/* Strategy Scores */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">Strategy Analysis</h4>
            <div className="space-y-1.5">
              <ScoreBar score={stock.scores.momentum} label="Momentum" />
              <ScoreBar score={stock.scores.meanReversion} label="Mean Reversion" />
              <ScoreBar score={stock.scores.breakout} label="Breakout" />
              <ScoreBar score={stock.scores.trendFollowing} label="Trend Follow" />
              <ScoreBar score={stock.scores.smartMoney} label="Smart Money" />
            </div>
          </div>

          {/* Reasons */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">Why this pick</h4>
            <ul className="space-y-1">
              {stock.reasons.map((r, i) => (
                <li key={i} className="text-xs text-[var(--text)] flex items-start gap-1.5">
                  <span className="text-blue-500 mt-0.5">•</span> {r}
                </li>
              ))}
            </ul>
          </div>

          {/* F&O Analysis */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">F&O Strategy</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <div>
                <div className="text-[10px] text-purple-500">Expected Move</div>
                <div className="text-sm font-bold text-purple-800">±{stock.foAnalysis.expectedMove}%</div>
              </div>
              <div>
                <div className="text-[10px] text-purple-500">Support</div>
                <div className="text-sm font-bold">₹{stock.foAnalysis.supportLevel.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div className="text-[10px] text-purple-500">Resistance</div>
                <div className="text-sm font-bold">₹{stock.foAnalysis.resistanceLevel.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div className="text-[10px] text-purple-500">Risk:Reward</div>
                <div className="text-sm font-bold text-[var(--green)]">1:{stock.foAnalysis.riskReward}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="badge badge-purple text-[10px]">OPTION</span>
              <div>
                <p className="text-xs font-semibold text-purple-900">{stock.foAnalysis.optionStrategy}</p>
                <p className="text-[11px] text-purple-700 mt-0.5">{stock.foAnalysis.optionReason}</p>
              </div>
            </div>
            <div className="flex gap-4 mt-2 text-[11px]">
              <span>SL: <b className="text-[var(--red)]">₹{stock.foAnalysis.suggestedStopLoss.toLocaleString('en-IN')}</b></span>
              <span>Target: <b className="text-[var(--green)]">₹{stock.foAnalysis.suggestedTarget.toLocaleString('en-IN')}</b></span>
            </div>
          </div>

          {/* Technical levels */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
            {[
              { label: 'SMA 20', value: `₹${stock.sma20.toLocaleString('en-IN')}` },
              { label: 'SMA 50', value: `₹${stock.sma50.toLocaleString('en-IN')}` },
              { label: 'SMA 200', value: `₹${stock.sma200.toLocaleString('en-IN')}` },
              { label: '52W High', value: `₹${stock.weekHigh52.toLocaleString('en-IN')}` },
              { label: '52W Low', value: `₹${stock.weekLow52.toLocaleString('en-IN')}` },
              { label: 'MACD', value: stock.macd.histogram > 0 ? '↑ Bullish' : '↓ Bearish' },
            ].map(item => (
              <div key={item.label} className="bg-[var(--bg-alt)] rounded-lg px-2 py-1.5">
                <div className="text-[9px] text-[var(--text-muted)]">{item.label}</div>
                <div className="text-[11px] font-bold text-[var(--text)]">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DiscoveryPage() {
  const { stocks, loading, lastScan, rescan } = useStockDiscovery();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');

  const filtered = stocks.filter(s => {
    if (filter === 'buy') return s.overallScore > 20;
    if (filter === 'sell') return s.overallScore < -20;
    return true;
  });

  const buyCount = stocks.filter(s => s.overallScore > 20).length;
  const sellCount = stocks.filter(s => s.overallScore < -20).length;

  return (
    <div className="space-y-6">
      {/* Scanner status */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${loading ? 'bg-amber-400 pulse' : 'bg-[var(--green)]'}`}></span>
            <span className="text-sm font-semibold text-[var(--text)]">
              {loading ? 'Scanning market...' : `AI Scanner found ${stocks.length} opportunities`}
            </span>
          </div>
          {lastScan && (
            <span className="text-xs text-[var(--text-muted)]">
              Last scan: {lastScan.toLocaleTimeString('en-IN')} • Auto-refresh: 5 min
            </span>
          )}
        </div>
        <button onClick={rescan} disabled={loading} className="text-sm font-semibold text-[var(--blue)] hover:underline disabled:opacity-50">
          {loading ? 'Scanning...' : '↻ Rescan Now'}
        </button>
      </div>

      {/* How it works */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50">
        <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">How the AI Scanner Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-[11px] text-blue-700">
          <div className="flex items-start gap-1.5"><span className="font-bold text-blue-500">1.</span> Scans top volume leaders, gainers & losers on NSE in real-time</div>
          <div className="flex items-start gap-1.5"><span className="font-bold text-blue-500">2.</span> Fetches 3-month historical data for technical analysis</div>
          <div className="flex items-start gap-1.5"><span className="font-bold text-blue-500">3.</span> Computes RSI, MACD, SMA, Bollinger Bands, ATR for each stock</div>
          <div className="flex items-start gap-1.5"><span className="font-bold text-blue-500">4.</span> Applies 5 strategies: Momentum, Mean Reversion, Breakout, Trend Following, Smart Money</div>
          <div className="flex items-start gap-1.5"><span className="font-bold text-blue-500">5.</span> Generates F&O strategy with support/resistance & risk:reward</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="tab-bar">
          <div className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All ({stocks.length})</div>
          <div className={`tab ${filter === 'buy' ? 'active' : ''}`} onClick={() => setFilter('buy')}>🟢 Buy Signals ({buyCount})</div>
          <div className={`tab ${filter === 'sell' ? 'active' : ''}`} onClick={() => setFilter('sell')}>🔴 Sell Signals ({sellCount})</div>
        </div>
      </div>

      {/* Stock cards */}
      {loading && stocks.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-2xl mb-2">🔍</div>
          <p className="text-sm text-[var(--text-secondary)]">Scanning NSE market for opportunities...</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Analyzing volume leaders, gainers, losers • Computing technicals • Scoring strategies</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filtered.map((stock, idx) => (
            <StockCard
              key={stock.symbol}
              stock={stock}
              expanded={expandedIdx === idx}
              onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            />
          ))}
        </div>
      )}

      {!loading && stocks.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-2xl mb-2">📊</div>
          <p className="text-sm text-[var(--text-secondary)]">No stocks discovered. Market may be closed or API unavailable.</p>
          <button onClick={rescan} className="mt-3 text-sm font-semibold text-[var(--blue)] hover:underline">Try Again</button>
        </div>
      )}
    </div>
  );
}
