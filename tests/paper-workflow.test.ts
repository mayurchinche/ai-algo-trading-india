import test from 'node:test';import assert from 'node:assert/strict';
import {newPaperAccount,advancePaper} from '../server/paperEngine.js';
import {advanceWorkflow,configureExecution,reviewIntent,cancelEntryRemainder} from '../server/paperWorkflow.js';
const now=Date.parse('2026-09-25T04:15:00Z');
const signal={symbol:'TEST',signalId:'strong-25',signalTime:new Date(now).toISOString(),side:'BUY',score:80,stop:99,target:104,strategy:{id:'test-policy'}};
const quote=(offset=0,price=100)=>({symbol:'TEST',timestamp:new Date(now+offset).toISOString(),price,source:'test-only'});
const run=(s:any,offset=0,candidates:any[]=[],price=100,acceptEntries=true)=>advanceWorkflow(s,{now:now+offset,quotes:[quote(offset,price)],candidates,marketOpen:true,acceptEntries});
test('automatic delay survives restart and repeated observations without resetting due time',()=>{
 let s=configureExecution(newPaperAccount(),{mode:'AUTOMATIC',delaySeconds:60},now).state;
 s=run(s,0,[signal]).state;const due=s.intents[0].dueAt;assert.equal(s.orders.length,0);
 s=run(JSON.parse(JSON.stringify(s)),30000,[{...signal,signalTime:new Date(now+30000).toISOString()}]).state;
 assert.equal(s.intents[0].dueAt,due);assert.equal(s.orders.length,0);
 s=run(s,60000,[signal]).state;assert.equal(s.orders.length,1);assert.equal(s.orders[0].submittedAt,due);assert.equal(s.orders[0].filled,0);
 assert.equal(run(s,61000).state.orders[0].status,'OPEN');
});
test('manual review requires approval, captures original strategy and does not fill on submission',()=>{
 let s=configureExecution(newPaperAccount(),{mode:'MANUAL',delaySeconds:0},now).state;s=run(s,0,[signal]).state;
 assert.equal(s.intents[0].status,'REVIEW');assert.equal(run(s,1000).state.orders.length,0);
 s=reviewIntent(s,{signalId:signal.signalId,quantity:1,orderType:'MARKET'},now+1000).state;
 assert.throws(()=>reviewIntent(s,{signalId:signal.signalId,quantity:1},now+1001));
 s=run(s,2000).state;assert.equal(s.orders[0].filled,0);assert.equal(s.orders[0].quantity,1);assert.equal(s.orders[0].strategy.id,'test-policy');
 assert.equal(run(s,3000).state.orders[0].filled,1);
});
test('missed or stale delayed signals expire without retrospective order timestamps',()=>{
 let s=configureExecution(newPaperAccount(),{mode:'AUTOMATIC',delaySeconds:60},now).state;s=run(s,0,[signal]).state;
 s=run(s,120001,[signal]).state;assert.equal(s.orders.length,0);assert.equal(s.intents[0].status,'EXPIRED');
 assert.equal(run(s,121000,[signal]).state.intents.length,1);
});
test('settings changes and pause cancel unsubmitted signals; submitted orders remain unchanged',()=>{
 let s=configureExecution(newPaperAccount(),{mode:'AUTOMATIC',delaySeconds:60},now).state;s=run(s,0,[signal]).state;
 const changed=configureExecution(s,{mode:'MANUAL',delaySeconds:0},now+1000).state;assert.equal(changed.intents[0].status,'CANCELLED');
 assert.equal(run(s,1000,[],100,false).state.intents[0].status,'CANCELLED');
 assert.throws(()=>configureExecution(s,{mode:'AUTOMATIC',delaySeconds:600}));
});
function ticket(type:string,fields:any={}){
 let s=configureExecution(newPaperAccount(),{mode:'MANUAL',delaySeconds:0},now).state;s=run(s,0,[signal]).state;
 return reviewIntent(s,{signalId:signal.signalId,quantity:2,orderType:type,...fields},now+1000).state;
}
test('limit orders wait without crossing the limit including slippage',()=>{
 let s=run(ticket('LIMIT',{limitPrice:100}),2000).state;
 assert.equal(run(s,3000).state.orders[0].filled,0);
 s=run(s,4000,[],99.8).state;assert.equal(s.orders[0].filled,2);assert(s.orders[0].entryPrice<=100);
});
test('stop-entry records trigger and uses only a subsequent quote for its fill',()=>{
 let s=run(ticket('STOP',{triggerPrice:101}),2000).state;
 assert.equal(run(s,3000,[],100.5).state.orders[0].filled,0);
 let r=run(s,4000,[],101);s=r.state;assert.equal(s.orders[0].filled,0);assert(r.events.some(e=>e.kind==='ENTRY_STOP_TRIGGERED'));
 s=run(s,5000,[],101.2).state;assert.equal(s.orders[0].filled,2);assert(s.orders[0].entryPrice>101.2);
});
test('cancel remainder preserves partial exposure and cannot request an exit',()=>{
 let s=run(ticket('MARKET'),2000).state;
 s=advancePaper(s,{now:now+3000,quotes:[{...quote(3000),bid:99.9,ask:100,askSize:1}],acceptEntries:true,marketOpen:true}).state;
 assert.equal(s.orders[0].filled,1);s=cancelEntryRemainder(s,s.orders[0].id,now+4000).state;
 assert.equal(s.orders[0].quantity,1);assert.equal(s.orders[0].status,'OPEN');assert.equal(s.orders[0].exitRequestedAt,undefined);
 assert.throws(()=>cancelEntryRemainder(s,s.orders[0].id));
});
test('oversized tickets and unsupported products cannot bypass engine risk controls',()=>{
 const s=run(ticket('MARKET',{quantity:1000000}),2000).state;assert.equal(s.orders.length,0);assert.equal(s.intents[0].status,'REJECTED');assert.match(s.intents[0].reason,/risk allowance/);
 const r=advancePaper(newPaperAccount(),{now,quotes:[quote()],candidates:[{...signal,product:'OPTIONS'}],marketOpen:true,acceptEntries:true});assert.equal(r.state.orders.length,0);assert.match(r.events[0].reason,/verified/);
});
import {amendPendingEntry} from '../server/paperWorkflow.js';
test('DAY entries survive two minutes but IOC remainders cancel on their first eligible quote',()=>{
 let s=run(ticket('LIMIT',{limitPrice:99.5,validity:'DAY'}),2000).state;
 s=run(s,180000,[],100).state;assert.equal(s.orders[0].status,'PENDING');
 s=run(s,181000,[],99.2).state;assert.equal(s.orders[0].filled,2);
 let ioc=run(ticket('LIMIT',{limitPrice:99.5,validity:'IOC'}),2000).state;
 ioc=run(ioc,3000).state;assert.equal(ioc.orders[0].status,'CANCELLED');assert.equal(ioc.orders[0].filled,0);
 let partial=run(ticket('MARKET',{validity:'IOC'}),2000).state;
 partial=advancePaper(partial,{now:now+3000,quotes:[{...quote(3000),bid:99.9,ask:100,askSize:1}],marketOpen:true,acceptEntries:true}).state;
 assert.equal(partial.orders[0].status,'OPEN');assert.equal(partial.orders[0].quantity,1);assert.equal(partial.orders[0].filled,1);
});
test('pending amendment preserves submission and rejects quotes before or at the amendment',()=>{
 let s=run(ticket('LIMIT',{limitPrice:99.5,validity:'DAY'}),2000).state;const submitted=s.orders[0].submittedAt;
 s=amendPendingEntry(s,{orderId:s.orders[0].id,quantity:1,price:100.5},now+5000).state;
 assert.equal(s.orders[0].submittedAt,submitted);assert.equal(s.orders[0].requestedQuantity,2);
 assert.equal(run(s,5000,[],100).state.orders[0].filled,0);
 s=run(s,6000,[],100).state;assert.equal(s.orders[0].filled,1);
 assert.throws(()=>amendPendingEntry(s,{orderId:s.orders[0].id,quantity:1,price:100.2},now+7000));
});
test('invalid amendments and stop IOC leave original state untouched',()=>{
 const s=run(ticket('LIMIT',{limitPrice:99.5}),2000).state;const before=JSON.stringify(s);
 assert.throws(()=>amendPendingEntry(s,{orderId:s.orders[0].id,quantity:3,price:100},now+3000));
 assert.throws(()=>amendPendingEntry(s,{orderId:s.orders[0].id,quantity:1,price:200},now+3000));
 assert.equal(JSON.stringify(s),before);assert.throws(()=>ticket('STOP',{triggerPrice:101,validity:'IOC'}));
});
