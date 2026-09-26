import test from 'node:test';
import assert from 'node:assert/strict';
import {createSameTimeVolume,researchDecision} from '../research/volumeVariants';
import type {ResearchBar} from '../research/asOfMarket';
const open=Date.parse('2026-09-07T09:15:00+05:30'),now=open+601000;
const bars:ResearchBar[]=Array.from({length:22},(_,day)=>Array.from({length:3},(_,i)=>({symbol:'TEST',interval:'5minute' as const,start:open-(21-day)*86400000+i*300000,end:open-(21-day)*86400000+(i+1)*300000,availableAt:open-(21-day)*86400000+(i+1)*300000+1000,open:100,high:101,low:99,close:100,volume:day===21?20:10}))).flat();
test('same-time median uses 20 prior complete prefixes and no future outcomes',()=>{
 const expected=createSameTimeVolume(bars)('TEST',now);assert.equal(expected.status,'READY');
 if(expected.status==='READY'){assert.equal(expected.ratio,2);assert.equal(expected.median,20);assert.equal(expected.dates.length,20);assert.ok(expected.dates.every(d=>d<'2026-09-07'));}
 assert.deepEqual(expected,createSameTimeVolume(bars.filter(b=>b.availableAt<=now))('TEST',now));
 assert.deepEqual(expected,createSameTimeVolume(bars.map(b=>b.availableAt>now?{...b,volume:1e12}:b))('TEST',now));
});
test('missing history is unavailable, not zero, and publication lag is respected',()=>{
 const missing=bars.filter((b,i)=>i!==3&&i!==6);
 assert.equal(createSameTimeVolume(missing)('TEST',now).status,'INSUFFICIENT_PRIOR_PREFIXES');
 assert.equal(createSameTimeVolume(bars)('TEST',now-1000).status,'INCOMPLETE_CURRENT_PREFIX');
 assert.equal(createSameTimeVolume(bars.map(b=>({...b,volume:0})))('TEST',now).status,'ZERO_BASELINE');
 assert.throws(()=>createSameTimeVolume([...bars,bars.at(-1)!]),/Duplicate/);
});
test('research policies separate regimes, preserve eligibility and orient sell risk',()=>{
 const stock:any={eligible:true,ltp:100,macd:{value:0,signal:0,histogram:0},sma20:90,sma50:95,sma200:110,weekHigh52:120,weekLow52:90,scores:{momentum:-80,trendFollowing:-80,meanReversion:100,breakout:-60,smartMoney:0},foAnalysis:{expectedMove:2,suggestedStopLoss:96}};
 const trend=researchDecision(stock,2,'trend-momentum');assert.equal(trend.admitted,true);assert.equal(trend.side,'SELL');assert.equal(trend.stop,104);assert.equal(trend.target,94);
 assert.equal(researchDecision(stock,2,'mean-reversion').admitted,false);
 assert.equal(researchDecision({...stock,eligible:false},2,'trend-momentum').admitted,false);
 assert.equal(researchDecision({...stock,scores:{...stock.scores,trendFollowing:40}},2,'mean-reversion').admitted,true);
 assert.equal(stock.scores.smartMoney,0);
});
