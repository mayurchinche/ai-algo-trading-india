import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Radar, BookOpen, Building2 } from 'lucide-react';
import { NAVIGATE_EVENT, ANALYSE_EVENT } from './services/specDraft';
import { Header } from './components/Header';
import { useLiveStocks } from './hooks/useLiveStocks';
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, key: K) => lazy(() => load().then(m => ({ default: m[key] })));
const StockAnalysisPage = named(() => import('./components/StockAnalysisPage'), 'StockAnalysisPage');
const SignalsPage = named(() => import('./components/SignalsPage'), 'SignalsPage');
const PaperTradingPage = named(() => import('./components/PaperTradingPage'), 'PaperTradingPage');
const IPOPage = named(() => import('./components/IPOPage'), 'IPOPage');
const RuleBuilderPage = named(() => import('./components/RuleBuilderPage'), 'RuleBuilderPage');
const OptionsWizardPage = named(() => import('./components/OptionsWizardPage'), 'OptionsWizardPage');
const ScreenerPage = named(() => import('./components/ScreenerPage'), 'ScreenerPage');
const ScorecardsPage = named(() => import('./components/ScorecardsPage'), 'ScorecardsPage');
const TrendDashboardPage = named(() => import('./components/TrendDashboardPage'), 'TrendDashboardPage');
const MarketNewsPage = named(() => import('./components/MarketNewsPage'), 'MarketNewsPage');
const PremarketPage = named(() => import('./components/PremarketPage'), 'PremarketPage');
const ResearchPortfolioPage = named(() => import('./components/ResearchPortfolioPage'), 'ResearchPortfolioPage');
const PortfolioFitPage = named(() => import('./components/PortfolioFitPage'), 'PortfolioFitPage');
const BasketsPage = named(() => import('./components/BasketsPage'), 'BasketsPage');
const MetalsPage = named(() => import('./components/MetalsPage'), 'MetalsPage');

export default function App() {
 const [activeTab, setActiveTab] = useState('Analysis');
 const [symbol, setSymbol] = useState<string | undefined>();
 const { nifty, lastUpdated } = useLiveStocks();
 useEffect(() => {
  const go = (e: Event) => { const tab = (e as CustomEvent).detail; if (typeof tab === 'string') { setActiveTab(tab); window.scrollTo({ top: 0 }); } };
  const analyse = (e: Event) => { const s = (e as CustomEvent).detail; if (typeof s === 'string') { setSymbol(s); setActiveTab('Analysis'); window.scrollTo({ top: 0 }); } };
  window.addEventListener(NAVIGATE_EVENT, go); window.addEventListener(ANALYSE_EVENT, analyse);
  return () => { window.removeEventListener(NAVIGATE_EVENT, go); window.removeEventListener(ANALYSE_EVENT, analyse); };
 }, []);
 const pages: Record<string, React.ReactNode> = {
  'Analysis': <StockAnalysisPage symbol={symbol} onSymbol={setSymbol} />, 'Signals': <SignalsPage />, 'Paper trading': <PaperTradingPage />, 'IPO': <IPOPage />,
  'Rule builder': <RuleBuilderPage />, 'Options wizard': <OptionsWizardPage />, 'Screener': <ScreenerPage />, 'Scorecards': <ScorecardsPage />, 'Trend': <TrendDashboardPage />,
  'Market News': <MarketNewsPage segment="intraday" />, 'Pre-market': <PremarketPage />, 'Portfolios': <ResearchPortfolioPage />, 'Portfolio fit': <PortfolioFitPage />, 'Baskets': <BasketsPage />, 'Metals': <MetalsPage />,
 };
 return (
  <div className="workspace-shell min-h-screen flex flex-col bg-[var(--bg)]">
   <a href="#main-content" className="skip-link">Skip to main content</a>
   <Header activeTab={activeTab} onTabChange={setActiveTab} nifty={nifty} lastUpdated={lastUpdated} />
   <main id="main-content" className="app-main" tabIndex={-1}>
    <Suspense fallback={<div className="card workspace-loading" role="status"><span className="loading-line" /><span className="loading-line short" /><p>Opening workspace…</p></div>}><AnimatePresence mode="wait">
     <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="space-y-6">
      {pages[activeTab] ?? pages.Analysis}
     </motion.div>
    </AnimatePresence></Suspense>
   </main>
   <nav className="mobile-nav" aria-label="Primary navigation">{([{ id: 'Analysis', label: 'Analysis', Icon: LineChart }, { id: 'Signals', label: 'Signals', Icon: Radar }, { id: 'Paper trading', label: 'Paper', Icon: BookOpen }, { id: 'IPO', label: 'IPO', Icon: Building2 }]).map(({ id, label, Icon }) => <button key={id} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}><Icon size={20} /><span>{label}</span></button>)}</nav>
   <footer className="workspace-footer text-center text-[11px] text-[var(--text-muted)] py-8 mt-4 border-t border-[rgba(0,0,0,0.04)]">
    <div className="max-w-[1600px] mx-auto px-8 space-y-1">
     <p className="font-medium text-[var(--text-secondary)]" style={{ fontFamily: 'Poppins' }}>AlgoTrader India</p>
     <p>Paper trading only • v2.0 • NSE • Not financial advice • Market data: Upstox (read-only), NSE, Google News</p>
    </div>
   </footer>
  </div>
 );
}
