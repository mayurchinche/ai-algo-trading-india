import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {buildStacks,STACKS,ruleText,conditionText,MAX_MEMBERS,STACKS_VERSION} from '../shared/stacks.js';
import {scoreUniverse} from '../server/scorecards.js';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';
import {basketFromStack,loadBaskets,saveBaskets} from '../src/services/baskets';
import {StackCard} from '../src/components/StacksFeed';

const universe=NIFTY50_UNIVERSE.members;
const SYMBOLS=['TCS','INFY','HCLTECH','TECHM','SUNPHARMA','CIPLA','DRREDDY','ITC','HINDUNILVR','NESTLEIND','TITAN','LT'];
// Company i: returns on capital and growth rise with i; debt and P/E fall with i; 12-month return falls with i.
const fundamentals=(i:number,warnings:string[]=[])=>({scopes:{Consolidated:{latestAnnualPeriod:{start:'2025-04-01',end:'2026-03-31'},
 ratios:[['roce',10+i],['roe',10+i],['debtToEquity',2-i/10],['pe',40-i],['peg',3-i/5]].map(([key,value])=>({key,value,status:'CALCULATED_REQUIRES_REVIEW',warnings,inputs:[]})),
 growth:['revenue','totalProfit'].flatMap(key=>[1,3,5].map(years=>({key,years,valuePct:i,status:'CALCULATED_REQUIRES_REVIEW',warnings:[]})))}}});
const price=(i:number)=>({status:'OBSERVED',return12mPct:30-i*5,belowHighPct:i<2?2:20,close:100,to:'2026-10-16'});
const scorecards=(override:(i:number)=>any=()=>({}))=>{
 const members=SYMBOLS.map(s=>universe.find(m=>m.symbol===s)!);
 return scoreUniverse(members.map((m,i)=>({symbol:m.symbol,isin:m.isin,instrumentKey:'NSE_EQ|'+m.isin,fundamentals:fundamentals(i,i===11?['FILED_SYMBOL_CHANGED']:[]),price:price(i),...(override as any)(i)})));
};
const byId=(r:any,id:string)=>r.stacks.find((s:any)=>s.id===id);

test('stack rule text is generated from the same conditions that select members',()=>{
 for(const s of STACKS)assert.equal(ruleText(s).split('; ').length,s.conditions.length+(s.noWeakStyle?1:0));
 assert.equal(conditionText({metric:'pe',by:'percentile',op:'gte',at:70}),'P/E better than 70% of peers (lower is better)');
 assert.equal(conditionText({metric:'return12m',by:'percentile',op:'lte',at:30}),'12-month return worse than 70% of peers');
 assert.equal(conditionText({metric:'belowHigh',by:'value',op:'lte',at:5}),'within 5% of the 52-week high');
 assert.equal(new Set(STACKS.map(s=>s.id)).size,STACKS.length);
});
test('members qualify only on available values, ranked by their percentiles, with reasons and warnings',()=>{
 const r=buildStacks(scorecards(),universe);
 assert.equal(r.version,STACKS_VERSION);assert.equal(r.companies,12);
 const q=byId(r,'quality-compounders');
 assert.equal(q.status,'LISTED');assert.deepEqual(q.members.map((m:any)=>m.symbol).slice(0,3),['LT','TITAN','NESTLEIND']);
 assert.equal(q.members[0].industry,universe.find(m=>m.symbol==='LT')!.industry);
 assert.deepEqual(q.members[0].why.map((w:any)=>w.metric),['roce','debtToEquity','profitGrowth3y']);
 assert.match(q.members[0].why[0].text,/^21\.0% · better than 100% of peers$/);
 assert.deepEqual(q.members[0].why[0].warnings,['FILED_SYMBOL_CHANGED']);
 // High 12-month return and near the high: only companies 0 and 1 qualify, so the stack is listed.
 const near=byId(r,'near-high-leaders');assert.deepEqual(near.members.map((m:any)=>m.symbol),['TCS','INFY']);assert.equal(near.priceSelected,true);
 // Out of favour: high ROE, weak returns; ranked with the return percentile inverted.
 assert.deepEqual(byId(r,'quality-out-of-favour').members.map((m:any)=>m.symbol).slice(0,2),['LT','TITAN']);
 assert(byId(r,'all-rounders').members.every((m:any)=>m.why[0].value>=60));
 // Missing data never qualifies: without prices, price-based stacks are empty.
 const noPrice=buildStacks(scorecards(()=>({price:null})),universe);
 assert.deepEqual([byId(noPrice,'near-high-leaders').status,byId(noPrice,'near-high-leaders').qualifying],['TOO_FEW_MEMBERS',0]);
 assert(byId(r,'growth-fair-price').members.length<=MAX_MEMBERS);
 assert.deepEqual(buildStacks(null).stacks.map((s:any)=>s.status),STACKS.map(()=>'TOO_FEW_MEMBERS'));
});
test('a stack saves as a basket that records its rule and survives reload',()=>{
 const stack=byId(buildStacks(scorecards(),universe),'quality-compounders');
 const b=basketFromStack(stack,STACKS_VERSION,'NIFTY50',Date.parse('2026-10-19T10:00:00Z'));
 assert.equal(b.screen,null);assert.deepEqual(b.origin,{kind:'stack',id:'quality-compounders',version:STACKS_VERSION,rule:stack.rule});
 assert.deepEqual(b.members.map(m=>m.symbol),stack.members.map((m:any)=>m.symbol));
 const store=new Map<string,string>(),storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>void store.set(k,v)};
 saveBaskets([b,{...b,id:'x',origin:undefined}],storage);
 assert.deepEqual(loadBaskets(storage).map(x=>x.id),[b.id],'a basket with neither screen nor stack origin is dropped');
 assert.throws(()=>basketFromStack({...stack,members:[]},STACKS_VERSION,'NIFTY50'));
});
test('stack card shows the rule, members and why they qualify',()=>{
 const stack=byId(buildStacks(scorecards(),universe),'quality-compounders');
 const html=renderToStaticMarkup(createElement(StackCard,{stack,onSave:()=>{}}));
 assert.match(html,/Quality compounders/);assert.match(html,/Rule: ROCE better than 70% of peers/);
 assert.match(html,/>LT<\/button>/);assert.match(html,/ROCE: 21\.0% · better than 100% of peers/);
 assert.match(html,/\* inputs span a symbol change/);assert.match(html,/Save as basket/);
});
