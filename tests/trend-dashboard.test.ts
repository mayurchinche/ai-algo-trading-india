import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {loadTrendRow,loadTrendRows,matchesTab,sortTrendRows,displayScore} from '../src/services/trendDashboard';
import {TrendTable,TrendValidationNotice} from '../src/components/TrendDashboardPage';
import {NIFTY50_UNIVERSE,TREND_VALIDATION} from '../shared/trendValidation.js';
const day=(i:number)=>new Date(Date.UTC(2024,0,1)+i*86400000).toISOString().slice(0,10);
const history=(closes:number[])=>({dates:closes.map((_,i)=>day(i)),closes,highs:closes.map(c=>c+1),lows:closes.map(c=>c-1),volumes:closes.map(()=>1),meta:{}});
const rise=Array.from({length:45},(_,i)=>i<40?100+Math.sin(i)*0.5:100+(i-40)*1.5);// trend start near the end
const fall=Array.from({length:120},(_,i)=>i<40?100+Math.sin(i)*0.5:i<80?100+(i-40)*1.5:160-(i-80)*1.5);

test('rows are loaded from completed Yahoo history with explicit failure states',async()=>{
 const asked:string[]=[];const row=await loadTrendRow('M&M',async s=>{asked.push(s);return history(rise) as any;});
 assert.deepEqual(asked,['M&M.NS']);assert.equal(row.status,'SCORED');
 assert.equal((await loadTrendRow('X',async()=>{throw Error('down');})).status,'DATA_UNAVAILABLE');
 assert.equal((await loadTrendRow('X',async()=>null)).status,'DATA_UNAVAILABLE');
 assert.equal((await loadTrendRow('X',async()=>history(rise.slice(0,10)) as any)).status,'INSUFFICIENT_HISTORY');
 assert.equal((await loadTrendRow('X',async()=>({...history(rise),dates:rise.map(()=>day(0))}) as any)).status,'INVALID_HISTORY');
});
test('tabs select bullish, recent trend start and recent trend end',async()=>{
 const start=await loadTrendRow('UP',async()=>history(rise) as any),ended=await loadTrendRow('DOWN',async()=>history(fall.slice(0,90)) as any),old=await loadTrendRow('OLD',async()=>history(fall) as any),missing={symbol:'NA',status:'DATA_UNAVAILABLE' as const};
 const rows=[start,ended,old,missing];
 assert.deepEqual(rows.filter(r=>matchesTab(r,'TREND_START')).map(r=>r.symbol),['UP']);
 assert.deepEqual(rows.filter(r=>matchesTab(r,'TREND_END')).map(r=>r.symbol),['DOWN']);
 assert.deepEqual(rows.filter(r=>matchesTab(r,'BULLISH')).map(r=>r.symbol),['UP']);
 assert.equal(rows.filter(r=>matchesTab(r,'ALL')).length,4);
 assert.deepEqual(sortTrendRows(rows).map(r=>r.symbol).at(-1),'NA');
 const html=renderToStaticMarkup(createElement(TrendTable,{rows,tab:'ALL'}));
 assert.match(html,/Trend start · /);assert.match(html,/Price history unavailable/);assert.match(html,/badge-green/);
 assert.match(renderToStaticMarkup(createElement(TrendTable,{rows:[missing],tab:'BULLISH'})),/No instruments in this view/);
});
test('loader bounds concurrency and reports every symbol once',async()=>{
 let active=0,peak=0;const seen:string[]=[];
 await loadTrendRows(['A','B','C','D','E','F','G'],r=>seen.push(r.symbol),{concurrency:3,load:async s=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return {symbol:s,status:'DATA_UNAVAILABLE'};}});
 assert.equal(peak,3);assert.deepEqual(seen.sort(),['A','B','C','D','E','F','G']);
});
test('every view carries the recorded replay result and the dated universe source',()=>{
 const html=renderToStaticMarkup(createElement(TrendValidationNotice));
 assert.match(html,/not a recommendation/);assert.match(html,/1 of 50/);assert.match(html,/2025: -0.87%/);
 assert.equal(NIFTY50_UNIVERSE.symbols.length,50);assert.equal(new Set(NIFTY50_UNIVERSE.symbols).size,50);assert.equal(TREND_VALIDATION.model,'trend-score-v1');
});
test('displayed scores never cross a zone boundary by rounding',()=>{
 assert.deepEqual([6.97,3.99,7,4,10].map(displayScore),['6.9','3.9','7.0','4.0','10.0']);
});
