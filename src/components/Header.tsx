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
    <header className="sticky top-0 z-50 glass border-b border-[rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between px-8 xl:px-12 py-4 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">AT</div>
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--text)]" style={{ fontFamily: 'Poppins', letterSpacing: '-0.01em' }}>AlgoTrader AI</h1>
            <p className="text-[11px] text-[var(--text-muted)]">NSE • Live Discovery • Paper Mode</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6">
          {nifty && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[rgba(0,0,0,0.02)]">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">NIFTY 50</span>
              <span className="text-[15px] font-bold text-[var(--text)]" style={{ fontFamily: 'Poppins', letterSpacing: '-0.02em' }}>
                {nifty.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-semibold ${nifty.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                {nifty.changePct >= 0 ? '↑' : '↓'} {Math.abs(nifty.changePct).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--text-muted)]">
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium ${marketOpen ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-green-500 pulse' : 'bg-red-400'}`}></span>
            {marketOpen ? 'Live' : 'Closed'}
          </div>
        </div>
      </div>

      <div className="px-8 xl:px-12 max-w-[1600px] mx-auto">
        <div className="tab-bar overflow-x-auto">
          {tabs.map((t) => (
            <div key={t} className={`tab whitespace-nowrap ${activeTab === t ? 'active' : ''}`} onClick={() => onTabChange(t)}>{t}</div>
          ))}
        </div>
      </div>
    </header>
  );
}
