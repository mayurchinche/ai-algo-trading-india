// ponytail: stock analysis from live discovery — no hardcoded data
import { useStockDiscovery } from '../hooks/useStockDiscovery';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export function StockAnalysisPage() {
  const { stocks, loading, lastScan, rescan } = useStockDiscovery();

  const chartData = stocks.slice(0, 15).map(s => ({
    symbol: s.symbol,
    score: s.overallScore,
    changePct: s.changePct,
  }));

  return (
    <div className="space-y-4">
      {/* Score chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">AI Conviction Score by Stock (Live)</h3>
          <button onClick={rescan} disabled={loading} className="text-xs text-[var(--blue)] font-semibold hover:underline disabled:opacity-50">
            {loading ? 'Scanning...' : '↻ Rescan'}
          </button>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="symbol" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid var(--border)' }}
              formatter={(v: any) => [v, 'Score']}
            />
            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.score >= 30 ? 'var(--green)' : d.score <= -30 ? 'var(--red)' : '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Live Market Data */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Live Market Data — NSE (Dynamically Discovered)</h3>
          <div className="flex items-center gap-2">
            {lastScan && <span className="text-[10px] text-[var(--text-muted)]">Updated: {lastScan.toLocaleTimeString('en-IN')}</span>}
            <span className="badge badge-green text-[9px]">● LIVE</span>
          </div>
        </div>
        {loading && stocks.length === 0 ? (
          <p className="text-center text-[var(--text-muted)] py-8 text-sm">Discovering stocks from NSE...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th className="text-right">LTP</th>
                  <th className="text-right">Change</th>
                  <th className="text-right">%</th>
                  <th className="text-right">Volume</th>
                  <th className="text-right">Vol Ratio</th>
                  <th className="text-center">RSI</th>
                  <th className="text-center">MACD</th>
                  <th className="text-right">SMA 50</th>
                  <th className="text-right">SMA 200</th>
                  <th className="text-center">Trend</th>
                  <th className="text-center">Score</th>
                  <th className="text-center">Signal</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map(s => (
                  <tr key={s.symbol}>
                    <td className="font-semibold">{s.symbol}</td>
                    <td className="text-[var(--text-secondary)] text-xs max-w-[160px] truncate">{s.name}</td>
                    <td className="text-right font-mono font-semibold">₹{s.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className={`text-right font-mono ${s.change >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {s.change >= 0 ? '+' : ''}₹{s.change.toFixed(2)}
                    </td>
                    <td className={`text-right font-mono font-semibold ${s.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                    </td>
                    <td className="text-right font-mono">{s.volume > 100000 ? `${(s.volume / 100000).toFixed(1)}L` : s.volume.toLocaleString()}</td>
                    <td className={`text-right font-mono font-bold ${s.volumeRatio > 2 ? 'text-[var(--green)]' : ''}`}>{s.volumeRatio}x</td>
                    <td className={`text-center font-medium ${s.rsi > 70 ? 'text-[var(--red)]' : s.rsi < 30 ? 'text-[var(--green)]' : ''}`}>{s.rsi}</td>
                    <td className={`text-center text-xs ${s.macd.histogram > 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {s.macd.histogram > 0 ? '↑ Bull' : '↓ Bear'}
                    </td>
                    <td className="text-right font-mono text-[var(--text-secondary)]">₹{s.sma50.toLocaleString('en-IN')}</td>
                    <td className="text-right font-mono text-[var(--text-secondary)]">₹{s.sma200.toLocaleString('en-IN')}</td>
                    <td className="text-center">
                      <span className={`text-[10px] font-bold ${s.trend.includes('UP') ? 'text-[var(--green)]' : s.trend.includes('DOWN') ? 'text-[var(--red)]' : 'text-[var(--text-muted)]'}`}>
                        {s.trend.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={`text-center font-bold ${s.overallScore > 30 ? 'text-[var(--green)]' : s.overallScore < -30 ? 'text-[var(--red)]' : ''}`}>
                      {s.overallScore}
                    </td>
                    <td className="text-center">
                      <span className={`badge text-[9px] ${s.signal.includes('BUY') ? 'badge-green' : s.signal.includes('SELL') ? 'badge-red' : 'badge-amber'}`}>
                        {s.signal.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
