import {createUpstoxReader,MarketDataError} from './upstoxReadOnly.js';
const DAY=86400000;
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);
// A daily close that moves more than this from the prior close is treated as a possible unadjusted split or
// bonus. Upstox candle adjustment is not verified, so such windows yield no price-derived criteria.
export const MAX_DAILY_MOVE=0.35;

// Completed daily bars strictly before asOf's IST date, keyed by the same NSE_EQ|ISIN instrument key as filings.
export function createDailyBarsReader({read=createUpstoxReader()}={}){
 return async(instrumentKey,asOf,days)=>{
  const to=istDate(asOf-DAY),from=istDate(asOf-days*DAY);
  const data=await read(`/v3/historical-candle/${encodeURIComponent(instrumentKey)}/days/1/${to}/${from}`);
  if(!Array.isArray(data?.candles))throw new MarketDataError('INVALID_CANDLE_RESPONSE');
  const byDate=new Map();
  for(const c of data.candles){
   if(!Array.isArray(c)||typeof c[0]!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(c[0])||!(c[4]>0)||!(c[2]>=c[4])||!Number.isFinite(c[2]))continue;
   const date=c[0].slice(0,10);if(date>to)continue;
   if(!byDate.has(date))byDate.set(date,[]);byDate.get(date).push({date,high:c[2],close:c[4]});
  }
  if(!byDate.size)throw new MarketDataError('NO_RECENT_DAILY_CLOSE');
  const bars=[...byDate.keys()].sort().map(date=>{const same=byDate.get(date);if(new Set(same.map(b=>b.close+'|'+b.high)).size!==1)throw new MarketDataError('AMBIGUOUS_DAILY_CLOSE');return same[0];});
  return {status:'OBSERVED',instrumentKey,currency:'INR',bars,source:'UPSTOX_HISTORICAL_DAILY_CANDLE_V3',observedAt:new Date(asOf).toISOString()};
 };
}
// The single owner of "latest completed close" for P/E.
export const latestClose=history=>{const b=history.bars.at(-1);return {status:'OBSERVED',instrumentKey:history.instrumentKey,value:b.close,currency:history.currency,date:b.date,source:history.source,observedAt:history.observedAt};};
export function createDailyCloseReader({read=createUpstoxReader()}={}){
 const bars=createDailyBarsReader({read});
 return async(instrumentKey,asOf)=>latestClose(await bars(instrumentKey,asOf,14));
}
export async function observeDailyClose(reader,instrumentKey,asOf){
 try{return await reader(instrumentKey,asOf);}
 catch(e){return {status:'UNAVAILABLE',instrumentKey,reason:e instanceof MarketDataError?e.code:'PRICE_SOURCE_FAILED'};}
}

// 12-month return and distance below the 52-week high, from one year of completed bars.
export function priceFacts(history,asOf){
 if(history?.status!=='OBSERVED')return {status:'PRICE_UNAVAILABLE',reason:history?.reason??null};
 const end=istDate(asOf-DAY),start=istDate(asOf-366*DAY),bars=history.bars.filter(b=>b.date>=start&&b.date<=end);
 if(!bars.length||Date.parse(end)-Date.parse(bars.at(-1).date)>10*DAY)return {status:'PRICE_STALE'};
 if(Date.parse(bars[0].date)-Date.parse(start)>21*DAY)return {status:'INSUFFICIENT_PRICE_HISTORY',from:bars[0].date};
 for(let i=1;i<bars.length;i++)if(Math.abs(bars[i].close/bars[i-1].close-1)>MAX_DAILY_MOVE)return {status:'POSSIBLE_UNADJUSTED_CORPORATE_ACTION',date:bars[i].date};
 const last=bars.at(-1),high=Math.max(...bars.map(b=>b.high));
 return {status:'OBSERVED',from:bars[0].date,to:last.date,close:last.close,return12mPct:(last.close/bars[0].close-1)*100,belowHighPct:(1-last.close/high)*100,high52w:high,source:history.source};
}
