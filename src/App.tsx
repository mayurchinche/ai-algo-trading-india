import { useState } from 'react';
import { Header } from './components/Header';
import { OverviewPage } from './components/OverviewPage';
import { TradesPage } from './components/TradesPage';
import { StockAnalysisPage } from './components/StockAnalysisPage';
import { SignalsPage } from './components/SignalsPage';
import { SmartPicksPage } from './components/SmartPicksPage';
import { MetalsPage } from './components/MetalsPage';
import { useLiveStocks } from './hooks/useLiveStocks';

export default function App() {
  const [activeTab, setActiveTab] = useState('Smart Picks');
  const { stocks, nifty, loading, lastUpdated, refresh } = useLiveStocks();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Header activeTab={activeTab} onTabChange={setActiveTab} stocks={stocks} nifty={nifty} lastUpdated={lastUpdated} />

      {/* Live data status bar */}
      <div className="bg-white border-b border-[var(--border)] px-6 py-2 flex items-center gap-4 max-w-[1400px] mx-auto w-full text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 pulse' : 'bg-[var(--green)]'}`}></span>
          <span className="text-[var(--text-secondary)] font-medium">
            {loading ? 'Fetching live prices...' : `Live prices • ${stocks.length} stocks`}
          </span>
        </div>
        {lastUpdated && (
          <span className="text-[var(--text-muted)]">
            Updated: {lastUpdated.toLocaleTimeString('en-IN')}
          </span>
        )}
        {nifty && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="font-semibold text-[var(--text)]">NIFTY 50</span>
            <span className="font-bold" style={{ fontFamily: 'Poppins' }}>
              {nifty.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
            <span className={`font-bold ${nifty.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
              {nifty.changePct >= 0 ? '+' : ''}{nifty.changePct.toFixed(2)}%
            </span>
          </div>
        )}
        <button onClick={refresh} className="text-[var(--blue)] font-semibold hover:underline ml-2">↻ Refresh</button>
      </div>

      <main className="flex-1 p-6 overflow-y-auto max-w-[1400px] mx-auto w-full">
        {activeTab === 'Smart Picks' && <SmartPicksPage stocks={stocks} />}
        {activeTab === 'Overview' && <OverviewPage nifty={nifty} />}
        {activeTab === 'Trades' && <TradesPage stocks={stocks} />}
        {activeTab === 'Stock Analysis' && <StockAnalysisPage stocks={stocks} />}
        {activeTab === 'Signals' && <SignalsPage stocks={stocks} />}
        {activeTab === 'Metals' && <MetalsPage />}
      </main>
      <footer className="text-center text-xs text-[var(--text-muted)] py-4 border-t border-[var(--border)] bg-white">
        AlgoTrader AI v1.0 • Paper Trading Mode • NSE/BSE • Not Financial Advice • Live data from Yahoo Finance
      </footer>
    </div>
  );
}
