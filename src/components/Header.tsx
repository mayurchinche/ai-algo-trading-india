import type { LiveStock } from '../services/liveData';

interface HeaderProps {
  activeTab: string;
  onTabChange: (t: string) => void;
  nifty: LiveStock | null;
  lastUpdated: Date | null;
}

export function Header({ activeTab, onTabChange, nifty }: HeaderProps) {
  const now = new Date();
  const h = now.getHours();
  const marketOpen = h >= 9 && (h < 15 || (h === 15 && now.getMinutes() <= 30));
  const tabs = ['AI Discovery', 'Smart Picks', 'Overview', 'Trades', 'Stock Analysis', 'Signals', 'Backtest', 'IPO Tracker', 'Metals'];

  return (
    <header className="bg-white border-b border-[var(--border)]">
      <div className="flex items-center justify-between px-8 xl:px-12 py-5 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-200">AT</div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text)]" style={{ fontFamily: 'Poppins' }}>AlgoTrader AI</h1>
            <p className="text-[11px] text-[var(--text-muted)] tracking-wide">Indian Stock Market • NSE • Live Discovery</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-8">
          {nifty && (
            <div>
              <div className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">NIFTY 50</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-[var(--text)]" style={{ fontFamily: 'Poppins' }}>
                  {nifty.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
                <span className={`text-sm font-bold ${nifty.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                  {nifty.changePct >= 0 ? '+' : ''}{nifty.changePct.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

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

      <div className="px-8 xl:px-12 pb-4 max-w-[1600px] mx-auto">
        <div className="tab-bar overflow-x-auto">
          {tabs.map((t) => (
            <div key={t} className={`tab whitespace-nowrap ${activeTab === t ? 'active' : ''}`} onClick={() => onTabChange(t)}>{t}</div>
          ))}
        </div>
      </div>
    </header>
  );
}
