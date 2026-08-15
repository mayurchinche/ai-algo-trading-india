import { motion } from 'framer-motion';
import { strategyPerformance } from '../data/mockData';

export function StrategyBreakdown() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card p-4"
    >
      <h2 className="text-sm font-semibold text-gray-300 mb-3">⚡ Strategy Performance</h2>
      <div className="space-y-3">
        {strategyPerformance.map((s) => (
          <div key={s.name} className="p-3 rounded-xl bg-white/3 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{s.name}</span>
              <span className={`text-sm font-bold ${s.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                +₹{s.pnl.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>Trades: <strong className="text-gray-200">{s.trades}</strong></span>
              <span>Win Rate: <strong className="text-green-400">{s.winRate}%</strong></span>
              <span>Sharpe: <strong className="text-amber-400">{s.sharpe}</strong></span>
            </div>
            {/* Win rate bar */}
            <div className="mt-2 w-full h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                style={{ width: `${s.winRate}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
