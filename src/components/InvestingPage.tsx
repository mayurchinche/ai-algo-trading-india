import { lazy, Suspense } from 'react';
import { INVESTING_TABS } from '../services/investing';
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, key: K) => lazy(() => load().then(m => ({ default: m[key] })));
const StacksFeed = named(() => import('./StacksFeed'), 'StacksFeed');
const AssistantPanel = named(() => import('./AssistantPanel'), 'AssistantPanel');
const ScorecardsPage = named(() => import('./ScorecardsPage'), 'ScorecardsPage');
const ScreenerPage = named(() => import('./ScreenerPage'), 'ScreenerPage');
const TrendDashboardPage = named(() => import('./TrendDashboardPage'), 'TrendDashboardPage');
const BasketsPage = named(() => import('./BasketsPage'), 'BasketsPage');
const PortfolioFitPage = named(() => import('./PortfolioFitPage'), 'PortfolioFitPage');


// Long-term investing research: themed stacks, style scorecards with plus/minus verdicts, screening, trend, baskets,
// portfolio fit and a rule-based assistant. Our own rules, inspired by public investing approaches; not advice.
export function InvestingPage({ tab, onTab }: { tab: string; onTab: (tab: string) => void }) {
 const current = INVESTING_TABS.some(([id]) => id === tab) ? tab : 'Stacks';
 return <div className="space-y-4">
  <div><h2>Investing</h2><p className="text-sm opacity-70">Long-term research on NIFTY 50 companies from NSE filings and prices. Research only, not investment advice.</p></div>
  <nav className="flex flex-wrap gap-2" aria-label="Investing sections">{INVESTING_TABS.map(([id, label]) => <button key={id} className={id === current ? 'btn-primary' : 'btn-secondary'} aria-current={id === current ? 'page' : undefined} onClick={() => onTab(id)}>{label}</button>)}</nav>
  <Suspense fallback={<p role="status">Loading…</p>}>
   {current === 'Stacks' && <StacksFeed onTab={onTab} />}
   {current === 'Assistant' && <AssistantPanel onTab={onTab} />}
   {current === 'Scorecards' && <ScorecardsPage />}
   {current === 'Screener' && <ScreenerPage />}
   {current === 'Trend' && <TrendDashboardPage />}
   {current === 'Baskets' && <BasketsPage />}
   {current === 'Portfolio fit' && <PortfolioFitPage />}
  </Suspense>
 </div>;
}
