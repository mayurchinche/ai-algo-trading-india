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
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 p-4 md:p-5 overflow-y-auto">
        {activeTab === 'Smart Picks' && <SmartPicksPage />}
        {activeTab === 'Overview' && <OverviewPage />}
        {activeTab === 'Trades' && <TradesPage />}
        {activeTab === 'Stock Analysis' && <StockAnalysisPage />}
        {activeTab === 'Signals' && <SignalsPage />}
      </main>
      <footer className="text-center text-[10px] text-[var(--muted-foreground)] py-2 border-t border-[var(--border)]">
        AlgoTrader AI v1.0 • Paper Trading Mode • NSE/BSE • Not Financial Advice • Data refreshes every 5 min during market hours
      </footer>
    </div>
  );
}
