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


const SUBTITLES: Record<string, string | undefined> = {
 Stacks: 'Themed lists of NIFTY 50 companies, each picked by a fixed rule you can read. Research ideas, not recommendations.',
 Assistant: 'Ask in plain words. Answers come from fixed rules over this app\'s data; no AI model is used.',
};

// Long-term investing research: themed stacks, style scorecards with plus/minus verdicts, screening, trend, baskets,
// portfolio fit and a rule-based assistant. Our own rules, inspired by public investing approaches; not advice.
export function InvestingPage({ tab, onTab }: { tab: string; onTab: (tab: string) => void }) {
 const current = INVESTING_TABS.some(([id]) => id === tab) ? tab : 'Stacks';
 return <div className="space-y-6">
  <div className="space-y-2"><span className="eyebrow faint">Investing</span>
   <nav className="tab-bar" aria-label="Investing sections">{INVESTING_TABS.map(([id, label]) => <button key={id} className={`tab${id === current ? ' active' : ''}`} aria-current={id === current ? 'page' : undefined} onClick={() => onTab(id)}>{label}</button>)}</nav></div>
  {/* Embedded pages carry their own titles; Stacks and Assistant get theirs here. */}
  {SUBTITLES[current] && <div className="page-title"><div><h2>{INVESTING_TABS.find(([id]) => id === current)?.[1]}</h2><p>{SUBTITLES[current]}</p></div></div>}
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
