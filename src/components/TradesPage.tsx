// ponytail: realistic paper trading — persisted in localStorage, entries at signal time
import { useStockDiscovery } from '../hooks/useStockDiscovery';
import { getPaperTrades, getPaperTradeSummary, clearPaperTrades } from '../services/paperTrading';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function duration(entry: string, exit?: string): string {
  const start = new Date(entry).getTime();
  const end = exit ? new Date(exit).getTime() : Date.now();
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
}

export function TradesPage() {
  const { loading, lastScan, rescan, stocks } = useStockDiscovery();
  const trades = getPaperTrades();
  const summary = getPaperTradeSummary();

  // Get current prices for open trades display
  const priceMap = new Map(stocks.map(s => [s.symbol, s.ltp]));

  const openTrades = trades.filter(t => t.status === 'OPEN');
  const closedTrades = trades.filter(t => t.status !== 'OPEN').sort((a, b) =>
    new Date(b.exitTime || b.entryTime).getTime() - new Date(a.exitTime || a.entryTime).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Capital</div>
          <div className="text-xl font-bold" style={{ fontFamily: 'Poppins' }}>₹{summary.capital.toLocaleString('en-IN')}</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Net P&L</div>
          <div className={`text-xl font-bold ${summary.totalNetPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`} style={{ fontFamily: 'Poppins' }}>
            {summary.totalNetPnl >= 0 ? '+' : ''}₹{summary.totalNetPnl.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Return</div>
          <div className={`text-xl font-bold ${summary.returnPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`} style={{ fontFamily: 'Poppins' }}>
            {summary.returnPct >= 0 ? '+' : ''}{summary.returnPct}%
          </div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Win Rate</div>
          <div className="text-xl font-bold" style={{ fontFamily: 'Poppins' }}>{summary.winRate}%</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Win / Loss</div>
          <div className="text-xl font-bold" style={{ fontFamily: 'Poppins' }}>
            <span className="text-[var(--green)]">{summary.wins}</span>
            <span className="text-[var(--text-muted)]"> / </span>
            <span className="text-[var(--red)]">{summary.losses}</span>
          </div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Brokerage</div>
          <div className="text-xl font-bold text-[var(--red)]" style={{ fontFamily: 'Poppins' }}>-₹{summary.totalBrokerage}</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Open</div>
          <div className="text-xl font-bold text-[var(--amber)]" style={{ fontFamily: 'Poppins' }}>{summary.openTrades}</div>
        </div>
      </div>

      {/* Info bar */}
      <div className="card flex items-center justify-between">
        <div className="text-xs text-[var(--text-secondary)]">
          <b>🤖 Auto Paper Trading</b> — Entries happen ONLY when signals fire during market hours (Mon-Fri 9:15-15:30). Max 3 equity + 2 F&O/day. SL/Target monitored every 5 min.
          {lastScan && <span className="ml-2 text-[var(--blue)]">Last scan: {lastScan.toLocaleTimeString('en-IN')}</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={rescan} disabled={loading} className="text-xs font-semibold text-[var(--blue)] hover:underline disabled:opacity-50">
            {loading ? 'Scanning...' : '↻ Refresh'}
          </button>
          {trades.length > 0 && (
            <button onClick={() => { clearPaperTrades(); window.location.reload(); }} className="text-xs text-[var(--red)] hover:underline">
              Reset All
            </button>
          )}
        </div>
      </div>

      {/* No trades state */}
      {trades.length === 0 && !loading && (
        <div className="card text-center py-12">
          <p className="text-sm text-[var(--text-secondary)]">No paper trades yet.</p>
          <p className="text-xs text-[var(--text-muted)] mt-2">Trades are opened automatically when high-conviction signals fire during market hours (Mon-Fri 9:15-15:30 IST).</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Today is {new Date().toLocaleDateString('en-IN', { weekday: 'long' })} — {new Date().getDay() >= 1 && new Date().getDay() <= 5 ? 'market day' : 'market closed (weekend)'}.</p>
        </div>
      )}

      {/* Open Trades */}
      {openTrades.length > 0 && (
        <div className="card overflow-x-auto">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">🟢 Open Positions ({openTrades.length})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Side</th>
                <th className="text-right">Entry Time</th>
                <th className="text-right">Duration</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Entry ₹</th>
                <th className="text-right">LTP</th>
                <th className="text-right">Unrealized</th>
                <th className="text-right">SL</th>
                <th className="text-right">Target</th>
                <th>Strategy</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map(t => {
                const ltp = priceMap.get(t.symbol) || t.entryPrice;
                const unrealized = t.side === 'BUY'
                  ? (ltp - t.entryPrice) * t.quantity
                  : (t.entryPrice - ltp) * t.quantity;
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="font-semibold">{t.symbol}</div>
                      <div className="text-[10px] text-[var(--text-muted)] max-w-[120px] truncate">{t.name}</div>
                    </td>
                    <td><span className={`badge text-[9px] ${t.type === 'F&O' ? 'badge-purple' : 'badge-blue'}`}>{t.type}</span></td>
                    <td><span className={`badge ${t.side === 'BUY' ? 'badge-green' : 'badge-red'}`}>{t.side}</span></td>
                    <td className="text-right font-mono text-xs">{formatTime(t.entryTime)}</td>
                    <td className="text-right font-mono text-xs text-[var(--text-secondary)]">{duration(t.entryTime)}</td>
                    <td className="text-right font-mono">{t.quantity}</td>
                    <td className="text-right font-mono">₹{t.entryPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="text-right font-mono font-semibold">₹{ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className={`text-right font-mono font-bold ${unrealized >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {unrealized >= 0 ? '+' : ''}₹{Math.round(unrealized).toLocaleString('en-IN')}
                    </td>
                    <td className="text-right font-mono text-[var(--red)] text-xs">₹{t.stopLoss.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                    <td className="text-right font-mono text-[var(--green)] text-xs">₹{t.target.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                    <td className="text-xs">{t.strategy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Closed Trades */}
      {closedTrades.length > 0 && (
        <div className="card overflow-x-auto">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">📋 Trade History ({closedTrades.length})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Side</th>
                <th className="text-center">Result</th>
                <th className="text-right">Entry</th>
                <th className="text-right">Exit</th>
                <th className="text-right">Duration</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Entry ₹</th>
                <th className="text-right">Exit ₹</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Charges</th>
                <th className="text-right">Net P&L</th>
                <th>Strategy</th>
              </tr>
            </thead>
            <tbody>
              {closedTrades.map(t => (
                <tr key={t.id}>
                  <td>
                    <div className="font-semibold">{t.symbol}</div>
                    <div className="text-[10px] text-[var(--text-muted)] max-w-[120px] truncate">{t.name}</div>
                  </td>
                  <td><span className={`badge text-[9px] ${t.type === 'F&O' ? 'badge-purple' : 'badge-blue'}`}>{t.type}</span></td>
                  <td><span className={`badge ${t.side === 'BUY' ? 'badge-green' : 'badge-red'}`}>{t.side}</span></td>
                  <td className="text-center">
                    <span className={`badge text-[9px] ${t.status === 'TARGET_HIT' ? 'badge-green' : t.status === 'SL_HIT' ? 'badge-red' : 'badge-amber'}`}>
                      {t.status === 'TARGET_HIT' ? '✓ Target' : t.status === 'SL_HIT' ? '✗ SL Hit' : t.status === 'EOD_EXIT' ? '⏱ EOD' : '⏱ Expired'}
                    </span>
                  </td>
                  <td className="text-right font-mono text-xs">{formatTime(t.entryTime)}</td>
                  <td className="text-right font-mono text-xs">{t.exitTime ? formatTime(t.exitTime) : '—'}</td>
                  <td className="text-right font-mono text-xs text-[var(--text-secondary)]">{duration(t.entryTime, t.exitTime)}</td>
                  <td className="text-right font-mono">{t.quantity}</td>
                  <td className="text-right font-mono">₹{t.entryPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="text-right font-mono font-semibold">₹{(t.exitPrice ?? t.entryPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className={`text-right font-mono ${(t.grossPnl ?? 0) >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {(t.grossPnl ?? 0) >= 0 ? '+' : ''}₹{(t.grossPnl ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td className="text-right font-mono text-[var(--red)] text-xs">-₹{t.brokerage ?? 0}</td>
                  <td className={`text-right font-mono font-bold ${(t.netPnl ?? 0) >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {(t.netPnl ?? 0) >= 0 ? '+' : ''}₹{(t.netPnl ?? 0).toLocaleString('en-IN')}
                    <div className="text-[9px] text-[var(--text-muted)]">{t.pnlPct != null ? `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct}%` : ''}</div>
                  </td>
                  <td className="text-xs">{t.strategy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
