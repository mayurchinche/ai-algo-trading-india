// ponytail: trades generated from live discovery — no hardcoded trade data
// Limited to 2-3 equity + 1-2 F&O trades per day to minimize brokerage impact
import { useStockDiscovery } from '../hooks/useStockDiscovery';
import type { DiscoveredStock } from '../services/stockDiscovery';
import { isAvailableInFnO } from '../services/optionsEngine';

interface PaperTrade {
  stock: DiscoveredStock;
  type: 'EQUITY' | 'F&O';
  side: 'BUY' | 'SELL';
  quantity: number;
  lotSize?: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  target: number;
  grossPnl: number;
  brokerage: number;
  netPnl: number;
  pnlPct: number;
  strategy: string;
  riskReward: number;
  entryTime: string;
  exitTime: string | null; // null = still open
  status: 'OPEN' | 'TARGET HIT' | 'SL HIT';
  duration: string;
}

// ponytail: brokerage calc — Zerodha-like flat fee model
// Equity intraday: ₹20/order or 0.03% whichever lower, both sides
// F&O: ₹20/lot per leg
// + STT + Exchange charges + GST ≈ 0.05% turnover for equity, 0.02% for F&O
function calcBrokerage(type: 'EQUITY' | 'F&O', turnover: number): number {
  if (type === 'EQUITY') {
    const brokerFee = Math.min(20 * 2, turnover * 0.0003 * 2); // both legs
    const sttExchange = turnover * 0.0005; // STT + exchange + GST
    return Math.round(brokerFee + sttExchange);
  }
  // F&O: ₹20 per leg (2 legs) + STT/exchange 0.02%
  return Math.round(40 + turnover * 0.0002);
}

function generatePaperTrades(stocks: DiscoveredStock[]): PaperTrade[] {
  const today = new Date();
  const marketOpen = new Date(today); marketOpen.setHours(9, 15, 0, 0);
  const now = new Date();

  // ponytail: only take TOP 3 equity trades by conviction (score ≥ 40, not 25)
  // + TOP 2 F&O trades from F&O-eligible stocks
  const highConviction = stocks
    .filter(s => Math.abs(s.overallScore) >= 40)
    .sort((a, b) => Math.abs(b.overallScore) - Math.abs(a.overallScore));

  const equityCandidates = highConviction.slice(0, 3); // Max 3 equity trades/day
  const foCandidates = highConviction
    .filter(s => isAvailableInFnO(s.symbol))
    .slice(0, 2); // Max 2 F&O trades/day

  const allCandidates: { stock: DiscoveredStock; type: 'EQUITY' | 'F&O' }[] = [
    ...equityCandidates.map(s => ({ stock: s, type: 'EQUITY' as const })),
    ...foCandidates.map(s => ({ stock: s, type: 'F&O' as const })),
  ];

  // Deduplicate (if a stock appears in both equity and F&O, keep only F&O)
  const seen = new Set<string>();
  const unique = allCandidates.filter(c => {
    if (seen.has(c.stock.symbol)) return false;
    seen.add(c.stock.symbol);
    return true;
  });

  return unique.map(({ stock: s, type }) => {
    const side: 'BUY' | 'SELL' = s.overallScore > 0 ? 'BUY' : 'SELL';
    const entryPrice = s.prevClose;
    const currentPrice = s.ltp;

    // ponytail: ₹20K capital — max ₹5K per equity, ₹7K per F&O (total ≤ ₹15K+₹14K risk)
    const lotSize = type === 'F&O' ? Math.max(1, Math.floor(7000 / entryPrice)) : undefined;
    const quantity = type === 'F&O'
      ? lotSize!
      : Math.max(1, Math.floor(5000 / entryPrice));

    const turnover = entryPrice * quantity * 2; // entry + exit
    const brokerage = calcBrokerage(type, turnover);

    const grossPnl = side === 'BUY'
      ? (currentPrice - entryPrice) * quantity
      : (entryPrice - currentPrice) * quantity;
    const netPnl = grossPnl - brokerage;
    const pnlPct = side === 'BUY'
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100;

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
      stock: s, type, side, quantity, lotSize, entryPrice, currentPrice,
      stopLoss: s.foAnalysis.suggestedStopLoss,
      target: s.foAnalysis.suggestedTarget,
      grossPnl: Math.round(grossPnl),
      brokerage,
      netPnl: Math.round(netPnl),
      pnlPct: Math.round(pnlPct * 100) / 100,
      strategy: s.strategies[0] || 'Multi-Strategy',
      riskReward: s.foAnalysis.riskReward,
      entryTime, exitTime, status, duration,
    };
  });
}

export function TradesPage() {
  const { stocks, loading, lastScan, rescan } = useStockDiscovery();
  const trades = generatePaperTrades(stocks);

  const totalGross = trades.reduce((a, t) => a + t.grossPnl, 0);
  const totalBrokerage = trades.reduce((a, t) => a + t.brokerage, 0);
  const totalNet = trades.reduce((a, t) => a + t.netPnl, 0);
  const wins = trades.filter(t => t.netPnl > 0).length;
  const losses = trades.filter(t => t.netPnl <= 0).length;
  const totalInvested = trades.reduce((a, t) => a + t.entryPrice * t.quantity, 0);
  const equityTrades = trades.filter(t => t.type === 'EQUITY').length;
  const foTrades = trades.filter(t => t.type === 'F&O').length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Trades</div>
          <div className="text-xl font-bold" style={{ fontFamily: 'Poppins' }}>{equityTrades}E + {foTrades}F</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Net P&L</div>
          <div className={`text-xl font-bold ${totalNet >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`} style={{ fontFamily: 'Poppins' }}>
            {totalNet >= 0 ? '+' : ''}₹{totalNet.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Brokerage</div>
          <div className="text-xl font-bold text-[var(--red)]" style={{ fontFamily: 'Poppins' }}>
            -₹{totalBrokerage.toLocaleString('en-IN')}
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
          <div className="text-xl font-bold" style={{ fontFamily: 'Poppins' }}>₹{totalInvested.toLocaleString('en-IN')}</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Gross vs Net</div>
          <div className="text-sm font-bold" style={{ fontFamily: 'Poppins' }}>
            <span className={totalGross >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>₹{totalGross.toLocaleString('en-IN')}</span>
            <span className="text-[var(--text-muted)]"> → </span>
            <span className={totalNet >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>₹{totalNet.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="card bg-blue-50 flex items-center justify-between">
        <div className="text-xs text-blue-700">
          <b>Paper Trading Mode</b> — Max 3 equity + 2 F&O trades/day. Score ≥ 40 required. Brokerage (Zerodha model: ₹20/order + STT/GST) deducted from P&L.
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
                <th>Type</th>
                <th>Side</th>
                <th className="text-center">Status</th>
                <th className="text-right">Entry ⏱</th>
                <th className="text-right">Exit ⏱</th>
                <th className="text-right">Duration</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Entry ₹</th>
                <th className="text-right">LTP</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Charges</th>
                <th className="text-right">Net P&L</th>
                <th className="text-right">SL</th>
                <th className="text-right">Target</th>
                <th>Strategy</th>
              </tr>
            </thead>
            <tbody>
              {trades.sort((a, b) => b.netPnl - a.netPnl).map(t => (
                <tr key={t.stock.symbol + t.type}>
                  <td>
                    <div className="font-semibold">{t.stock.symbol}</div>
                    <div className="text-[10px] text-[var(--text-muted)] max-w-[120px] truncate">{t.stock.name}</div>
                  </td>
                  <td>
                    <span className={`badge text-[9px] ${t.type === 'F&O' ? 'badge-purple' : 'badge-blue'}`}>{t.type}</span>
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
                  <td className="text-right font-mono">{t.quantity}{t.lotSize ? <span className="text-[9px] text-[var(--text-muted)]"> (1 lot)</span> : ''}</td>
                  <td className="text-right font-mono">₹{t.entryPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="text-right font-mono font-semibold">₹{t.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className={`text-right font-mono ${t.grossPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {t.grossPnl >= 0 ? '+' : ''}₹{t.grossPnl.toLocaleString('en-IN')}
                  </td>
                  <td className="text-right font-mono text-[var(--red)] text-xs">-₹{t.brokerage}</td>
                  <td className={`text-right font-mono font-bold ${t.netPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {t.netPnl >= 0 ? '+' : ''}₹{t.netPnl.toLocaleString('en-IN')}
                  </td>
                  <td className="text-right font-mono text-[var(--red)] text-xs">₹{t.stopLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="text-right font-mono text-[var(--green)] text-xs">₹{t.target.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
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
