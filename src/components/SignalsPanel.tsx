import { motion } from 'framer-motion';
import { ArrowUpCircle, ArrowDownCircle, MinusCircle } from 'lucide-react';
import { activeSignals } from '../data/mockData';

const directionConfig = {
  BUY: { icon: ArrowUpCircle, color: 'text-green-400', bg: 'bg-green-900/30' },
  SELL: { icon: ArrowDownCircle, color: 'text-red-400', bg: 'bg-red-900/30' },
  HOLD: { icon: MinusCircle, color: 'text-gray-400', bg: 'bg-gray-800/30' },
};

export function SignalsPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25 }}
      className="glass-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">🤖 AI Signals (Live)</h2>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-400 pulse-live"></span>
          <span className="text-[10px] text-purple-400">ENGINE ACTIVE</span>
        </span>
      </div>
      <div className="space-y-2">
        {activeSignals.map((signal) => {
          const cfg = directionConfig[signal.direction];
          return (
            <div key={signal.symbol + signal.timestamp} className={`p-3 rounded-xl ${cfg.bg} border border-white/5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <cfg.icon size={16} className={cfg.color} />
                  <span className="font-semibold text-sm">{signal.symbol}</span>
                  <span className={`text-xs font-bold ${cfg.color}`}>{signal.direction}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${signal.confidence > 0.7 ? 'bg-green-400' : signal.confidence > 0.6 ? 'bg-amber-400' : 'bg-gray-400'}`}
                      style={{ width: `${signal.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{(signal.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{signal.reason}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-500">{signal.strategy}</span>
                <span className="text-[10px] text-gray-500">{signal.timestamp.slice(11, 16)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
