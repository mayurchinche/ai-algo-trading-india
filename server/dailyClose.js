import {createUpstoxReader,MarketDataError} from './upstoxReadOnly.js';
const DAY=86400000;
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);
// Latest completed daily close strictly before asOf's IST date, keyed by the same NSE_EQ|ISIN instrument key as filings.
export function createDailyCloseReader({read=createUpstoxReader()}={}){
 return async(instrumentKey,asOf)=>{
  const to=istDate(asOf-DAY),from=istDate(asOf-14*DAY);
  const data=await read(`/v3/historical-candle/${encodeURIComponent(instrumentKey)}/days/1/${to}/${from}`);
  if(!Array.isArray(data?.candles))throw new MarketDataError('INVALID_CANDLE_RESPONSE');
  const bars=data.candles.filter(c=>Array.isArray(c)&&typeof c[0]==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(c[0])&&c[0].slice(0,10)<=to&&Number.isFinite(c[4])&&c[4]>0);
  if(!bars.length)throw new MarketDataError('NO_RECENT_DAILY_CLOSE');
  const date=bars.map(c=>c[0].slice(0,10)).sort().at(-1),same=bars.filter(c=>c[0].slice(0,10)===date);
  if(new Set(same.map(c=>c[4])).size!==1)throw new MarketDataError('AMBIGUOUS_DAILY_CLOSE');
  return {status:'OBSERVED',instrumentKey,value:same[0][4],currency:'INR',date,source:'UPSTOX_HISTORICAL_DAILY_CANDLE_V3',observedAt:new Date(asOf).toISOString()};
 };
}
export async function observeDailyClose(reader,instrumentKey,asOf){
 try{return await reader(instrumentKey,asOf);}
 catch(e){return {status:'UNAVAILABLE',instrumentKey,reason:e instanceof MarketDataError?e.code:'PRICE_SOURCE_FAILED'};}
}
