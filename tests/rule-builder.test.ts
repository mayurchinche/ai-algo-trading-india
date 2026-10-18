import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {parseStrategySpec} from '../shared/strategySpec.js';
import {runSpecBacktest} from '../shared/specBacktest.js';
import {TEMPLATES} from '../src/services/specTemplates';
import {parseChartBars,fetchSpecBars,yahooSymbol,BAR_SOURCES} from '../src/services/specBars';
import {ConditionEditor,BacktestView} from '../src/components/RuleBuilderPage';
import {loadSpecDraft,saveSpecDraft,SPEC_DRAFT_KEY} from '../src/services/specDraft';

test('every template is a valid spec',()=>{for(const [name,t] of Object.entries(TEMPLATES)){const r=parseStrategySpec(t);assert(r.ok,name+': '+JSON.stringify(!r.ok&&r.issues));}});
const chart=(rows:[number,number|null,number,number,number][])=>({chart:{result:[{timestamp:rows.map(r=>r[0]),indicators:{quote:[{open:rows.map(r=>r[1]),high:rows.map(r=>r[2]),low:rows.map(r=>r[3]),close:rows.map(r=>r[4]),volume:rows.map(()=>null)}]}}]}});
test('chart bars keep completed sessions only and count invalid rows',()=>{
 const d=(s:string)=>Date.parse(s)/1000;
 const r=parseChartBars(chart([[d('2026-10-15T03:45:00Z'),100,101,99,100],[d('2026-10-16T03:45:00Z'),null,101,99,100],[d('2026-10-16T03:45:00Z'),100,99,101,100],[d('2026-10-19T03:45:00Z'),100,102,99,101]]),'1d',Date.parse('2026-10-19T08:00:00Z'));
 assert.deepEqual(r.bars.map(b=>new Date(b.time+19800000).toISOString().slice(0,10)),['2026-10-15']);assert.equal(r.invalid,2);assert.equal(r.incomplete,1);assert.equal(r.bars[0].volume,0);
 const intra=parseChartBars(chart([[d('2026-10-19T03:45:00Z'),1,2,1,1],[d('2026-10-19T03:50:00Z'),1,2,1,1]]),'5m',Date.parse('2026-10-19T03:52:00Z'));assert.equal(intra.bars.length,1);assert.equal(intra.incomplete,1);
 assert.deepEqual(parseChartBars({},'1d',0),{bars:[],invalid:0,incomplete:0});
});
test('history symbols and sources follow the underlying and timeframe',async()=>{
 assert.equal(yahooSymbol({symbol:'NIFTY',exchange:'NSE',kind:'index'}),'^NSEI');assert.equal(yahooSymbol({symbol:'M&M',exchange:'NSE',kind:'equity'}),'M&M.NS');assert.equal(yahooSymbol({symbol:'XYZ',exchange:'NSE',kind:'index'}),null);
 assert.equal(BAR_SOURCES['3m'],null);
 const asked:string[]=[];const r=await fetchSpecBars(TEMPLATES['SMA 20/50 crossover (daily)'],Date.now(),async(p:string)=>{asked.push(p);return {};});
 assert.equal(asked[0],'/api/yahoo/v8/finance/chart/INFY.NS?interval=1d&range=10y');assert.equal(r.bars.length,0);
 await assert.rejects(fetchSpecBars({...TEMPLATES['SMA 20/50 crossover (daily)'],timeframe:'3m'},0,async()=>({})),/No history source/);
});
test('condition editor renders nested groups and operands; backtest view shows grade, flags and option-leg refusal',()=>{
 const html=renderToStaticMarkup(createElement(ConditionEditor,{value:{any:[{compare:{left:{indicator:'m'},op:'gt',right:{value:1}}},{not:{compare:{left:{price:'close'},op:'lt',right:{indicator:'m'}}}}]},indicators:[{id:'m',type:'macd',params:{fast:12,slow:26,signal:9}}],onChange:()=>{}}));
 assert.match(html,/ANY of/);assert.match(html,/NOT/);assert.match(html,/histogram/);
 const closes=Array.from({length:120},(_,i)=>100+10*Math.sin(i/6));const bars=closes.map((c,i)=>({time:Date.parse('2026-01-01T00:00:00+05:30')+i*86400000,open:c,high:c+1,low:c-1,close:c,volume:1}));
 const r=runSpecBacktest(parseStrategySpec(TEMPLATES['RSI below 30 (daily)']).ok?(parseStrategySpec(TEMPLATES['RSI below 30 (daily)']) as any).spec:null,bars);
 const view=renderToStaticMarkup(createElement(BacktestView,{result:r}));assert.match(view,/Grade/);assert.match(view,/few trades|Trades/);
 assert.match(renderToStaticMarkup(createElement(BacktestView,{result:{status:'UNSUPPORTED_OPTION_LEGS',legs:['ce'],reason:'x'}})),/paper run/);
 const store:Record<string,string>={};saveSpecDraft({a:1},{setItem:(k:string,v:string)=>{store[k]=v;}});assert.deepEqual(loadSpecDraft({getItem:(k:string)=>store[k]??null}),{a:1});
 store[SPEC_DRAFT_KEY]='{';assert.equal(loadSpecDraft({getItem:(k:string)=>store[k]??null}),null);
});
