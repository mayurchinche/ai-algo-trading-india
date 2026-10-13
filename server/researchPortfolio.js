import {portfolioCoverage} from './portfolioCoverage.js';
import {matchCandidateFinancials} from './candidateFinancials.js';
import {BUSINESS_RESEARCH_POLICY} from '../shared/businessResearch.js';
import {assessBusinessResearch} from './businessResearch.js';
import {evaluateDecisionEvidence,evidenceHash} from './decisionEvidence.js';
export const PORTFOLIO_POLICY='evidence-portfolio-v1';
export function validateMandate(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['name','segment','budget','maxStockPct','maxSectorPct','cashReservePct','maxPositions','riskBudgetPct'].includes(k)))throw Error('Invalid portfolio settings');
 const m={...input,name:typeof input.name==='string'?input.name.trim():''};
 if(!m.name||m.name.length>80||!['short-term','long-term'].includes(m.segment))throw Error('A name and delivery investment horizon are required');
 const ranges={budget:[1000,10000000],maxStockPct:[1,25],maxSectorPct:[5,50],cashReservePct:[10,90],maxPositions:[1,20],riskBudgetPct:[0.1,2]};
 for(const [key,[min,max]] of Object.entries(ranges))if(!Number.isFinite(m[key])||m[key]<min||m[key]>max)throw Error(`Invalid ${key}`);
 if(!Number.isInteger(m.maxPositions)||m.maxStockPct>m.maxSectorPct)throw Error('Invalid position or sector limits');
 m.budget=Math.round(m.budget*100)/100;return m;
}
const money=n=>Math.round(n*100)/100;
// This planner accepts only server-sourced observations. There is no client fact,
// score or LLM-output field in the public API, and no order submission path.
export function buildResearchPortfolio({mandate,candidates=[],quotes=[],asOf,source}){
 const m=validateMandate(mandate),now=Date.parse(asOf);
 if(!Number.isFinite(now)||!Array.isArray(candidates)||candidates.length>200)throw Error('Invalid research snapshot');
 const assessments=[],allocations=[],sectors=new Map(),seen=new Set();
 let invested=0,costs=0,plannedLoss=0;
 const investable=m.budget*(1-m.cashReservePct/100),riskBudget=m.budget*m.riskBudgetPct/100;
 // Stable ordering is an allocation convention, not a prediction of returns.
 const ordered=[...candidates].sort((a,b)=>String(a.instrumentKey).localeCompare(String(b.instrumentKey))||String(b.signalTime).localeCompare(String(a.signalTime)));
 for(const c of ordered){
  if(!c.instrumentKey||seen.has(c.instrumentKey))continue;seen.add(c.instrumentKey);
  const financialResearch=matchCandidateFinancials(c.instrumentKey,source?.financialSnapshot,asOf);
  let evidence;
  try{evidence=evaluateDecisionEvidence({candidate:c,segment:m.segment,asOf,facts:c.verifiedFacts||c.decisionEvidence?.facts||[],thesis:c.thesis||c.decisionEvidence?.thesis||null});}catch{assessments.push({symbol:c.symbol||'Unknown',instrumentKey:c.instrumentKey,blockers:['CONFLICTING_OR_INVALID_EVIDENCE'],evidence:null,financialResearch});continue;}
  const businessResearch=assessBusinessResearch(evidence);
  const blockers=[...evidence.blockers,...businessResearch.blockers];
  const age=now-Date.parse(c.signalTime);
  if(!Number.isFinite(age)||age<0||age>86400000)blockers.push('SIGNAL_NOT_CURRENT');
  if(c.side!=='BUY'||!c.instrumentKey.startsWith('NSE_EQ|'))blockers.push('DELIVERY_LONG_ONLY');
  const sectorFact=evidence.facts.find(f=>f.category==='sector'&&f.key==='classification'&&typeof f.value==='string');
  const sector=sectorFact?.value.normalize('NFKC').trim().toLowerCase();if(!sector)blockers.push('VERIFIED_SECTOR_CLASSIFICATION_MISSING');
  const q=quotes.find(q=>q.symbol===c.instrumentKey);
  if(!q||![q.ask,q.bid,q.askSize].every(n=>Number.isFinite(n)&&n>0)||q.ask<q.bid||!['timestamp','observedAt'].every(k=>Number.isFinite(Date.parse(q[k]))&&Date.parse(q[k])<=now&&now-Date.parse(q[k])<=120000))blockers.push('FRESH_EXECUTABLE_QUOTE_MISSING');
  const risk=evidence.thesis?.risk;
  // Thesis risk numbers are for the cited quantity; do not silently rescale them.
  const quantity=risk?.quantity,amount=q&&quantity?money(q.ask*quantity):0;
  if(risk&&(!Number.isFinite(amount)||amount<=0||amount>risk.capitalAtRisk||quantity>q?.askSize))blockers.push('QUANTITY_OR_PRICE_REQUIRES_NEW_RISK_REVIEW');
  if(!blockers.length){
   if(allocations.length>=m.maxPositions)blockers.push('POSITION_LIMIT');
   if(amount>m.budget*m.maxStockPct/100)blockers.push('STOCK_LIMIT');
   if((sectors.get(sector)||0)+amount>m.budget*m.maxSectorPct/100)blockers.push('SECTOR_LIMIT');
   if(invested+costs+amount+risk.estimatedCosts>investable)blockers.push('CASH_RESERVE_LIMIT');
   if(plannedLoss+risk.plannedLossAtStop+risk.estimatedCosts>riskBudget)blockers.push('PORTFOLIO_RISK_LIMIT');
  }
  assessments.push({symbol:c.symbol,instrumentKey:c.instrumentKey,signalTime:c.signalTime,sector:sector||null,blockers:[...new Set(blockers)],evidence,businessResearch,financialResearch});
  if(blockers.length)continue;
  invested=money(invested+amount);costs=money(costs+risk.estimatedCosts);plannedLoss=money(plannedLoss+risk.plannedLossAtStop+risk.estimatedCosts);sectors.set(sector,money((sectors.get(sector)||0)+amount));
  allocations.push({symbol:c.symbol,instrumentKey:c.instrumentKey,sector,quantity,referenceAsk:q.ask,quoteTime:q.timestamp,amount,weightPct:money(amount/m.budget*100),estimatedCosts:risk.estimatedCosts,plannedLossAtStop:money(risk.plannedLossAtStop+risk.estimatedCosts),evidenceHash:evidence.snapshotHash});
 }
 const report={policy:PORTFOLIO_POLICY,businessResearchPolicy:BUSINESS_RESEARCH_POLICY,account:'user1',scope:'RESEARCH_PROPOSAL_NO_ORDERS',asOf,mandate:m,source,status:allocations.length?'REVIEW_REQUIRED':'UNALLOCATED',allocations,assessments,coverage:portfolioCoverage(assessments),totals:{invested,estimatedCosts:costs,unallocated:money(m.budget-invested-costs),plannedLossAtStop:plannedLoss},performance:{status:'NOT_MEASURED',netReturnPct:null,drawdownPct:null},limits:['Research budget is not a deposit or an existing paper-account balance.','Financial facts and thesis references require source review; completeness does not prove correctness.','Stop-based loss is a planning estimate; gaps can exceed it.','Alphabetical allocation is deterministic, not an optimal portfolio or a return forecast.','No correlation model, calibrated expected returns, LLM analysis or automatic rebalancing is enabled.']};
 return {...report,snapshotHash:evidenceHash(report)};
}
