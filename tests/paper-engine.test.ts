import test from 'node:test';import assert from 'node:assert/strict';
import {advancePaper,newPaperAccount} from '../server/paperEngine.js';
const start=Date.parse('2026-09-21T04:30:00Z');
const q=(offset=0,price=100)=>({symbol:'ABC',price,timestamp:new Date(start+offset).toISOString(),source:'test-only'});
const signal={symbol:'ABC',signalId:'2026-09-21:ABC:BUY',signalTime:new Date(start).toISOString(),side:'BUY',score:80,stop:99,target:103};
const step=(s:any,offset:number,quotes:any[],candidates:any[]=[],enabled=true)=>advancePaper(s,{now:start+offset,quotes,candidates,marketOpen:true,acceptEntries:enabled});
const pending=()=>step(newPaperAccount(),0,[q()],[signal]).state;
test('persistent paper orders fill only on a later quote and keep three distinct timestamps',()=>{
 let s=pending();assert.equal(s.orders[0].status,'PENDING');assert.equal(step(s,1000,[q()]).events.length,0);
 const filled=step(s,2000,[q(1000)]);assert.equal(filled.state.orders[0].status,'OPEN');assert.equal(filled.state.orders[0].entryTime,new Date(start+2000).toISOString());assert.equal(filled.events[0].quoteTime,q(1000).timestamp);assert.equal(filled.state.orders[0].submittedAt,signal.signalTime);
 assert.equal(step(filled.state,3000,[q(1000)],[signal]).events.length,0);
});
test('stop submits an exit, next quote fills at observed adverse price and charges net ledger',()=>{
 let s=step(pending(),1000,[q(1000)]).state;const entry=s.orders[0].entryPrice;
 s=step(s,2000,[q(2000,98)]).state;assert.equal(s.orders[0].status,'EXIT_PENDING');assert.equal(s.orders[0].exitTime,undefined);
 const result=step(s,3000,[q(3000,97)]);const o=result.state.orders[0];assert.equal(o.status,'CLOSED');assert.equal(o.exitReason,'STOP');assert(o.exitPrice<97);assert(o.netPnl<o.grossPnl);assert.equal(result.state.realized,o.netPnl);assert(entry>100);
});
test('bid/ask size supports partial fills without consuming the same quote twice',()=>{
 const tick={...q(1000),bid:99.9,ask:100.1,bidSize:1,askSize:1};const r=step(pending(),1000,[tick]);assert.equal(r.state.orders[0].filled,1);assert.equal(r.state.orders[0].status,'PARTIAL');assert.equal(r.events[0].model,'TOP_OF_BOOK_WITH_SLIPPAGE');assert.equal(step(r.state,2000,[tick]).state.orders[0].filled,1);
});
test('restart preserves deduplication and stale or future quotes never fill',()=>{
 const s=JSON.parse(JSON.stringify(pending()));assert.equal(step(s,1000,[q(2000)],[signal]).state.orders.length,1);assert.equal(step(s,1000,[q(2000)]).state.orders[0].filled,0);
 const r=step(s,180000,[q()]);assert.equal(r.state.orders[0].status,'CANCELLED');assert.equal(r.state.orders[0].filled,0);
});
test('paused accounts cancel pending entries but keep monitoring existing risk',()=>{
 assert.equal(step(pending(),1000,[q(1000)],[],false).state.orders[0].status,'CANCELLED');
 let s=step(pending(),1000,[q(1000)]).state;s=step(s,2000,[q(2000,104)],[],false).state;assert.equal(s.orders[0].exitReason,'TARGET');
 assert.equal(step(s,3000,[q(3000,104)],[],false).state.orders[0].status,'CLOSED');
});
test('monitoring gaps are audited and missed closes never acquire invented timestamps',()=>{
 let s=step(pending(),1000,[q(1000)]).state;let r=step(s,180000,[q(180000,104)]);assert.equal(r.state.orders[0].monitoringGap,true);assert(r.events.some(e=>e.kind==='MONITORING_GAP'));
 s=r.state;r=step(s,86400000,[q(86400000,102)]);assert.equal(r.state.orders[0].exitTime,new Date(start+86400000).toISOString());assert.equal(r.state.orders[0].monitoringGap,true);
});
test('EOD closes are requested at 15:25 and cannot fill on a closed market',()=>{
 let s=step(pending(),1000,[q(1000)]).state;const offset=(15*60+25-10*60)*60000;
 s=step(s,offset,[q(offset)]).state;assert.equal(s.orders[0].exitReason,'EOD');
 const r=advancePaper(s,{now:start+offset+1000,quotes:[q(offset+1000)],marketOpen:false});assert.equal(r.state.orders[0].status,'EXIT_PENDING');
});
test('short-side paper entry and exit use adverse prices and positive net results only after fees',()=>{
 const sell={...signal,signalId:'SELL:ABC',side:'SELL',stop:101,target:97};let s=step(newPaperAccount(),0,[q()],[sell]).state;s=step(s,1000,[q(1000)]).state;assert(s.orders[0].entryPrice<100);s=step(s,2000,[q(2000,96)]).state;s=step(s,3000,[q(3000,96)]).state;assert(s.orders[0].exitPrice>96);assert(s.orders[0].netPnl>0);
});
test('fill-time risk limit resizes a price gap and never exceeds per-trade budget',()=>{
 const s=step(pending(),1000,[q(1000,102)]).state,o=s.orders[0];assert(o.filled<40);assert((o.entryPrice-o.stop)*o.filled+40+o.entryPrice*.001*o.filled<=o.riskBudget+.01);
});
import paperHandler from '../api/paper.js';
test('paper API requires authentication and denies unknown origins without querying account data',async()=>{
 const response=()=>({code:200,payload:null as any,setHeader(){},status(code:number){this.code=code;return this;},json(data:any){this.payload=data;return this;},end(){}});
 const r=response();await paperHandler({method:'GET',headers:{host:'example.test'},query:{}},r);assert.equal(r.code,401);
 const blocked=response();await paperHandler({method:'GET',headers:{host:'example.test',origin:'https://attacker.test'},query:{}},blocked);assert.equal(blocked.code,403);
});
test('a pending manual exit is not overwritten by an older threshold quote',()=>{
 const s=step(pending(),1000,[q(1000)]).state;const o=s.orders[0];o.exitRequestedAt=new Date(start+5000).toISOString();o.exitReason='MANUAL';o.status='EXIT_PENDING';
 const r=step(s,6000,[q(4000,104)]);assert.equal(r.state.orders[0].exitRequestedAt,o.exitRequestedAt);assert.equal(r.state.orders[0].exitReason,'MANUAL');assert.equal(r.state.orders[0].exited,0);
});
test('missing quotes on existing exposure block new entries with unknown account risk',()=>{
 const s=step(pending(),1000,[q(1000)]).state;const second={...signal,symbol:'XYZ',signalId:'XYZ'};
 const r=step(s,2000,[{...q(2000),symbol:'XYZ'}],[second]);assert.equal(r.state.orders.length,1);
});
test('a delayed response cannot process a fill after the session has ended',()=>{
 let s=step(pending(),1000,[q(1000)]).state;const cutoff=(15*60+25-10*60)*60000;s=step(s,cutoff,[q(cutoff)]).state;
 const close=(15*60+30-10*60)*60000;const r=step(s,close,[q(close-1000)]);assert.equal(r.state.orders[0].status,'EXIT_PENDING');assert.equal(r.state.orders[0].exited,0);
});
test('09:45 signal submitted at 09:46 cannot fill at the earlier signal quote',()=>{
 const t=Date.parse('2026-09-25T04:15:00Z');
 const candidate={...signal,signalId:'delayed-25',signalTime:new Date(t).toISOString()};
 const quote=(offset:number,price=100)=>({...q(),timestamp:new Date(t+offset).toISOString(),price});
 let r=advancePaper(newPaperAccount(),{now:t+60000,quotes:[quote(0)],candidates:[candidate],marketOpen:true,acceptEntries:true});
 assert.equal(r.state.orders[0].submittedAt,new Date(t+60000).toISOString());
 assert.equal(r.state.orders[0].filled,0);
 r=advancePaper(r.state,{now:t+61000,quotes:[quote(60000)],marketOpen:true,acceptEntries:true});
 assert.equal(r.state.orders[0].filled,0);
 r=advancePaper(r.state,{now:t+65000,quotes:[quote(64000,100.2)],marketOpen:true,acceptEntries:true});
 assert(r.state.orders[0].filled>0);assert(r.state.orders[0].entryPrice>100.2);
 assert.equal(r.state.orders[0].entryQuoteTime,new Date(t+64000).toISOString());
 assert.equal(r.state.orders[0].entryTime,new Date(t+65000).toISOString());
});
test('manual exit requires a strictly later quote, including when quote timestamp equals request',()=>{
 const s=step(pending(),1000,[q(1000)]).state;const o=s.orders[0];
 o.exitRequestedAt=new Date(start+5000).toISOString();o.exitReason='MANUAL';o.status='EXIT_PENDING';
 const r=step(s,6000,[q(5000,102)]);assert.equal(r.state.orders[0].exited,0);
 assert.equal(step(r.state,7000,[q(6500,102)]).state.orders[0].status,'CLOSED');
});

import {paperBalance} from '../server/paperFunds.js';
function partialExit(side='BUY',exitPrice=85){
 const state=newPaperAccount();state.orders=[{id:'partial-exit',signalId:'partial-exit',symbol:'ABC',side,status:'EXIT_PENDING',quantity:40,filled:40,exited:36,entryValue:4000,entryPrice:100,exitValue:36*exitPrice,referencePrice:100,lastPrice:100,lastQuoteTime:q(1000).timestamp,submittedAt:q().timestamp,exitRequestedAt:q(2000).timestamp,stop:side==='BUY'?80:120,target:side==='BUY'?120:80}];return state;
}
const otherSignal={...signal,symbol:'XYZ',signalId:'second-symbol'};
test('partial exits and estimated costs count toward daily loss limits for long and short positions',()=>{
 for(const [side,price] of [['BUY',85],['SELL',115]] as const){
  const state=partialExit(side,price);assert(paperBalance(state,start+2000).positionPnl < -400);
  const result=step(state,2000,[q(1000),{...q(2000),symbol:'XYZ'}],[otherSignal]);
  assert.equal(result.state.orders.length,1);assert(result.events.some((e:any)=>e.kind==='ORDER_REJECTED'&&e.reason==='Daily loss limit reached'));
  assert.equal(result.state.realized,0);assert.equal(result.state.orders[0].exitValue,36*price);
 }
});
test('new-order risk budget uses the same net equity as the account balance view',()=>{
 const state=partialExit('BUY',99),balance=paperBalance(state,start+2000);
 const result=step(state,2000,[q(1000),{...q(2000),symbol:'XYZ'}],[otherSignal]);
 assert.equal(result.state.orders.length,2);assert.equal(result.state.orders[1].riskBudget,balance.equity*.005);
 assert.equal(result.state.realized,0);
});

import {estimatePaperEconomics,paperExecutionFees} from '../server/paperCosts.js';
test('cost-adjusted references expose small-quantity target losses for both directions',()=>{
 for(const side of ['BUY','SELL']){const e=estimatePaperEconomics({side,entry:100,stop:side==='BUY'?98:102,target:side==='BUY'?104:96,quantity:1},start);assert(e.costsExceedTarget);assert(e.targetNet<0);assert(e.stopNet<0);assert.equal(e.quantity,1);}
 const e=estimatePaperEconomics({side:'BUY',entry:100,stop:98,target:104,quantity:40},start);assert(e.targetNet>0);assert(e.netRewardRisk<2);assert.equal(e.targetCosts,paperExecutionFees(100,103.95,40));
 assert.equal(estimatePaperEconomics({side:'BUY',entry:100,stop:101,target:104,quantity:40}),null);
});
test('submitted orders retain auditable economics without changing realized ledger results',()=>{
 const result=step(newPaperAccount(),0,[q()],[signal]);const o=result.state.orders[0];
 assert.equal(o.economics.quantity,o.quantity);assert.equal(o.economics.at,o.submittedAt);assert.deepEqual(result.events[0].economics,o.economics);assert.equal(result.state.realized,0);
});
