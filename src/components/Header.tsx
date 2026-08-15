import { portfolio } from '../data/mockData';

export function Header({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  const now = new Date();
  const h = now.getHours();
  const marketOpen = h >= 9 && (h < 15 || (h === 15 && now.getMinutes() <= 30));
  const tabs = ['Smart Picks', 'Overview', 'Trades', 'Stock Analysis', 'Signals', 'Metals'];

  return (
    <header className="bg-white border-b border-[var(--border)]">
      <div className="flex items-center justify-between px-6 py-4 max-w-[1400px] mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-blue-200">AT</div>
          <div>
            <h1 className="text-base font-bold text-[var(--text)]" style={{ fontFamily: 'Poppins' }}>AlgoTrader AI</h1>
            <p className="text-xs text-[var(--text-muted)]">Indian Stock Market • NSE</p>
          </div>
        </div>

        {/* Quick metrics */}
        <div className="hidden lg:flex items-center gap-8">
          <div>
            <div className="text-xs text-[var(--text-muted)] font-medium">Portfolio</div>
            <div className="text-base font-bold text-[var(--text)]" style={{ fontFamily: 'Poppins' }}>₹{(portfolio.currentValue / 100000).toFixed(2)}L</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)] font-medium">Today</div>
            <div className={`text-base font-bold ${portfolio.todayPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`} style={{ fontFamily: 'Poppins' }}>
              {portfolio.todayPnl >= 0 ? '+' : ''}₹{portfolio.todayPnl.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)] font-medium">Total P&L</div>
            <div className={`text-base font-bold ${portfolio.totalPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`} style={{ fontFamily: 'Poppins' }}>
              +₹{portfolio.totalPnl.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)] font-medium">Win Rate</div>
            <div className="text-base font-bold text-[var(--blue)]" style={{ fontFamily: 'Poppins' }}>{portfolio.winRate}%</div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)] font-medium">
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className={`badge ${marketOpen ? 'badge-green' : 'badge-red'}`}>
            <span className={`w-2 h-2 rounded-full ${marketOpen ? 'bg-[var(--green)] pulse' : 'bg-[var(--red)]'}`}></span>
            {marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </span>
          <span className="badge badge-purple">📄 PAPER MODE</span>
        </div>
      </div>

      {/* Tabs — pill style */}
      <div className="px-6 pb-3 max-w-[1400px] mx-auto">
        <div className="tab-bar">
          {tabs.map((t) => (
            <div key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => onTabChange(t)}>
              {t}
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
