import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePaperPerformance} from '../server/paperPerformance.js';
import {newPaperAccount} from '../server/paperEngine.js';
import {replayPaper} from '../server/paperReplay.js';
const start=Date.parse('2026-09-21T04:30:00Z');
const at=(s:number)=>new Date(start+s*1000).toISOString();
const order=(id:string,pnl:number,seconds=0)=>({id,signalId:`${id}:strong-equity-observed-v3`,status:'CLOSED',netPnl:pnl,grossPnl:pnl+40,fees:40,filled:1,exited:1,monitoringGap:false,signalTime:at(seconds),submittedAt:at(seconds),entryQuoteTime:at(seconds+1),entryTime:at(seconds+1),exitQuoteTime:at(seconds+2),exitTime:at(seconds+2)});
test('empty ledger has unavailable statistics, never zero percent wins',()=>{
 const r=evaluatePaperPerformance(newPaperAccount());assert.equal(r.qualified.winRatePct,null);assert.equal(r.qualified.netPnl,null);assert.equal(r.qualified.profitFactor,null);
});
test('net outcomes, breakeven and chronological closed drawdown are distinct',()=>{
 const r=evaluatePaperPerformance({...newPaperAccount(),realized:-100,orders:[order('loss',-200,10),order('win',100),order('flat',0,20)]});
 assert.equal(r.qualified.winRatePct,33.33);assert.equal(r.qualified.breakeven,1);assert.equal(r.qualified.expectancy,-33.33);assert.equal(r.qualified.profitFactor,.5);assert.equal(r.qualified.closedTradeDrawdown,200);assert.equal(r.realizedOutsideRetainedOrders,0);assert.equal(r.byPolicy['strong-equity-observed-v3'].closedTrades,3);
});
test('gaps, bad timestamps and corrupt net values excluded without changing ledger P&L',()=>{
 const r=evaluatePaperPerformance({...newPaperAccount(),realized:999,orders:[{...order('gap',100),monitoringGap:true},{...order('time',100),entryQuoteTime:at(0)},{...order('net',100),fees:0},order('good',100)]});
 assert.equal(r.excluded.length,3);assert.equal(r.qualified.closedTrades,1);assert.equal(r.ledgerRealized,999);assert.equal(r.realizedOutsideRetainedOrders,599);assert.equal(r.qualified.profitFactor,null);
 assert.deepEqual(r.qualified.winRateInterval95Pct,[20.65,100]);
});
test('malformed snapshots and duplicate orders fail closed',()=>{
 assert.throws(()=>evaluatePaperPerformance({}),/Invalid/);assert.throws(()=>evaluatePaperPerformance({...newPaperAccount(),orders:[order('same',1),order('same',1)]}),/duplicate/);
});
const recording=()=>({schema:'paper-observations-v1',source:'synthetic unit test only',initialCapital:20000,cycles:[0,30,60,61,62,63].map(s=>({now:start+s*1000,marketOpen:true,acceptEntries:true,quotes:[{symbol:'TEST',price:s>=62?104:100,timestamp:at(s),source:'synthetic-test'}],candidates:s===0?[{symbol:'TEST',signalId:'2026-09-21:TEST:BUY:strong-equity-observed-v3',signalTime:at(0),side:'BUY',score:80,stop:99,target:103}]:[]}))});
test('replay uses delayed workflow, later quote fills and ledger fees',()=>{
 const r=replayPaper(recording(),60);const o=r.state.orders[0];assert.equal(o.submittedAt,at(60));assert.equal(o.entryTime,at(61));assert.equal(o.exitTime,at(63));assert(o.fees>0);assert.equal(r.performance.qualified.closedTrades,1);assert.equal(r.performance.ledgerRealized,o.netPnl);
});
test('replay never fabricates closure and rejects future or unordered input',()=>{
 const input=recording();input.cycles=input.cycles.slice(0,4);const r=replayPaper(input,60);assert.equal(r.performance.openOrPending,1);assert.equal(r.performance.qualified.winRatePct,null);
 assert.throws(()=>replayPaper({...input,cycles:[input.cycles[1],input.cycles[0]]}),/chronological/);
 input.cycles[0].quotes[0].timestamp=at(1);assert.throws(()=>replayPaper(input),/future quote/);
 assert.throws(()=>replayPaper({...input,cycles:[]}),/nonempty/);
});
