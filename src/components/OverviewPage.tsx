// ponytail: overview derived from live paper trades + live Nifty intraday
import { useState, useEffect } from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, ComposedChart, Area } from 'recharts';
import { useLiveStocks } from '../hooks/useLiveStocks';
import { useStockDiscovery } from '../hooks/useStockDiscovery';
import type { DiscoveredStock } from '../services/stockDiscovery';

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="kpi">
      <div className={`kpi-value ${color || 'text-[var(--text)]'}`}>{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className={`kpi-sub ${color || 'text-[var(--text-secondary)]'}`}>{sub}</div>}
    </div>
  );
}

// Compute portfolio from live discovered stocks (paper trading simulation)
function computePortfolio(stocks: DiscoveredStock[]) {
  const totalCapital = 1000000; // ₹10L paper trading capital
  const trades = stocks.filter(s => Math.abs(s.overallScore) >= 25);
  let totalPnl = 0, wins = 0, losses = 0;
  let largestWin = 0, largestLoss = 0;
  let investedValue = 0;

  trades.forEach(s => {
    const side = s.overallScore > 0 ? 1 : -1;
    const qty = Math.max(1, Math.floor(50000 / s.prevClose));
    const pnl = side * (s.ltp - s.prevClose) * qty;
    totalPnl += pnl;
    investedValue += s.prevClose * qty;
    if (pnl > 0) { wins++; largestWin = Math.max(largestWin, pnl); }
    else { losses++; largestLoss = Math.min(largestLoss, pnl); }
  });

  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const avgWin = wins > 0 ? Math.round(totalPnl / wins) : 0;
  const avgLoss = losses > 0 ? Math.round(totalPnl / losses) : 0;

  return {
    totalCapital,
    currentValue: totalCapital + totalPnl,
    investedValue: Math.round(investedValue),
    totalPnl: Math.round(totalPnl),
    totalPnlPct: Math.round((totalPnl / totalCapital) * 10000) / 100,
    totalTrades: trades.length,
    openPositions: trades.filter(s => {
      const target = s.foAnalysis.suggestedTarget;
      const sl = s.foAnalysis.suggestedStopLoss;
      return s.ltp < target && s.ltp > sl;
    }).length,
    winRate: Math.round(winRate * 10) / 10,
    wins, losses,
    avgWin, avgLoss,
    largestWin: Math.round(largestWin),
    largestLoss: Math.round(largestLoss),
    profitFactor: losses > 0 && avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
    sharpeRatio: trades.length > 3 ? Math.round((totalPnl / totalCapital) / 0.04 * 100) / 100 : 0,
    maxDrawdownPct: Math.round(Math.abs(largestLoss / totalCapital) * 10000) / 100,
    maxDrawdown: Math.round(Math.abs(largestLoss)),
    riskReward: trades.length > 0
      ? Math.round(trades.reduce((a, s) => a + s.foAnalysis.riskReward, 0) / trades.length * 100) / 100
      : 0,
  };
}

// Compute strategy breakdown from discovered stocks
function computeStrategyStats(stocks: DiscoveredStock[]) {
  const stratMap: Record<string, { pnl: number; trades: number; wins: number }> = {};
  stocks.filter(s => Math.abs(s.overallScore) >= 25).forEach(s => {
    const strat = s.strategies[0] || 'Multi-Strategy';
    if (!stratMap[strat]) stratMap[strat] = { pnl: 0, trades: 0, wins: 0 };
    const side = s.overallScore > 0 ? 1 : -1;
    const qty = Math.max(1, Math.floor(50000 / s.prevClose));
    const pnl = side * (s.ltp - s.prevClose) * qty;
    stratMap[strat].trades++;
    stratMap[strat].pnl += pnl;
    if (pnl > 0) stratMap[strat].wins++;
  });

  return Object.entries(stratMap)
    .map(([name, d]) => ({
      name,
      trades: d.trades,
      winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 1000) / 10 : 0,
      pnl: Math.round(d.pnl),
    }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 5);
}

// Fetch Nifty 50 intraday 5-min data from Yahoo Finance
async function fetchNiftyIntraday(): Promise<{ time: string; price: number; volume: number }[]> {
  try {
    const res = await fetch('/api/yahoo/v8/finance/chart/%5ENSEI?interval=5m&range=1d');
    if (!res.ok) return [];
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return [];
    const { timestamp } = result;
    const q = result.indicators.quote[0];
    return (timestamp || []).map((ts: number, i: number) => {
      const d = new Date(ts * 1000);
      return {
        time: `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`,
        price: q.close?.[i] ?? q.open?.[i] ?? 0,
        volume: q.volume?.[i] ?? 0,
      };
    }).filter((p: any) => p.price > 0);
  } catch { return []; }
}

export function OverviewPage() {
  const { nifty } = useLiveStocks();
  const { stocks, loading: stocksLoading } = useStockDiscovery();
  const [niftyIntraday, setNiftyIntraday] = useState<{ time: string; price: number; volume: number }[]>([]);

  useEffect(() => { fetchNiftyIntraday().then(setNiftyIntraday); }, []);

  const portfolio = computePortfolio(stocks);
  const strategyStats = computeStrategyStats(stocks);
  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="kpi-card gold"><KPI label="Portfolio Value" value={`₹${(portfolio.currentValue / 100000).toFixed(2)}L`} sub={`of ₹${(portfolio.totalCapital / 100000).toFixed(0)}L capital`} /></div>
        <div className="kpi-card green"><KPI label="Today's P&L" value={`${portfolio.totalPnl >= 0 ? '+' : ''}₹${(portfolio.totalPnl / 1000).toFixed(1)}K`} sub={`${portfolio.totalPnlPct >= 0 ? '+' : ''}${portfolio.totalPnlPct}%`} color={portfolio.totalPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'} /></div>
        <div className="kpi-card blue"><KPI label="Win Rate" value={`${portfolio.winRate}%`} sub={`${portfolio.totalTrades} trades`} color="text-blue-400" /></div>
        <div className="kpi-card gold"><KPI label="Sharpe Ratio" value={portfolio.sharpeRatio.toFixed(2)} sub="session" color="text-amber-400" /></div>
        <div className="kpi-card purple"><KPI label="Profit Factor" value={portfolio.profitFactor.toFixed(2)} sub="gross W/L" color="text-purple-400" /></div>
        <div className="kpi-card red"><KPI label="Max Drawdown" value={`${portfolio.maxDrawdownPct}%`} sub={`₹${(portfolio.maxDrawdown / 1000).toFixed(1)}K`} color="text-[var(--red)]" /></div>
        <div className="kpi-card blue"><KPI label="Avg R:R" value={portfolio.riskReward.toFixed(2)} sub={`${portfolio.openPositions} open`} /></div>
        <div className="kpi-card green"><KPI label="Win / Loss" value={`${portfolio.wins} / ${portfolio.losses}`} sub="today" /></div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Per-stock P&L */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Today's Paper Trade P&L (Live)</h3>
            <span className={`badge ${portfolio.totalPnl >= 0 ? 'badge-green' : 'badge-red'}`}>
              {portfolio.totalPnl >= 0 ? '+' : ''}₹{portfolio.totalPnl.toLocaleString()}
            </span>
          </div>
          {stocksLoading && stocks.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--text-muted)]">Discovering stocks...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stocks.filter(s => Math.abs(s.overallScore) >= 25).map(s => {
                const side = s.overallScore > 0 ? 1 : -1;
                const qty = Math.max(1, Math.floor(50000 / s.prevClose));
                const pnl = Math.round(side * (s.ltp - s.prevClose) * qty);
                return { symbol: s.symbol, pnl };
              }).sort((a, b) => b.pnl - a.pnl)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="symbol" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'P&L']} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {stocks.filter(s => Math.abs(s.overallScore) >= 25).map((s, i) => {
                    const side = s.overallScore > 0 ? 1 : -1;
                    const pnl = side * (s.ltp - s.prevClose);
                    return <rect key={i} fill={pnl >= 0 ? '#22C55E' : '#EF4444'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Score distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">AI Score Distribution (Live Scan)</h3>
            <span className="text-[10px] text-[var(--text-secondary)]">{stocks.length} stocks analyzed</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stocks.slice(0, 20).map(s => ({ symbol: s.symbol, score: s.overallScore })).sort((a, b) => b.score - a.score)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="symbol" tick={{ fontSize: 8, fill: '#64748B' }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {stocks.slice(0, 20).sort((a, b) => b.overallScore - a.overallScore).map((s, i) => (
                  <rect key={i} fill={s.overallScore > 30 ? '#22C55E' : s.overallScore > 0 ? '#3B82F6' : s.overallScore > -30 ? '#F59E0B' : '#EF4444'} />
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
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">NIFTY 50 Intraday</h3>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse"></span>
              {nifty ? (
                <>
                  <span className="text-sm font-bold text-[var(--text)]" style={{ fontFamily: 'Poppins' }}>
                    {nifty.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-xs font-bold ${nifty.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {nifty.changePct >= 0 ? '+' : ''}{nifty.changePct.toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">Loading...</span>
              )}
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
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} interval={15} />
              <YAxis yAxisId="price" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} domain={['dataMin - 20', 'dataMax + 20']} />
              <YAxis yAxisId="vol" orientation="right" tick={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1A202C', borderRadius: 8, fontSize: 11 }} />
              <Bar yAxisId="vol" dataKey="volume" fill="rgba(59,130,246,0.1)" radius={[1, 1, 0, 0]} />
              <Area yAxisId="price" type="monotone" dataKey="price" stroke="#3B82F6" fill="url(#gNifty)" strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Strategy Performance */}
        <div className="card">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Strategy Performance (Live)</h3>
          {strategyStats.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--text-muted)]">Waiting for trades...</div>
          ) : (
            <div className="space-y-5">
              {strategyStats.map((s) => (
                <div key={s.name} className="p-3 rounded-lg bg-[var(--bg-alt)] border border-[var(--border)]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-medium">{s.name}</span>
                    <span className={`text-xs font-bold ${s.pnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {s.pnl >= 0 ? '+' : ''}₹{(s.pnl / 1000).toFixed(1)}K
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--text-secondary)]">
                    <div>Win Rate: <span className="text-[var(--text)] font-medium">{s.winRate}%</span></div>
                    <div>Trades: <span className="text-[var(--text)] font-medium">{s.trades}</span></div>
                  </div>
                  <div className="progress-bar mt-2">
                    <div className="progress-fill bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${s.winRate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Portfolio details */}
      <div className="card">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Paper Trading Summary (Live)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
          <div><span className="text-[var(--text-secondary)]">Capital Deployed</span><div className="font-medium">₹{(portfolio.investedValue / 1000).toFixed(0)}K</div></div>
          <div><span className="text-[var(--text-secondary)]">Available Margin</span><div className="font-medium">₹{((portfolio.totalCapital - portfolio.investedValue) / 100000).toFixed(2)}L</div></div>
          <div><span className="text-[var(--text-secondary)]">P&L</span><div className={`font-medium ${portfolio.totalPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>{portfolio.totalPnl >= 0 ? '+' : ''}₹{portfolio.totalPnl.toLocaleString()}</div></div>
          <div><span className="text-[var(--text-secondary)]">Open Positions</span><div className="font-medium">{portfolio.openPositions}</div></div>
          <div><span className="text-[var(--text-secondary)]">Largest Win</span><div className="font-medium text-[var(--green)]">+₹{portfolio.largestWin.toLocaleString()}</div></div>
          <div><span className="text-[var(--text-secondary)]">Largest Loss</span><div className="font-medium text-[var(--red)]">₹{portfolio.largestLoss.toLocaleString()}</div></div>
          <div><span className="text-[var(--text-secondary)]">Stocks Analyzed</span><div className="font-medium">{stocks.length}</div></div>
          <div><span className="text-[var(--text-secondary)]">Conviction Trades</span><div className="font-medium">{portfolio.totalTrades} (score ≥ 25)</div></div>
          <div><span className="text-[var(--text-secondary)]">Mode</span><div className="font-medium text-amber-500">📋 Paper Trading</div></div>
          <div><span className="text-[var(--text-secondary)]">Data Source</span><div className="font-medium">Yahoo Finance (Live)</div></div>
          <div><span className="text-[var(--text-secondary)]">Strategies</span><div className="font-medium">{strategyStats.length} active</div></div>
          <div><span className="text-[var(--text-secondary)]">Market</span><div className="font-medium">NSE India</div></div>
        </div>
      </div>
    </div>
  );
}
