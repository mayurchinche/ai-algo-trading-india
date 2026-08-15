import { motion } from 'framer-motion';
import { recentTrades } from '../data/mockData';

const statusStyles: Record<string, string> = {
  OPEN: 'bg-blue-900/40 text-blue-400',
  CLOSED_PROFIT: 'bg-green-900/40 text-green-400',
  CLOSED_LOSS: 'bg-red-900/40 text-red-400',
  CLOSED_SL: 'bg-red-900/40 text-red-400',
};

const statusLabels: Record<string, string> = {
  OPEN: '● OPEN',
  CLOSED_PROFIT: '✓ PROFIT',
  CLOSED_LOSS: '✗ LOSS',
  CLOSED_SL: '⚡ SL HIT',
};

export function TradeLog() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="glass-card p-4"
    >
      <h2 className="text-sm font-semibold text-gray-300 mb-3">📋 Trade Log</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-white/5">
              <th className="text-left py-2 px-2">Time</th>
              <th className="text-left py-2 px-2">Symbol</th>
              <th className="text-left py-2 px-2">Side</th>
              <th className="text-right py-2 px-2">Entry</th>
              <th className="text-right py-2 px-2">SL</th>
              <th className="text-right py-2 px-2">TP</th>
              <th className="text-right py-2 px-2">P&L</th>
              <th className="text-left py-2 px-2">Strategy</th>
              <th className="text-center py-2 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentTrades.map((t) => (
              <tr key={t.id} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                <td className="py-2 px-2 text-gray-400">{t.timestamp.slice(5, 16)}</td>
                <td className="py-2 px-2 font-medium">{t.symbol}</td>
                <td className={`py-2 px-2 font-bold ${t.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{t.side}</td>
                <td className="py-2 px-2 text-right font-mono">₹{t.entryPrice.toLocaleString()}</td>
                <td className="py-2 px-2 text-right font-mono text-red-400/70">₹{t.stopLoss.toLocaleString()}</td>
                <td className="py-2 px-2 text-right font-mono text-green-400/70">₹{t.takeProfit.toLocaleString()}</td>
                <td className={`py-2 px-2 text-right font-mono font-bold ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {t.pnl >= 0 ? '+' : ''}₹{t.pnl.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-gray-400">{t.strategy}</td>
                <td className="py-2 px-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyles[t.status]}`}>
                    {statusLabels[t.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
