import { portfolio } from '../data/mockData';

export function Header({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  const now = new Date();
  const h = now.getHours();
  const marketOpen = h >= 9 && (h < 15 || (h === 15 && now.getMinutes() <= 30));

  const tabs = ['Smart Picks', 'Overview', 'Trades', 'Stock Analysis', 'Signals'];

  return (
    <header className="border-b border-[var(--border)] bg-[var(--primary)]">
      <div className="flex items-center justify-between px-5 py-3">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">AT</div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">AlgoTrader AI</h1>
            <p className="text-[10px] text-[var(--muted-foreground)]">Indian Stock Market • NSE</p>
          </div>
        </div>

        {/* Center: Quick stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center">
            <div className="text-xs text-[var(--muted-foreground)]">Portfolio</div>
            <div className="text-sm font-bold text-white">₹{(portfolio.currentValue / 100000).toFixed(2)}L</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[var(--muted-foreground)]">Today</div>
            <div className={`text-sm font-bold ${portfolio.todayPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
              {portfolio.todayPnl >= 0 ? '+' : ''}₹{portfolio.todayPnl.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[var(--muted-foreground)]">Total P&L</div>
            <div className={`text-sm font-bold ${portfolio.totalPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
              +₹{portfolio.totalPnl.toLocaleString()} ({portfolio.totalPnlPct}%)
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[var(--muted-foreground)]">Win Rate</div>
            <div className="text-sm font-bold text-white">{portfolio.winRate}%</div>
          </div>
        </div>

        {/* Right: Status */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--muted-foreground)]">
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className={`badge ${marketOpen ? 'badge-green' : 'badge-red'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-[var(--green)] pulse' : 'bg-[var(--red)]'}`}></span>
            {marketOpen ? 'LIVE' : 'CLOSED'}
          </span>
          <span className="badge badge-purple">PAPER</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar px-5">
        {tabs.map((t) => (
          <div key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => onTabChange(t)}>
            {t}
          </div>
        ))}
      </div>
    </header>
  );
}
