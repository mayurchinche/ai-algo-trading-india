// ponytail: trades generated from live discovery — no hardcoded trade data
import { useStockDiscovery } from '../hooks/useStockDiscovery';
import type { DiscoveredStock } from '../services/stockDiscovery';

interface PaperTrade {
  stock: DiscoveredStock;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  target: number;
  pnl: number;
  pnlPct: number;
  strategy: string;
  riskReward: number;
  entryTime: string;
  exitTime: string | null; // null = still open
  status: 'OPEN' | 'TARGET HIT' | 'SL HIT';
  duration: string;
}

function generatePaperTrades(stocks: DiscoveredStock[]): PaperTrade[] {
  const today = new Date();
  const marketOpen = new Date(today); marketOpen.setHours(9, 15, 0, 0);
  const now = new Date();

  return stocks
    .filter(s => Math.abs(s.overallScore) >= 25)
    .map(s => {
      const side: 'BUY' | 'SELL' = s.overallScore > 0 ? 'BUY' : 'SELL';
      const entryPrice = s.prevClose;
      const currentPrice = s.ltp;
      const quantity = Math.max(1, Math.floor(50000 / entryPrice));
      const pnl = side === 'BUY'
        ? (currentPrice - entryPrice) * quantity
        : (entryPrice - currentPrice) * quantity;
      const pnlPct = side === 'BUY'
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100;

      // ponytail: entry at market open, exit when SL/target hit or still open
      const entryTime = marketOpen.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      let status: PaperTrade['status'] = 'OPEN';
      let exitTime: string | null = null;

      if (side === 'BUY') {
        if (currentPrice >= s.foAnalysis.suggestedTarget) { status = 'TARGET HIT'; }
        else if (currentPrice <= s.foAnalysis.suggestedStopLoss) { status = 'SL HIT'; }
      } else {
        if (currentPrice <= s.foAnalysis.suggestedTarget) { status = 'TARGET HIT'; }
        else if (currentPrice >= s.foAnalysis.suggestedStopLoss) { status = 'SL HIT'; }
      }

      if (status !== 'OPEN') {
        // Simulate exit happened some time between open and now
        const elapsed = now.getTime() - marketOpen.getTime();
        const exitAt = new Date(marketOpen.getTime() + Math.random() * Math.min(elapsed, 4 * 3600000));
        exitTime = exitAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }

      const durationMs = status !== 'OPEN' && exitTime
        ? (new Date(`2000-01-01 ${exitTime}`).getTime() - new Date(`2000-01-01 ${entryTime}`).getTime())
        : (now.getTime() - marketOpen.getTime());
      const durationMin = Math.max(1, Math.round(durationMs / 60000));
      const duration = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`;

      return {
        stock: s, side, quantity, entryPrice, currentPrice,
        stopLoss: s.foAnalysis.suggestedStopLoss,
        target: s.foAnalysis.suggestedTarget,
        pnl: Math.round(pnl), pnlPct: Math.round(pnlPct * 100) / 100,
        strategy: s.strategies[0] || 'Multi-Strategy',
        riskReward: s.foAnalysis.riskReward,
        entryTime, exitTime, status, duration,
      };
    });
}

export function TradesPage() {
  const { stocks, loading, lastScan, rescan } = useStockDiscovery();
  const trades = generatePaperTrades(stocks);

  const totalPnl = trades.reduce((a, t) => a + t.pnl, 0);
  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl < 0).length;
  const totalInvested = trades.reduce((a, t) => a + t.entryPrice * t.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Active Trades</div>
          <div className="text-xl font-bold" style={{ fontFamily: 'Poppins' }}>{trades.length}</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Today's P&L</div>
          <div className={`text-xl font-bold ${totalPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`} style={{ fontFamily: 'Poppins' }}>
            {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Win / Loss</div>
          <div className="text-xl font-bold" style={{ fontFamily: 'Poppins' }}>
            <span className="text-[var(--green)]">{wins}</span>
            <span className="text-[var(--text-muted)]"> / </span>
            <span className="text-[var(--red)]">{losses}</span>
          </div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Capital Deployed</div>
          <div className="text-xl font-bold" style={{ fontFamily: 'Poppins' }}>₹{(totalInvested / 100000).toFixed(1)}L</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Win Rate</div>
          <div className="text-xl font-bold" style={{ fontFamily: 'Poppins' }}>
            {trades.length > 0 ? ((wins / trades.length) * 100).toFixed(0) : 0}%
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="card bg-blue-50 flex items-center justify-between">
        <div className="text-xs text-blue-700">
          <b>Paper Trading Mode</b> — AI discovers stocks from live NSE data, simulates entry at previous close, tracks against live LTP.
          {lastScan && <span className="ml-2 text-blue-500">Last scan: {lastScan.toLocaleTimeString('en-IN')}</span>}
        </div>
        <button onClick={rescan} disabled={loading} className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50">
          {loading ? 'Scanning...' : '↻ Refresh'}
        </button>
      </div>

      {/* Trade table */}
      {loading && trades.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm text-[var(--text-secondary)]">Discovering stocks and generating paper trades...</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Side</th>
                <th className="text-center">Status</th>
                <th className="text-right">Entry ⏱</th>
                <th className="text-right">Exit ⏱</th>
                <th className="text-right">Duration</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Entry ₹</th>
                <th className="text-right">LTP (Live)</th>
                <th className="text-right">P&L</th>
                <th className="text-right">%</th>
                <th className="text-right">Stop Loss</th>
                <th className="text-right">Target</th>
                <th>Strategy</th>
              </tr>
            </thead>
            <tbody>
              {trades.sort((a, b) => b.pnl - a.pnl).map(t => (
                <tr key={t.stock.symbol}>
                  <td>
                    <div className="font-semibold">{t.stock.symbol}</div>
                    <div className="text-[10px] text-[var(--text-muted)] max-w-[120px] truncate">{t.stock.name}</div>
                  </td>
                  <td>
                    <span className={`badge ${t.side === 'BUY' ? 'badge-green' : 'badge-red'}`}>{t.side}</span>
                  </td>
                  <td className="text-center">
                    <span className={`badge text-[9px] ${t.status === 'TARGET HIT' ? 'badge-green' : t.status === 'SL HIT' ? 'badge-red' : 'badge-amber'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="text-right font-mono text-xs">{t.entryTime}</td>
                  <td className="text-right font-mono text-xs">{t.exitTime || <span className="text-amber-500">Live</span>}</td>
                  <td className="text-right font-mono text-xs text-[var(--text-secondary)]">{t.duration}</td>
                  <td className="text-right font-mono">{t.quantity}</td>
                  <td className="text-right font-mono">₹{t.entryPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="text-right font-mono font-semibold">₹{t.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className={`text-right font-mono font-bold ${t.pnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {t.pnl >= 0 ? '+' : ''}₹{t.pnl.toLocaleString('en-IN')}
                  </td>
                  <td className={`text-right font-mono font-bold ${t.pnlPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                  </td>
                  <td className="text-right font-mono text-[var(--red)]">₹{t.stopLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="text-right font-mono text-[var(--green)]">₹{t.target.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="text-xs">{t.strategy}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {trades.length === 0 && <p className="text-center text-[var(--text-muted)] py-8 text-sm">No trades generated — no stocks met the conviction threshold (score ≥ 25)</p>}
        </div>
      )}
    </div>
  );
}
