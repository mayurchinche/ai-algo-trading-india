import {createHash} from 'node:crypto';
export const EVIDENCE_POLICY='decision-evidence-v1';
export const evidenceRequirements=Object.freeze({
 intraday:['sector','news','liquidity','session'],
 'short-term':['financials','sector','news','liquidity','corporate-actions'],
 'long-term':['financials','sector','valuation','governance','news','liquidity','corporate-actions'],
 options:['sector','news','liquidity','session','contract','volatility','greeks','expiry'],
 futures:['sector','news','liquidity','session','contract','margin','settlement'],
});
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const evidenceHash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const time=value=>typeof value==='string'?Date.parse(value):NaN;
const text=v=>typeof v==='string'&&v.trim().length>0;
const url=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
// Select only versions actually received by the system by this decision time.
// Financial period-end is never treated as publication/availability time.
export function factsKnownAt(facts,asOf,instrumentKey){
 const cutoff=time(asOf);if(!Number.isFinite(cutoff))throw Error('Invalid decision time');
 const selected=new Map(),rejected=[];
 const ids=new Map();
 for(const f of facts||[]){
  const reject=reason=>rejected.push({id:typeof f?.id==='string'?f.id:null,reason});
  if(!f||!text(f.id)||!text(f.key)||!text(f.category)||f.instrumentKey!==instrumentKey||f.verification!=='VERIFIED'||!url(f.sourceUrl)||!text(f.sourceName)||!text(f.unit)||!['number','string','boolean'].includes(typeof f.value)||typeof f.value==='number'&&!Number.isFinite(f.value)||typeof f.value==='string'&&!text(f.value)){reject('INVALID_OR_UNVERIFIED_FACT');continue;}
  const published=time(f.publishedAt),observed=time(f.observedAt),expires=time(f.expiresAt);
  if(![published,observed,expires].every(Number.isFinite)||observed<published||expires<=observed){reject('INVALID_FACT_TIMING');continue;}
  if(published>cutoff||observed>cutoff){reject('NOT_KNOWN_AT_DECISION');continue;}
  if(expires<=cutoff){reject('EXPIRED_FACT');continue;}
  const hash=evidenceHash(f);
  if(ids.has(f.id)&&ids.get(f.id)!==hash)throw Error('Conflicting fact revision identifier');
  ids.set(f.id,hash);
  const key=f.category+':'+f.key,prior=selected.get(key);
  if(prior&&time(prior.publishedAt)===published&&prior.id!==f.id)throw Error('Conflicting simultaneous fact revisions');
  if(!prior||published>time(prior.publishedAt))selected.set(key,structuredClone(f));
 }
 return {facts:[...selected.values()].sort((a,b)=>a.id.localeCompare(b.id)),rejected};
}
export function evaluateDecisionEvidence({candidate,segment,asOf,facts=[],thesis=null}){
 const required=evidenceRequirements[segment];if(!required)throw Error('Unknown evidence segment');
 if(!candidate||!text(candidate.signalId)||!text(candidate.symbol))throw Error('Candidate identity required');
 const instrumentKey=candidate.instrumentKey||candidate.symbol;
 const known=factsKnownAt(facts,asOf,instrumentKey),ids=new Set(known.facts.map(f=>f.id));
 const blockers=required.filter(category=>!known.facts.some(f=>f.category===category)).map(category=>`MISSING_${category.toUpperCase().replaceAll('-','_')}`);
 const supported=part=>part&&text(part.text)&&Array.isArray(part.factIds)&&part.factIds.length>0&&part.factIds.every(id=>ids.has(id));
 const fields=['whyStock','whyNow','contraryEvidence','entryCondition','invalidation','exitPlan'];
 for(const field of fields)if(!supported(thesis?.[field]))blockers.push('MISSING_SUPPORTED_'+field.replace(/[A-Z]/g,c=>'_'+c).toUpperCase());
 const risk=thesis?.risk;
 if(!risk||![risk.quantity,risk.capitalAtRisk,risk.plannedLossAtStop,risk.riskBudget,risk.estimatedCosts].every(Number.isFinite)||!Number.isInteger(risk.quantity)||risk.quantity<=0||risk.capitalAtRisk<=0||risk.riskBudget<=0||risk.plannedLossAtStop<=0||risk.estimatedCosts<0||risk.plannedLossAtStop+risk.estimatedCosts>risk.riskBudget||!text(risk.costModel)||!supported(risk.assumptions))blockers.push('RISK_PLAN_UNVERIFIED');
 if(!risk?.worstCase||!['BOUNDED','UNBOUNDED'].includes(risk.worstCase.kind)||!text(risk.worstCase.reason)||risk.worstCase.kind==='BOUNDED'&&(!Number.isFinite(risk.worstCase.amount)||risk.worstCase.amount<Math.max(risk.capitalAtRisk,risk.plannedLossAtStop)+risk.estimatedCosts))blockers.push('MAXIMUM_LOSS_NOT_EXPLAINED');
 if((segment==='futures'||candidate.side==='SELL')&&risk?.worstCase?.kind==='BOUNDED')blockers.push('UNSUPPORTED_BOUNDED_LOSS_CLAIM');
 // Coverage alone cannot establish a quality investment or authorise execution.
 const body={policy:EVIDENCE_POLICY,scope:'SHADOW_RESEARCH_NOT_EXECUTION',signalId:candidate.signalId,instrumentKey,segment,asOf,decision:blockers.length?'NO_TRADE':'REVIEW_REQUIRED',blockers,requiredCategories:required,facts:known.facts,rejectedFacts:known.rejected,thesis:thesis?structuredClone(thesis):null,baselineStrategy:candidate.strategy?.id||'UNRECORDED'};
 return {...body,snapshotHash:evidenceHash(body)};
}
export function attachDecisionEvidence(candidate,segment,asOf){
 // Do not manufacture financial/news facts from a technical score. Source adapters
 // must supply verified point-in-time evidence before this assessment can advance.
 const decisionEvidence=evaluateDecisionEvidence({candidate,segment,asOf,facts:candidate.verifiedFacts||[],thesis:candidate.thesis||null});
 return {...candidate,decisionEvidence};
}
