import test from 'node:test';import assert from 'node:assert/strict';
import {inPaperView,orderValuation,type PaperOrder} from '../src/services/paperWorkspace';
import {paperBalance} from '../server/paperFunds.js';
const now=Date.parse('2026-09-25T04:30:00Z');
const order:PaperOrder={id:'test',symbol:'TEST',side:'BUY',status:'OPEN',quantity:10,filled:10,exited:3,entryPrice:100,entryValue:1000,exitValue:315,lastPrice:110,lastQuoteTime:new Date(now).toISOString(),submittedAt:new Date(now-60000).toISOString()};
test('position valuation includes partial exits and matches the account net estimate',()=>{
 const v=orderValuation(order,now);assert.equal(v.remaining,7);assert.equal(v.gross,85);
 assert.equal(v.net,paperBalance({capital:20000,realized:0,orders:[order]},now).positionPnl);
 assert.equal(orderValuation({...order,side:'SELL'},now).gross,-85);
});
test('stale, future and missing marks cannot look like live P&L',()=>{
 for(const lastQuoteTime of [undefined,new Date(now-120001).toISOString(),new Date(now+1).toISOString()]){
  const v=orderValuation({...order,lastQuoteTime},now);assert.equal(v.stale,true);assert.equal(v.net,null);
 }
});
test('pending exits remain positions; cancelled orders and net results stay in history',()=>{
 assert(inPaperView({...order,status:'EXIT_PENDING'},'positions'));
 assert(!inPaperView({...order,status:'PENDING',filled:0,exited:0},'positions'));
 assert(inPaperView({...order,status:'CANCELLED'},'closed'));
 const closed={...order,status:'CLOSED',exited:10,netPnl:75,fees:40,lastQuoteTime:undefined};
 assert.equal(orderValuation(closed,now).net,75);assert.equal(orderValuation(closed,now).gross,115);
 assert(!inPaperView(closed,'positions'));
});
import {paperEvidence} from '../src/services/paperEvidence';
test('strategy evidence excludes gaps, keeps execution cohorts separate and uses net closed results',()=>{
 const closed:PaperOrder={...order,exited:10,status:'CLOSED',netPnl:20,fees:40,signalTime:new Date(now-61000).toISOString(),entryQuoteTime:new Date(now-50000).toISOString(),entryTime:new Date(now-49000).toISOString(),exitQuoteTime:new Date(now-1000).toISOString(),exitTime:new Date(now).toISOString(),strategy:{id:'policy-v1',score:80,signal:'STRONG_BUY',recordedAt:new Date(now-61000).toISOString()},executionMode:'AUTOMATIC',reactionDelaySeconds:0};
 const result=paperEvidence([closed,{...closed,id:'loss',netPnl:-30,exitTime:new Date(now+1000).toISOString()},{...closed,id:'gap',monitoringGap:true,netPnl:9999},{...closed,id:'manual',executionMode:'MANUAL'}]);
 assert.equal(result.excluded,1);assert.equal(result.groups.length,2);
 assert.equal(result.groups[0].net,-10);assert.equal(result.groups[0].expectancy,-5);assert.equal(result.groups[0].realizedDrawdown,30);
 assert.equal(paperEvidence([{...closed,entryQuoteTime:closed.submittedAt}]).excluded,1);
});
import {dailyResult,opportunityStatus,rupees} from '../src/services/tradingHome';
test('daily home result follows IST exit date, not submission date or UTC date',()=>{
 const boundary=Date.parse('2026-09-25T18:31:00Z');
 const make=(exitTime:string,netPnl:number)=>({...order,status:'CLOSED',exitTime,netPnl});
 assert.equal(dailyResult([make('2026-09-25T18:29:59Z',900),make('2026-09-25T18:30:00Z',-50),{...order,netPnl:700}],boundary),-50);
 assert.equal(dailyResult([],boundary),0);
 assert.equal(dailyResult([{...make('2026-09-25T18:30:00Z',0),netPnl:undefined}],boundary),null);
 assert.equal(rupees(NaN),'Unavailable');assert.equal(rupees(null),'Unavailable');
});
test('opportunities distinguish stale observations, paused entries, and closed markets',()=>{
 const stock={symbol:'TEST',signal:'STRONG_BUY',overallScore:80,eligible:true,ltp:100,generatedAt:new Date(now).toISOString(),quoteTime:new Date(now).toISOString(),foAnalysis:{suggestedStopLoss:99,suggestedTarget:104}};
 assert.equal(opportunityStatus(stock,true,false,now),'Strong setup · entries paused');
 assert.equal(opportunityStatus(stock,true,true,now),'Strong setup · account checks apply');
 assert.equal(opportunityStatus(stock,false,true,now),'Market unavailable or closed');
 assert.equal(opportunityStatus({...stock,quoteTime:undefined},true,true,now),'Quote stale or missing');
 assert.equal(opportunityStatus(stock,true,true,now+120001),'Signal expired');
});
