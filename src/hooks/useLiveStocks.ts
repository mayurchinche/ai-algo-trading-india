// ponytail: only fetches Nifty 50 index — stocks come from useStockDiscovery
import { useState, useEffect, useCallback } from 'react';
import { fetchNifty } from '../services/liveData';
import type { LiveStock } from '../services/liveData';

export function useLiveStocks() {
  const [nifty, setNifty] = useState<LiveStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const n = await fetchNifty();
      if (n) { setNifty(n); setLastUpdated(new Date()); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { nifty, loading, lastUpdated, refresh };
}
