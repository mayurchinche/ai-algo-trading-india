// NSE market intelligence from published files: bulk and block deals (the latest trading day's files),
// provisional FII/DII cash-market flows, and security-wise delivery from the daily bhavcopy.
// Each reader returns parsed rows with the source URL; parsing never fills missing values.
export const DEALS_URLS=Object.freeze({BULK:'https://nsearchives.nseindia.com/content/equities/bulk.csv',BLOCK:'https://nsearchives.nseindia.com/content/equities/block.csv'});
export const FLOWS_URL='https://www.nseindia.com/api/fiidiiTradeReact';
export const bhavcopyUrl=date=>`https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${date.slice(8,10)}${date.slice(5,7)}${date.slice(0,4)}.csv`;
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const MONTHS={JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'};
// 16-OCT-2026 / 16-Oct-2026 → 2026-10-16
export const nseDate=s=>{const m=/^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(String(s).trim());return m&&MONTHS[m[2].toUpperCase()]?`${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1]}`:null;};
async function text(fetcher,url,max){
 const r=await fetcher(url,{headers:{'User-Agent':UA,Accept:'*/*'},redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Object.assign(new Error('NSE_HTTP_'+r.status),{code:r.status===404?'NOT_PUBLISHED':'NSE_UNAVAILABLE'});
 const b=Buffer.from(await r.arrayBuffer());if(b.length>max)throw Object.assign(new Error('too large'),{code:'NSE_RESPONSE_TOO_LARGE'});
 return b.toString('utf8');
}
// RFC4180-style CSV split (quoted fields may contain commas).
export function csvRows(body){
 const rows=[];for(const line of body.split(/\r?\n/)){if(!line.trim())continue;const out=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(c==='"')q=false;else cur+=c;}else if(c==='"')q=true;else if(c===','){out.push(cur.trim());cur='';}else cur+=c;}
  out.push(cur.trim());rows.push(out);}
 return rows;
}
export function parseDeals(body,kind){
 const [header,...rows]=csvRows(body),col=n=>header.findIndex(h=>h.toLowerCase().startsWith(n));
 const c={date:col('date'),symbol:col('symbol'),client:col('client'),side:col('buy/sell'),qty:col('quantity'),price:col('trade price')};
 if(Object.values(c).some(i=>i<0))throw Object.assign(new Error('header'),{code:'DEALS_FORMAT_CHANGED'});
 return rows.map(r=>({date:nseDate(r[c.date]),kind,symbol:r[c.symbol],client:r[c.client],side:r[c.side]?.toUpperCase(),quantity:Number(r[c.qty]),price:Number(r[c.price])}))
  .filter(d=>d.date&&/^[A-Z0-9&-]{1,30}$/.test(d.symbol)&&d.client&&d.client.length<=200&&['BUY','SELL'].includes(d.side)&&Number.isInteger(d.quantity)&&d.quantity>0&&d.price>0);
}
export async function readDeals({fetcher=fetch}={}){
 const out=[];for(const [kind,url] of Object.entries(DEALS_URLS))out.push(...parseDeals(await text(fetcher,url,5e6),kind));
 return out;
}
export function parseFlows(body){
 const rows=JSON.parse(body);if(!Array.isArray(rows))throw Object.assign(new Error('flows'),{code:'FLOWS_FORMAT_CHANGED'});
 return rows.map(r=>({date:nseDate(r.date),category:r.category,buy:Number(r.buyValue),sell:Number(r.sellValue),net:Number(r.netValue)})).filter(f=>f.date&&['FII/FPI','DII'].includes(f.category)&&[f.buy,f.sell,f.net].every(Number.isFinite));
}
export const readFlows=async({fetcher=fetch}={})=>parseFlows(await text(fetcher,FLOWS_URL,100000));
// Delivery for one symbol (EQ series) from one day's full bhavcopy.
export function parseDelivery(body,symbol){
 const [header,...rows]=csvRows(body),h=header.map(x=>x.trim()),i=n=>h.indexOf(n);
 const r=rows.find(r=>r[i('SYMBOL')]===symbol&&r[i('SERIES')]==='EQ');if(!r)return null;
 const n=k=>{const v=Number(r[i(k)]);return Number.isFinite(v)?v:null;};
 return {date:nseDate(r[i('DATE1')]),close:n('CLOSE_PRICE'),volume:n('TTL_TRD_QNTY'),deliveredQty:n('DELIV_QTY'),deliveryPct:n('DELIV_PER'),trades:n('NO_OF_TRADES'),turnoverLakh:n('TURNOVER_LACS')};
}
// Day files are shared by every symbol, so they are cached for the process lifetime (each is ~400 KB).
export function createDeliveryReader({fetcher=fetch,maxDays=10}={}){
 const cache=new Map();
 const day=date=>{if(!cache.has(date)){if(cache.size>=30)cache.delete(cache.keys().next().value);cache.set(date,text(fetcher,bhavcopyUrl(date),3e6).catch(e=>{cache.delete(date);throw e;}));}return cache.get(date);};
 return async(symbol,now)=>{
  const out=[];let missing=0;
  for(let k=1;k<=21&&out.length<maxDays;k++){
   const d=new Date(now-k*86400000+19800000),date=d.toISOString().slice(0,10);if([0,6].includes(d.getUTCDay()))continue;
   try{const row=parseDelivery(await day(date),symbol);if(row)out.push(row);}catch(e){if(e.code!=='NOT_PUBLISHED')throw e;missing++;}
  }
  return {symbol,days:out,source:'NSE full bhavcopy (sec_bhavdata_full)',holidaysOrUnpublished:missing};
 };
}
