import { useState } from 'react';
import { allTrades } from '../data/mockData';

type FilterStatus = 'ALL' | 'OPEN' | 'TARGET_HIT' | 'SL_HIT' | 'MANUAL_EXIT';

const statusConfig: Record<string, { label: string; class: string }> = {
  OPEN: { label: '● OPEN', class: 'badge-blue' },
  TARGET_HIT: { label: '✓ TARGET', class: 'badge-green' },
  SL_HIT: { label: '✗ SL HIT', class: 'badge-red' },
  MANUAL_EXIT: { label: '↗ MANUAL', class: 'badge-amber' },
};

export function TradesPage() {
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const filtered = filter === 'ALL' ? allTrades : allTrades.filter(t => t.status === filter);
  const totalPnl = filtered.reduce((acc, t) => acc + t.netPnl, 0);
  const wins = filtered.filter(t => t.netPnl > 0).length;
  const losses = filtered.filter(t => t.netPnl < 0).length;

  return (
    <div className="space-y-4">
      {/* Filter + Summary bar */}
      <div className="card flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['ALL', 'OPEN', 'TARGET_HIT', 'SL_HIT', 'MANUAL_EXIT'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${filter === f ? 'bg-[var(--blue)] text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-white'}`}
            >
              {f === 'ALL' ? 'All Trades' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-[var(--muted-foreground)]">Showing: <strong className="text-white">{filtered.length}</strong> trades</span>
          <span className="text-[var(--green)]">Wins: {wins}</span>
          <span className="text-[var(--red)]">Losses: {losses}</span>
          <span className={totalPnl >= 0 ? 'text-[var(--green)] font-bold' : 'text-[var(--red)] font-bold'}>
            Net: {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Trades table */}
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Time</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Qty</th>
              <th className="text-right">Entry</th>
              <th className="text-right">Exit/CMP</th>
              <th className="text-right">SL</th>
              <th className="text-right">Target</th>
              <th className="text-right">P&L</th>
              <th className="text-right">Net P&L</th>
              <th className="text-right">%</th>
              <th>R:R</th>
              <th>Strategy</th>
              <th>Confidence</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td className="text-[var(--muted-foreground)] font-mono text-[10px]">{t.id}</td>
                <td className="text-[11px] whitespace-nowrap">{t.entryTime.slice(5, 16)}</td>
                <td className="font-medium">{t.symbol}</td>
                <td><span className={`badge ${t.side === 'BUY' ? 'badge-green' : 'badge-red'}`}>{t.side}</span></td>
                <td>{t.quantity}</td>
                <td className="text-right font-mono">₹{t.entryPrice.toLocaleString()}</td>
                <td className="text-right font-mono">{t.exitPrice ? `₹${t.exitPrice.toLocaleString()}` : `₹${t.currentPrice.toLocaleString()}`}</td>
                <td className="text-right font-mono text-red-400/70">₹{t.stopLoss.toLocaleString()}</td>
                <td className="text-right font-mono text-green-400/70">₹{t.takeProfit.toLocaleString()}</td>
                <td className={`text-right font-mono font-bold ${t.pnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                  {t.pnl >= 0 ? '+' : ''}₹{t.pnl.toLocaleString()}
                </td>
                <td className={`text-right font-mono ${t.netPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                  {t.netPnl >= 0 ? '+' : ''}₹{t.netPnl.toLocaleString()}
                </td>
                <td className={`text-right ${t.pnlPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                  {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                </td>
                <td className="text-center">{t.riskRewardRatio}</td>
                <td className="text-[11px] text-[var(--muted-foreground)]">{t.strategy}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <div className="progress-bar w-12">
                      <div className={`progress-fill ${t.confidence >= 0.8 ? 'bg-[var(--green)]' : t.confidence >= 0.7 ? 'bg-blue-400' : 'bg-amber-400'}`} style={{ width: `${t.confidence * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-[var(--muted-foreground)]">{(t.confidence * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="text-[11px] text-[var(--muted-foreground)]">{t.holdingDuration}</td>
                <td><span className={`badge ${statusConfig[t.status].class}`}>{statusConfig[t.status].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trade detail expanded (shows for first trade) */}
      <div className="card border-l-4 border-l-blue-500">
        <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">Trade Reasoning — {allTrades[0].id} ({allTrades[0].symbol})</h3>
        <p className="text-xs text-[var(--foreground)] leading-relaxed">{allTrades[0].reason}</p>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--muted-foreground)]">
          <span>Strategy: <strong>{allTrades[0].strategy}</strong></span>
          <span>Confidence: <strong>{(allTrades[0].confidence * 100).toFixed(0)}%</strong></span>
          <span>R:R: <strong>{allTrades[0].riskRewardRatio}</strong></span>
        </div>
      </div>
    </div>
  );
}
