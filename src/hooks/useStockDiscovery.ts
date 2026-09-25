import { useEffect, useState, useSyncExternalStore } from 'react';
import { discoverStocks, fetchQuotes, type DiscoveredStock } from '../services/stockDiscovery';
import { getSignalHistory, recordSignals, updateOutcomes } from '../services/signalHistory';
import { sharedPaperRequest } from '../services/sharedPaperAccount';
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
    // Research outcomes remain local; paper positions are monitored only by the shared server.
    const symbols = [ ...getSignalHistory().filter(s => s.outcome === 'PENDING').map(s => s.symbol)];
    const quotes = await fetchQuotes(symbols);

    updateOutcomes(quotes);
    publish({ quotes });
    if (symbols.some(symbol => !quotes.has(symbol))) publish({ error: 'Some open positions or signals have no quote; their outcomes remain unknown.' });
    const stocks = await discoverStocks();
    // Provider calls can finish after the app is hidden or the status cache expires.
    if (document.visibilityState !== 'visible') { publish({ marketOpen: false }); return; }
    const marketOpen = market.isOpen && isMarketOpenCached();
    const observedAt = Date.now();
    if (marketOpen) recordSignals(stocks, observedAt);

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
  const [paperError,setPaperError]=useState<string|null>(null);
  useEffect(() => {
    void scan();
    let ticking=false;
    const tick=async()=>{if(ticking||document.visibilityState!=='visible')return;ticking=true;try{await sharedPaperRequest({tick:true});setPaperError(null);}catch(error){setPaperError(error instanceof Error?error.message:'Shared execution unavailable');}finally{ticking=false;}};
    void tick();
    const paperTimer=setInterval(()=>void tick(),60000);
    const resumePaper=()=>{if(document.visibilityState==='visible')void tick();};
    document.addEventListener('visibilitychange',resumePaper);window.addEventListener('paper-scan-requested',resumePaper);
    const timer = setInterval(() => void scan(), 60_000);
    const resume = () => { if (document.visibilityState === 'visible') void scan(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('paper-scan-requested',resume);
    const refresh = () => publish({});
    window.addEventListener('storage', refresh);
    return () => {clearInterval(paperTimer);document.removeEventListener('visibilitychange',resumePaper);window.removeEventListener('paper-scan-requested',resumePaper); document.removeEventListener('visibilitychange', resume); clearInterval(timer); window.removeEventListener('storage', refresh);window.removeEventListener('paper-scan-requested',resume); };
  }, []);
  return {paperError};
}
