import {createHash} from 'node:crypto';
import {companyHistoryReader} from './companyHistory.js';
const topics=[['audit','Audit opinion and auditor changes',/\b(qualified opinion|adverse opinion|disclaimer of opinion|key audit matters?|auditor.{0,20}resign|independent auditor)/i],['fees','Auditor fees and services',/\b(audit(?:or|ors)?[’']? fees?|remuneration to auditors|non.audit services|payment.{0,20}auditors)/i],['pay','Management remuneration',/\b(managerial remuneration|remuneration.{0,30}(director|management)|director.{0,20}remuneration)/i],['related','Related parties and ownership',/\b(related party|related parties|pledged|encumbrance)/i],['cash','Cash flow and accounting',/\b(cash flows? from operating|capitalis(?:ed|ation)|trade receivables|contingent liabilities)/i],['capital','Capital allocation',/\b(capital expenditure|capital allocation|business combination|goodwill impairment|buyback)/i]];
export function locateReportPassages(pages){
 return topics.map(([id,title,pattern])=>{
  const passages=[];let matchingPages=0;
  for(const page of pages){const text=page.text.replace(/\s+/g,' ').trim(),match=pattern.exec(text);if(!match)continue;matchingPages++;if(passages.length<3){const start=Math.max(0,match.index-180),end=Math.min(text.length,match.index+420);passages.push({page:page.page,text:(start?'…':'')+text.slice(start,end)+(end<text.length?'…':''),status:'TOPIC_MATCH_REQUIRES_REVIEW'});}}
  return {id,title,status:passages.length?'PASSAGES_FOUND':'NO_MATCH_IN_EXTRACTED_TEXT',matchingPages,passages};
 });
}
export async function extractPdfPages(bytes){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,verbosity:0});
 let pdf;try{pdf=await task.promise;if(pdf.numPages>600)throw Error('Report page limit exceeded');const pages=[];let total=0;const deadline=Date.now()+20000;
 for(let page=1;page<=pdf.numPages;page++){if(Date.now()>deadline)throw Error('Report extraction deadline exceeded');const p=await pdf.getPage(page);const content=await p.getTextContent();const text=content.items.map(i=>typeof i.str==='string'?i.str:'').join(' ');total+=text.length;if(total>8000000)throw Error('Report text limit exceeded');pages.push({page,text});p.cleanup();}return pages;
 }finally{await task.destroy();}
}
export function createReportPassageReader({history=companyHistoryReader,fetcher=fetch,extract=extractPdfPages,clock=Date.now}={}){
 const cache=new Map(),pending=new Map();
 return async(symbol,segment,id)=>{
  const index=await history(symbol,segment),report=index.reports.find(r=>r.id===id);
  if(!report||report.format!=='PDF')throw Error('Select a PDF from the current company index');
  const u=new URL(report.url);if(u.protocol!=='https:'||!['nsearchives.nseindia.com','archives.nseindia.com'].includes(u.hostname)||u.username||u.password||u.port||u.search||u.hash||!/^\/annual_reports\/[A-Za-z0-9_.%-]+\.pdf$/i.test(u.pathname))throw Error('Unsupported source');
  const key=symbol+':'+segment+':'+id,hit=cache.get(key);if(hit&&clock()-Date.parse(hit.observedAt)<300000)return hit;
  if(pending.has(key))return pending.get(key);if(pending.size>=2)throw Error('Report reader busy');
  const promise=(async()=>{const r=await fetcher(u.href,{redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Report unavailable');const reader=r.body?.getReader();if(!reader)throw Error('Empty report');const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12000000)throw Error('Report byte limit exceeded');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=Buffer.concat(chunks);if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('Not a PDF');
  const pages=await extract(bytes),textPages=pages.filter(p=>p.text.trim().length>=50).length;
  const result={policy:'report-passages-v1',id,symbol,company:report.company,url:report.url,fromYear:report.fromYear,toYear:report.toYear,revision:report.revision,publishedAt:report.publishedAt,indexObservedAt:index.observedAt,observedAt:new Date(clock()).toISOString(),documentHash:createHash('sha256').update(bytes).digest('hex'),status:textPages?'EXTRACTED_REQUIRES_REVIEW':'OCR_OR_MANUAL_REVIEW_REQUIRED',coverage:{pages:pages.length,textPages,lowTextPages:pages.length-textPages},topics:locateReportPassages(pages),note:'Keyword-located passages only, not findings or governance clearance. Negation, scope, tables and context require original-page review. PDF page numbers may differ from printed page labels. No OCR, numeric table interpretation or company identity verification. This preview is not saved with a portfolio.'};
  if(cache.size>=5)cache.delete(cache.keys().next().value);cache.set(key,result);return result;})();pending.set(key,promise);try{return await promise;}finally{pending.delete(key);}
 };
}
export const reportPassageReader=createReportPassageReader();
