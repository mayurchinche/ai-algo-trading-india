// Backfill annual results (Ind AS, NBFC Ind AS and banking formats) for named companies from NSE's per-company integrated-filing index, and
// (when the company's ISIN is known) its earlier audited annual results, so multi-year growth is available.
// Older files label some full-year facts with quarter contexts; the parser drops every context whose dates
// disagree with the filing's declared reporting period, and they carry no ISIN, so identity is the symbol
// matched against the requested company's ISIN (recorded as the filing's identity basis).
import {createHash} from 'node:crypto';
import {parseFinancialDisclosure,MAX_DOCUMENT_BYTES} from './financialStatements.js';
import {toFundamentalFiling} from './fundamentals.js';
import {companySymbol} from './companyHistory.js';
import {disclosureTime,readPublic} from './companyDisclosures.js';
import {corporateActionsUrl,parseCorporateActions,relinkFormerIsin} from './isinLineage.js';
const sha=v=>createHash('sha256').update(v).digest('hex');
const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
export const filingIndexUrl=symbol=>'https://www.nseindia.com/api/integrated-filing-results?index=equities&size=100&symbol='+encodeURIComponent(companySymbol(symbol));
const quarterEnd=v=>{const m=/^(\d{2})-([A-Z]{3})-(\d{4})$/.exec(v||'');if(!m||!MONTHS.includes(m[2]))return null;const d=`${m[3]}-${String(MONTHS.indexOf(m[2])+1).padStart(2,'0')}-${m[1]}`;return new Date(d).toISOString().slice(0,10)===d?d:null;};
const xbrlUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='nsearchives.nseindia.com'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/corporate\/xbrl\/INTEGRATED_FILING_(?:INDAS|BANKING|NBFC_INDAS)_[A-Za-z0-9_]+\.xml$/.test(u.pathname)?u.href:null;}catch{return null;}};

// Selects financial-result filings (Ind AS, NBFC Ind AS, banking) for quarters ending 31 March, which carry a full
// April–March year and its year-end balance sheet, plus the quarters after the latest such year end, whose
// paid-up capital and face value keep the share count (market cap) current. Earlier quarters are counted, not
// used, as are governance and insurance filings.
export function parseFilingIndex(body,symbol,now){
 companySymbol(symbol);
 const parsed=JSON.parse(body);if(!parsed||!Array.isArray(parsed.data))throw Error('Invalid filing index');
 const counts={received:parsed.data.length,otherFilingTypes:0,notFinancialYearEnd:0,rejected:0};const seen=new Set(),valid=[],items=[];
 for(const row of parsed.data){
  if(typeof row?.xbrl!=='string'||!/INTEGRATED_FILING_(?:INDAS|BANKING|NBFC_INDAS)_/.test(row.xbrl)){counts.otherFilingTypes++;continue;}
  const url=xbrlUrl(row.xbrl),publishedAt=disclosureTime(row.broadcast_Date),qe=quarterEnd(row.qe_Date);
  if(!url||!publishedAt||Date.parse(publishedAt)>now||!qe||row.symbol!==undefined&&row.symbol!==symbol){counts.rejected++;continue;}
  valid.push({row,url,publishedAt,qe});
 }
 const latestYearEnd=valid.map(v=>v.qe).filter(qe=>qe.endsWith('-03-31')).sort().at(-1);
 for(const {row,url,publishedAt,qe} of valid){
  if(!qe.endsWith('-03-31')&&!(latestYearEnd&&qe>latestYearEnd)){counts.notFinancialYearEnd++;continue;}
  const id=sha(url+'|'+publishedAt);if(seen.has(id))continue;seen.add(id);
  items.push({id,url,publishedAt,quarterEnd:qe,scope:typeof row.consolidated==='string'?row.consolidated:null});
 }
 const total=Number.isInteger(parsed.totalCount)?parsed.totalCount:null;
 return {source:filingIndexUrl(symbol),sourceHash:sha(body),observedAt:new Date(now).toISOString(),items:items.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.id.localeCompare(b.id)),coverage:{...counts,selected:items.length,totalCount:total,truncated:total===null||total>parsed.data.length}};
}

export const legacyIndexUrl=symbol=>'https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Annual&symbol='+encodeURIComponent(companySymbol(symbol));
const legacyXbrlUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='nsearchives.nseindia.com'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/corporate\/xbrl\/INDAS_\d+_\d+_\d+(?:_WEB)?\.xml$/.test(u.pathname)?u.href:null;}catch{return null;}};
// Audited annual results (April–March) from FY`fromYear` on, before integrated filings began.
export function parseLegacyAnnualIndex(body,symbol,now,{fromYear=2019,beforeYear=2025}={}){
 companySymbol(symbol);
 const rows=JSON.parse(body);if(!Array.isArray(rows))throw Error('Invalid annual results index');
 const seen=new Set(),items=[];let rejected=0,outOfRange=0;
 for(const row of rows){
  const url=legacyXbrlUrl(row?.xbrl),publishedAt=disclosureTime(row?.broadCastDate),end=quarterEnd(String(row?.toDate??'').toUpperCase());
  if(!url||!publishedAt||Date.parse(publishedAt)>now||!end||row.period!=='Annual'||!end.endsWith('-03-31')){rejected++;continue;}
  const year=Number(end.slice(0,4));if(year<fromYear||year>=beforeYear){outOfRange++;continue;}
  const id=sha(url+'|'+publishedAt);if(seen.has(id))continue;seen.add(id);
  items.push({id,url,publishedAt,quarterEnd:end,scope:typeof row.consolidated==='string'?row.consolidated:null,legacy:true});
 }
 return {source:legacyIndexUrl(symbol),sourceHash:sha(body),items:items.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.id.localeCompare(b.id)),coverage:{received:rows.length,selected:items.length,rejected,outOfRange}};
}
const outcome=(item,status,extra={})=>({id:item.id,url:item.url,publishedAt:item.publishedAt,quarterEnd:item.quarterEnd,status,...extra});
// Each target is {symbol, isin?}. With an ISIN, identity is the ISIN: issuers sometimes file under a former or
// mistyped symbol (TATAMOTORS for TMPV, BAJAJAUTO for BAJAJ-AUTO), which is kept as filedSymbol.
// Without an ISIN, the filed symbol must equal the requested symbol.
export async function backfillFundamentalFilings({targets,store,legacy=true,read=(url,max)=>readPublic(url,fetch,max),clock=Date.now,pause=()=>new Promise(r=>setTimeout(r,300))}){
 const results=[];
 for(const {symbol,isin} of targets){
  if(isin!==undefined&&!/^INE[A-Z0-9]{9}$/.test(isin))throw Error('Invalid ISIN for '+symbol);
  let index;
  try{index=parseFilingIndex(await read(filingIndexUrl(symbol)),symbol,clock());}
  catch{results.push({symbol,isin:isin??null,status:'INDEX_UNAVAILABLE',index:null,outcomes:[]});await pause();continue;}
  // Earlier audited annual results need the ISIN: those files identify the company only by symbol.
  if(legacy&&isin){try{const l=parseLegacyAnnualIndex(await read(legacyIndexUrl(symbol)),symbol,clock());index.items.push(...l.items.map(i=>({...i,expected:{symbol,isin}})));index.coverage.legacy=l.coverage;}catch{index.coverage.legacy='INDEX_UNAVAILABLE';}await pause();}
  let actions;
  const stored=new Set((await store.known(index.items.map(i=>i.id))).map(r=>r.id));
  const outcomes=index.items.filter(i=>stored.has(i.id)).map(i=>outcome(i,'ALREADY_RECORDED'));
  for(const item of index.items.filter(i=>!stored.has(i.id))){
   await pause();
   let filing,relinked=null;
   try{
    const doc=parseFinancialDisclosure(await read(item.url,MAX_DOCUMENT_BYTES),item,clock());
    filing=toFundamentalFiling(doc);
    if(isin?doc.instrumentKey!=='NSE_EQ|'+isin:doc.symbol!==symbol){
     // A former ISIN of the same issuer is accepted only with NSE's record of a face-value change after the filing.
     let reason='NO_ISIN';
     if(isin){
      if(actions===undefined){try{actions=parseCorporateActions(await read(corporateActionsUrl(symbol)),companySymbol(symbol),clock());}catch{actions=null;}}
      const linked=actions?relinkFormerIsin(filing,{symbol:companySymbol(symbol),currentIsin:isin,corporateActions:actions}):{reason:'CORPORATE_ACTIONS_UNAVAILABLE'};
      if(linked.filing){filing=linked.filing;relinked=doc.instrumentKey;}else reason=linked.reason;
     }
     if(!relinked){outcomes.push(outcome(item,'IDENTITY_MISMATCH',{filedSymbol:doc.symbol,filedInstrumentKey:doc.instrumentKey,lineage:reason}));continue;}
    }
   }catch(e){
    // Pre-FY2023 annual files reference contexts they never define and carry no company identity; they are
    // recorded as unreadable rather than as a failed read.
    outcomes.push(outcome(item,e?.code==='UNSUPPORTED_FINANCIAL_FORMAT'?'UNSUPPORTED_FORMAT':item.legacy&&/identity|context/i.test(e?.message??'')?'LEGACY_UNVERIFIABLE':'READ_FAILED'));continue;
   }
   const filed={...(filing.symbol!==symbol?{filedSymbol:filing.symbol}:{}),...(relinked?{relinkedFrom:relinked}:{})};
   try{const saved=await store.save(filing);outcomes.push(outcome(item,saved?.id===filing.id?'RECORDED':'DUPLICATE_DOCUMENT',filed));}
   catch{outcomes.push(outcome(item,'STORE_FAILED'));}
  }
  const failed=outcomes.filter(o=>['READ_FAILED','STORE_FAILED','IDENTITY_MISMATCH'].includes(o.status)).length;
  results.push({symbol,isin:isin??null,status:failed?'PARTIAL':index.items.length?'COMPLETE':'NO_SUPPORTED_ANNUAL_FILINGS',index:{source:index.source,sourceHash:index.sourceHash,observedAt:index.observedAt,coverage:index.coverage},outcomes});
  await pause();
 }
 const all=results.flatMap(r=>r.outcomes),count=s=>all.filter(o=>o.status===s).length;
 return {policy:'fundamental-backfill-v1',selection:'INTEGRATED_FILING_INDAS_NBFC_BANKING_QUARTER_ENDING_31_MARCH_AND_LATER_QUARTERS',symbols:results,
  coverage:{symbols:targets.length,indexUnavailable:results.filter(r=>r.status==='INDEX_UNAVAILABLE').length,recorded:count('RECORDED'),alreadyRecorded:count('ALREADY_RECORDED'),duplicates:count('DUPLICATE_DOCUMENT'),unsupportedFormat:count('UNSUPPORTED_FORMAT'),failed:count('READ_FAILED')+count('STORE_FAILED')+count('IDENTITY_MISMATCH')},
  limitations:['Integrated filings start with the quarter ended 31 Dec 2024; earlier audited annual results (FY2019–FY2024) are added when the ISIN is known, identified by symbol.','Older NSE XBRL contexts can contradict the declared reporting period.','Companies whose financial year does not end on 31 March are not backfilled.','The company index is NSE-provided and observed now; publication times come from it, while each stored filing records when this app read it.']};
}
