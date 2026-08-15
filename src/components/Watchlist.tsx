import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { watchlist } from '../data/mockData';

export function Watchlist() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card p-4 overflow-hidden"
    >
      <h2 className="text-sm font-semibold text-gray-300 mb-3">📊 Watchlist (NSE)</h2>
      <div className="space-y-1 max-h-[380px] overflow-y-auto">
        {watchlist.map((s) => (
          <div
            key={s.symbol}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{s.symbol}</span>
              <span className="text-[10px] text-gray-500">{s.name}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-mono">₹{s.ltp.toLocaleString()}</span>
              <span className={`text-xs flex items-center gap-0.5 ${s.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {s.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {s.change >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
