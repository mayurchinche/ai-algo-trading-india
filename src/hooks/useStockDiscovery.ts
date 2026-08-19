import { useState, useEffect, useCallback } from 'react';
import { discoverStocks, type DiscoveredStock } from '../services/stockDiscovery';
import { recordSignals, updateOutcomes } from '../services/signalHistory';

export function useStockDiscovery() {
  const [stocks, setStocks] = useState<DiscoveredStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const discovered = await discoverStocks();
      setStocks(discovered);
      setLastScan(new Date());

      // Record signals + check outcomes against current prices
      recordSignals(discovered);
      const priceMap = new Map(discovered.map(s => [s.symbol, s.ltp]));
      updateOutcomes(priceMap);
    } catch (e: any) {
      setError(e?.message || 'Discovery failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scan();
    // Re-scan every 5 minutes during market hours
    const interval = setInterval(scan, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [scan]);

  return { stocks, loading, lastScan, error, rescan: scan };
}
