import {tradingSegments} from '../shared/tradingSegments';
import {SegmentPaperAccount} from './components/SegmentPaperAccount';
import { lazy, Suspense, useState } from 'react';
import { LayoutDashboard, Compass, Bell, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
const AlertsPage = lazy(() => import('./components/AlertsPage').then(m => ({default:m.AlertsPage})));
import { SignalPopup } from './components/SignalPopup';
import { Header } from './components/Header';
const OverviewPage = lazy(() => import('./components/OverviewPage').then(m => ({default:m.OverviewPage})));
const TradesPage = lazy(() => import('./components/TradesPage').then(m => ({default:m.TradesPage})));
const StockAnalysisPage = lazy(() => import('./components/StockAnalysisPage').then(m => ({default:m.StockAnalysisPage})));
const SignalsPage = lazy(() => import('./components/SignalsPage').then(m => ({default:m.SignalsPage})));
const SmartPicksPage = lazy(() => import('./components/SmartPicksPage').then(m => ({default:m.SmartPicksPage})));
const MetalsPage = lazy(() => import('./components/MetalsPage').then(m => ({default:m.MetalsPage})));
const DiscoveryPage = lazy(() => import('./components/DiscoveryPage').then(m => ({default:m.DiscoveryPage})));
const BacktestPage = lazy(() => import('./components/BacktestPage').then(m => ({default:m.BacktestPage})));
const IPOPage = lazy(() => import('./components/IPOPage').then(m => ({default:m.IPOPage})));
import { useLiveStocks } from './hooks/useLiveStocks';
import { useStockDiscovery, useTradingRuntime } from './hooks/useStockDiscovery';

export default function App() {
  const {paperError}=useTradingRuntime();
  const { error, loading, lastScan } = useStockDiscovery();
  const [segment,setSegment]=useState(tradingSegments[0]);
  const [activeTab, setActiveTab] = useState('Overview');
  const separateResearch=['IPO Tracker','Metals'].includes(activeTab);
  const [focusSignalId,setFocusSignalId]=useState<string|undefined>();
  const { nifty, lastUpdated } = useLiveStocks();

  return (
    <div className="workspace-shell min-h-screen flex flex-col bg-[var(--bg)]">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {segment.id==='intraday'&&<SignalPopup onView={() => setActiveTab('Alerts')} />}
      <Header activeTab={activeTab} onTabChange={setActiveTab} nifty={nifty} lastUpdated={lastUpdated} />

      <main id="main-content" className="app-main" tabIndex={-1}>
        <nav className="segment-selector" aria-label="Trading segment">{tradingSegments.map(item=><button key={item.id} aria-pressed={segment.id===item.id} onClick={()=>{setSegment(item);setFocusSignalId(undefined);}}>{item.label}<small>{item.executionReady?'Paper trading':'Funding only'}</small></button>)}</nav>
        <p className="notice">{segment.label} · shared user1 account. Starting budgets are simulation settings, not a profitability guarantee. Existing intraday capital is preserved.</p>
        <div className={`runtime-status ${error ? 'runtime-error' : ''}`} role="status">{error || (loading ? 'Refreshing market observations…' : `Device research scan · ${lastScan ? 'Scan ' + lastScan.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : 'Awaiting data'} · Intraday paper monitoring while app is visible`)}</div>
        <div role="status">{paperError&&<p className="notice">user1 monitoring: {paperError}</p>}</div>
        <div key={segment.id}><Suspense fallback={<div className="card workspace-loading" role="status"><span className="loading-line"/><span className="loading-line short"/><p>Opening workspace…</p></div>}><AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-6"
          >
            {segment.id!=='intraday'&&!separateResearch ? (['Overview','Trades'].includes(activeTab)?<SegmentPaperAccount segment={segment}/>:<section className="card space-y-4"><h1>{segment.label} · {activeTab}</h1><p>Unavailable until this segment’s data, strategy and execution checks pass. No intraday signals are reused here.</p><button onClick={()=>setActiveTab('Trades')}>View {segment.label.toLowerCase()} paper account</button></section>) : <>
            {activeTab === 'Alerts' && <AlertsPage />}
            {activeTab === 'AI Discovery' && <DiscoveryPage />}
            {activeTab === 'Smart Picks' && <SmartPicksPage />}
            {activeTab === 'Overview' && <OverviewPage onOpenWorkspace={signalId=>{setFocusSignalId(signalId);setActiveTab('Trades');window.scrollTo({top:0});}} />}
            {activeTab === 'Trades' && <TradesPage focusSignalId={focusSignalId}/>}
            {activeTab === 'Stock Analysis' && <StockAnalysisPage />}
            {activeTab === 'Signals' && <SignalsPage />}
            {activeTab === 'Backtest' && <BacktestPage />}
            {activeTab === 'IPO Tracker' && <IPOPage />}
            {activeTab === 'Metals' && <MetalsPage />}
            </>}
          </motion.div>
        </AnimatePresence></Suspense></div>
      </main>
      <nav className="mobile-nav" aria-label="Primary navigation">{([{id:'Overview',label:'Home',Icon:LayoutDashboard},{id:'AI Discovery',label:'Discover',Icon:Compass},{id:'Alerts',label:'Alerts',Icon:Bell},{id:'Trades',label:'Paper trades',Icon:BookOpen}]).map(({id,label,Icon})=><button key={id} aria-current={activeTab===id?'page':undefined} onClick={()=>setActiveTab(id)}><Icon size={20}/><span>{label}</span></button>)}</nav>
      <footer className="workspace-footer text-center text-[11px] text-[var(--text-muted)] py-8 mt-4 border-t border-[rgba(0,0,0,0.04)]">
        <div className="max-w-[1600px] mx-auto px-8 space-y-1">
          <p className="font-medium text-[var(--text-secondary)]" style={{ fontFamily: 'Poppins' }}>AlgoTrader AI</p>
          <p>Paper Trading Mode • v1.6.0 • NSE • Not Financial Advice • Powered by Yahoo Finance</p>
        </div>
      </footer>
    </div>
  );
}
