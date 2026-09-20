import { useEffect, useSyncExternalStore } from 'react';
import { discoverStocks, fetchQuotes, type DiscoveredStock } from '../services/stockDiscovery';
import { getSignalHistory, recordSignals, updateOutcomes } from '../services/signalHistory';
import { getPaperTrades, updatePaperTrades } from '../services/paperTrading';
import { fetchMarketStatus, isMarketOpenCached } from '../services/marketStatus';
import type { MarketQuote } from '../services/tradingTime';

let state = { stocks: [] as DiscoveredStock[], quotes: new Map<string, MarketQuote>(), marketOpen: false, loading: false, lastScan: null as Date | null, error: null as string | null };
const listeners = new Set<() => void>();
let running = false;
const publish = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
async function runScan() {
  if (running || document.visibilityState !== 'visible') return;
  running = true; publish({ loading: true, error: null });
  try {
    const market = await fetchMarketStatus();
    // Monitor existing positions independently of whether they appear in today's screener.
    const symbols = [...getPaperTrades().filter(t => t.status === 'OPEN').map(t => t.symbol), ...getSignalHistory().filter(s => s.outcome === 'PENDING').map(s => s.symbol)];
    const quotes = await fetchQuotes(symbols);
    if(localStorage.getItem('paper_legacy_reconciled')!=='true') updatePaperTrades(quotes);
    updateOutcomes(quotes);
    publish({ quotes });
    if (symbols.some(symbol => !quotes.has(symbol))) publish({ error: 'Some open positions or signals have no quote; their outcomes remain unknown.' });
    const stocks = await discoverStocks();
    // Provider calls can finish after the app is hidden or the status cache expires.
    if (document.visibilityState !== 'visible') { publish({ marketOpen: false }); return; }
    const marketOpen = market.isOpen && isMarketOpenCached();
    const observedAt = Date.now();
    if (marketOpen) recordSignals(stocks, observedAt);
    // New paper entries belong exclusively to the persistent backend worker.
    publish({ stocks, marketOpen, lastScan: new Date(observedAt) });
  } catch (error) {
    publish({ marketOpen: false, error: error instanceof Error ? error.message : 'Scan failed; entries paused' });
  } finally { running = false; publish({ loading: false }); }
}
async function scan() {
  // One writer across tabs. Lock held for the complete read/modify/write cycle.
  if (!navigator.locks) { publish({ error: 'This browser lacks safe multi-tab locking. Paper trading is paused.' }); return; }
  await navigator.locks.request('paper-trading-scan', { ifAvailable: true }, lock => lock ? runScan() : undefined);
}
export function useStockDiscovery() {
  const snapshot = useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => state);
  return { ...snapshot, rescan: scan };
}
// Mounted once at the application root; page navigation never starts another engine.
export function useTradingRuntime() {
  useEffect(() => {
    void scan();
    const timer = setInterval(() => void scan(), 60_000);
    const resume = () => { if (document.visibilityState === 'visible') void scan(); };
    document.addEventListener('visibilitychange', resume);
    const refresh = () => publish({});
    window.addEventListener('storage', refresh);
    return () => { document.removeEventListener('visibilitychange', resume); clearInterval(timer); window.removeEventListener('storage', refresh); };
  }, []);
}
