import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateOpeningGap,observeOpeningGaps} from '../src/services/openingGap';
import {discoverStocks} from '../src/services/stockDiscovery';
const start=Date.parse('2026-10-01T09:15:00+05:30'),now=start+6*60000;
const stock={symbol:'TEST',prevClose:100};
function chart(){return {chart:{result:[{meta:{regularMarketPrice:103,regularMarketTime:now/1000},timestamp:Array.from({length:7},(_,i)=>(start+i*60000)/1000),indicators:{quote:[{open:[102,102,102,102,102,102,999],high:[102.5,102.5,102.5,102.5,102.5,103.2,999],low:[101.5,101.5,101.5,101.5,101.5,102,999],close:[102,102,102,102,102,103,999],volume:[100,100,100,100,100,100,100]}]}}]}};}
test('gap research waits for opening range and never consumes unfinished candle',()=>{
 assert.equal(evaluateOpeningGap(stock,chart(),start+4*60000).status,'FORMING');
 const row=evaluateOpeningGap(stock,chart(),now);assert.equal(row.status,'BREAKOUT_OBSERVED');assert.equal(row.rangeHigh,102.5);assert.equal(row.confirmationTime,new Date(now).toISOString());assert.ok(Math.abs(row.gapPct!-2)<1e-10);
 const data=chart();data.chart.result[0].indicators.quote[0].close[6]=1;assert.deepEqual(evaluateOpeningGap(stock,data,now),row);
});
test('missing opening minute, duplicate minute, null/zero volume, stale quotes and old sessions fail closed',()=>{
 for(const mutation of [(d:any)=>d.chart.result[0].timestamp.splice(2,1),(d:any)=>d.chart.result[0].timestamp[2]=d.chart.result[0].timestamp[1],(d:any)=>d.chart.result[0].indicators.quote[0].volume[0]=null,(d:any)=>d.chart.result[0].indicators.quote[0].volume[0]=0]){const d=chart();mutation(d);assert.equal(evaluateOpeningGap(stock,d,now).status,'DATA_UNAVAILABLE');}
 const d=chart();d.chart.result[0].meta.regularMarketTime-=180;assert.equal(evaluateOpeningGap(stock,d,now).status,'STALE_QUOTE');
 assert.equal(evaluateOpeningGap(stock,chart(),now+86400000).status,'DATA_UNAVAILABLE');
});
test('gap-down confirmation is directional and fresh quote must agree',()=>{
 const d=chart();const q=d.chart.result[0].indicators.quote[0];for(const k of ['open','high','low','close'] as const)q[k]=q[k].map(v=>200-v);[q.high,q.low]=[q.low,q.high];d.chart.result[0].meta.regularMarketPrice=97;
 assert.equal(evaluateOpeningGap(stock,d,now).direction,'DOWN');assert.equal(evaluateOpeningGap(stock,d,now).status,'BREAKOUT_OBSERVED');d.chart.result[0].meta.regularMarketPrice=99;assert.equal(evaluateOpeningGap(stock,d,now).status,'WATCHING');
});
test('gap scanner bounds load, reports failures and never calls provider outside window',async()=>{
 let calls=0;const stocks=Array.from({length:20},(_,i)=>({...stock,symbol:'TEST'+i,ltp:100,avgVolume:2000000,changePct:i})) as any;
 const fetcher=async()=>{calls++;throw Error('unavailable')};const result=await observeOpeningGaps(stocks,fetcher,now);assert.equal(calls,12);assert.equal(result.failures,12);assert.equal(result.status,'UNAVAILABLE');
 await observeOpeningGaps(stocks,fetcher,start+76*60000);assert.equal(calls,12);
});
test('discovery reports screener errors distinctly from valid empty results',async()=>{
 let coverage:any;await assert.rejects(discoverStocks(async()=>{throw Error('provider down')},d=>coverage=d));assert.equal(coverage.screenersFailed,3);assert.equal(coverage.scored,0);
 await assert.rejects(discoverStocks(async()=>({finance:{result:[{quotes:[]}]}}),d=>coverage=d));assert.equal(coverage.screenersFailed,0);assert.equal(coverage.universe,0);
});
