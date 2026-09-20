import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertsPage } from './components/AlertsPage';
import { SignalPopup } from './components/SignalPopup';
import { Header } from './components/Header';
import { OverviewPage } from './components/OverviewPage';
import { TradesPage } from './components/TradesPage';
import { StockAnalysisPage } from './components/StockAnalysisPage';
import { SignalsPage } from './components/SignalsPage';
import { SmartPicksPage } from './components/SmartPicksPage';
import { MetalsPage } from './components/MetalsPage';
import { DiscoveryPage } from './components/DiscoveryPage';
import { BacktestPage } from './components/BacktestPage';
import { IPOPage } from './components/IPOPage';
import { useLiveStocks } from './hooks/useLiveStocks';
import { useStockDiscovery, useTradingRuntime } from './hooks/useStockDiscovery';

export default function App() {
  useTradingRuntime();
  const { error, loading, lastScan, stocks, marketOpen } = useStockDiscovery();
  const [activeTab, setActiveTab] = useState('Overview');
  const { nifty, lastUpdated } = useLiveStocks();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SignalPopup stocks={stocks} marketOpen={marketOpen} onView={() => setActiveTab('Alerts')} />
      <Header activeTab={activeTab} onTabChange={setActiveTab} nifty={nifty} lastUpdated={lastUpdated} />

      <main className="app-main">
        <div className={`runtime-status ${error ? 'runtime-error' : ''}`} role="status">{error || (loading ? 'Refreshing market observations…' : `Research feed · ${lastScan ? 'Scan ' + lastScan.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : 'Awaiting data'} · Research scan; see paper account for worker status`)}</div>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-6"
          >
            {activeTab === 'Alerts' && <AlertsPage />}
            {activeTab === 'AI Discovery' && <DiscoveryPage />}
            {activeTab === 'Smart Picks' && <SmartPicksPage />}
            {activeTab === 'Overview' && <OverviewPage />}
            {activeTab === 'Trades' && <TradesPage />}
            {activeTab === 'Stock Analysis' && <StockAnalysisPage />}
            {activeTab === 'Signals' && <SignalsPage />}
            {activeTab === 'Backtest' && <BacktestPage />}
            {activeTab === 'IPO Tracker' && <IPOPage />}
            {activeTab === 'Metals' && <MetalsPage />}
          </motion.div>
        </AnimatePresence>
      </main>
      <nav className="mobile-nav" aria-label="Primary navigation">{['Overview', 'AI Discovery', 'Alerts', 'Trades'].map(tab => <button key={tab} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => setActiveTab(tab)}>{tab === 'AI Discovery' ? 'Discover' : tab === 'Trades' ? 'Journal' : tab}</button>)}</nav>
      <footer className="text-center text-[11px] text-[var(--text-muted)] py-8 mt-4 border-t border-[rgba(0,0,0,0.04)]">
        <div className="max-w-[1600px] mx-auto px-8 space-y-1">
          <p className="font-medium text-[var(--text-secondary)]" style={{ fontFamily: 'Poppins' }}>AlgoTrader AI</p>
          <p>Paper Trading Mode • NSE • Not Financial Advice • Powered by Yahoo Finance</p>
        </div>
      </footer>
    </div>
  );
}
