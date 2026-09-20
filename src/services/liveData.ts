import { fetchMarketJSON } from '../utils/fetchMarketJSON';
export interface LiveStock { symbol: string; ltp: number; changePct: number; quoteTime: string }
export async function fetchNifty(): Promise<LiveStock | null> {
  try {
    const data = await fetchMarketJSON('/api/yahoo/v8/finance/chart/%5ENSEI?interval=1d&range=1d');
    const meta = data?.chart?.result?.[0]?.meta;
    if (![meta?.regularMarketPrice, meta?.chartPreviousClose, meta?.regularMarketTime].every(Number.isFinite)
        || meta.regularMarketPrice <= 0 || meta.chartPreviousClose <= 0 || meta.regularMarketTime * 1000 > Date.now()+5000) return null;
    return {symbol:'NSEI', ltp:meta.regularMarketPrice, changePct:(meta.regularMarketPrice/meta.chartPreviousClose-1)*100,
      quoteTime:new Date(meta.regularMarketTime*1000).toISOString()};
  } catch { return null; }
}
