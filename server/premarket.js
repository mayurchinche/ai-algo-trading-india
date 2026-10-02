import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fetchNews} from './marketNews.js';
const MASTER='https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';
let masterCache, masterPending;
export function premarketSlot(now=Date.now()){
 const d=new Date(now+19800000),minute=d.getUTCHours()*60+d.getUTCMinutes();
 if(d.getUTCDay()===0||d.getUTCDay()===6||minute<450||minute>=556)return null;
 // A late invocation never backfills an earlier slot.
 const slot=Math.floor(minute/15)*15;
 return {date:d.toISOString().slice(0,10),slot:`${String(Math.floor(slot/60)).padStart(2,'0')}:${String(slot%60).padStart(2,'0')}`,late:minute%15>2};
}
const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
export function equityUniverse(rows){
 if(!Array.isArray(rows))throw new Error('Invalid instrument master');
 const seen=new Set();
 const result=rows.filter(r=>r.segment==='NSE_EQ'&&r.instrument_type==='EQ'&&r.security_type==='NORMAL'&&/^NSE_EQ\|INE[A-Z0-9]{9}$/.test(r.instrument_key)&&typeof r.name==='string'&&typeof r.trading_symbol==='string').flatMap(r=>{
  if(seen.has(r.instrument_key))return [];seen.add(r.instrument_key);
  const name=normalize(r.name).replace(/\b(limited|ltd|ltd co|l)\b$/,'').trim();
  const short=normalize(r.short_name);
  // Multiword company names only. Short/common ticker strings are not evidence of identity.
  const aliases=[name,short].filter(a=>a.length>=8&&a.split(' ').length>=2);
  return [{instrumentKey:r.instrument_key,symbol:r.trading_symbol,name:r.name,aliases:[...new Set(aliases)]}];
 });
 if(!result.length)throw new Error('No verified equities in master');
 return result;
}
async function loadMaster(){
 const response=await fetch(MASTER,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Instrument source unavailable');
 const reader=response.body?.getReader();if(!reader)throw new Error('Instrument source empty');
 const chunks=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>8_000_000)throw new Error('Instrument response too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const compressed=Buffer.concat(chunks);
 const rows=JSON.parse(gunzipSync(compressed,{maxOutputLength:60_000_000}).toString('utf8'));
 return {rows:equityUniverse(rows),observedAt:new Date().toISOString(),source:MASTER};
}
export async function getEquityUniverse(){
 if(masterCache&&Date.now()-Date.parse(masterCache.observedAt)<6*3600000)return masterCache;
 if(!masterPending)masterPending=loadMaster().then(value=>(masterCache=value)).finally(()=>{masterPending=null;});
 return masterPending;
}
const events=[['Results / guidance',/\b(earnings|profit|revenue|results|guidance)\b/i],['Corporate event',/\b(merger|acquisition|buyback|dividend|demerger|contract|order win)\b/i],['Regulatory / governance',/\b(sebi|rbi|penalty|fraud|probe|resign|regulatory|approval)\b/i],['Disclosed investor activity',/\b(block deal|bulk deal|stake sale|stake purchase|shareholding)\b/i]];
export function buildPremarket({universe,articles,sourceHealth,startedAt,observedAt,mode='preview'}){
 const cutoff=Date.parse(startedAt),groups=new Map(),seen=new Set();let unmatched=0,ambiguous=0;
 for(const a of articles){
  if(!a.title||!a.url||!a.source||!Number.isFinite(Date.parse(a.publishedAt))||Date.parse(a.publishedAt)>cutoff||cutoff-Date.parse(a.publishedAt)>86400000)continue;
  const text=' '+normalize(a.title.replace(/\s[-–—]\s[^-–—]+$/,''))+' ';
  const dedup=normalize(a.title.replace(/\s[-–—]\s[^-–—]+$/,''));
  if(seen.has(dedup))continue;seen.add(dedup);
  const matches=universe.rows.filter(stock=>stock.aliases.some(alias=>text.includes(' '+alias+' ')));
  if(matches.length!==1){if(matches.length>1)ambiguous++;else unmatched++;continue;}
  // Search indexes also date evergreen quote/result directories and generic roundups.
  if(/\b(half yearly results|yearly results|find .+ results|dividend gems|stocks to buy|among others|stocks with|check returns)\b/i.test(a.title)||/\bq[1-4] (results|earnings result)\b/i.test(a.title)&&!/\b(reports?|posts?|announces?|beats?|misses?|jumps?|falls?|surges?)\b/i.test(a.title))continue;
  const stock=matches[0],categories=events.filter(([label,regex])=>regex.test(a.title)&&(label!=='Results / guidance'||/\b(reports?|posts?|announces?|beats?|misses?|jumps?|falls?|surges?|cuts?|raises?)\b/i.test(a.title))).map(([label])=>label);
  // Exclude quote-directory/price-only stories from the event shortlist.
  if(!categories.length)continue;
  const id=createHash('sha256').update(a.url+'|'+a.publishedAt).digest('hex').slice(0,24);
  const evidence={id,title:a.title,url:a.url,source:a.source,publishedAt:a.publishedAt,observedAt,categories};
  const current=groups.get(stock.instrumentKey)||{instrumentKey:stock.instrumentKey,symbol:stock.symbol,name:stock.name,evidence:[]};
  current.evidence.push(evidence);groups.set(stock.instrumentKey,current);
 }
 const candidates=[...groups.values()].map(c=>({...c,evidence:c.evidence.slice(0,8),eventTypes:[...new Set(c.evidence.flatMap(e=>e.categories))],publisherCount:new Set(c.evidence.map(e=>e.source.toLowerCase())).size,latestPublication:Math.max(...c.evidence.map(e=>Date.parse(e.publishedAt))),status:'RESEARCH_ONLY',direction:'UNDETERMINED'})).sort((a,b)=>b.eventTypes.length-a.eventTypes.length||b.latestPublication-a.latestPublication||a.symbol.localeCompare(b.symbol)).slice(0,10);
 return {version:1,mode,startedAt,observedAt,status:sourceHealth.some(s=>s.status==='unavailable')?'PARTIAL':candidates.length?'AVAILABLE':'NO_MATCHED_EVENTS',universe:{source:universe.source,observedAt:universe.observedAt,count:universe.rows.length},sourceHealth,coverage:{headlines:seen.size,unmatched,ambiguous,candidates:candidates.length},method:'Event-category coverage, then publication recency; unvalidated research ordering. No bullish/bearish or profitability score.',sessionEligibility:'UNVERIFIED',missingEvidence:['Live pre-open/depth feed not connected','Liquidity and executable entry levels not verified','Financial-statement and investor-disclosure verification not implemented'],candidates};
}
export async function observePremarket({now=()=>Date.now(),master=getEquityUniverse,news=fetchNews,mode='preview'}={}){
 const startedAt=new Date(now()).toISOString();
 const results=await Promise.allSettled([master(),...['company','earnings','market'].map(topic=>news('',{topic,days:1}))]);
 if(results[0].status==='rejected')throw new Error('Verified instrument source unavailable; no candidate mapping generated');
 const sourceHealth=results.slice(1).map((r,i)=>({source:'Google News RSS',topic:['company','earnings','market'][i],status:r.status==='fulfilled'?'available':'unavailable',count:r.status==='fulfilled'?r.value.articles.length:null}));
 if(sourceHealth.every(s=>s.status==='unavailable'))throw new Error('News acquisition unavailable; no shortlist generated');
 return buildPremarket({universe:results[0].value,articles:results.slice(1).flatMap(r=>r.status==='fulfilled'?r.value.articles:[]),sourceHealth,startedAt,observedAt:new Date(now()).toISOString(),mode});
}
