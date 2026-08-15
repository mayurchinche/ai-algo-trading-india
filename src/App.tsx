import { Header } from './components/Header';
import { MetricsBar } from './components/MetricsBar';
import { PortfolioChart, NiftyChart } from './components/Charts';
import { Watchlist } from './components/Watchlist';
import { SignalsPanel } from './components/SignalsPanel';
import { TradeLog } from './components/TradeLog';
import { StrategyBreakdown } from './components/StrategyBreakdown';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto w-full">
        {/* Metrics Row */}
        <MetricsBar />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Watchlist */}
          <div className="lg:col-span-3">
            <Watchlist />
          </div>

          {/* Center: Charts */}
          <div className="lg:col-span-5 space-y-4">
            <NiftyChart />
            <PortfolioChart />
          </div>

          {/* Right: Signals + Strategy */}
          <div className="lg:col-span-4 space-y-4">
            <SignalsPanel />
            <StrategyBreakdown />
          </div>
        </div>

        {/* Trade Log (full width) */}
        <TradeLog />
      </main>

      <footer className="text-center text-[10px] text-gray-600 py-3 border-t border-white/5">
        AlgoTrader AI • Paper Trading Mode • Not Financial Advice • Data from NSE/BSE via Public APIs
      </footer>
    </div>
  );
}
