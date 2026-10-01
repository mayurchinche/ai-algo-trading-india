import {freshQuote, inSession, istDate, istMinutes} from './tradingTime';
import type {DiscoveredStock} from './stockDiscovery';
export interface GapObservation {
 symbol:string; observedAt:string; status:string; reason:string; gapPct?:number; open?:number;
 previousClose:number; rangeHigh?:number; rangeLow?:number; quoteTime?:string; price?:number;
 direction?:'UP'|'DOWN'; confirmationTime?:string;
}
export interface GapSnapshot {at:string; status:string; universe:number; attempted:number; failures:number; rows:GapObservation[]}
// Research only. Uses complete one-minute candles, never the unfinished current bar.
export function evaluateOpeningGap(stock:Pick<DiscoveredStock,'symbol'|'prevClose'>,data:any,now:number):GapObservation {
 const row:GapObservation={symbol:stock.symbol,previousClose:stock.prevClose,observedAt:new Date(now).toISOString(),status:'DATA_UNAVAILABLE',reason:'Complete opening candles and a fresh quote are required.'};
 const result=data?.chart?.result?.[0],q=result?.indicators?.quote?.[0],meta=result?.meta;
 if(!q||!Array.isArray(result.timestamp)||!Number.isFinite(stock.prevClose)||stock.prevClose<=0)return row;
 if(!inSession(now)||istMinutes(now)>=630)return {...row,status:'OUTSIDE_WINDOW',reason:'Opening-gap research runs from 09:15 to 10:30 IST.'};
 const start=Date.parse(istDate(now)+'T09:15:00+05:30');
 const bars=result.timestamp.map((t:number,i:number)=>({time:t*1000,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]}))
  .filter((b:any)=>Number.isFinite(b.time)&&b.time>=start&&b.time+60000<=now&&[b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&b.volume>0&&b.low>0&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close))
  .sort((a:any,b:any)=>a.time-b.time);
 if(now<start+300000)return {...row,status:'FORMING',reason:'Waiting for the complete 09:15–09:20 opening range.'};
 const opening=bars.filter((b:any)=>b.time<start+300000);
 if(opening.length!==5||opening.some((b:any,i:number)=>b.time!==start+i*60000))return row;
 const open=opening[0].open,gapPct=(open/stock.prevClose-1)*100;
 Object.assign(row,{open,gapPct,direction:gapPct>=0?'UP':'DOWN',rangeHigh:Math.max(...opening.map((b:any)=>b.high)),rangeLow:Math.min(...opening.map((b:any)=>b.low))});
 if(Math.abs(gapPct)<1)return {...row,status:'SMALL_GAP',reason:'Opening gap below the 1% research filter.'};
 if(Math.abs(gapPct)>5)return {...row,status:'EXTENDED_GAP',reason:'Gap above 5%; excluded from this research setup.'};
 const quote={price:meta?.regularMarketPrice,timestamp:Number.isFinite(meta?.regularMarketTime)?new Date(meta.regularMarketTime*1000).toISOString():'',source:'Yahoo research feed'};
 Object.assign(row,{price:quote.price,quoteTime:quote.timestamp});
 if(!freshQuote(quote,now))return {...row,status:'STALE_QUOTE',reason:'Quote missing or older than two minutes; setup is not current.'};
 const last=bars.at(-1);
 if(!last||last.time<start+300000)return {...row,status:'WATCHING',reason:'Waiting for a completed candle after the opening range.'};
 if(now-(last.time+60000)>120000||meta.regularMarketTime*1000<last.time+60000)return {...row,status:'STALE_CANDLE',reason:'Latest completed candle or corresponding quote is stale.'};
 const up=gapPct>0,level=up?row.rangeHigh!:row.rangeLow!;
 const confirmed=up?last.close>level&&quote.price>level:last.close<level&&quote.price<level;
 return {...row,status:confirmed?'BREAKOUT_OBSERVED':'WATCHING',confirmationTime:confirmed?new Date(last.time+60000).toISOString():undefined,reason:confirmed?'A completed candle and current quote are beyond the opening range in the gap direction. Research only; no order generated.':'Waiting for a completed candle and current quote beyond the opening range in the gap direction.'};
}
export async function observeOpeningGaps(stocks:DiscoveredStock[],fetchJSON:(path:string)=>Promise<any>,now=Date.now()):Promise<GapSnapshot>{
 const at=new Date(now).toISOString();
 if(!inSession(now)||istMinutes(now)>=630)return {at,status:'OUTSIDE_WINDOW',universe:stocks.length,attempted:0,failures:0,rows:[]};
 // Bounded provider load. This is a movers sample, not a whole-market screen.
 const selected=stocks.filter(s=>s.ltp>=50&&s.avgVolume*s.ltp>=100_000_000).sort((a,b)=>Math.abs(b.changePct)-Math.abs(a.changePct)).slice(0,12);
 const results=await Promise.allSettled(selected.map(async stock=>evaluateOpeningGap(stock,await fetchJSON(`/api/yahoo/v8/finance/chart/${encodeURIComponent(stock.symbol+'.NS')}?interval=1m&range=1d`),now)));
 const rows=results.map((result,i)=>result.status==='fulfilled'?result.value:{symbol:selected[i].symbol,previousClose:selected[i].prevClose,observedAt:at,status:'DATA_UNAVAILABLE',reason:'Minute-candle provider request failed.'});
 const failures=rows.filter(r=>r.status==='DATA_UNAVAILABLE').length;
 return {at,status:!rows.length?'NO_UNIVERSE':failures===rows.length?'UNAVAILABLE':failures?'PARTIAL':'OBSERVED',universe:stocks.length,attempted:selected.length,failures,rows};
}
