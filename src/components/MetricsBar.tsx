import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, Zap } from 'lucide-react';
import { portfolioMetrics } from '../data/mockData';

const metrics = [
  { label: 'Portfolio Value', value: `₹${(portfolioMetrics.totalValue / 100000).toFixed(2)}L`, icon: BarChart3, color: 'text-blue-400' },
  { label: 'Total Return', value: `+${portfolioMetrics.totalReturnPct}%`, icon: TrendingUp, color: 'text-green-400' },
  { label: "Today's P&L", value: `+₹${portfolioMetrics.todayPnl.toLocaleString()}`, icon: Activity, color: 'text-green-400' },
  { label: 'Win Rate', value: `${portfolioMetrics.winRate}%`, icon: Target, color: 'text-purple-400' },
  { label: 'Sharpe Ratio', value: portfolioMetrics.sharpeRatio.toFixed(2), icon: Zap, color: 'text-amber-400' },
  { label: 'Max Drawdown', value: `${portfolioMetrics.maxDrawdown}%`, icon: TrendingDown, color: 'text-red-400' },
];

export function MetricsBar() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass-card p-4 flex flex-col gap-1"
        >
          <div className="flex items-center gap-2">
            <m.icon size={14} className={m.color} />
            <span className="text-xs text-gray-400">{m.label}</span>
          </div>
          <span className={`text-lg font-bold ${m.color}`}>{m.value}</span>
        </motion.div>
      ))}
    </div>
  );
}
