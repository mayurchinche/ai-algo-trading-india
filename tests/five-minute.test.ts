import test from 'node:test';import assert from 'node:assert/strict';
import {simulateFiveMinute} from '../research/fiveMinuteExecution.js';
const day='2026-09-07',open=Date.parse(day+'T09:15:00+05:30');
const signal={id:'one',symbol:'TEST',at:open+300000+1000,price:100,score:80,side:'BUY',stop:99,target:103};
const bars=()=>Array.from({length:75},(_,i)=>({symbol:'TEST',start:open+i*300000,open:100,high:100.5,low:99.5,close:100,volume:10000}));
const run=(b:any[],signals:any[]=[signal])=>simulateFiveMinute({sessions:[day],bars:b,signals,capital:20000,delaySeconds:60});
test('entry occurs at a later five-minute boundary and collision exits stop-first after costs',()=>{
 const b=bars();b[2]={...b[2],low:98,high:104};const r=run(b),o=r.orders[0];assert.equal(o.entryAt,open+600000);assert.equal(o.reason,'STOP');assert.equal(o.ambiguous,true);assert(o.netPnl<0);assert(o.fees>0);assert.equal(r.metrics.closed,1);
});
test('missing exposure bar stays unresolved and prevents later entries',()=>{
 const b=bars().filter((_,i)=>i!==3),r=run(b,[signal,{...signal,id:'two',symbol:'OTHER',at:open+1200000}]);assert.equal(r.orders[0].status,'UNRESOLVED');assert.equal(r.metrics.winRatePct,null);assert.equal(r.metrics.fullAccountReturnPct,null);assert(r.rejections.some(x=>x.reason==='UNRESOLVED_EXPOSURE'));
});
test('gap exits at observed open and never a better stop price',()=>{
 const b=bars();b[3]={...b[3],open:97,low:96,high:98,close:97};const o=run(b).orders[0];assert.equal(o.reason,'GAP');assert(o.exit<97);
});
test('missing entry cancels and empty study does not invent a win rate',()=>{
 assert.equal(run(bars().filter((_,i)=>i!==2)).orders[0].status,'CANCELLED');assert.equal(run(bars(),[]).metrics.winRatePct,null);
});
test('available 15:25 bar allows a modelled EOD exit; unavailable EOD remains unresolved',()=>{
 assert.equal(run(bars()).orders[0].reason,'EOD_MODELLED_OPEN');assert.equal(run(bars().slice(0,74)).orders[0].status,'UNRESOLVED');
});
