// ponytail: signals generated from live discovery engine + accuracy tracking
import { useState } from 'react';
import { useStockDiscovery } from '../hooks/useStockDiscovery';
import type { DiscoveredStock } from '../services/stockDiscovery';
import { getSignalAccuracy, getSignalHistory, clearSignalHistory } from '../services/signalHistory';

function directionFromSignal(s: DiscoveredStock): 'BUY' | 'SELL' | 'HOLD' {
  if (s.signal === 'STRONG_BUY' || s.signal === 'BUY') return 'BUY';
  if (s.signal === 'STRONG_SELL' || s.signal === 'SELL') return 'SELL';
  return 'HOLD';
}

export function SignalsPage() {
  const { stocks, loading, lastScan, rescan } = useStockDiscovery();
  const [showHistory, setShowHistory] = useState(false);

  const signals = stocks.map(s => ({
    stock: s,
    direction: directionFromSignal(s),
    confidence: Math.min(Math.abs(s.overallScore) / 100, 1),
  }));

  const buySignals = signals.filter(s => s.direction === 'BUY');
  const sellSignals = signals.filter(s => s.direction === 'SELL');
  const holdSignals = signals.filter(s => s.direction === 'HOLD');

  const accuracy = getSignalAccuracy();
  const history = showHistory ? getSignalHistory().slice(0, 50) : [];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="card flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 pulse' : 'bg-[var(--green)]'}`}></span>
          <span className="text-xs font-medium">{loading ? 'Scanning...' : 'AI Engine Active'}</span>
        </div>
        {lastScan && (
          <span className="text-xs text-[var(--text-secondary)]">
            Last scan: {lastScan.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST • Auto-refresh: 5 min
          </span>
        )}
        <div className="flex items-center gap-4 ml-auto text-xs">
          <span className="badge badge-green">{buySignals.length} BUY</span>
          <span className="badge badge-red">{sellSignals.length} SELL</span>
          <span className="badge badge-amber">{holdSignals.length} HOLD</span>
          <button onClick={rescan} className="text-[var(--blue)] font-semibold hover:underline">↻ Rescan</button>
        </div>
      </div>

      {/* Signal Accuracy Tracker */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">📊 Signal Accuracy Tracker</h3>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-[var(--blue)] font-semibold hover:underline">
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
            {accuracy.total > 0 && (
              <button onClick={() => { clearSignalHistory(); window.location.reload(); }} className="text-xs text-[var(--red)] hover:underline">Reset</button>
            )}
          </div>
        </div>
        {accuracy.total === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">No signals recorded yet. Signals are stored on each scan and accuracy is tracked over time.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl bg-[var(--bg)] text-center">
                <div className="text-lg font-bold" style={{ fontFamily: 'Poppins' }}>{accuracy.winRate}%</div>
                <div className="text-[10px] text-[var(--text-muted)]">Win Rate</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg)] text-center">
                <div className="text-lg font-bold text-[var(--green)]" style={{ fontFamily: 'Poppins' }}>{accuracy.targetHit}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Target Hit ✓</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg)] text-center">
                <div className="text-lg font-bold text-[var(--red)]" style={{ fontFamily: 'Poppins' }}>{accuracy.slHit}</div>
                <div className="text-[10px] text-[var(--text-muted)]">SL Hit ✗</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg)] text-center">
                <div className="text-lg font-bold text-amber-500" style={{ fontFamily: 'Poppins' }}>{accuracy.pending}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Pending</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg)] text-center">
                <div className="text-lg font-bold text-[var(--green)]" style={{ fontFamily: 'Poppins' }}>+{accuracy.avgWinPct}%</div>
                <div className="text-[10px] text-[var(--text-muted)]">Avg Win</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg)] text-center">
                <div className="text-lg font-bold text-[var(--red)]" style={{ fontFamily: 'Poppins' }}>{accuracy.avgLossPct}%</div>
                <div className="text-[10px] text-[var(--text-muted)]">Avg Loss</div>
              </div>
            </div>

            {/* Strategy breakdown */}
            {Object.keys(accuracy.byStrategy).length > 0 && (
              <div>
                <h4 className="text-[10px] text-[var(--text-muted)] uppercase mb-2">By Strategy</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(accuracy.byStrategy).map(([name, s]) => (
                    <div key={name} className="p-2 rounded-lg bg-[var(--bg-alt)] border border-[var(--border)]">
                      <div className="text-[10px] font-medium truncate">{name}</div>
                      <div className="text-xs font-bold mt-1">
                        <span className={s.winRate >= 60 ? 'text-[var(--green)]' : s.winRate >= 40 ? 'text-amber-500' : 'text-[var(--red)]'}>{s.winRate}%</span>
                        <span className="text-[var(--text-muted)] ml-1">({s.wins}/{s.total})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signal history table */}
            {showHistory && history.length > 0 && (
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Symbol</th>
                      <th>Signal</th>
                      <th className="text-right">Entry</th>
                      <th className="text-right">Target</th>
                      <th className="text-right">SL</th>
                      <th className="text-center">Outcome</th>
                      <th className="text-right">P&L %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(s => (
                      <tr key={s.id}>
                        <td className="text-[var(--text-muted)]">{new Date(s.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                        <td className="font-semibold">{s.symbol}</td>
                        <td><span className={`badge text-[9px] ${s.signal.includes('BUY') ? 'badge-green' : s.signal.includes('SELL') ? 'badge-red' : 'badge-amber'}`}>{s.signal}</span></td>
                        <td className="text-right font-mono">₹{s.entryPrice.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                        <td className="text-right font-mono text-[var(--green)]">₹{s.target.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                        <td className="text-right font-mono text-[var(--red)]">₹{s.stopLoss.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                        <td className="text-center">
                          <span className={`badge text-[9px] ${s.outcome === 'TARGET_HIT' ? 'badge-green' : s.outcome === 'SL_HIT' ? 'badge-red' : s.outcome === 'EXPIRED' ? 'badge-amber' : 'badge-blue'}`}>
                            {s.outcome === 'TARGET_HIT' ? '✓ Target' : s.outcome === 'SL_HIT' ? '✗ SL Hit' : s.outcome === 'EXPIRED' ? '⏱ Expired' : '⏳ Pending'}
                          </span>
                        </td>
                        <td className={`text-right font-mono font-bold ${(s.pnlPct || 0) >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                          {s.pnlPct != null ? `${s.pnlPct >= 0 ? '+' : ''}${s.pnlPct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {loading && stocks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm text-[var(--text-secondary)]">Scanning NSE for signals...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {signals.sort((a, b) => b.confidence - a.confidence).map(({ stock: s, direction, confidence }) => (
            <div key={s.symbol} className={`card border-l-4 ${direction === 'BUY' ? 'border-l-[var(--green)]' : direction === 'SELL' ? 'border-l-[var(--red)]' : 'border-l-amber-400'}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{s.symbol}</span>
                  <span className={`badge ${direction === 'BUY' ? 'badge-green' : direction === 'SELL' ? 'badge-red' : 'badge-amber'}`}>
                    {s.signal.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">{s.exchange}</span>
              </div>

              {/* Price */}
              <div className="flex items-center gap-4 mb-2 text-xs">
                <span className="text-[var(--text-secondary)]">LTP:</span>
                <span className="font-mono font-semibold">₹{s.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                <span className={s.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                  {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                </span>
              </div>

              {/* Confidence */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-[var(--text-secondary)]">Score:</span>
                <div className="progress-bar flex-1">
                  <div
                    className={`progress-fill ${confidence >= 0.7 ? 'bg-[var(--green)]' : confidence >= 0.5 ? 'bg-blue-400' : confidence >= 0.3 ? 'bg-amber-400' : 'bg-gray-400'}`}
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold">{s.overallScore}</span>
              </div>

              {/* Indicators */}
              <div className="grid grid-cols-2 gap-1 mb-2 text-[10px]">
                <div className="text-[var(--text-secondary)]">RSI: <span className={`font-medium ${s.rsi > 70 ? 'text-[var(--red)]' : s.rsi < 30 ? 'text-[var(--green)]' : ''}`}>{s.rsi}</span></div>
                <div className="text-[var(--text-secondary)]">Vol: <span className="font-medium">{s.volumeRatio}x avg</span></div>
                <div className="text-[var(--text-secondary)]">MACD: <span className={`font-medium ${s.macd.histogram > 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>{s.macd.histogram > 0 ? '↑ Bull' : '↓ Bear'}</span></div>
                <div className="text-[var(--text-secondary)]">Trend: <span className="font-medium">{s.trend.replace('_', ' ')}</span></div>
              </div>

              {/* F&O suggestion */}
              <div className="bg-purple-50 rounded-lg px-2 py-1.5 mb-2 text-[10px]">
                <span className="text-purple-600 font-semibold">F&O: </span>
                <span className="text-purple-800">{s.foAnalysis.optionStrategy}</span>
                <div className="flex gap-4 mt-0.5 text-purple-600">
                  <span>SL: ₹{s.foAnalysis.suggestedStopLoss.toLocaleString('en-IN')}</span>
                  <span>Target: ₹{s.foAnalysis.suggestedTarget.toLocaleString('en-IN')}</span>
                  <span>R:R 1:{s.foAnalysis.riskReward}</span>
                </div>
              </div>

              {/* Reasons */}
              <div className="border-t border-[var(--border)] pt-2 mt-2">
                {s.reasons.slice(0, 2).map((r, i) => (
                  <p key={i} className="text-[11px] text-[var(--text-secondary)] leading-relaxed">• {r}</p>
                ))}
              </div>

              {/* Strategies */}
              <div className="mt-2 flex flex-wrap gap-1">
                {s.strategies.map(st => (
                  <span key={st} className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{st}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
