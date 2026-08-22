// ponytail: live NSE market status — handles holidays, special sessions, weekends
// NSE API returns actual market state (Open/Close/Pre-open etc.)

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
    const res = await fetch('/api/nse/api/marketStatus');
    if (!res.ok) throw new Error(`NSE API ${res.status}`);
    const data = await res.json();

    // NSE returns: { marketState: [{ market: "Capital Market", marketStatus: "Open"|"Close", ... }] }
    const capitalMarket = data.marketState?.find(
      (m: any) => m.market === 'Capital Market' || m.market === 'CM'
    );

    const status = capitalMarket?.marketStatus || 'Close';
    const isOpen = status.toLowerCase().includes('open') || status.toLowerCase().includes('pre-open');

    cachedStatus = { isOpen, status, lastUpdated: new Date() };
    lastFetch = now;
    console.log('[MarketStatus] NSE:', status, '→', isOpen ? 'OPEN' : 'CLOSED');
    return cachedStatus;
  } catch (e) {
    console.warn('[MarketStatus] NSE API failed, using time-based fallback:', e);
    // Fallback: weekday + time check (not perfect but reasonable)
    const d = new Date();
    const day = d.getDay();
    const h = d.getHours();
    const m = d.getMinutes();
    const mins = h * 60 + m;
    const isWeekday = day >= 1 && day <= 5;
    const inHours = mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
    const isOpen = isWeekday && inHours;

    cachedStatus = { isOpen, status: isOpen ? 'Open (fallback)' : 'Closed (fallback)', lastUpdated: new Date() };
    lastFetch = now;
    return cachedStatus;
  }
}

// Synchronous check using cached value (for paper trading engine)
export function isMarketOpenCached(): boolean {
  return cachedStatus?.isOpen ?? false;
}
