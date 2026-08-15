import { portfolio, dailyPnl, strategyStats, niftyIntraday } from '../data/mockData';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, ComposedChart } from 'recharts';

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="kpi">
      <div className={`kpi-value ${color || 'text-white'}`}>{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className={`kpi-sub ${color || 'text-[var(--muted-foreground)]'}`}>{sub}</div>}
    </div>
  );
}

export function OverviewPage() {
  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="kpi-card gold"><KPI label="Portfolio Value" value={`₹${(portfolio.currentValue / 100000).toFixed(2)}L`} sub={`of ₹${(portfolio.totalCapital / 100000).toFixed(0)}L capital`} /></div>
        <div className="kpi-card green"><KPI label="Total P&L" value={`+₹${(portfolio.totalPnl / 1000).toFixed(1)}K`} sub={`+${portfolio.totalPnlPct}%`} color="text-[var(--green)]" /></div>
        <div className="kpi-card green"><KPI label="Today's P&L" value={`+₹${(portfolio.todayPnl / 1000).toFixed(1)}K`} sub={`+${portfolio.todayPnlPct}%`} color="text-[var(--green)]" /></div>
        <div className="kpi-card blue"><KPI label="Win Rate" value={`${portfolio.winRate}%`} sub={`${portfolio.totalTrades} trades`} color="text-blue-400" /></div>
        <div className="kpi-card gold"><KPI label="Sharpe Ratio" value={portfolio.sharpeRatio.toFixed(2)} sub="annualized" color="text-amber-400" /></div>
        <div className="kpi-card purple"><KPI label="Profit Factor" value={portfolio.profitFactor.toFixed(2)} sub="gross W/L" color="text-purple-400" /></div>
        <div className="kpi-card red"><KPI label="Max Drawdown" value={`${portfolio.maxDrawdownPct}%`} sub={`₹${(portfolio.maxDrawdown / 1000).toFixed(1)}K`} color="text-[var(--red)]" /></div>
        <div className="kpi-card blue"><KPI label="Avg R:R" value={portfolio.riskRewardRatio.toFixed(2)} sub={portfolio.avgHoldingPeriod} /></div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cumulative P&L */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Cumulative P&L (26 Trading Days)</h3>
            <span className="badge badge-green">+₹72,840</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyPnl}>
              <defs>
                <linearGradient id="gCum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#0E1223', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`₹${Number(v).toLocaleString()}`, '']} />
              <Area type="monotone" dataKey="cumulative" stroke="#22C55E" fill="url(#gCum)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Daily P&L bars */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Daily P&L</h3>
            <span className="text-[10px] text-[var(--muted-foreground)]">{portfolio.profitableDays}/{portfolio.tradingDays} profitable days</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyPnl}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(8)} />
              <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#0E1223', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`₹${Number(v).toLocaleString()}`, '']} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]} fill="#3B82F6">
                {dailyPnl.map((entry, i) => (
                  <rect key={i} fill={entry.pnl >= 0 ? '#22C55E' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* NIFTY Live */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">NIFTY 50 Intraday</h3>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse"></span>
              <span className="text-sm font-bold text-[var(--green)]">24,856.40</span>
              <span className="text-xs text-[var(--green)]">+0.63%</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={niftyIntraday}>
              <defs>
                <linearGradient id="gNifty" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.2)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={15} />
              <YAxis yAxisId="price" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={['dataMin - 20', 'dataMax + 20']} />
              <YAxis yAxisId="vol" orientation="right" tick={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0E1223', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar yAxisId="vol" dataKey="volume" fill="rgba(59,130,246,0.1)" radius={[1, 1, 0, 0]} />
              <Area yAxisId="price" type="monotone" dataKey="price" stroke="#3B82F6" fill="url(#gNifty)" strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Strategy Performance */}
        <div className="card">
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Strategy Performance</h3>
          <div className="space-y-3">
            {strategyStats.map((s) => (
              <div key={s.name} className="p-3 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-medium">{s.name}</span>
                  <span className="text-xs font-bold text-[var(--green)]">+₹{(s.pnl / 1000).toFixed(1)}K</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-[var(--muted-foreground)]">
                  <div>WR: <span className="text-white font-medium">{s.winRate}%</span></div>
                  <div>Sharpe: <span className="text-amber-400 font-medium">{s.sharpe}</span></div>
                  <div>DD: <span className="text-red-400 font-medium">{s.maxDD}%</span></div>
                </div>
                <div className="progress-bar mt-2">
                  <div className="progress-fill bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${s.winRate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio details */}
      <div className="card">
        <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Portfolio Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
          <div><span className="text-[var(--muted-foreground)]">Invested</span><div className="font-medium">₹{(portfolio.investedValue / 1000).toFixed(0)}K</div></div>
          <div><span className="text-[var(--muted-foreground)]">Available Margin</span><div className="font-medium">₹{(portfolio.availableMargin / 100000).toFixed(2)}L</div></div>
          <div><span className="text-[var(--muted-foreground)]">Realized P&L</span><div className="font-medium text-[var(--green)]">+₹{portfolio.realizedPnl.toLocaleString()}</div></div>
          <div><span className="text-[var(--muted-foreground)]">Unrealized P&L</span><div className="font-medium text-[var(--green)]">+₹{portfolio.unrealizedPnl.toLocaleString()}</div></div>
          <div><span className="text-[var(--muted-foreground)]">Avg Win / Loss</span><div className="font-medium">₹{portfolio.avgWin} / ₹{Math.abs(portfolio.avgLoss)}</div></div>
          <div><span className="text-[var(--muted-foreground)]">Best / Worst</span><div className="font-medium"><span className="text-[var(--green)]">+₹{portfolio.largestWin.toLocaleString()}</span> / <span className="text-[var(--red)]">-₹{Math.abs(portfolio.largestLoss).toLocaleString()}</span></div></div>
          <div><span className="text-[var(--muted-foreground)]">Consec. Wins</span><div className="font-medium">{portfolio.consecutiveWins}</div></div>
          <div><span className="text-[var(--muted-foreground)]">Consec. Losses</span><div className="font-medium text-[var(--red)]">{portfolio.consecutiveLosses}</div></div>
          <div><span className="text-[var(--muted-foreground)]">Open Positions</span><div className="font-medium">{portfolio.openPositions}</div></div>
          <div><span className="text-[var(--muted-foreground)]">Avg Trades/Day</span><div className="font-medium">{portfolio.avgTradesPerDay}</div></div>
          <div><span className="text-[var(--muted-foreground)]">Profitable Days</span><div className="font-medium">{portfolio.profitableDays}/{portfolio.tradingDays} ({((portfolio.profitableDays/portfolio.tradingDays)*100).toFixed(0)}%)</div></div>
          <div><span className="text-[var(--muted-foreground)]">Trading Since</span><div className="font-medium">14 Jul 2026</div></div>
        </div>
      </div>
    </div>
  );
}
