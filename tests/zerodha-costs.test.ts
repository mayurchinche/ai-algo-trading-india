import test from 'node:test';import assert from 'node:assert/strict';
import {zerodhaIntradayCosts,sizeWithTariff,costModelId} from '../research/zerodhaCosts.js';
import {simulateFiveMinute} from '../research/fiveMinuteExecution.js';
const base={entry:100,exit:110,quantity:10,side:'BUY',date:'2026-09-10'};
test('NSE intraday tariff calculates side-specific taxes and uncapped small-order brokerage',()=>{
 const c=zerodhaIntradayCosts(base);assert(Math.abs(c.raw.brokerage-.63)<1e-10);assert.equal(c.raw.stt,.275);assert(Math.abs(c.raw.stamp-.03)<1e-10);assert.equal(c.total,1.13);
 const sell=zerodhaIntradayCosts({...base,side:'SELL'});assert.equal(sell.raw.stt,.25);assert(Math.abs(sell.raw.stamp-.033)<1e-10);
 assert.equal(zerodhaIntradayCosts({...base,quantity:1000}).raw.brokerage,40);
 assert.equal(zerodhaIntradayCosts({...base,assetType:'equity-etf'}).total,c.total);
 assert.equal(zerodhaIntradayCosts({...base,brokerSquareOff:true}).total,60.13);
 assert.throws(()=>zerodhaIntradayCosts({...base,date:'2025-09-10'}));assert.throws(()=>zerodhaIntradayCosts({...base,assetType:'options'}));
});
test('quantity includes stop slippage and charges within cash and risk limits',()=>{
 const args={entry:100,stop:99,side:'BUY',date:base.date,riskBudget:50,cashBudget:9000,slippageBps:5};
 const q=sizeWithTariff(args),stopFill=99*.9995;
 const risk=(n:number)=>Math.abs(100-stopFill)*n+zerodhaIntradayCosts({...base,exit:stopFill,quantity:n}).total;
 assert(q>1);assert(risk(q)<=50);assert(risk(q+1)>50);
});
test('new costs retain unresolved exits rather than manufacturing performance',()=>{
 const open=Date.parse(base.date+'T09:15:00+05:30');
 const bars=Array.from({length:74},(_,i)=>({symbol:'TEST',start:open+i*300000,open:100,high:100.5,low:99.5,close:100,volume:100}));
 const r=simulateFiveMinute({sessions:[base.date],bars,signals:[{id:'x',symbol:'TEST',at:open+301000,price:100,side:'BUY',score:80,stop:99,target:103}],capital:10000,costModel:costModelId});
 assert.equal(r.orders[0].status,'UNRESOLVED');assert.equal(r.metrics.fullAccountReturnPct,null);assert(r.orders[0].qty>1);
});
