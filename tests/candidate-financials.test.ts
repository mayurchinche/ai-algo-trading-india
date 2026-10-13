import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {matchCandidateFinancials} from '../server/candidateFinancials.js';
import {CandidateFinancialEvidence} from '../src/components/CandidateFinancialEvidence';
const asOf='2026-10-04T06:00:00Z',instrumentKey='NSE_EQ|INE000A01010';
const doc={id:'original',symbol:'FIXTURE',instrumentKey,kind:'FINANCIALS',status:'EXTRACTED_REQUIRES_REVIEW',publishedAt:'2026-10-01T10:00:00Z',observedAt:'2026-10-04T05:00:00Z',url:'https://example.com/fixture',documentHash:'fixture-hash',periods:[{contextId:'period',start:'2026-04-01',end:'2026-06-30',scope:'Consolidated',metrics:[{key:'revenue',label:'Revenue',value:1000,currency:'INR'},{key:'profit',label:'Profit',value:null,currency:null}],ratio:{label:'Profit/revenue',valuePct:null}}]};
const snapshot=(documents=[doc])=>({status:'CAPTURED_SAMPLE',capturedAt:asOf,documents});
test('links all eligible revisions by instrument, never a similar name',()=>{
 const result=matchCandidateFinancials(instrumentKey,snapshot([doc,{...doc,id:'revision'},{...doc,id:'wrong-company',instrumentKey:'NSE_EQ|OTHER'}]),asOf);
 assert.equal(result.status,'MATCHED_REQUIRES_REVIEW');assert.deepEqual(result.documentIds,['original','revision']);
 assert.equal(matchCandidateFinancials('NSE_EQ|OTHER',snapshot(),asOf).status,'NO_MATCH_IN_SAMPLE');
});
test('future, invalid and reversed observation times cannot enter candidate evidence',()=>{
 for(const changes of [{observedAt:'2026-10-05T00:00:00Z'},{publishedAt:'2026-10-05T00:00:00Z'},{observedAt:'bad'},{observedAt:'2026-09-01T00:00:00Z'}])assert.equal(matchCandidateFinancials(instrumentKey,snapshot([{...doc,...changes}]),asOf).documentIds.length,0);
 assert.equal(matchCandidateFinancials(instrumentKey,{...snapshot(),capturedAt:'2026-10-05T00:00:00Z'},asOf).status,'INVALID_SNAPSHOT_TIME');
});
test('missing historical capture, outage and unmatched sample remain distinct',()=>{
 assert.equal(matchCandidateFinancials(instrumentKey,undefined,asOf).status,'NOT_RECORDED');
 assert.equal(matchCandidateFinancials(instrumentKey,{status:'UNAVAILABLE'},asOf).status,'SOURCE_UNAVAILABLE');
 assert.equal(matchCandidateFinancials(instrumentKey,snapshot([]),asOf).status,'NO_MATCH_IN_SAMPLE');
});
test('candidate view only displays linked figures and preserves unavailable values',()=>{
 const research=matchCandidateFinancials(instrumentKey,snapshot(),asOf);
 const html=renderToStaticMarkup(createElement(CandidateFinancialEvidence,{research,documents:[doc,{...doc,id:'other',symbol:'UNRELATED'}]}));
 assert(html.includes('1,000 INR'));assert(html.includes('Profit: Unavailable'));assert(html.includes('Consolidated'));assert(!html.includes('UNRELATED'));assert(html.includes('do not change allocation eligibility'));
 assert(renderToStaticMarkup(createElement(CandidateFinancialEvidence,{})).includes('not recorded'));
});

test('candidate view renders saved comparable growth and its missing-input explanations',()=>{
 const current={...doc.periods[0],metrics:[{key:'revenue',label:'Revenue',value:1250,currency:'INR',status:'ISSUER_REPORTED'}]};
 const prior={...current,contextId:'prior',start:'2025-04-01',end:'2025-06-30',metrics:[{...current.metrics[0],value:1000}]};
 const filing={...doc,periods:[current,prior]};
 const research=matchCandidateFinancials(instrumentKey,{...snapshot(),documents:[filing]},asOf);
 assert.equal(research.growth.comparisons[0].growthPct,25);
 const html=renderToStaticMarkup(createElement(CandidateFinancialEvidence,{research,documents:[filing]}));assert(html.includes('25.00% reported YoY'));assert(html.includes('2025-04-01'));assert(html.includes('input unavailable or ambiguous'));assert(html.includes('No cross-filing revision selection'));
});
