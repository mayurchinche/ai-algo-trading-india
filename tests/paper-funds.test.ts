import test from 'node:test';import assert from 'node:assert/strict';
import {newPaperAccount,advancePaper} from '../server/paperEngine.js';
import {paperBalance,transferPaperFunds,importLegacyPaper} from '../server/paperFunds.js';
const now=Date.parse('2026-09-23T04:30:00Z');
const adjustment=(s:any,kind:string,amount:number,id='test-transfer-001')=>transferPaperFunds(s,{kind,amount,id},now);
test('all-day P&L carries forward and deposits/withdrawals never become trading profits',()=>{
 const s=newPaperAccount();s.realized=-350;let r=adjustment(s,'DEPOSIT',5000);r=adjustment(r.state,'WITHDRAWAL',2000,'test-transfer-002');
 const b=paperBalance(r.state,now);assert.equal(b.balance,22650);assert.equal(b.principal,23000);assert.equal(b.realized,-350);assert.equal(b.deposits,5000);assert.equal(b.withdrawals,2000);assert.equal(r.events[0].balanceAfter,22650);
 const tomorrow=advancePaper(r.state,{now:now+86400000});assert.equal(paperBalance(tomorrow.state,now+86400000).balance,22650);
});
test('funding retry is idempotent and conflicting reuse cannot double credit',()=>{
 const r=adjustment(newPaperAccount(),'DEPOSIT',100);const retry=adjustment(r.state,'DEPOSIT',100);assert.equal(retry.events.length,0);assert.equal(retry.state.transfers.length,1);assert.throws(()=>adjustment(r.state,'DEPOSIT',200));
});
test('invalid precision, negative amounts and overdrafts leave original account unchanged',()=>{
 const s=newPaperAccount();for(const amount of [0,-1,NaN,Infinity,1.001,100000001])assert.throws(()=>adjustment(s,'DEPOSIT',amount));assert.throws(()=>adjustment(s,'WITHDRAWAL',20000.01));assert.equal(s.realized,0);assert.equal(s.transfers.length,0);
});
const trade=(id:string,netPnl:number,day:string)=>({id,symbol:id,side:'BUY',quantity:10,entryPrice:100,exitPrice:netPnl>0?110:90,entryTime:`${day}T04:30:00Z`,exitTime:`${day}T05:30:00Z`,status:'EOD_EXIT',netPnl,brokerage:40,stopLoss:95,target:110});
test('reconciliation includes yesterday, earlier days and archived P&L exactly once',()=>{
 const original={trades:[trade('ABC',60,'2026-09-21'),trade('XYZ',-140,'2026-09-22')],archivedNet:250,archivedCount:7};
 const r=importLegacyPaper(newPaperAccount(),original,now);assert.equal(r.state.realized,170);assert.equal(paperBalance(r.state,now).balance,20170);assert.equal(r.state.orders.length,2);assert.equal(r.events.length,3);assert.equal(r.state.orders[0].entryTime,original.trades[0].entryTime);assert.throws(()=>importLegacyPaper(r.state,original,now));
 const next=advancePaper(r.state,{now:now+86400000});assert.equal(next.state.realized,170);
});
test('invalid or duplicate legacy data rolls back and active accounts cannot be overwritten',()=>{
 const s=newPaperAccount(),t=trade('ABC',60,'2026-09-21');assert.throws(()=>importLegacyPaper(s,{trades:[t,t],archivedNet:0},now));assert.equal(s.orders.length,0);assert.throws(()=>importLegacyPaper(adjustment(s,'DEPOSIT',10).state,{trades:[t],archivedNet:0},now));
});
test('open imported positions reserve capital and stale marks block withdrawals',()=>{
 const open={...trade('ABC',0,'2026-09-22'),status:'OPEN',netPnl:undefined,exitTime:undefined,exitPrice:undefined};const r=importLegacyPaper(newPaperAccount(),{trades:[open],archivedNet:0},now);
 const b=paperBalance(r.state,now);assert.equal(b.realized,0);assert.equal(b.reserved,1040);assert.equal(b.valuationStale,true);assert.equal(b.equity,null);assert.equal(b.available,0);assert.throws(()=>adjustment(r.state,'WITHDRAWAL',1));
 r.state.orders[0].lastQuoteTime=new Date(now).toISOString();r.state.orders[0].lastPrice=100;assert(paperBalance(r.state,now).available<20000);assert.throws(()=>adjustment(r.state,'WITHDRAWAL',20000));
});
test('an imported open trade is credited only when it actually closes',()=>{
 const legacy={...trade('ABC',0,'2026-09-22'),status:'OPEN',netPnl:undefined,exitTime:undefined,exitPrice:undefined};let s=importLegacyPaper(newPaperAccount(),{trades:[legacy],archivedNet:25},now).state;
 const tick=(n:number)=>({symbol:'ABC',price:102,timestamp:new Date(now+n).toISOString(),source:'test-only'});
 s=advancePaper(s,{now,quotes:[tick(0)],marketOpen:true}).state;assert.equal(s.realized,25);assert.equal(s.orders[0].status,'EXIT_PENDING');
 s=advancePaper(s,{now:now+1000,quotes:[tick(1000)],marketOpen:true}).state;assert.equal(s.orders[0].status,'CLOSED');assert.equal(Math.round(s.realized*100),2500+Math.round(s.orders[0].netPnl*100));
 const again=advancePaper(s,{now:now+2000,quotes:[tick(2000)],marketOpen:true}).state;assert.equal(again.realized,s.realized);
});
