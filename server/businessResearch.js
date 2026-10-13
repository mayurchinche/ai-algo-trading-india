import {BUSINESS_RESEARCH_POLICY,researchPillars,sectorResearchFields} from '../shared/businessResearch.js';
const primaryTypes=new Set(['COMPANY_FILING','EXCHANGE_ANNOUNCEMENT','ANNUAL_REPORT','EARNINGS_TRANSCRIPT','OFFICIAL_POLICY']);
// Facts supplied here have already passed factsKnownAt in decisionEvidence.
// Source adapters, never public request bodies, assign documentType after review.
export function assessBusinessResearch(evidence){
 const facts=evidence.facts||[],byId=new Map(facts.map(f=>[f.id,f]));
 const sector=facts.find(f=>f.category==='sector'&&f.key==='classification')?.value;
 const profile=sectorResearchFields(sector),research=evidence.thesis?.businessResearch;
 const blockers=[];
 const matches=(f,category,key)=>f.category===category&&(f.key===key||category==='management'&&key==='delivery'&&['delivery.guidance','delivery.actual'].includes(f.key))&&primaryTypes.has(f.documentType);
 const pillars=researchPillars.map(p=>{
  const spec=p.id==='orders'?profile:p;
  const submitted=research?.[p.id];
  const outlook=(p.id==='global'?['FAVORABLE','MIXED','ADVERSE','NOT_MATERIAL']:['FAVORABLE','MIXED','ADVERSE']).includes(submitted?.outlook)?submitted.outlook:null;
  const fields=spec.fields.map(([key,label])=>{
   const claim=submitted?.[key],ids=claim?.factIds;
   const matching=Array.isArray(ids)?ids.map(id=>byId.get(id)).filter(f=>f&&matches(f,spec.category,key)):[];
   const firmOrders=spec.category!=='orders'||key!=='commitments'||matching.some(f=>['CONFIRMED','NONE_DISCLOSED'].includes(f.commitmentStatus));
   const guidanceComparison=p.id!=='management'||key!=='delivery'||matching.some(f=>f.observationType==='GUIDANCE'&&typeof f.financialPeriod==='string'&&f.financialPeriod.trim()&&matching.some(actual=>actual.observationType==='ACTUAL_OUTCOME'&&actual.financialPeriod===f.financialPeriod&&Date.parse(f.publishedAt)<Date.parse(actual.publishedAt)));
   const supported=firmOrders&&guidanceComparison&&typeof claim?.text==='string'&&claim.text.trim().length>0&&claim.text.length<=4000&&Array.isArray(ids)&&ids.length>0&&ids.length<=30&&ids.every(id=>byId.has(id))&&ids.some(id=>{const f=byId.get(id);return matches(f,spec.category,key);});
   if(!supported)blockers.push(`BUSINESS_${p.id.toUpperCase()}_${key.toUpperCase()}_UNSUPPORTED`);
   return {key,label,status:supported?'CITED_REQUIRES_REVIEW':'MISSING_EVIDENCE',text:supported?claim.text:null,factIds:supported?[...new Set(ids)]:[]};
  });
  if(!outlook)blockers.push(`BUSINESS_${p.id.toUpperCase()}_OUTLOOK_MISSING`);
  if(outlook==='ADVERSE')blockers.push(`BUSINESS_${p.id.toUpperCase()}_ADVERSE_REVIEW_REQUIRED`);
  return {id:p.id,title:p.id==='orders'&&profile.profile!=='orders'?`Revenue visibility · ${profile.profile}`:p.title,status:fields.every(f=>f.status==='CITED_REQUIRES_REVIEW')&&outlook?'COVERAGE_COMPLETE_REQUIRES_REVIEW':'INCOMPLETE',outlook,fields};
 });
 return {policy:BUSINESS_RESEARCH_POLICY,status:blockers.length?'NO_ALLOCATION':'REVIEW_REQUIRED',sectorProfile:profile.profile,blockers,pillars};
}
