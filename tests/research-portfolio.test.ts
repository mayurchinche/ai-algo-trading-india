import test from 'node:test';import assert from 'node:assert/strict';
import {buildResearchPortfolio,validateMandate} from '../server/researchPortfolio.js';
import {evidenceRequirements} from '../server/decisionEvidence.js';
import {createPortfolioHandler} from '../api/_research-portfolios.js';
import {researchPillars,sectorResearchFields} from '../shared/businessResearch.js';
const asOf='2026-10-04T04:30:00.000Z';
const mandate={name:'Test research',segment:'long-term',budget:10000,maxStockPct:20,maxSectorPct:35,cashReservePct:20,maxPositions:5,riskBudgetPct:2};
function fixture(symbol='AAA',sector='Banking'){
 const key='NSE_EQ|'+symbol;
 const facts=evidenceRequirements['long-term'].map((category:string,i:number)=>({id:symbol+i,key:category==='sector'?'classification':'test',category,instrumentKey:key,value:category==='sector'?sector:1,unit:'test',verification:'VERIFIED',sourceUrl:'https://example.com/fixture',sourceName:'Test fixture only',publishedAt:'2026-10-03T12:00:00Z',observedAt:'2026-10-03T12:01:00Z',expiresAt:'2026-10-05T12:00:00Z'}));
 const supported={text:'Test assessment',factIds:[symbol+'0']};
 const thesis:any=Object.fromEntries(['whyStock','whyNow','contraryEvidence','entryCondition','invalidation','exitPlan'].map(k=>[k,supported]));
 thesis.risk={quantity:20,capitalAtRisk:2000,plannedLossAtStop:40,riskBudget:100,estimatedCosts:10,costModel:'fixture',assumptions:supported,worstCase:{kind:'BOUNDED',amount:2010,reason:'Full capital and costs'}};
 thesis.businessResearch={};
 for(const pillar of researchPillars){
  const spec=pillar.id==='orders'?sectorResearchFields(sector):pillar;
  const section:any={outlook:'MIXED'};
  for(const [key] of spec.fields){
   const id=symbol+pillar.id+key;
   facts.push({...facts[0],id,key:pillar.id==='management'&&key==='delivery'?'delivery.guidance':key,category:spec.category,value:'Test evidence only',documentType:'COMPANY_FILING',commitmentStatus:'CONFIRMED',observationType:'GUIDANCE',financialPeriod:'FY2025'} as any);
   const factIds=[id];
   if(pillar.id==='management'&&key==='delivery'){
    facts.push({...facts.at(-1),id:id+'actual',key:'delivery.actual',observationType:'ACTUAL_OUTCOME',publishedAt:'2026-10-03T12:00:30Z'} as any);factIds.push(id+'actual');
   }
   section[key]={text:'Test assessment only',factIds};
  }
  thesis.businessResearch[pillar.id]=section;
 }
 return {signalId:symbol,signalTime:asOf,symbol,instrumentKey:key,side:'BUY',verifiedFacts:facts,thesis};
}
const quote=(c:any)=>({symbol:c.instrumentKey,ask:100,bid:99,askSize:1000,timestamp:asOf,observedAt:asOf});
const build=(candidates:any[],changes:any={})=>buildResearchPortfolio({mandate,candidates,quotes:candidates.map(quote),asOf,source:{status:'TEST_ONLY'},...changes});
test('mandate rejects unknown fields, bad horizons and invalid limits',()=>{
 for(const extra of [{segment:'options'},{maxStockPct:26},{budget:NaN},{maxPositions:1.5},{maxStockPct:20,maxSectorPct:10},{facts:[]}])assert.throws(()=>validateMandate({...mandate,...extra}));
});
test('empty research keeps all funds unallocated and returns unavailable performance',()=>{const r=build([]);assert.equal(r.status,'UNALLOCATED');assert.equal(r.totals.unallocated,10000);assert.equal(r.performance.netReturnPct,null);});
test('deterministic allocation uses whole thesis quantities and enforces sector exposure',()=>{
 const a=fixture(),b=fixture('BBB','  BANKING  ');const r=build([b,a]);assert.deepEqual(r.allocations.map((a:any)=>a.symbol),['AAA']);assert(r.assessments[1].blockers.includes('SECTOR_LIMIT'));assert.equal(r.totals.unallocated,7990);assert.equal(r.totals.plannedLossAtStop,50);assert.equal(r.status,'REVIEW_REQUIRED');assert.equal(r.snapshotHash,build([a,b]).snapshotHash);
});
test('freshness and evidence failures block proposals even with high technical scores',()=>{
 for(const modify of [(c:any)=>({...c,verifiedFacts:[]}),(c:any)=>({...c,signalTime:'2026-10-01T00:00:00Z'}),(c:any)=>({...c,side:'SELL'}),(c:any)=>({...c,verifiedFacts:c.verifiedFacts.map((f:any)=>({...f,observedAt:'2026-10-05T00:00:00Z'}))})])assert.equal(build([modify(fixture())]).allocations.length,0);
 const c=fixture();assert.equal(build([c],{quotes:[{...quote(c),timestamp:'2026-10-03T00:00:00Z'}]}).allocations.length,0);
 assert.equal(build([c],{quotes:[{...quote(c),ask:200}]}).allocations.length,0);
});
test('cash, risk, position and name limits cannot be bypassed by candidate count',()=>{
 const cs=[fixture(),fixture('BBB','IT'),fixture('CCC','Energy'),fixture('DDD','FMCG'),fixture('EEE','Industrials')];
 const r=build(cs);assert.equal(r.allocations.length,3);assert(r.totals.invested+r.totals.estimatedCosts<=8000);
 assert.equal(build(cs,{mandate:{...mandate,maxPositions:1}}).allocations.length,1);
 assert.equal(build(cs,{mandate:{...mandate,riskBudgetPct:0.5}}).allocations.length,1);
 assert.equal(build(cs,{mandate:{...mandate,maxStockPct:10}}).allocations.length,0);
 assert.equal(build([cs[0],cs[0]]).assessments.length,1);
});
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function response(){return {statusCode:0,body:null as any,setHeader(){},status(n:number){this.statusCode=n;return this;},json(b:any){this.body=b;return this;}};}
test('API persists only server candidates and supports immutable retry without rereading providers',async()=>{
 let saved:any=null,reads=0,saves=0,financialReads=0;
 const db={list:async()=>saved?[saved]:[],prior:async()=>saved,candidates:async()=>{reads++;return {candidates:[],source:{status:'TEST'}};},save:async(i:string,report:any)=>{saves++;saved={id:i,report};return saved;}};
 const handler=createPortfolioHandler({store:()=>db,clock:()=>Date.parse(asOf),archived:async()=>({status:'TEST_ONLY',records:[]}),financials:async()=>{financialReads++;return {status:'TEST_ONLY',documents:[]};},disclosures:async()=>({status:'TEST_ONLY',items:[]})}),req={method:'POST',headers:{host:'test'},body:{id,mandate}};
 const first=response();await handler(req,first);assert.equal(first.statusCode,201);assert.equal(first.body.portfolio.report.status,'UNALLOCATED');assert.equal(first.body.portfolio.report.source.financialSnapshot.status,'TEST_ONLY');assert.equal(first.body.portfolio.report.source.archivedEvidence.status,'TEST_ONLY');
 const retry=response();await handler(req,retry);assert.equal(retry.statusCode,200);assert.equal(reads,1);assert.equal(saves,1);assert.equal(financialReads,1);
 const bad=response();await handler({...req,body:{...req.body,quotes:[]}},bad);assert.equal(bad.statusCode,400);
 const conflict=response();await handler({...req,body:{id,mandate:{...mandate,budget:20000}}},conflict);assert.equal(conflict.statusCode,409);
});
test('API storage outage is unavailable, never a successful empty history',async()=>{const handler=createPortfolioHandler({store:()=>{throw Error('private DB failure');}});const res=response();await handler({method:'GET',headers:{host:'test'}},res);assert.equal(res.statusCode,503);assert(!res.body.error.includes('private'));});

test('portfolio requires global, sector revenue and management evidence despite complete base thesis',()=>{
 const c=fixture();delete c.thesis.businessResearch;
 const r=build([c]);assert.equal(r.allocations.length,0);assert.equal(r.assessments[0].evidence.decision,'REVIEW_REQUIRED');assert.equal(r.assessments[0].businessResearch.status,'NO_ALLOCATION');
});
test('industrial bids and management expectations cannot stand in for confirmed order evidence',()=>{
 for(const status of ['BID','EXPECTED',undefined]){
  const c=fixture('AAA','Industrials');c.verifiedFacts=c.verifiedFacts.map((f:any)=>f.category==='orders'&&f.key==='commitments'?{...f,commitmentStatus:status}:f);
  assert(build([c]).assessments[0].blockers.includes('BUSINESS_ORDERS_COMMITMENTS_UNSUPPORTED'));
 }
});
test('management comparison requires guidance and later outcome for the same financial period',()=>{
 const c=fixture();c.verifiedFacts=c.verifiedFacts.map((f:any)=>f.observationType==='ACTUAL_OUTCOME'?{...f,financialPeriod:'FY2024'}:f);
 assert(build([c]).assessments[0].blockers.includes('BUSINESS_MANAGEMENT_DELIVERY_UNSUPPORTED'));
});
test('news leads, future evidence, unrelated citations and adverse outlook cannot qualify',()=>{
 for(const change of [(c:any)=>{c.verifiedFacts=c.verifiedFacts.map((f:any)=>({...f,documentType:'NEWS_HEADLINE'}));},(c:any)=>{c.verifiedFacts=c.verifiedFacts.map((f:any)=>f.category==='global'?{...f,observedAt:'2026-10-05T00:00:00Z'}:f);},(c:any)=>{c.thesis.businessResearch.global.opportunity.factIds=['AAA0'];},(c:any)=>{c.thesis.businessResearch.management.outlook='ADVERSE';}]){
  const c=fixture();change(c);assert.equal(build([c]).allocations.length,0);
 }
});
test('banking and insurance use their own revenue evidence; saved reports do not mutate',()=>{
 for(const sector of ['Banking','Insurance']){const c=fixture('AAA',sector);const r=build([c]);assert.equal(r.allocations.length,1);assert.equal(r.assessments[0].businessResearch.sectorProfile,sector.toLowerCase());const prior=JSON.stringify(r);c.thesis.businessResearch.global.opportunity.text='Rewritten later';assert.equal(JSON.stringify(r),prior);}
});

test('company filing links are saved per candidate without changing allocation eligibility',()=>{
 const candidate=fixture();const original=build([candidate]);
 const document={id:'test-filing',instrumentKey:candidate.instrumentKey,kind:'FINANCIALS',status:'EXTRACTED_REQUIRES_REVIEW',publishedAt:'2026-10-01T00:00:00Z',observedAt:asOf};
 const report=build([candidate],{source:{financialSnapshot:{status:'CAPTURED_SAMPLE',capturedAt:asOf,documents:[document]}}});
 assert.deepEqual(report.assessments[0].financialResearch.documentIds,['test-filing']);assert.deepEqual(report.allocations,original.allocations);assert.deepEqual(report.assessments[0].blockers,original.assessments[0].blockers);assert.notEqual(report.snapshotHash,original.snapshotHash);
 const missing={...candidate,verifiedFacts:[],thesis:null};assert.equal(build([missing],{source:report.source}).allocations.length,0);
});
