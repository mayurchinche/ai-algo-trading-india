// Backfill annual Ind AS results for named companies from NSE's per-company integrated-filing index.
// Older pre-integrated XBRL files are not used: their contexts can mislabel full-year facts as quarters.
import {createHash} from 'node:crypto';
import {parseFinancialDisclosure,MAX_DOCUMENT_BYTES} from './financialStatements.js';
import {toFundamentalFiling} from './fundamentals.js';
import {companySymbol} from './companyHistory.js';
import {disclosureTime,readPublic} from './companyDisclosures.js';
const sha=v=>createHash('sha256').update(v).digest('hex');
const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
export const filingIndexUrl=symbol=>'https://www.nseindia.com/api/integrated-filing-results?index=equities&size=100&symbol='+encodeURIComponent(companySymbol(symbol));
const quarterEnd=v=>{const m=/^(\d{2})-([A-Z]{3})-(\d{4})$/.exec(v||'');if(!m||!MONTHS.includes(m[2]))return null;const d=`${m[3]}-${String(MONTHS.indexOf(m[2])+1).padStart(2,'0')}-${m[1]}`;return new Date(d).toISOString().slice(0,10)===d?d:null;};
const xbrlUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='nsearchives.nseindia.com'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/corporate\/xbrl\/INTEGRATED_FILING_INDAS_[A-Za-z0-9_]+\.xml$/.test(u.pathname)?u.href:null;}catch{return null;}};

// Selects Ind AS financial-result filings for quarters ending 31 March: the filings that carry a full
// April–March year and its year-end balance sheet. Governance and banking filings are counted, not used.
export function parseFilingIndex(body,symbol,now){
 companySymbol(symbol);
 const parsed=JSON.parse(body);if(!parsed||!Array.isArray(parsed.data))throw Error('Invalid filing index');
 const counts={received:parsed.data.length,otherFilingTypes:0,notFinancialYearEnd:0,rejected:0};const seen=new Set(),items=[];
 for(const row of parsed.data){
  if(typeof row?.xbrl!=='string'||!/INTEGRATED_FILING_INDAS_/.test(row.xbrl)){counts.otherFilingTypes++;continue;}
  const url=xbrlUrl(row.xbrl),publishedAt=disclosureTime(row.broadcast_Date),qe=quarterEnd(row.qe_Date);
  if(!url||!publishedAt||Date.parse(publishedAt)>now||!qe||row.symbol!==undefined&&row.symbol!==symbol){counts.rejected++;continue;}
  if(!qe.endsWith('-03-31')){counts.notFinancialYearEnd++;continue;}
  const id=sha(url+'|'+publishedAt);if(seen.has(id))continue;seen.add(id);
  items.push({id,url,publishedAt,quarterEnd:qe,scope:typeof row.consolidated==='string'?row.consolidated:null});
 }
 const total=Number.isInteger(parsed.totalCount)?parsed.totalCount:null;
 return {source:filingIndexUrl(symbol),sourceHash:sha(body),observedAt:new Date(now).toISOString(),items:items.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.id.localeCompare(b.id)),coverage:{...counts,selected:items.length,totalCount:total,truncated:total===null||total>parsed.data.length}};
}

const outcome=(item,status,extra={})=>({id:item.id,url:item.url,publishedAt:item.publishedAt,quarterEnd:item.quarterEnd,status,...extra});
// Each target is {symbol, isin?}. With an ISIN, identity is the ISIN: issuers sometimes file under a former or
// mistyped symbol (TATAMOTORS for TMPV, BAJAJAUTO for BAJAJ-AUTO), which is kept as filedSymbol.
// Without an ISIN, the filed symbol must equal the requested symbol.
export async function backfillFundamentalFilings({targets,store,read=(url,max)=>readPublic(url,fetch,max),clock=Date.now,pause=()=>new Promise(r=>setTimeout(r,300))}){
 const results=[];
 for(const {symbol,isin} of targets){
  if(isin!==undefined&&!/^INE[A-Z0-9]{9}$/.test(isin))throw Error('Invalid ISIN for '+symbol);
  let index;
  try{index=parseFilingIndex(await read(filingIndexUrl(symbol)),symbol,clock());}
  catch{results.push({symbol,isin:isin??null,status:'INDEX_UNAVAILABLE',index:null,outcomes:[]});await pause();continue;}
  const stored=new Set((await store.known(index.items.map(i=>i.id))).map(r=>r.id));
  const outcomes=index.items.filter(i=>stored.has(i.id)).map(i=>outcome(i,'ALREADY_RECORDED'));
  for(const item of index.items.filter(i=>!stored.has(i.id))){
   await pause();
   let filing;
   try{
    const doc=parseFinancialDisclosure(await read(item.url,MAX_DOCUMENT_BYTES),item,clock());
    if(isin?doc.instrumentKey!=='NSE_EQ|'+isin:doc.symbol!==symbol){outcomes.push(outcome(item,'IDENTITY_MISMATCH',{filedSymbol:doc.symbol,filedInstrumentKey:doc.instrumentKey}));continue;}
    filing=toFundamentalFiling(doc);
   }catch(e){outcomes.push(outcome(item,e?.code==='UNSUPPORTED_FINANCIAL_FORMAT'?'UNSUPPORTED_FORMAT':'READ_FAILED'));continue;}
   const filed=filing.symbol!==symbol?{filedSymbol:filing.symbol}:{};
   try{const saved=await store.save(filing);outcomes.push(outcome(item,saved?.id===filing.id?'RECORDED':'DUPLICATE_DOCUMENT',filed));}
   catch{outcomes.push(outcome(item,'STORE_FAILED'));}
  }
  const failed=outcomes.filter(o=>['READ_FAILED','STORE_FAILED','IDENTITY_MISMATCH'].includes(o.status)).length;
  results.push({symbol,isin:isin??null,status:failed?'PARTIAL':index.items.length?'COMPLETE':'NO_SUPPORTED_ANNUAL_FILINGS',index:{source:index.source,sourceHash:index.sourceHash,observedAt:index.observedAt,coverage:index.coverage},outcomes});
  await pause();
 }
 const all=results.flatMap(r=>r.outcomes),count=s=>all.filter(o=>o.status===s).length;
 return {policy:'fundamental-backfill-v1',selection:'INTEGRATED_FILING_INDAS_QUARTER_ENDING_31_MARCH',symbols:results,
  coverage:{symbols:targets.length,indexUnavailable:results.filter(r=>r.status==='INDEX_UNAVAILABLE').length,recorded:count('RECORDED'),alreadyRecorded:count('ALREADY_RECORDED'),duplicates:count('DUPLICATE_DOCUMENT'),unsupportedFormat:count('UNSUPPORTED_FORMAT'),failed:count('READ_FAILED')+count('STORE_FAILED')+count('IDENTITY_MISMATCH')},
  limitations:['Integrated filings start with the quarter ended 31 Dec 2024, so annual history begins with FY2025; 3- and 5-year growth and PEG need older years.','Pre-integrated NSE XBRL is excluded because its contexts can contradict the declared reporting period.','Companies whose financial year does not end on 31 March are not backfilled.','The company index is NSE-provided and observed now; publication times come from it, while each stored filing records when this app read it.']};
}
