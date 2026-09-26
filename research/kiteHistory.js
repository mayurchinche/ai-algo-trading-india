// Read-only historical adapter. No order endpoints or account writes are exposed.
export function normalizeKiteCandles(candles,{symbol,interval,publicationLagMs=1000}){
 if(!Array.isArray(candles)||!symbol||!['minute','day'].includes(interval)||!Number.isFinite(publicationLagMs)||publicationLagMs<0)throw new Error('Invalid candle input');
 let previous=-Infinity;
 return candles.map(row=>{
  if(!Array.isArray(row)||row.length<6||typeof row[0]!=='string'||!/(Z|[+-]\d\d:?\d\d)$/.test(row[0]))throw new Error('Timestamp with explicit timezone required');
  const [timestamp,open,high,low,close,volume,oi]=row,start=Date.parse(timestamp);
  const date=new Date(start+19800000).toISOString().slice(0,10);
  const end=interval==='minute'?start+60000:Date.parse(date+'T15:30:00+05:30');
  if(![start,open,high,low,close,volume].every(Number.isFinite)||start<=previous||end<=start||low<=0||low>Math.min(open,close)||high<Math.max(open,close)||volume<0||(oi!==undefined&&(!Number.isFinite(oi)||oi<0)))throw new Error('Invalid or unordered candle');
  previous=start;
  return {symbol,interval,start,end,availableAt:end+publicationLagMs,open,high,low,close,volume,...(oi===undefined?{}:{oi})};
 });
}
export async function fetchKiteHistory({apiKey,accessToken,instrumentToken,from,to,interval='minute',symbol},fetcher=fetch){
 if(!apiKey||!accessToken)return {status:'CREDENTIALS_MISSING'};
 if(!/^\d+$/.test(String(instrumentToken))||Number(instrumentToken)<=0||!symbol||!['minute','day'].includes(interval)||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw new Error('Invalid historical request');
 const url=new URL(`https://api.kite.trade/instruments/historical/${instrumentToken}/${interval}`);
 url.search=new URLSearchParams({from:from+' 09:15:00',to:to+' 15:30:00',continuous:'0',oi:'1'}).toString();
 try{
  const res=await fetcher(url,{method:'GET',headers:{'X-Kite-Version':'3',Authorization:`token ${apiKey}:${accessToken}`},signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!res.ok)return {status:res.status===401||res.status===403?'AUTH_OR_ENTITLEMENT_FAILED':'HTTP_FAILED',httpStatus:res.status};
  const json=await res.json();if(json.status!=='success'||!Array.isArray(json.data?.candles))return {status:'INVALID_PROVIDER_RESPONSE'};
  const bars=normalizeKiteCandles(json.data.candles,{symbol,interval});
  if(!bars.length)return {status:'NO_DATA'};
  const begin=Date.parse(from+'T00:00:00+05:30'),end=Date.parse(to+'T23:59:59+05:30');
  if(bars.some(b=>b.start<begin||b.start>end))return {status:'OUT_OF_RANGE_DATA'};
  return {status:'SAMPLE_RECEIVED_NOT_FULL_COVERAGE',bars};
 }catch{return {status:'TRANSPORT_OR_SCHEMA_FAILED'};}
}
