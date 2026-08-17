import { stockAnalysis } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import type { LiveStock } from '../services/liveData';

export function StockAnalysisPage({ stocks }: { stocks: LiveStock[] }) {
  const chartData = stockAnalysis.map(s => ({ symbol: s.symbol, pnl: s.totalPnl, winRate: s.winRate }));

  return (
    <div className="space-y-4">
      {/* P&L by stock chart */}
      <div className="card">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">P&L by Stock</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="symbol" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1A202C', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'P&L']} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.pnl >= 0 ? '#22C55E' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stock analysis table */}
      <div className="card overflow-x-auto">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Per-Stock Analysis</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Sector</th>
              <th className="text-center">Trades</th>
              <th className="text-center">Wins</th>
              <th className="text-center">Losses</th>
              <th className="text-center">Win Rate</th>
              <th className="text-right">Total P&L</th>
              <th className="text-right">Avg P&L</th>
              <th className="text-right">Best Trade</th>
              <th className="text-right">Worst Trade</th>
              <th className="text-center">Sharpe</th>
              <th className="text-center">Profit Factor</th>
              <th className="text-center">Max Consec. Loss</th>
              <th>Avg Hold</th>
              <th>AI Score</th>
              <th>Signal</th>
            </tr>
          </thead>
          <tbody>
            {stockAnalysis.map((s) => {
              const stock = stocks.find(w => w.symbol === s.symbol);
              return (
                <tr key={s.symbol}>
                  <td className="font-medium">{s.symbol}</td>
                  <td className="text-[var(--text-secondary)] text-[11px]">{stock?.sector || '-'}</td>
                  <td className="text-center">{s.totalTrades}</td>
                  <td className="text-center text-[var(--green)]">{s.wins}</td>
                  <td className="text-center text-[var(--red)]">{s.losses}</td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="progress-bar w-10">
                        <div className={`progress-fill ${s.winRate >= 70 ? 'bg-[var(--green)]' : s.winRate >= 60 ? 'bg-blue-400' : s.winRate >= 50 ? 'bg-amber-400' : 'bg-[var(--red)]'}`} style={{ width: `${s.winRate}%` }} />
                      </div>
                      <span className="text-[10px]">{s.winRate.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className={`text-right font-mono font-bold ${s.totalPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {s.totalPnl >= 0 ? '+' : ''}₹{s.totalPnl.toLocaleString()}
                  </td>
                  <td className={`text-right font-mono ${s.avgPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {s.avgPnl >= 0 ? '+' : ''}₹{s.avgPnl.toLocaleString()}
                  </td>
                  <td className="text-right font-mono text-[var(--green)]">+₹{s.bestTrade.toLocaleString()}</td>
                  <td className="text-right font-mono text-[var(--red)]">-₹{Math.abs(s.worstTrade).toLocaleString()}</td>
                  <td className={`text-center font-medium ${s.sharpe >= 2 ? 'text-[var(--green)]' : s.sharpe >= 1.5 ? 'text-blue-400' : s.sharpe >= 1 ? 'text-amber-400' : 'text-[var(--red)]'}`}>
                    {s.sharpe.toFixed(2)}
                  </td>
                  <td className={`text-center font-medium ${s.profitFactor >= 2 ? 'text-[var(--green)]' : s.profitFactor >= 1.5 ? 'text-blue-400' : 'text-[var(--red)]'}`}>
                    {s.profitFactor.toFixed(2)}
                  </td>
                  <td className="text-center">{s.maxConsecutiveLosses}</td>
                  <td className="text-[11px] text-[var(--text-secondary)]">{s.avgHoldingTime}</td>
                  <td>
                    <div className="flex items-center justify-center">
                      <span className={`text-[11px] font-bold ${(stock?.changePct ?? 0) > 0 ? 'text-[var(--green)]' : (stock?.changePct ?? 0) === 0 ? 'text-amber-400' : 'text-[var(--red)]'}`}>
                        {stock ? (50 + Math.round(stock.changePct * 10)).toString() : '-'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${(stock?.changePct ?? 0) > 0.5 ? 'badge-green' : (stock?.changePct ?? 0) < -0.5 ? 'badge-red' : 'badge-amber'}`}>
                      {(stock?.changePct ?? 0) > 0.5 ? 'BULLISH' : (stock?.changePct ?? 0) < -0.5 ? 'BEARISH' : 'NEUTRAL'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Market data for each stock — LIVE */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Live Market Data — NSE</h3>
          <span className="badge badge-green text-[9px]">● LIVE</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>Sector</th>
              <th className="text-right">LTP</th>
              <th className="text-right">Change</th>
              <th className="text-right">%</th>
              <th className="text-right">Open</th>
              <th className="text-right">High</th>
              <th className="text-right">Low</th>
              <th className="text-right">Volume</th>
              <th className="text-right">Prev Close</th>
              <th className="text-right">52W High</th>
              <th className="text-right">52W Low</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => (
              <tr key={s.symbol}>
                <td className="font-semibold">{s.symbol}</td>
                <td className="text-[var(--text-secondary)] text-xs max-w-[180px] truncate">{s.name}</td>
                <td className="text-[var(--text-secondary)] text-xs">{s.sector}</td>
                <td className="text-right font-mono font-semibold">₹{s.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td className={`text-right font-mono ${s.change >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                  {s.change >= 0 ? '+' : ''}₹{s.change.toFixed(2)}
                </td>
                <td className={`text-right font-mono font-semibold ${s.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                  {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                </td>
                <td className="text-right font-mono text-[var(--text-secondary)]">₹{s.open.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td className="text-right font-mono text-[var(--text-secondary)]">₹{s.dayHigh.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td className="text-right font-mono text-[var(--text-secondary)]">₹{s.dayLow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td className="text-right font-mono">{s.volume > 100000 ? `${(s.volume / 100000).toFixed(1)}L` : s.volume.toLocaleString()}</td>
                <td className="text-right font-mono text-[var(--text-secondary)]">₹{s.prevClose.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td className="text-right font-mono text-[var(--text-secondary)]">₹{s.weekHigh52.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td className="text-right font-mono text-[var(--text-secondary)]">₹{s.weekLow52.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {stocks.length === 0 && <p className="text-center text-[var(--text-muted)] py-8 text-sm">Loading live stock data...</p>}
      </div>
    </div>
  );
}
