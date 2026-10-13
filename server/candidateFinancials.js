import {compareFinancialGrowth} from './financialGrowth.js';
// Identity and time matching only. Issuer-reported observations are not verified thesis facts.
export function matchCandidateFinancials(instrumentKey,snapshot,asOf){
 const base={policy:'candidate-financial-links-v1',documentIds:[],note:'Matching filings from a limited saved sample. No completeness, freshness or investment-quality conclusion.'};
 if(!snapshot)return {...base,status:'NOT_RECORDED'};
 if(!['CAPTURED_SAMPLE','PARTIAL'].includes(snapshot.status))return {...base,status:snapshot.status==='NO_STRUCTURED_FILINGS'?'NO_MATCH_IN_SAMPLE':'SOURCE_UNAVAILABLE'};
 const decision=Date.parse(asOf),captured=Date.parse(snapshot.capturedAt);
 if(!Number.isFinite(decision)||!Number.isFinite(captured)||captured>decision)return {...base,status:'INVALID_SNAPSHOT_TIME'};
 const documents=(snapshot.documents||[]).filter(d=>{
  const published=Date.parse(d.publishedAt),observed=Date.parse(d.observedAt);
  return d.instrumentKey===instrumentKey&&d.kind==='FINANCIALS'&&d.status==='EXTRACTED_REQUIRES_REVIEW'&&Number.isFinite(published)&&Number.isFinite(observed)&&published<=observed&&observed<=captured;
 });
 // Never pick one revision, scope or period as automatically authoritative.
 return {...base,status:documents.length?'MATCHED_REQUIRES_REVIEW':'NO_MATCH_IN_SAMPLE',documentIds:[...new Set(documents.map(d=>d.id))].sort(),growth:compareFinancialGrowth(documents)};
}
