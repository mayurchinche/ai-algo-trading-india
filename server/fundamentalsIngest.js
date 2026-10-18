import {financialDisclosureReader} from './companyDisclosures.js';
import {toFundamentalFiling} from './fundamentals.js';
// The reader allows four documents in flight; the budget leaves room inside a 60 s function.
const BATCH=4,BUDGET_MS=40000;
const outcome=(item,status)=>({id:item.id,url:item.url,publishedAt:item.publishedAt,status});
export async function ingestFundamentalFilings({store,reader=financialDisclosureReader,clock=Date.now}){
 const started=clock(),feed=await reader.feed();
 const xml=feed.items.filter(item=>item.format==='XML');
 const stored=new Set((await store.known(xml.map(item=>item.id))).map(row=>row.id));
 const outcomes=xml.filter(item=>stored.has(item.id)).map(item=>outcome(item,'ALREADY_RECORDED'));
 const pending=xml.filter(item=>!stored.has(item.id));
 for(let i=0;i<pending.length;i+=BATCH){
  if(clock()-started>BUDGET_MS){outcomes.push(...pending.slice(i).map(item=>outcome(item,'DEFERRED')));break;}
  outcomes.push(...await Promise.all(pending.slice(i,i+BATCH).map(async item=>{
   let filing;
   try{const doc=await reader.document(item.id);if(doc.id!==item.id||doc.url!==item.url||doc.publishedAt!==item.publishedAt)return outcome(item,'INVALID_PROVENANCE');filing=toFundamentalFiling(doc);}
   catch{return outcome(item,'READ_FAILED');}
   try{const saved=await store.save(filing);return outcome(item,saved?.id===filing.id?'RECORDED':'DUPLICATE_DOCUMENT');}
   catch{return outcome(item,'STORE_FAILED');}
  })));
 }
 const count=status=>outcomes.filter(o=>o.status===status).length;
 const settled=count('RECORDED')+count('ALREADY_RECORDED')+count('DUPLICATE_DOCUMENT');
 return {policy:'fundamental-ingest-v1',status:!xml.length?'NO_STRUCTURED_FILINGS':settled===xml.length?'COMPLETE':settled?'PARTIAL':'FAILED',startedAt:new Date(started).toISOString(),completedAt:new Date(clock()).toISOString(),
  feed:{source:feed.source,receivedAt:feed.receivedAt,sourceHash:feed.sourceHash,status:feed.status,coverage:feed.coverage},
  coverage:{xmlItems:xml.length,pdfItemsNotIngested:feed.items.length-xml.length,alreadyRecorded:count('ALREADY_RECORDED'),recorded:count('RECORDED'),duplicates:count('DUPLICATE_DOCUMENT'),deferred:count('DEFERRED'),failed:xml.length-settled-count('DEFERRED')},
  outcomes,limitations:['Rolling exchange feed: filings that left the feed between runs are not recovered, and a truncated feed may omit filings.','PDF-only filings are not ingested.','Failed and deferred filings are retried on the next run while they remain in the feed.']};
}
