import {reportEvidenceStore} from './reportEvidenceStore.js';
export function selectArchivedEvidence(rows,candidates,asOf){
 const now=Date.parse(asOf);if(!Number.isFinite(now))throw Error('Invalid archive cutoff');
 const symbols=[...new Set(candidates.map(c=>c.symbol).filter(s=>typeof s==='string'))].sort();
 const relevant=rows.filter(r=>symbols.includes(r.report?.symbol));
 const records=[],excluded=[],seen=new Set();let bytes=0;
 for(const row of [...relevant].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||String(a.id).localeCompare(String(b.id)))){
  const r=row.report,times=[r.publishedAt,r.observedAt,row.created_at].map(Date.parse);
  let reason=null;
  if(times.some(t=>!Number.isFinite(t)||t>now)||times[0]>times[1]||times[1]>times[2])reason='TIMING_UNVERIFIED_OR_AFTER_CUTOFF';
  else if(r.policy!=='report-passages-v1'||r.status!=='EXTRACTED_REQUIRES_REVIEW'||r.segment!=='equities')reason='UNSUPPORTED_OR_INCOMPLETE_EXTRACTION';
  const identity=[r.symbol,r.segment,r.documentHash].join('|');
  if(!reason&&seen.has(identity))reason='DUPLICATE_DOCUMENT';
  const size=Buffer.byteLength(JSON.stringify(row));
  if(!reason&&(records.length>=5||bytes+size>200000))reason='SNAPSHOT_LIMIT';
  if(reason){excluded.push({id:row.id,symbol:r.symbol,reason});continue;}
  seen.add(identity);bytes+=size;records.push(structuredClone(row));
 }
 return {policy:'archived-portfolio-evidence-v1',status:records.length?'CAPTURED_REQUIRES_REVIEW':'NO_ELIGIBLE_ARCHIVED_EVIDENCE',asOf,records,excluded,missingSymbols:symbols.filter(s=>!records.some(r=>r.report.symbol===s)),note:'Exact symbol match only, not verified ISIN identity. Equity reports only; up to five documents and 200 KB. Passages remain unverified review context and cannot satisfy allocation gates.'};
}
export async function captureArchivedEvidence(candidates,{store=reportEvidenceStore,clock=Date.now}={}){
 const asOf=new Date(clock()).toISOString();
 try{return selectArchivedEvidence(await store().list(),candidates,asOf);}catch{return {policy:'archived-portfolio-evidence-v1',status:'UNAVAILABLE',asOf,records:[],excluded:[],missingSymbols:[],note:'Archive unavailable; candidate coverage cannot be determined. No allocation approval is inferred.'};}
}
