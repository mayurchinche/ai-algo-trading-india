// ponytail: live NSE market status — handles holidays, special sessions, weekends
// NSE API returns actual market state (Open/Close/Pre-open etc.)
import { fetchMarketJSON } from '../utils/fetchMarketJSON';

export interface MarketStatus {
  isOpen: boolean;
  status: string; // "Open" | "Closed" | "Pre-open" | "Normal Close" etc.
  lastUpdated: Date;
}

let cachedStatus: MarketStatus | null = null;
let lastFetch = 0;
const CACHE_MS = 60_000; // Cache for 1 minute

export async function fetchMarketStatus(): Promise<MarketStatus> {
  const now = Date.now();
  if (cachedStatus && now - lastFetch < CACHE_MS) return cachedStatus;

  try {
    const data = await fetchMarketJSON('/api/nse/api/marketStatus');

    // NSE returns: { marketState: [{ market: "Capital Market", marketStatus: "Open"|"Close", ... }] }
    const capitalMarket = data.marketState?.find(
      (m: any) => m.market === 'Capital Market' || m.market === 'CM'
    );

    const status = capitalMarket?.marketStatus || 'Close';
    const isOpen = status.toLowerCase().includes('open') && !status.toLowerCase().includes('pre-open');
    const isPreOpen = status.toLowerCase().includes('pre-open');

    cachedStatus = { isOpen, status: isPreOpen ? 'Pre-open' : status, lastUpdated: new Date() };
    lastFetch = now;
    console.log('[MarketStatus] NSE:', status, '→', isOpen ? 'OPEN' : 'CLOSED');
    return cachedStatus;
  } catch (e) {
    console.warn('[MarketStatus] NSE API failed, entries paused:', e);
    cachedStatus = { isOpen: false, status: 'Unknown — entries paused', lastUpdated: new Date() };
    lastFetch = now;
    return cachedStatus;
  }
}

// Synchronous check using cached value (for paper trading engine)
export function isMarketOpenCached(): boolean {
  return !!cachedStatus?.isOpen && Date.now() - lastFetch < CACHE_MS * 2;
}
