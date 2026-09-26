import {evaluateDiscoverySnapshot} from '../src/services/discoveryScoring';
import {istDate} from '../src/services/tradingTime';
import {strongSignalId,strongSignalRejection} from '../src/services/strongSignalPolicy';
export interface ResearchBar {
 symbol:string; interval:'day'|'minute'|'5minute'; start:number; end:number; availableAt:number;
 open:number; high:number; low:number; close:number; volume:number;
}
export function validateBars(bars:ResearchBar[]){
 const last=new Map<string,number>();
 for(const b of bars){
  if(!b.symbol||!['day','minute','5minute'].includes(b.interval)||![b.start,b.end,b.availableAt,b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.end<=b.start||b.availableAt<b.end||b.low<=0||b.volume<0||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close))throw new Error('Invalid normalized bar');
  if(b.interval!=='day'&&b.end-b.start!==(b.interval==='minute'?60000:300000))throw new Error('Minute interval must span exactly 60 seconds');
  const key=`${b.symbol}:${b.interval}`;if(b.start<=(last.get(key)??-Infinity))throw new Error('Duplicate or unordered bars');last.set(key,b.start);
 }
}
// Copies are held privately; the strategy only receives a prefix at the decision time.
export function createAsOfMarket(input:ResearchBar[], interval: 'minute'|'5minute' = 'minute'){
 if(!['minute','5minute'].includes(interval))throw new Error('Unsupported interval');
 validateBars(input);const bars=input.map(b=>Object.freeze({...b}));
 return Object.freeze({snapshot(symbol:string,now:number){
  if(!Number.isFinite(now))throw new Error('Invalid replay clock');
  const visible=bars.filter(b=>b.symbol===symbol&&b.availableAt<=now&&b.end<=now);
  const today=istDate(now),history=visible.filter(b=>b.interval==='day'&&istDate(b.start)<today);
  const minutes=visible.filter(b=>b.interval===interval&&istDate(b.start)===today);
  // Require complete prefix since opening; absent candles cannot imply zero volume.
  const open=Date.parse(today+'T09:15:00+05:30');
  if(!minutes.length)return {status:'NO_COMPLETED_MINUTE' as const};
  if(minutes[0].start!==open||minutes.some((b,i)=>i>0&&b.start!==minutes[i-1].end))return {status:'INCOMPLETE_SESSION_PREFIX' as const};
  if(history.length<200)return {status:'INSUFFICIENT_WARMUP' as const};
  const yearStart=Date.parse(today)-365*86400000;
  if(Date.parse(istDate(history[0].start))>yearStart)return {status:'INSUFFICIENT_YEAR_HISTORY' as const};
  const last=minutes.at(-1)!;
  if(now-last.end>120000)return {status:'STALE_CANDLE' as const};
  const year=history.filter(b=>Date.parse(istDate(b.start))>=yearStart);
  const stock=evaluateDiscoverySnapshot(symbol,{dates:history.map(b=>istDate(b.start)),closes:history.map(b=>b.close),highs:history.map(b=>b.high),lows:history.map(b=>b.low),volumes:history.map(b=>b.volume),meta:{
   regularMarketPrice:last.close,regularMarketTime:last.end/1000,
   regularMarketVolume:minutes.reduce((n,b)=>n+b.volume,0),
   fiftyTwoWeekHigh:Math.max(...year.map(b=>b.high),...minutes.map(b=>b.high)),
   fiftyTwoWeekLow:Math.min(...year.map(b=>b.low),...minutes.map(b=>b.low)),
  }},now);
  if(!stock)return {status:'INVALID_SCORING_INPUT' as const};
  return {status:'SCORED' as const,stock,signalId:strongSignalId(stock,now),rejection:strongSignalRejection(stock,now),
   model:interval==='minute'?'COMPLETED_MINUTE_CLOSE_NOT_OBSERVED_QUOTE':'COMPLETED_FIVE_MINUTE_CLOSE_NOT_OBSERVED_QUOTE',universe:'CALLER_SUPPLIED_NOT_PROVIDER_SCREENER',lastAvailableAt:last.availableAt};
 }});
}
