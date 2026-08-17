import { useState, useEffect, useCallback } from 'react';
import { fetchAllStocks, fetchNifty } from '../services/liveData';
import type { LiveStock } from '../services/liveData';

const REFRESH_INTERVAL = 60_000; // 1 minute

export function useLiveStocks() {
  const [stocks, setStocks] = useState<LiveStock[]>([]);
  const [nifty, setNifty] = useState<LiveStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [stockData, niftyData] = await Promise.all([fetchAllStocks(), fetchNifty()]);
      if (stockData.length > 0) {
        setStocks(stockData);
        setLastUpdated(new Date());
      }
      if (niftyData) setNifty(niftyData);
    } catch {
      setError('Failed to fetch live data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  return { stocks, nifty, loading, lastUpdated, error, refresh };
}
