// ponytail: only Nifty index fetching — stock discovery handled by stockDiscovery.ts

export interface LiveStock {
  symbol: string;
  name: string;
  sector: string;
  ltp: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  prevClose: number;
  volume: number;
  weekHigh52: number;
  weekLow52: number;
}

interface YahooChartMeta {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  chartPreviousClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
}

async function fetchSingleStock(symbol: string): Promise<LiveStock | null> {
  try {
    const res = await fetch(`/api/yahoo/v8/finance/chart/${symbol}?interval=1d&range=1d`);
    if (!res.ok) return null;
    const data = await res.json();
    const meta: YahooChartMeta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const prevClose = meta.chartPreviousClose || 0;
    const ltp = meta.regularMarketPrice || 0;
    const change = ltp - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
    const opens = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.open;
    const openPrice = opens?.[0] ?? prevClose;
    const sym = symbol.replace('.NS', '').replace('^', '');

    return {
      symbol: sym,
      name: meta.longName || meta.shortName || sym,
      sector: '',
      ltp: Math.round(ltp * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      dayHigh: meta.regularMarketDayHigh || ltp,
      dayLow: meta.regularMarketDayLow || ltp,
      open: openPrice,
      prevClose: Math.round(prevClose * 100) / 100,
      volume: meta.regularMarketVolume || 0,
      weekHigh52: meta.fiftyTwoWeekHigh || ltp,
      weekLow52: meta.fiftyTwoWeekLow || ltp,
    };
  } catch {
    return null;
  }
}

// ponytail: only Nifty — individual stocks come from stockDiscovery.ts
export async function fetchNifty(): Promise<LiveStock | null> {
  return fetchSingleStock('^NSEI');
}
