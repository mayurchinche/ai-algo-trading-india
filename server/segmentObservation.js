import {createUpstoxReader,getTradingInstruments,normalizeUpstoxQuotes,MarketDataError} from './upstoxReadOnly.js';
import {segmentPolicy} from '../shared/segmentExecution.js';
const day=ms=>new Date(ms+19800000).toISOString().slice(0,10);
const equities=['RELIANCE','HDFCBANK','ICICIBANK','INFY','TCS','ITC','LT','SBIN'];
const indices=['NSE_INDEX|Nifty 50','NSE_INDEX|Nifty Bank'];
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
// Only completed bars available at decision time; no future outcomes used.
export function trendDecision(raw,segment,now){
 const daily=!!segmentPolicy[segment]?.holdingDays;
 const rows=(raw||[]).filter(r=>Array.isArray(r)&&Number.isFinite(Date.parse(r[0]))&&[r[1],r[2],r[3],r[4]].every(n=>Number.isFinite(n)&&n>0)&&r[2]>=Math.max(r[1],r[3],r[4])&&r[3]<=Math.min(r[1],r[2],r[4])&&(daily?day(Date.parse(r[0]))<day(now):Date.parse(r[0])+300000<=now));
 rows.sort((a,b)=>Date.parse(a[0])-Date.parse(b[0]));
 const seen=new Map();
 for(const row of rows){const prior=seen.get(row[0]);if(prior&&JSON.stringify(prior)!==JSON.stringify(row))return {reason:'CONFLICTING_DUPLICATE_BARS'};seen.set(row[0],row);}
 const unique=[...seen.values()];
 const slow=segment==='long-term'?200:50;
 if(unique.length<slow+1)return {reason:'INSUFFICIENT_COMPLETED_BARS'};
 const last=unique.at(-1),lastMs=Date.parse(last[0]);
 if(daily?now-lastMs>7*86400000:now-lastMs>600000)return {reason:'STALE_STRATEGY_BARS'};
 const closes=unique.map(r=>r[4]),fast=mean(closes.slice(-20)),slowValue=mean(closes.slice(-slow));
 const previous=unique.slice(-21,-1),high=Math.max(...previous.map(r=>r[2])),low=Math.min(...previous.map(r=>r[3]));
 const side=last[4]>high&&fast>slowValue?'BUY':!daily&&last[4]<low&&fast<slowValue?'SELL':null;
 return side?{side,barTime:last[0],price:last[4],strategyId:`${segment}-completed-trend-v1`,reasons:[`Completed ${daily?'daily':'5-minute'} breakout`, `20/${slow} period trend confirmation`]}:{reason:'NO_TREND_BREAKOUT'};
}
export function selectContract(rows,segment,underlying,decision,now){
 const eligible=rows.filter(r=>r.segment==='NSE_FO'&&r.underlying_type==='INDEX'&&r.underlying_key===underlying&&Number.isFinite(r.expiry)&&day(r.expiry)>day(now)&&Number.isInteger(r.lot_size)&&r.lot_size>0&&(segment==='options'?r.instrument_type===(decision.side==='BUY'?'CE':'PE'):r.instrument_type==='FUT'));
 eligible.sort((a,b)=>a.expiry-b.expiry||(segment==='options'?Math.abs(a.strike_price-decision.price)-Math.abs(b.strike_price-decision.price):0)||a.instrument_key.localeCompare(b.instrument_key));
 return eligible[0];
}
export function createSegmentObserver({read=createUpstoxReader(),master=getTradingInstruments,clock=Date.now}={}){
 const cache=new Map();
 async function bars(key,daily,now){
  const cacheKey=key+(daily?':daily':':minutes'),prior=cache.get(cacheKey);
  if(prior&&now-prior.at<(daily?3600000:60000))return prior.value;
  const encoded=encodeURIComponent(key),to=day(now-86400000),from=day(now-(daily?400:7)*86400000);
  const path=`/v3/historical-candle/${encoded}/${daily?'days/1':'minutes/5'}/${to}/${from}`;
  const historical=await read(path);
  const current=daily?[]:(await read(`/v3/historical-candle/intraday/${encoded}/minutes/5`)).candles;
  if(!Array.isArray(historical.candles)||!Array.isArray(current))throw new MarketDataError('INVALID_CANDLE_RESPONSE');
  const value=[...historical.candles,...current];cache.set(cacheKey,{at:now,value});return value;
 }
 return async function observe(account,now=clock()){
  const segment=account.id.replace('user1:','');
  if(!segmentPolicy[segment])throw new MarketDataError('UNKNOWN_SEGMENT');
  const active=account.state.orders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status));
  const diagnostics={scored:0,rejections:{},provider:'Upstox read-only',strategyVersion:'completed-trend-v1'};
  const reject=reason=>{diagnostics.rejections[reason]=(diagnostics.rejections[reason]||0)+1;};
  let marketOpen=false,discoveryError,rows=[],signals=[];
  try{const status=await read('/v2/market/status/NSE');if(typeof status.status!=='string')throw new MarketDataError('MARKET_STATUS_INVALID');marketOpen=status.status==='NORMAL_OPEN';}catch(e){discoveryError=e instanceof MarketDataError?e.code:'MARKET_STATUS_UNAVAILABLE';}
  if(marketOpen){
   try{
    rows=await master();const daily=!!segmentPolicy[segment].holdingDays;
    const universe=daily?rows.filter(r=>r.segment==='NSE_EQ'&&r.instrument_type==='EQ'&&r.security_type==='NORMAL'&&equities.includes(r.trading_symbol)):indices.map(instrument_key=>({instrument_key}));
    if(!universe.length)throw new MarketDataError('UNIVERSE_UNAVAILABLE');
    // Small, declared pilot universe; at most eight instruments per account.
    for(let offset=0;offset<universe.length;offset+=8){
     await Promise.all(universe.slice(offset,offset+8).map(async instrument=>{
      try{
       const decision=trendDecision(await bars(instrument.instrument_key,daily,now),segment,now);diagnostics.scored++;
       if(!decision.side){reject(decision.reason);return;}
       const contract=daily?instrument:selectContract(rows,segment,instrument.instrument_key,decision,now);
       if(!contract){reject('NO_VERIFIED_CONTRACT');return;}
       const side=segment==='options'?'BUY':decision.side;
       signals.push({segment,instrumentKey:contract.instrument_key,symbol:contract.trading_symbol,lotSize:daily?1:contract.lot_size,expiry:contract.expiry,underlyingType:contract.underlying_type,side,signalId:`${segment}:${contract.instrument_key.replace(/[^A-Za-z0-9]/g,'_')}:${day(now)}:${Date.parse(decision.barTime)}`,signalTime:new Date(now).toISOString(),score:null,strategy:{id:decision.strategyId,signal:side,score:null,recordedAt:new Date(now).toISOString(),reasons:[...decision.reasons,'Rule-qualified experimental policy; no win probability has been established'],barTime:decision.barTime}});
      }catch(e){reject(e instanceof MarketDataError?e.code:'STRATEGY_DATA_UNAVAILABLE');discoveryError='Some strategy data unavailable';}
     }));
    }
   }catch(e){discoveryError=e instanceof MarketDataError?e.code:'INSTRUMENT_OR_STRATEGY_DATA_UNAVAILABLE';}
  }
  let quotes=[];
  const keys=[...new Set([...active.map(o=>o.instrumentKey),...signals.map(s=>s.instrumentKey)].filter(Boolean))];
  if(keys.length)try{quotes=normalizeUpstoxQuotes(await read('/v3/market-quote/quotes?instrument_key='+encodeURIComponent(keys.join(','))),keys,clock());}catch(e){discoveryError=e instanceof MarketDataError?e.code:'QUOTE_DATA_UNAVAILABLE';}
  for(const key of keys)if(!quotes.some(q=>q.symbol===key))reject('MISSING_FRESH_BOOK');
  const candidates=signals.filter(s=>quotes.some(q=>q.symbol===s.instrumentKey));
  return {segment,marketOpen,discoveryError,quotes,candidates,missingQuotes:keys.filter(k=>!quotes.some(q=>q.symbol===k)),scanDiagnostics:diagnostics};
 };
}
export const observeSegmentPaper=createSegmentObserver();
