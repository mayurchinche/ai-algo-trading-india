import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {basketPerformance} from '../shared/basketPerformance.js';
import {applyScreen,validateScreen,loadBaskets,saveBaskets,loadCloses,BASKETS_KEY} from '../src/services/baskets';
import {PerformanceView} from '../src/components/BasketsPage';
import {scoreUniverse} from '../server/scorecards.js';

const series=(dates:string[],closes:number[])=>({dates,closes});
const D=['2026-01-01','2026-01-02','2026-01-05','2026-01-06'];
test('equal-weight buy-and-hold from the first session on or after the start date',()=>{
 const closes=new Map([['A',series(D,[100,110,120,130])],['B',series(D,[50,50,45,40])],['C',series(D.slice(1),[10,11,12])]]);
 const r:any=basketPerformance({members:['A','B','C','Z'],closes,benchmark:series(D,[1000,1010,1020,1030]),startDate:'2025-12-31',fdRatePct:7.3});
 assert.equal(r.status,'MEASURED');assert.equal(r.baseDate,'2026-01-01');
 assert.deepEqual(r.excluded,[{symbol:'C',reason:'NO_CLOSE_ON_START_DATE'},{symbol:'Z',reason:'NO_PRICE_HISTORY'}]);
 assert(Math.abs(r.summary.basketPct-((1.3+0.8)/2*100-100))<1e-9);assert(Math.abs(r.summary.benchmarkPct-3)<1e-9);
 assert(Math.abs(r.summary.fdPct-(Math.pow(1.073,5/365)-1)*100)<1e-9);assert(Math.abs(r.summary.excessVsBenchmarkPct-2)<1e-9);
 assert(r.summary.maxDrawdownPct===0||r.summary.maxDrawdownPct>0);
});
test('missing later closes carry forward and are counted; no data and bad inputs are explicit',()=>{
 const closes=new Map([['A',series([D[0],D[1],D[3]],[100,80,90])]]);
 const r:any=basketPerformance({members:['A'],closes,benchmark:series(D,[1,1,1,1]),startDate:D[0],fdRatePct:0});
 assert.deepEqual(r.members,[{symbol:'A',returnPct:-10.000000000000002,carriedForwardSessions:1}].map(m=>({...m,returnPct:r.members[0].returnPct})));
 assert.equal(r.series[2].basket,80);assert(Math.abs(r.summary.maxDrawdownPct-20)<1e-9);assert.equal(r.summary.fdPct,0);
 assert.equal(basketPerformance({members:['A'],closes,benchmark:series(D,[1,1,1,1]),startDate:'2026-02-01',fdRatePct:7}).status,'NO_BENCHMARK_DATA');
 assert.equal(basketPerformance({members:['Q'],closes,benchmark:series(D,[1,1,1,1]),startDate:D[0],fdRatePct:7}).status,'NO_MEMBER_DATA');
 assert.equal(basketPerformance({members:['A'],closes,benchmark:series(D,[1,1,1,1]),startDate:D[3],fdRatePct:7}).status,'STARTED_TODAY');
 assert.throws(()=>basketPerformance({members:['A'],closes,benchmark:series(D,[1,1,1,1]),startDate:'x',fdRatePct:7}));
 assert.throws(()=>basketPerformance({members:['A'],closes,benchmark:series(D,[1,1,1,1]),startDate:D[0],fdRatePct:50}));
});

const f=(roe:number|null,de:number)=>({scopes:{Consolidated:{latestAnnualPeriod:{start:'2025-04-01',end:'2026-03-31'},ratios:['roce','roe','debtToEquity','pe','peg'].map(key=>{const v=key==='roe'?roe:key==='debtToEquity'?de:null;return {key,value:v,status:v===null?'INPUT_UNAVAILABLE':'CALCULATED_REQUIRES_REVIEW',warnings:[],inputs:[]};}),growth:['revenue','totalProfit'].flatMap(key=>[1,3,5].map(years=>({key,years,valuePct:null,status:'BASE_PERIOD_MISSING',warnings:[]})))}}});
const companies=scoreUniverse(Array.from({length:12},(_,i)=>({symbol:'S'+String(i).padStart(2,'0'),isin:'INE'+String(i).padStart(9,'0'),instrumentKey:'k',fundamentals:f(i===11?null:i*3,i/10),price:{status:'PRICE_UNAVAILABLE'}})) as any).companies as any;
test('screens keep only available values that pass every filter, sorted and limited',()=>{
 const picked=applyScreen(companies,{filters:[{column:'roe',op:'gte',value:15},{column:'debtToEquity',op:'lte',value:0.8}],sortBy:'roe',limit:2});
 assert.deepEqual(picked.map((c:any)=>c.symbol),['S08','S07']);
 assert.equal(applyScreen(companies,{filters:[],sortBy:'roe',limit:30}).length,11,'missing sort value excluded');
 assert.throws(()=>validateScreen({filters:[{column:'nope',op:'gte',value:1}],sortBy:'roe',limit:5}));
 assert.throws(()=>validateScreen({filters:[],sortBy:'roe',limit:31}));
 assert.throws(()=>validateScreen({filters:[{column:'roe',op:'eq',value:1}],sortBy:'roe',limit:5}));
});
test('stored baskets are validated on load and capped',()=>{
 const good={id:'1',name:'B',createdAt:'2026-10-18T00:00:00Z',universe:'NIFTY 50',screen:{filters:[],sortBy:'roe',limit:5},members:[{symbol:'INFY',isin:'INE009A01021'}],fdRatePct:7};
 const store:Record<string,string>={};const storage={getItem:(k:string)=>store[k]??null,setItem:(k:string,v:string)=>{store[k]=v;}};
 saveBaskets([good,{...good,id:'2',members:[]} as any,{...good,id:'3',screen:{filters:[],sortBy:'x',limit:5}}],storage);
 assert.deepEqual(loadBaskets(storage).map(b=>b.id),['1']);
 store[BASKETS_KEY]='not json';assert.deepEqual(loadBaskets(storage),[]);
});
test('closes load for NSE symbols and the index without a suffix; failures are left out',async()=>{
 const asked:string[]=[];const closes=await loadCloses(['INFY','^NSEI','BAD'],async s=>{asked.push(s);if(s==='BAD.NS')throw Error('x');return {dates:['2026-01-01'],closes:[1],highs:[1],lows:[1],volumes:[1],meta:{}} as any;});
 assert.deepEqual(asked.sort(),['BAD.NS','INFY.NS','^NSEI']);assert.deepEqual([...closes.keys()].sort(),['INFY','^NSEI']);
 const perf=basketPerformance({members:['INFY','BAD'],closes,benchmark:closes.get('^NSEI')!,startDate:'2026-01-01',fdRatePct:7});
 assert.match(renderToStaticMarkup(createElement(PerformanceView,{perf,label:'Since created'})),/BAD \(no price history\)/);
});
