import test from 'node:test';import assert from 'node:assert/strict';
import {compareFinancialGrowth} from '../server/financialGrowth.js';
const period=(year:number,value:number,scope='Consolidated')=>({scope,contextId:String(year),start:year+'-04-01',end:year+'-06-30',metrics:[{key:'revenue',value,currency:'INR',status:'ISSUER_REPORTED'}]});
const compare=(periods:any[])=>compareFinancialGrowth([{id:'fixture',periods}]).comparisons.find((x:any)=>x.key==='revenue');
test('same-filing comparable YoY uses filed numbers without rescaling',()=>{const r=compare([period(2026,1250),period(2025,1000)]);assert.equal(r.growthPct,25);assert.equal(r.priorPeriod.contextId,'2025');assert.equal(r.currentValue,1250);});
test('reporting scopes and duration boundaries are never mixed',()=>{
 for(const prior of [period(2025,1000,'Standalone'),{...period(2025,1000),start:'2025-01-01'}])assert.equal(compare([period(2026,1250),prior]).status,'COMPARABLE_PRIOR_PERIOD_MISSING');
 const r=compareFinancialGrowth([{id:'a',periods:[period(2026,1250)]},{id:'b',periods:[period(2025,1000)]}]);assert(r.comparisons.every((x:any)=>x.growthPct===null));
});
test('zero and negative base values do not become growth percentages',()=>{for(const v of [0,-100])assert.equal(compare([period(2026,1250),period(2025,v)]).status,'NON_POSITIVE_BASE');assert.equal(compare([period(2026,0),period(2025,100)]).growthPct,-100);});
test('currency mismatch, missing or duplicated facts and contexts fail closed',()=>{
 const prior=period(2025,1000);prior.metrics[0].currency='USD';assert.equal(compare([period(2026,1250),prior]).status,'CURRENCY_MISMATCH');
 assert.equal(compare([period(2026,1250),period(2025,1000),period(2025,1000)]).status,'AMBIGUOUS_REPORTING_CONTEXT');
 const missing=period(2026,1250);missing.metrics=[];assert.equal(compare([missing,period(2025,1000)]).status,'INPUT_UNAVAILABLE_OR_AMBIGUOUS');
});
test('comparison output is bounded and invalid periods do not produce results',()=>{assert.equal(compareFinancialGrowth([{id:'x',periods:[{...period(2026,1),end:'2026-02-30'}]}]).comparisons.length,0);const r=compareFinancialGrowth(Array.from({length:20},(_,i)=>({id:String(i),periods:[period(2026,1250),period(2025,1000)]})));assert.equal(r.comparisons.length,24);assert.equal(r.omitted,36);});
