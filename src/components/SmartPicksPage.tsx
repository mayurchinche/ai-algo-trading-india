import { useState } from 'react';
import { useStockDiscovery } from '../hooks/useStockDiscovery';
import type { DiscoveredStock } from '../services/stockDiscovery';

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-[var(--text-secondary)] w-16">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--border)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-[var(--text)] font-mono w-6 text-right">{Math.round(value)}</span>
    </div>
  );
}

function SignalBadge({ signal }: { signal: DiscoveredStock['signal'] }) {
  const cls = signal === 'STRONG_BUY' || signal === 'BUY' ? 'badge-green'
    : signal === 'SELL' || signal === 'STRONG_SELL' ? 'badge-red' : 'badge-amber';
  return <span className={`badge ${cls}`}>{signal.replace('_', ' ')}</span>;
}

function StockCard({ stock, variant }: { stock: DiscoveredStock; variant: 'short' | 'long' | 'smart' }) {
  const [expanded, setExpanded] = useState(false);
  const expectedReturn = stock.ltp > 0 ? ((stock.foAnalysis.suggestedTarget - stock.ltp) / stock.ltp * 100) : 0;

  return (
    <div className="card" style={{ borderLeft: `3px solid ${variant === 'short' ? 'var(--green)' : variant === 'long' ? 'var(--purple, #8b5cf6)' : 'var(--amber, #f59e0b)'}` }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ fontFamily: 'Poppins' }}>{stock.symbol}</span>
            <SignalBadge signal={stock.signal} />
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{stock.name} • {stock.exchange}</div>
        </div>
        <div className="score-circle" style={{
          borderColor: stock.overallScore >= 70 ? 'var(--green)' : stock.overallScore >= 50 ? 'var(--gold, #eab308)' : 'var(--blue)',
          color: stock.overallScore >= 70 ? 'var(--green)' : stock.overallScore >= 50 ? 'var(--gold, #eab308)' : 'var(--blue)'
        }}>
          {Math.round(stock.overallScore)}
        </div>
      </div>

      {/* Price row */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-[10px] text-[var(--text-secondary)]">LTP</div>
          <div className="text-sm font-bold font-mono">₹{stock.ltp.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-secondary)]">Change</div>
          <div className={`text-sm font-bold ${stock.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
            {stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-secondary)]">Target</div>
          <div className="text-sm font-bold font-mono text-[var(--green)]">₹{stock.foAnalysis.suggestedTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-secondary)]">Stop Loss</div>
          <div className="text-sm font-bold font-mono text-[var(--red)]">₹{stock.foAnalysis.suggestedStopLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* Expected return + R:R */}
      <div className="flex items-center gap-4 mb-3 text-[11px]">
        <span className="text-[var(--text-secondary)]">Expected: <strong className={expectedReturn >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>{expectedReturn >= 0 ? '+' : ''}{expectedReturn.toFixed(1)}%</strong></span>
        <span className="text-[var(--text-secondary)]">R:R <strong className="text-[var(--text)]">{stock.foAnalysis.riskReward.toFixed(1)}</strong></span>
        {variant === 'short' && <span className="badge badge-cyan">⏱ 10-15 days</span>}
        {variant === 'long' && <span className="badge badge-purple">⏱ 3-12 months</span>}
      </div>

      {/* Strategies */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {stock.strategies.map((s, i) => <span key={i} className="reason-tag">{s}</span>)}
      </div>

      {/* Smart money info for smart variant */}
      {variant === 'smart' && (
        <div className="p-2.5 rounded-lg bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)] mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold text-[var(--amber, #f59e0b)]">🦊 SMART MONEY</span>
          </div>
          <div className="text-[11px] text-[var(--amber, #f59e0b)]">
            Volume ratio: <strong>{stock.volumeRatio.toFixed(1)}x</strong> avg • {stock.volumeRatio >= 2 ? 'Strong accumulation signal' : stock.volumeRatio >= 1.5 ? 'Moderate accumulation' : 'Normal flow'}
          </div>
        </div>
      )}

      {/* Score bars */}
      <div className="space-y-1 mb-3">
        <ScoreBar label="Momentum" value={stock.scores.momentum} color="var(--green)" />
        <ScoreBar label="Breakout" value={stock.scores.breakout} color="var(--blue)" />
        <ScoreBar label="Trend" value={stock.scores.trendFollowing} color="var(--purple, #8b5cf6)" />
        <ScoreBar label="Smart $" value={stock.scores.smartMoney} color="var(--amber, #f59e0b)" />
        <ScoreBar label="MeanRev" value={stock.scores.meanReversion} color="var(--red)" />
      </div>

      {/* Reasons */}
      <div className="space-y-1.5 mb-3">
        {stock.reasons.slice(0, expanded ? undefined : 3).map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px]">
            <span className="text-[var(--green)] mt-0.5">✦</span>
            <span className="text-[var(--text)]">{r}</span>
          </div>
        ))}
        {stock.reasons.length > 3 && (
          <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-[var(--purple, #8b5cf6)] font-medium hover:underline">
            {expanded ? '▲ Show less' : `▼ +${stock.reasons.length - 3} more reasons`}
          </button>
        )}
      </div>

      {/* Technicals row */}
      <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)]">
        <span>RSI: <strong className="text-[var(--text)]">{stock.rsi.toFixed(1)}</strong></span>
        <span>Trend: <strong className="text-[var(--green)]">{stock.trend.replace('_', ' ')}</strong></span>
        <span>Support: <strong className="text-[var(--text)]">₹{stock.foAnalysis.supportLevel.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
        <span>Resistance: <strong className="text-[var(--text)]">₹{stock.foAnalysis.resistanceLevel.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
      </div>

      {/* F&O suggestion */}
      {stock.foAnalysis.optionStrategy && (
        <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
          F&O: <strong className="text-[var(--blue)]">{stock.foAnalysis.optionStrategy}</strong> — {stock.foAnalysis.optionReason}
        </div>
      )}
    </div>
  );
}

export function SmartPicksPage() {
  const { stocks, loading, lastScan, error, rescan } = useStockDiscovery();
  const [view, setView] = useState<'short' | 'long' | 'smartmoney'>('short');

  const shortTerm = stocks.filter(s => s.scores.momentum > 30 || s.scores.breakout > 30)
    .sort((a, b) => (b.scores.momentum + b.scores.breakout) - (a.scores.momentum + a.scores.breakout));
  const longTerm = stocks.filter(s => s.scores.trendFollowing > 30 && s.ltp > s.sma200)
    .sort((a, b) => b.scores.trendFollowing - a.scores.trendFollowing);
  const smartMoney = stocks.filter(s => s.scores.smartMoney > 30)
    .sort((a, b) => b.scores.smartMoney - a.scores.smartMoney);

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="card flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('short')} className={`btn-filter ${view === 'short' ? 'btn-filter-active-green' : 'btn-filter-inactive'}`}>
            🚀 Short-Term ({shortTerm.length})
          </button>
          <button onClick={() => setView('long')} className={`btn-filter ${view === 'long' ? 'btn-filter-active-purple' : 'btn-filter-inactive'}`}>
            💎 Long-Term ({longTerm.length})
          </button>
          <button onClick={() => setView('smartmoney')} className={`btn-filter ${view === 'smartmoney' ? 'btn-filter-active-amber' : 'btn-filter-inactive'}`}>
            🦊 Smart Money ({smartMoney.length})
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-[var(--text-secondary)]">
            {lastScan ? `Last scan: ${lastScan.toLocaleTimeString('en-IN')}` : 'Scanning...'} • Live Discovery
          </div>
          <button onClick={rescan} disabled={loading} className="text-[11px] text-[var(--blue)] font-semibold hover:underline">
            {loading ? '⏳ Scanning...' : '↻ Rescan'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
          <div className="text-[12px] text-[var(--red)]">⚠ Discovery error: {error}</div>
          <button onClick={rescan} className="text-[11px] text-[var(--blue)] mt-1 hover:underline">Retry</button>
        </div>
      )}

      {/* Loading state */}
      {loading && stocks.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-2xl mb-3">🔍</div>
          <div className="text-sm font-semibold text-[var(--text)]" style={{ fontFamily: 'Poppins' }}>Scanning NSE for Opportunities...</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">Analyzing momentum, breakouts, trends & smart money flow</div>
        </div>
      )}

      {/* Short-term */}
      {view === 'short' && !loading && (
        <div className="space-y-4">
          <div className="section-header">
            <span className="text-gradient-green">🚀 Short-Term Picks (10-15 Days)</span>
            <span className="badge badge-green">MOMENTUM + BREAKOUT</span>
            <span className="text-[11px] text-[var(--text-secondary)] ml-auto">{shortTerm.length} stocks found</span>
          </div>
          {shortTerm.length === 0 ? (
            <div className="card text-center py-8 text-[var(--text-secondary)] text-sm">No short-term opportunities detected in current scan</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {shortTerm.map(s => <StockCard key={s.symbol} stock={s} variant="short" />)}
            </div>
          )}
        </div>
      )}

      {/* Long-term */}
      {view === 'long' && !loading && (
        <div className="space-y-4">
          <div className="section-header">
            <span className="text-gradient-purple">💎 Long-Term Picks (Trend + SMA200)</span>
            <span className="badge badge-purple">TREND FOLLOWING</span>
            <span className="text-[11px] text-[var(--text-secondary)] ml-auto">{longTerm.length} stocks found</span>
          </div>
          {longTerm.length === 0 ? (
            <div className="card text-center py-8 text-[var(--text-secondary)] text-sm">No long-term opportunities above SMA200 detected</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {longTerm.map(s => <StockCard key={s.symbol} stock={s} variant="long" />)}
            </div>
          )}
        </div>
      )}

      {/* Smart Money */}
      {view === 'smartmoney' && !loading && (
        <div className="space-y-4">
          <div className="section-header">
            <span className="text-gradient-gold">🦊 Smart Money Flow</span>
            <span className="badge badge-amber">VOLUME + INSTITUTIONAL</span>
            <span className="text-[11px] text-[var(--text-secondary)] ml-auto">{smartMoney.length} stocks detected</span>
          </div>
          {smartMoney.length === 0 ? (
            <div className="card text-center py-8 text-[var(--text-secondary)] text-sm">No unusual smart money activity detected</div>
          ) : (
            <>
              {/* Summary table */}
              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th>LTP</th>
                      <th>Change</th>
                      <th>Vol Ratio</th>
                      <th>Signal</th>
                      <th>Smart Score</th>
                      <th>Pattern</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smartMoney.map(s => (
                      <tr key={s.symbol}>
                        <td className="font-medium">{s.symbol}</td>
                        <td className="font-mono">₹{s.ltp.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className={s.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>{s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%</td>
                        <td className="font-mono"><strong>{s.volumeRatio.toFixed(1)}x</strong></td>
                        <td><SignalBadge signal={s.signal} /></td>
                        <td className="font-mono">{Math.round(s.scores.smartMoney)}</td>
                        <td className="text-[11px]">{s.volumeRatio >= 2 ? '🟢 Accumulation' : s.volumeRatio >= 1.5 ? '🟡 Building' : '⚪ Normal'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Detail cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {smartMoney.map(s => <StockCard key={s.symbol} stock={s} variant="smart" />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
