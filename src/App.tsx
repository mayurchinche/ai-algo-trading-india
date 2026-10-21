import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gauge, LineChart, Radar, BookOpen, Layers } from 'lucide-react';
import { NAVIGATE_EVENT, ANALYSE_EVENT } from './services/specDraft';
import { Header } from './components/Header';
import { InvestingPage } from './components/InvestingPage';
import { INVESTING_TABS } from './services/investing';
import { parseRoute, routeHash } from './services/route';
import { SignalPopup } from './components/SignalPopup';
import { useLiveStocks } from './hooks/useLiveStocks';
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, key: K) => lazy(() => load().then(m => ({ default: m[key] })));
const TodayPage = named(() => import('./components/TodayPage'), 'TodayPage');
const StockAnalysisPage = named(() => import('./components/StockAnalysisPage'), 'StockAnalysisPage');
const SignalsPage = named(() => import('./components/SignalsPage'), 'SignalsPage');
const OpeningGapsPage = named(() => import('./components/OpeningGapsPage'), 'OpeningGapsPage');
const AlertsPage = named(() => import('./components/AlertsPage'), 'AlertsPage');
const DiscoveryPage = named(() => import('./components/DiscoveryPage'), 'DiscoveryPage');
const SmartPicksPage = named(() => import('./components/SmartPicksPage'), 'SmartPicksPage');
const PaperTradingPage = named(() => import('./components/PaperTradingPage'), 'PaperTradingPage');
const IPOPage = named(() => import('./components/IPOPage'), 'IPOPage');
const RuleBuilderPage = named(() => import('./components/RuleBuilderPage'), 'RuleBuilderPage');
const OptionsWizardPage = named(() => import('./components/OptionsWizardPage'), 'OptionsWizardPage');
const MarketNewsPage = named(() => import('./components/MarketNewsPage'), 'MarketNewsPage');
const PremarketPage = named(() => import('./components/PremarketPage'), 'PremarketPage');
const ResearchPortfolioPage = named(() => import('./components/ResearchPortfolioPage'), 'ResearchPortfolioPage');
const MetalsPage = named(() => import('./components/MetalsPage'), 'MetalsPage');

const INVESTING_IDS = new Set(INVESTING_TABS.map(([id]) => id));
// Every key of `pages` below; a page missing here still works but cannot be opened from a link.
const PAGE_IDS = [...INVESTING_IDS, 'Today', 'Analysis', 'Signals', 'Opening gaps', 'Alerts', 'Discover', 'Watch ideas', 'Paper trading', 'IPO', 'Rule builder', 'Options wizard', 'Market News', 'Pre-market', 'Portfolios', 'Metals'];

export default function App() {
 const initial = parseRoute(window.location.hash, PAGE_IDS);
 const [activeTab, setActiveTab] = useState(initial?.tab ?? 'Today');
 const [symbol, setSymbol] = useState<string | undefined>(initial?.symbol);
 const { nifty, lastUpdated } = useLiveStocks();
 useEffect(() => {
  const go = (e: Event) => { const tab = (e as CustomEvent).detail; if (typeof tab === 'string') { setActiveTab(tab); window.scrollTo({ top: 0 }); } };
  const analyse = (e: Event) => { const s = (e as CustomEvent).detail; if (typeof s === 'string') { setSymbol(s); setActiveTab('Analysis'); window.scrollTo({ top: 0 }); } };
  // Back and forward restore the page in the URL.
  const pop = () => { const r = parseRoute(window.location.hash, PAGE_IDS); if (r) { setActiveTab(r.tab); if (r.symbol) setSymbol(r.symbol); } };
  window.addEventListener(NAVIGATE_EVENT, go); window.addEventListener(ANALYSE_EVENT, analyse); window.addEventListener('popstate', pop);
  return () => { window.removeEventListener(NAVIGATE_EVENT, go); window.removeEventListener(ANALYSE_EVENT, analyse); window.removeEventListener('popstate', pop); };
 }, []);
 useEffect(() => { const h = routeHash(activeTab, symbol); if (window.location.hash !== h) window.history.pushState(null, '', h); }, [activeTab, symbol]);
 // Investing tabs share one page; each tab id stays a navigation target.
 const investing = (tab: string) => <InvestingPage tab={tab} onTab={setActiveTab} />;
 const pages: Record<string, React.ReactNode> = {
  ...Object.fromEntries(INVESTING_TABS.map(([t]) => [t, investing(t)])),
  'Today': <TodayPage />, 'Analysis': <StockAnalysisPage symbol={symbol} onSymbol={setSymbol} />, 'Signals': <SignalsPage />, 'Opening gaps': <OpeningGapsPage />, 'Alerts': <AlertsPage />, 'Discover': <DiscoveryPage />, 'Watch ideas': <SmartPicksPage />, 'Paper trading': <PaperTradingPage />, 'IPO': <IPOPage />,
  'Rule builder': <RuleBuilderPage />, 'Options wizard': <OptionsWizardPage />,
  'Market News': <MarketNewsPage segment="intraday" />, 'Pre-market': <PremarketPage />, 'Portfolios': <ResearchPortfolioPage />, 'Metals': <MetalsPage />,
 };
 return (
  <div className="workspace-shell min-h-screen flex flex-col bg-[var(--bg)]">
   <a href="#main-content" className="skip-link">Skip to main content</a>
   <SignalPopup onView={() => setActiveTab('Alerts')} />
   <Header activeTab={activeTab} onTabChange={setActiveTab} nifty={nifty} lastUpdated={lastUpdated} />
   <main id="main-content" className="app-main" tabIndex={-1}>
    <Suspense fallback={<div className="card workspace-loading" role="status"><span className="loading-line" /><span className="loading-line short" /><p>Opening workspace…</p></div>}><AnimatePresence mode="wait">
     <motion.div key={INVESTING_IDS.has(activeTab) ? 'Investing' : activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="space-y-6">
      {pages[activeTab] ?? pages.Today}
     </motion.div>
    </AnimatePresence></Suspense>
   </main>
   <nav className="mobile-nav" aria-label="Primary navigation">{([{ id: 'Today', label: 'Today', Icon: Gauge }, { id: 'Analysis', label: 'Analysis', Icon: LineChart }, { id: 'Signals', label: 'Signals', Icon: Radar }, { id: 'Stacks', label: 'Investing', Icon: Layers }, { id: 'Paper trading', label: 'Paper', Icon: BookOpen }]).map(({ id, label, Icon }) => <button key={id} aria-current={activeTab === id || (id === 'Stacks' && INVESTING_IDS.has(activeTab)) ? 'page' : undefined} onClick={() => setActiveTab(id)}><Icon size={20} /><span>{label}</span></button>)}</nav>
   <footer className="workspace-footer text-center text-[11px] text-[var(--text-muted)] py-8 mt-4 border-t border-[rgba(0,0,0,0.04)]">
    <div className="max-w-[1600px] mx-auto px-8 space-y-1">
     <p className="font-medium text-[var(--text-secondary)]">AlgoTrader India</p>
     <p>Paper trading only • v2.1 • NSE • Not financial advice • Market data: Upstox (read-only), NSE, Google News</p>
    </div>
   </footer>
  </div>
 );
}
