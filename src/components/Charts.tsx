import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { niftyIntraday, portfolioHistory } from '../data/mockData';

export function PortfolioChart() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-300">Portfolio vs Nifty 50 (30 Days)</h2>
        <span className="text-xs px-2 py-1 rounded bg-green-900/40 text-green-400">+4.86%</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={portfolioHistory}>
          <defs>
            <linearGradient id="gradPortfolio" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#448aff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#448aff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradBenchmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff9100" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ff9100" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#90a4ae' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#90a4ae' }} axisLine={false} tickLine={false} domain={['dataMin - 5000', 'dataMax + 5000']} tickFormatter={(v) => `${(v/100000).toFixed(1)}L`} />
          <Tooltip
            contentStyle={{ background: '#1a2236', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            formatter={(value) => [`₹${Number(value).toLocaleString()}`, '']}
          />
          <Area type="monotone" dataKey="value" stroke="#448aff" fill="url(#gradPortfolio)" strokeWidth={2} name="Portfolio" />
          <Area type="monotone" dataKey="benchmark" stroke="#ff9100" fill="url(#gradBenchmark)" strokeWidth={1.5} strokeDasharray="4 4" name="Nifty 50" />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function NiftyChart() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-300">NIFTY 50 Intraday</h2>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 pulse-live"></span>
          <span className="text-xs text-green-400">LIVE</span>
          <span className="text-sm font-bold text-green-400">24,856.40 (+0.63%)</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={niftyIntraday}>
          <defs>
            <linearGradient id="gradNifty" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00e676" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#90a4ae' }} axisLine={false} tickLine={false} interval={15} />
          <YAxis tick={{ fontSize: 9, fill: '#90a4ae' }} axisLine={false} tickLine={false} domain={['dataMin - 20', 'dataMax + 20']} />
          <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
          <Area type="monotone" dataKey="price" stroke="#00e676" fill="url(#gradNifty)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
      {/* Volume bars */}
      <ResponsiveContainer width="100%" height={40}>
        <BarChart data={niftyIntraday}>
          <Bar dataKey="volume" fill="rgba(68,138,255,0.3)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
