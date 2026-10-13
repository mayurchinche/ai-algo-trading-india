import {financialDisclosureReader} from './companyDisclosures.js';
// A bounded market-wide sample, not company-complete evidence or allocation approval.
export async function captureFinancialEvidence({reader=financialDisclosureReader,clock=Date.now}={}){
 const base={policy:'financial-observation-v1',selection:'LATEST_FOUR_XML_FILINGS',verification:'EXTRACTED_REQUIRES_REVIEW',note:'Recent market-wide sample, not complete candidate coverage. Figures are issuer-reported and do not authorize allocation.'};
 let feed;
 try{feed=await reader.feed();}catch{return {...base,status:'UNAVAILABLE',capturedAt:new Date(clock()).toISOString(),feed:null,documents:[],outcomes:[]};}
 const selected=feed.items.filter(item=>item.format==='XML').slice(0,4);
 const results=await Promise.allSettled(selected.map(item=>reader.document(item.id)));
 const documents=[],outcomes=[];
 for(let i=0;i<results.length;i++){
  const result=results[i],item=selected[i];let status='UNAVAILABLE';
  if(result.status==='fulfilled'){
   const doc=result.value;
   const times=[doc.publishedAt,doc.observedAt].map(Date.parse);
   if(doc.id!==item.id||doc.url!==item.url||doc.publishedAt!==item.publishedAt||times.some(t=>!Number.isFinite(t)||t>clock())||times[1]<times[0])status='INVALID_PROVENANCE';
   else if(Buffer.byteLength(JSON.stringify(doc))>50000)status='DOCUMENT_SIZE_LIMIT';
   else{documents.push(doc);status='CAPTURED';}
  }
  outcomes.push({id:item.id,url:item.url,publishedAt:item.publishedAt,status});
 }
 return {...base,status:!selected.length?'NO_STRUCTURED_FILINGS':documents.length===selected.length?'CAPTURED_SAMPLE':documents.length?'PARTIAL':'UNAVAILABLE',capturedAt:new Date(clock()).toISOString(),feed,documents,outcomes,coverage:{feedItems:feed.items.length,selected:selected.length,captured:documents.length,notSelected:feed.items.length-selected.length}};
}
