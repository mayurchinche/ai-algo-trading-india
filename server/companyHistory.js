import {SCRAP_POLICY,scrapRequirements} from '../shared/scrapResearch.js';
import {createHash} from 'node:crypto';
import {disclosureTime} from './companyDisclosures.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function companySymbol(value){if(typeof value!=='string'||! /^[A-Z0-9&-]{1,30}$/.test(value))throw Error('Use an exact uppercase NSE symbol');return value;}
const time=value=>typeof value==='string'?disclosureTime(value.replace(/-([A-Z]{3})-/,(_,m)=>'-'+m[0]+m.slice(1).toLowerCase()+'-')):null;
export function parseCompanyHistory(body,symbol,segment,now){
 companySymbol(symbol);if(!['equities','sme'].includes(segment))throw Error('Invalid segment');
 const parsed=JSON.parse(body);if(!Array.isArray(parsed.data)||Buffer.byteLength(body)>1000000)throw Error('Invalid annual report index');
 let rejected=0;const seen=new Set();
 const reports=parsed.data.flatMap(row=>{
  let u;try{u=new URL(row.fileName);}catch{rejected++;return [];}
  if(u.protocol!=='https:'||!['nsearchives.nseindia.com','archives.nseindia.com'].includes(u.hostname)||u.port||u.username||u.password||u.search||u.hash||!/^\/annual_reports\/[A-Za-z0-9_.%-]+\.(pdf|zip)$/i.test(u.pathname)||typeof row.companyName!=='string'||!row.companyName.trim()||!/^\d{4}$/.test(row.fromYr)||!/^\d{4}$/.test(row.toYr)||Number(row.toYr)<Number(row.fromYr)||Number(row.toYr)>new Date(now).getUTCFullYear()+1){rejected++;return [];}
  const submittedAt=time(row.broadcast_dttm),publishedAt=time(row.disseminationDateTime);
  if([submittedAt,publishedAt].some(t=>t&&Date.parse(t)>now)||submittedAt&&publishedAt&&submittedAt>publishedAt){rejected++;return [];}
  const id=hash(u.href+'|'+(publishedAt||'UNKNOWN'));if(seen.has(id))return [];seen.add(id);
  return [{id,company:row.companyName.slice(0,200),fromYear:row.fromYr,toYear:row.toYr,revision:typeof row.submission_type==='string'?row.submission_type.slice(0,40):'Unknown',url:u.href,format:u.pathname.toLowerCase().endsWith('.pdf')?'PDF':'ZIP',submittedAt,publishedAt,observedAt:new Date(now).toISOString(),timingStatus:publishedAt?'PUBLICATION_RECORDED':'PUBLICATION_UNKNOWN',verification:'INDEX_ONLY_CONTENT_NOT_REVIEWED'}];
 }).sort((a,b)=>b.toYear.localeCompare(a.toYear)||(b.publishedAt||'').localeCompare(a.publishedAt||'')||a.id.localeCompare(b.id));
 return {symbol,segment,status:reports.length?'AVAILABLE':parsed.data.length?'NO_VALID_REPORTS':'EMPTY_INDEX',source:'https://www.nseindia.com/api/annual-reports?index='+segment+'&symbol='+encodeURIComponent(symbol),sourceHash:hash(body),observedAt:new Date(now).toISOString(),reports:reports.slice(0,20),coverage:{received:parsed.data.length,rejected,returned:Math.min(20,reports.length),truncated:reports.length>20},limitations:['Company-specific NSE index, not a guarantee of complete history. Symbol query is not an independently verified ISIN mapping.','Publication uses exchange dissemination time; unavailable timestamps are never inferred from filenames or financial years.','Index observed now: not evidence that this application knew these reports at an earlier date.','This index does not include report contents. Separate PDF previews require review; no governance clearance or financial score is implied.']};
}
export function createCompanyHistoryReader({fetcher=fetch,clock=Date.now}={}){
 const cache=new Map(),pending=new Map();
 return async(symbol,segment='equities')=>{
  companySymbol(symbol);if(!['equities','sme'].includes(segment))throw Error('Invalid segment');
  const key=segment+':'+symbol,cached=cache.get(key);if(cached&&clock()-Date.parse(cached.observedAt)<300000)return cached;
  if(pending.has(key))return pending.get(key);if(pending.size>=3)throw Error('Company history reader busy');
  const promise=(async()=>{const r=await fetcher('https://www.nseindia.com/api/annual-reports?index='+segment+'&symbol='+encodeURIComponent(symbol),{redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Company history unavailable');
   const stream=r.body?.getReader();if(!stream)throw Error('Empty response');let bytes=0;const chunks=[];try{for(;;){const {done,value}=await stream.read();if(done)break;bytes+=value.length;if(bytes>1000000)throw Error('Index too large');chunks.push(value);}}finally{await stream.cancel().catch(()=>{});}
   const result=parseCompanyHistory(Buffer.concat(chunks).toString('utf8'),symbol,segment,clock());if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(key,result);return result;})();
  pending.set(key,promise);try{return await promise;}finally{pending.delete(key);}
 };
}
export const companyHistoryReader=createCompanyHistoryReader();
export async function captureCompanyHistories(candidates,{reader=companyHistoryReader,clock=Date.now}={}){
 const symbols=[...new Set(candidates.map(c=>c.symbol).filter(s=>typeof s==='string'&&/^[A-Z0-9&-]{1,30}$/.test(s)))].sort();
 const selected=symbols.slice(0,3),results=await Promise.allSettled(selected.map(s=>reader(s)));
 return {research:{policy:SCRAP_POLICY,status:'INSUFFICIENT_EVIDENCE',pillars:scrapRequirements.map(p=>({...p,status:'NOT_ASSESSED'})),thresholds:{sectorGrowthPct:15,companyGrowthPct:25,status:'USER_SCREENING_HYPOTHESES_NOT_VALIDATED'}},policy:'company-history-index-v1',capturedAt:new Date(clock()).toISOString(),selection:'FIRST_THREE_SYMBOLS_ALPHABETICALLY_EQUITIES_ONLY',notSelected:symbols.slice(3),observations:results.map((r,i)=>r.status==='fulfilled'?{symbol:selected[i],status:'CAPTURED',history:r.value}:{symbol:selected[i],status:'UNAVAILABLE',history:null}),note:'Annual-report indexes only. No PDF extraction, verified company identity, governance findings or allocation approval.'};
}
