import { useState } from 'react';
import { Header } from './components/Header';
import { OverviewPage } from './components/OverviewPage';
import { TradesPage } from './components/TradesPage';
import { StockAnalysisPage } from './components/StockAnalysisPage';
import { SignalsPage } from './components/SignalsPage';
import { SmartPicksPage } from './components/SmartPicksPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('Smart Picks');

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 p-6 overflow-y-auto max-w-[1400px] mx-auto w-full">
        {activeTab === 'Smart Picks' && <SmartPicksPage />}
        {activeTab === 'Overview' && <OverviewPage />}
        {activeTab === 'Trades' && <TradesPage />}
        {activeTab === 'Stock Analysis' && <StockAnalysisPage />}
        {activeTab === 'Signals' && <SignalsPage />}
      </main>
      <footer className="text-center text-xs text-[var(--text-muted)] py-4 border-t border-[var(--border)] bg-white">
        AlgoTrader AI v1.0 • Paper Trading Mode • NSE/BSE • Not Financial Advice • Data refreshes every 5 min
      </footer>
    </div>
  );
}
