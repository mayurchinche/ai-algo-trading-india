import {gunzipSync} from 'node:zlib';
// Fixed destinations and GET-only methods. This adapter cannot place broker orders.
const ROOT='https://api.upstox.com';
let masterCache,masterPending;
export class MarketDataError extends Error {constructor(code){super(code);this.code=code;}}
async function bounded(response,max){
 const reader=response.body?.getReader();if(!reader)throw new MarketDataError('EMPTY_PROVIDER_RESPONSE');
 let size=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new MarketDataError('PROVIDER_RESPONSE_TOO_LARGE');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
export function createUpstoxReader({fetcher=fetch,token=()=>process.env.UPSTOX_ANALYTICS_TOKEN}={}){
 return async function read(path){
  if(!/^\/v[23]\/(market-quote\/quotes\?|market\/status\/NSE$|historical-candle\/)/.test(path))throw new MarketDataError('UNSUPPORTED_READ_PATH');
  const secret=token();if(!secret)throw new MarketDataError('UPSTOX_TOKEN_MISSING');
  let response;try{response=await fetcher(ROOT+path,{method:'GET',headers:{Authorization:`Bearer ${secret}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw new MarketDataError('UPSTOX_TRANSPORT_FAILED');}
  if(!response.ok)throw new MarketDataError(response.status===401||response.status===403?'UPSTOX_AUTH_FAILED':response.status===429?'UPSTOX_RATE_LIMITED':'UPSTOX_PROVIDER_FAILED');
  let body;try{body=JSON.parse((await bounded(response,4_000_000)).toString());}catch{throw new MarketDataError('UPSTOX_INVALID_RESPONSE');}
  if(body.status!=='success'||!body.data)throw new MarketDataError('UPSTOX_INVALID_RESPONSE');
  return body.data;
 };
}
export async function getTradingInstruments(){
 if(masterCache&&Date.now()-masterCache.at<3600000)return masterCache.rows;
 if(!masterPending)masterPending=(async()=>{
  const res=await fetch('https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz',{redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new MarketDataError('INSTRUMENT_MASTER_UNAVAILABLE');
  const rows=JSON.parse(gunzipSync(await bounded(res,8_000_000),{maxOutputLength:60_000_000}).toString());
  if(!Array.isArray(rows)||!rows.length)throw new MarketDataError('INVALID_INSTRUMENT_MASTER');
  masterCache={at:Date.now(),rows};return rows;
 })().finally(()=>{masterPending=null;});
 return masterPending;
}
export function normalizeUpstoxQuotes(data,keys,now){
 const wanted=new Set(keys),quotes=[];
 for(const q of Object.values(data||{})){
  const ms=Number(q.last_trade_time),responseMs=Date.parse(q.timestamp);
  // Provider response time is NOT the time of a trade or a book update.
  if(!wanted.has(q.instrument_token)||!Number.isFinite(ms)||ms>now||now-ms>120000||!Number.isFinite(responseMs)||responseMs>now||now-responseMs>120000)continue;
  const bid=q.depth?.buy?.[0],ask=q.depth?.sell?.[0];
  if(![q.last_price,bid?.price,ask?.price,bid?.quantity,ask?.quantity].every(n=>Number.isFinite(n)&&n>0)||ask.price<bid.price)continue;
  quotes.push({symbol:q.instrument_token,price:q.last_price,bid:bid.price,ask:ask.price,bidSize:bid.quantity,askSize:ask.quantity,timestamp:new Date(ms).toISOString(),observedAt:new Date(responseMs).toISOString(),source:'UPSTOX_FULL_QUOTE_V3',spread:(ask.price-bid.price)/((ask.price+bid.price)/2)});
 }
 return quotes;
}
export function createUpstoxProbe({read=createUpstoxReader(),clock=Date.now}={}){
 let cached,pending;
 return async()=>{
  if(cached&&clock()-cached.at<60000)return cached.result;
  if(!pending)pending=(async()=>{
   let result;
   try{
    const [market,quotes]=await Promise.all([read('/v2/market/status/NSE'),read('/v3/market-quote/quotes?instrument_key=NSE_INDEX%7CNifty%2050')]);
    const q=Object.values(quotes).find(q=>q.instrument_token==='NSE_INDEX|Nifty 50');
    if(typeof market.status!=='string'||!q||!Number.isFinite(q.last_price)||q.last_price<=0||!Number.isFinite(Number(q.last_trade_time)))throw new MarketDataError('UPSTOX_QUOTE_SCHEMA_UNVERIFIED');
    result={status:'CONNECTED',marketStatus:market.status,checkedAt:new Date(clock()).toISOString(),quoteTime:new Date(Number(q.last_trade_time)).toISOString(),note:'Market-status and index-quote reads succeeded. This does not verify fresh derivative books or enable paper execution.'};
   }catch(e){result={status:'UNAVAILABLE',reason:e instanceof MarketDataError?e.code:'UPSTOX_CONNECTION_FAILED',checkedAt:new Date(clock()).toISOString()};}
   cached={at:clock(),result};return result;
  })().finally(()=>{pending=null;});
  return pending;
 };
}
export const probeUpstox=createUpstoxProbe();
