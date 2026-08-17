import { useState } from 'react';
import { runBacktest, type BacktestResult } from '../services/backtestEngine';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts';

function AccuracyMeter({ label, value }: { label: string; value: number }) {
  const color = value >= 65 ? 'var(--green)' : value >= 50 ? 'var(--blue)' : value >= 40 ? '#f59e0b' : 'var(--red)';
  return (
    <div className="text-center">
      <div className="relative w-16 h-16 mx-auto mb-1">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${value} ${100 - value}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color }}>{value}%</span>
        </div>
      </div>
      <div className="text-[9px] text-[var(--text-secondary)] font-medium">{label}</div>
    </div>
  );
}

export function BacktestPage() {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState('');

  const handleRun = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    const res = await runBacktest({ symbol: symbol.trim().toUpperCase() });
    if (res) setResult(res);
    else setError(`Could not backtest ${symbol}. Check if symbol exists on NSE.`);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Input section */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-1 block">Stock Symbol (NSE)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRun()}
                placeholder="e.g. RELIANCE, TCS, SBIN, INFY..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm font-medium focus:outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-blue-100"
              />
              <button
                onClick={handleRun}
                disabled={loading || !symbol.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-blue-200 hover:shadow-xl disabled:opacity-50 transition-all"
              >
                {loading ? '⏳ Running...' : '▶ Run Backtest'}
              </button>
            </div>
          </div>
          <div className="hidden md:block text-[11px] text-[var(--text-secondary)] max-w-[250px]">
            <p className="font-semibold text-[var(--text)]">How it works:</p>
            <p>Fetches 1-year data → runs all 5 strategies → computes win rate, P&L, drawdown, accuracy % for every signal</p>
          </div>
        </div>
        {/* Quick picks */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {['RELIANCE', 'TCS', 'HDFCBANK', 'SBIN', 'INFY', 'BAJFINANCE', 'MARUTI', 'ICICIBANK', 'WIPRO', 'TATASTEEL'].map(s => (
            <button key={s} onClick={() => { setSymbol(s); }} className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-[var(--text-secondary)] hover:bg-blue-50 hover:text-blue-600 font-medium transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="card border-l-4 border-l-red-400 text-sm text-[var(--red)]">{error}</div>}

      {loading && (
        <div className="card text-center py-12">
          <div className="text-3xl mb-3">⏳</div>
          <p className="text-sm font-semibold">Running backtest on {symbol.toUpperCase()}...</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Analyzing 1 year of data • 5 strategies • Computing accuracy metrics</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Hero stats */}
          <div className="card bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text)]" style={{ fontFamily: 'Poppins' }}>{result.symbol} — Backtest Results</h2>
                <p className="text-xs text-[var(--text-secondary)]">{result.stockName} • {result.period} ({result.totalDays} trading days)</p>
              </div>
              <div className={`text-right`}>
                <div className={`text-2xl font-bold ${result.totalReturnPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`} style={{ fontFamily: 'Poppins' }}>
                  {result.totalReturnPct >= 0 ? '+' : ''}{result.totalReturnPct}%
                </div>
                <div className="text-xs text-[var(--text-secondary)]">₹{result.initialCapital.toLocaleString('en-IN')} → ₹{result.finalCapital.toLocaleString('en-IN')}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-[9px] text-[var(--text-muted)] uppercase">Total P&L</div>
                <div className={`text-base font-bold ${result.totalReturn >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                  {result.totalReturn >= 0 ? '+' : ''}₹{result.totalReturn.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-[9px] text-[var(--text-muted)] uppercase">Win Rate</div>
                <div className="text-base font-bold text-[var(--blue)]">{result.combined.winRate}%</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-[9px] text-[var(--text-muted)] uppercase">Profit Factor</div>
                <div className="text-base font-bold text-purple-600">{result.combined.profitFactor}</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-[9px] text-[var(--text-muted)] uppercase">vs Buy & Hold</div>
                <div className={`text-base font-bold ${result.alphaVsBuyHold >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                  {result.alphaVsBuyHold >= 0 ? '+' : ''}{result.alphaVsBuyHold}%
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-[9px] text-[var(--text-muted)] uppercase">Total Trades</div>
                <div className="text-base font-bold text-[var(--text)]">{result.combined.totalTrades}</div>
              </div>
            </div>
          </div>

          {/* Accuracy Meters */}
          <div className="card">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">Strategy Accuracy (% Win Rate)</h3>
            <div className="flex items-center justify-around flex-wrap gap-4">
              <AccuracyMeter label="Overall" value={result.accuracy.overallSignalAccuracy} />
              <AccuracyMeter label="Buy Signals" value={result.accuracy.buySignalAccuracy} />
              <AccuracyMeter label="Sell Signals" value={result.accuracy.sellSignalAccuracy} />
              <AccuracyMeter label="Momentum" value={result.accuracy.momentumAccuracy} />
              <AccuracyMeter label="Breakout" value={result.accuracy.breakoutAccuracy} />
              <AccuracyMeter label="Trend" value={result.accuracy.trendAccuracy} />
              <AccuracyMeter label="Mean Rev." value={result.accuracy.meanReversionAccuracy} />
              <AccuracyMeter label="Smart Money" value={result.accuracy.smartMoneyAccuracy} />
            </div>
          </div>

          {/* Equity Curve */}
          <div className="card">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Equity Curve (₹5L → ₹{(result.finalCapital / 100000).toFixed(2)}L)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={result.equityCurve.filter((_, i) => i % 3 === 0)}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={result.totalReturn >= 0 ? '#22C55E' : '#EF4444'} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={result.totalReturn >= 0 ? '#22C55E' : '#EF4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/100000).toFixed(1)}L`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12 }} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Equity']} />
                <Area type="monotone" dataKey="equity" stroke={result.totalReturn >= 0 ? '#22C55E' : '#EF4444'} fill="url(#eqGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Strategy comparison */}
          <div className="card">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Strategy Comparison</h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Strategy</th>
                    <th className="text-center">Trades</th>
                    <th className="text-center">Win Rate</th>
                    <th className="text-right">Total P&L</th>
                    <th className="text-right">Avg Win</th>
                    <th className="text-right">Avg Loss</th>
                    <th className="text-center">Profit Factor</th>
                    <th className="text-center">Sharpe</th>
                    <th className="text-center">Max DD</th>
                    <th className="text-right">Expectancy</th>
                  </tr>
                </thead>
                <tbody>
                  {result.strategies.filter(s => s.totalTrades > 0).map(s => (
                    <tr key={s.name}>
                      <td className="font-semibold">{s.name}</td>
                      <td className="text-center">{s.totalTrades}</td>
                      <td className="text-center">
                        <span className={`font-bold ${s.winRate >= 60 ? 'text-[var(--green)]' : s.winRate >= 45 ? 'text-amber-500' : 'text-[var(--red)]'}`}>
                          {s.winRate}%
                        </span>
                      </td>
                      <td className={`text-right font-mono ${s.totalPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                        {s.totalPnl >= 0 ? '+' : ''}₹{s.totalPnl.toLocaleString('en-IN')}
                      </td>
                      <td className="text-right font-mono text-[var(--green)]">+₹{s.avgWin.toLocaleString('en-IN')}</td>
                      <td className="text-right font-mono text-[var(--red)]">-₹{s.avgLoss.toLocaleString('en-IN')}</td>
                      <td className="text-center font-bold">{s.profitFactor}</td>
                      <td className="text-center">{s.sharpeRatio}</td>
                      <td className="text-center text-[var(--red)]">{s.maxDrawdownPct}%</td>
                      <td className={`text-right font-mono ${s.expectancy >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                        ₹{s.expectancy.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-blue-50">
                    <td>COMBINED</td>
                    <td className="text-center">{result.combined.totalTrades}</td>
                    <td className="text-center text-[var(--blue)]">{result.combined.winRate}%</td>
                    <td className={`text-right font-mono ${result.combined.totalPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {result.combined.totalPnl >= 0 ? '+' : ''}₹{result.combined.totalPnl.toLocaleString('en-IN')}
                    </td>
                    <td className="text-right font-mono">+₹{result.combined.avgWin.toLocaleString('en-IN')}</td>
                    <td className="text-right font-mono">-₹{result.combined.avgLoss.toLocaleString('en-IN')}</td>
                    <td className="text-center">{result.combined.profitFactor}</td>
                    <td className="text-center">{result.combined.sharpeRatio}</td>
                    <td className="text-center">{result.combined.maxDrawdownPct}%</td>
                    <td className="text-right font-mono">₹{result.combined.expectancy.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* P&L per strategy bar chart */}
          <div className="card">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">P&L by Strategy</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={result.strategies.filter(s => s.totalTrades > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12 }} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'P&L']} />
                <Bar dataKey="totalPnl" radius={[6, 6, 0, 0]}>
                  {result.strategies.filter(s => s.totalTrades > 0).map((s, i) => (
                    <Cell key={i} fill={s.totalPnl >= 0 ? '#22C55E' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent trades */}
          <div className="card">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
              Trade Log ({result.trades.length} trades)
            </h3>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="data-table">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Side</th>
                    <th className="text-right">Entry ₹</th>
                    <th className="text-right">Exit ₹</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">P&L</th>
                    <th className="text-right">%</th>
                    <th>Strategy</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.slice(-30).reverse().map((t, i) => (
                    <tr key={i}>
                      <td className="text-[11px]">{t.entryDate}</td>
                      <td className="text-[11px]">{t.exitDate}</td>
                      <td><span className={`badge ${t.side === 'BUY' ? 'badge-green' : 'badge-red'}`}>{t.side}</span></td>
                      <td className="text-right font-mono">₹{t.entryPrice.toFixed(2)}</td>
                      <td className="text-right font-mono">₹{t.exitPrice.toFixed(2)}</td>
                      <td className="text-right font-mono">{t.quantity}</td>
                      <td className={`text-right font-mono font-bold ${t.pnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                        {t.pnl >= 0 ? '+' : ''}₹{t.pnl.toLocaleString('en-IN')}
                      </td>
                      <td className={`text-right font-mono ${t.pnlPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                        {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct}%
                      </td>
                      <td className="text-[11px]">{t.strategy}</td>
                      <td className="text-[10px] text-[var(--text-muted)] max-w-[200px] truncate">{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
