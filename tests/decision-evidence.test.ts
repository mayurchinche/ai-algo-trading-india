import test from 'node:test';import assert from 'node:assert/strict';
import {factsKnownAt,evaluateDecisionEvidence,evidenceRequirements,attachDecisionEvidence} from '../server/decisionEvidence.js';
import {compareEvidencePolicies} from '../server/evidenceComparison.js';
const asOf='2026-10-01T04:30:00.000Z';
const fact=(extra:any={})=>({id:'f1',key:'trend',category:'sector',instrumentKey:'TEST',value:1,unit:'ratio',verification:'VERIFIED',sourceUrl:'https://example.com/filing',sourceName:'Test fixture',publishedAt:'2026-09-30T12:00:00.000Z',observedAt:'2026-09-30T12:01:00.000Z',expiresAt:'2026-10-02T12:00:00.000Z',...extra});
const candidate={signalId:'s1',symbol:'TEST',strategy:{id:'baseline'}};
test('point-in-time facts exclude delayed receipt, future publication, staleness and wrong identities',()=>{
 const result=factsKnownAt([fact(),fact({id:'late',observedAt:'2026-10-01T05:00:00Z'}),fact({id:'future',publishedAt:'2026-10-01T06:00:00Z',observedAt:'2026-10-01T06:01:00Z'}),fact({id:'stale',expiresAt:'2026-10-01T04:00:00Z'}),fact({id:'other',instrumentKey:'OTHER'}),fact({id:'bad',value:NaN})],asOf,'TEST');assert.deepEqual(result.facts.map(f=>f.id),['f1']);assert.equal(result.rejected.length,5);
});
test('restatement only changes decisions after receipt; conflicting version IDs fail',()=>{
 const revision=fact({id:'r2',publishedAt:'2026-10-01T03:00:00Z',observedAt:'2026-10-01T05:00:00Z',value:2});assert.equal(factsKnownAt([fact(),revision],asOf,'TEST').facts[0].value,1);assert.equal(factsKnownAt([fact(),revision],'2026-10-01T06:00:00Z','TEST').facts[0].value,2);assert.throws(()=>factsKnownAt([fact(),fact({value:3})],asOf,'TEST'),/Conflicting/);
});
test('every mode produces no trade with missing evidence, never inferred ratios or analyst approval',()=>{
 for(const segment of Object.keys(evidenceRequirements)){const report=evaluateDecisionEvidence({candidate,segment,asOf});assert.equal(report.decision,'NO_TRADE');assert.equal(report.facts.length,0);assert(report.blockers.length>6);assert.equal(report.baselineStrategy,'baseline');}
});
test('complete cited coverage needs review and cannot authorize execution; unsupported countercase blocks',()=>{
 const facts=evidenceRequirements.intraday.map((category,i)=>fact({id:'f'+i,category}));
 const supported={text:'Fixture assessment',factIds:['f0']};
 const thesis:any=Object.fromEntries(['whyStock','whyNow','contraryEvidence','entryCondition','invalidation','exitPlan'].map(k=>[k,supported]));
 thesis.risk={quantity:1,capitalAtRisk:100,plannedLossAtStop:5,riskBudget:10,estimatedCosts:1,costModel:'fixture',assumptions:supported,worstCase:{kind:'BOUNDED',amount:101,reason:'Cash-paid long position fixture'}};
 const report=evaluateDecisionEvidence({candidate,segment:'intraday',asOf,facts,thesis});assert.equal(report.decision,'REVIEW_REQUIRED');assert.equal(report.scope,'SHADOW_RESEARCH_NOT_EXECUTION');
 thesis.contraryEvidence={...supported,factIds:['unknown']};assert.equal(evaluateDecisionEvidence({candidate,segment:'intraday',asOf,facts,thesis}).decision,'NO_TRADE');assert.equal(report.thesis.contraryEvidence.factIds[0],'f0');
});
test('snapshot hashes are deterministic and candidate input is not mutated',()=>{
 const before=structuredClone(candidate),a=attachDecisionEvidence(candidate,'long-term',asOf),b=attachDecisionEvidence(candidate,'long-term',asOf);assert.deepEqual(candidate,before);assert.equal(a.decisionEvidence.snapshotHash,b.decisionEvidence.snapshotHash);assert.notEqual(attachDecisionEvidence(candidate,'short-term',asOf).decisionEvidence.snapshotHash,a.decisionEvidence.snapshotHash);
});
const times=['2026-09-01T10:00:00Z','2026-09-02T10:00:00Z','2026-09-03T10:00:00Z'];
const protocol={id:'p1',mode:'forward',frozenAt:'2026-09-01T09:00:00Z',evaluatedAt:'2026-09-04T10:00:00Z',expectedMarks:times,dataSnapshotHash:'dataset',costModel:'same-costs',baselinePolicy:'base',challengerPolicy:'new',cashFlowConvention:'INTERVAL_END'};
const ledger=(policy:string)=>({policy,costModel:'same-costs',dataSnapshotHash:'dataset',complete:true,monitoringGaps:[],marks:times.map((at,i)=>({at,equity:[100,160,144][i],netCashFlow:[0,50,0][i],grossExposure:[50,80,0][i]}))});
test('comparison removes deposits from return and calculates observed drawdown and exposure',()=>{
 const report=compareEvidencePolicies({protocol,baseline:ledger('base'),challenger:ledger('new')});assert.equal(report.status,'COMPARABLE');assert(Math.abs(report.baseline.netReturnPct+1)<1e-8);assert.equal(report.baseline.netPnl,-6);assert(Math.abs(report.baseline.observedDrawdownPct-10)<1e-8);assert.equal(report.baseline.timeWeightedGrossExposurePct,50);assert.equal(report.returnDifferencePercentagePoints,0);
});
test('missing challenger, stale coverage, unmatched costs and retroactive forward protocols stay unavailable',()=>{
 for(const challenger of [null,{...ledger('new'),costModel:'different'},{...ledger('new'),monitoringGaps:['gap']},{...ledger('new'),marks:ledger('new').marks.slice(1)}])assert.equal(compareEvidencePolicies({protocol,baseline:ledger('base'),challenger}).status,'UNAVAILABLE');
 assert.equal(compareEvidencePolicies({protocol:{...protocol,frozenAt:times[1]},baseline:ledger('base'),challenger:ledger('new')}).status,'UNAVAILABLE');
});
import {recordOpportunities} from '../server/sharedOpportunities.js';
import {newPaperAccount} from '../server/paperEngine.js';
test('live opportunity path saves shadow assessment once without rewriting technical signal',()=>{
 const c={...candidate,side:'BUY',score:75,signalTime:asOf,signalQuoteTime:asOf,signalPrice:100,stop:95,target:110};
 const a=recordOpportunities(newPaperAccount(),[c],Date.parse(asOf),true);assert.equal(a.events.length,1);assert.equal(a.events[0].score,75);assert.equal(a.events[0].decisionEvidence.decision,'NO_TRADE');assert.equal(a.events[0].decisionEvidence.asOf,asOf);
 const hash=a.events[0].decisionEvidence.snapshotHash;
 const b=recordOpportunities(a.state,[{...c,verifiedFacts:[fact()]}],Date.parse(asOf)+30000,true);assert.equal(b.events.length,0);assert.equal(a.events[0].decisionEvidence.snapshotHash,hash);
});
test('futures cannot claim a bounded maximum loss from a stop',()=>{
 const report=evaluateDecisionEvidence({candidate:{...candidate,side:'BUY'},segment:'futures',asOf,thesis:{risk:{worstCase:{kind:'BOUNDED',amount:500,reason:'stop'}}}});assert(report.blockers.includes('UNSUPPORTED_BOUNDED_LOSS_CLAIM'));
});
