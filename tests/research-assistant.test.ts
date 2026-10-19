import test from 'node:test';import assert from 'node:assert/strict';
import {parseQuestion,PROMPT_LIBRARY,MAX_RESULTS} from '../shared/researchAssistant.js';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';
import {SCREENER_COLUMNS} from '../src/services/screener';
const universe=NIFTY50_UNIVERSE.members,ask=(q:string)=>parseQuestion(q,{universe});
const columns=new Set(SCREENER_COLUMNS.map(c=>c.id));

test('every example question parses to a supported plan with real screener columns',()=>{
 for(const {prompts} of PROMPT_LIBRARY)for(const p of prompts){
  const plan=ask(p);
  assert(!['UNKNOWN','NEEDS_INPUT','EMPTY'].includes(plan.intent),`${p} → ${plan.intent}`);
  assert.deepEqual(plan.ignored,[],p);
  if(plan.screen){assert(columns.has(plan.screen.sortBy),plan.screen.sortBy);for(const f of plan.screen.filters)assert(columns.has(f.column),f.column);}
 }
});
test('companies, comparisons and routing intents',()=>{
 assert.deepEqual([ask('Analyse reliance').intent,ask('Analyse reliance').symbols],['ANALYSE',['RELIANCE']]);
 assert.deepEqual(ask('Compare TCS, INFY and HCLTECH').symbols,['TCS','INFY','HCLTECH']);
 assert.equal(ask('Is INFY better than TCS').intent,'COMPARE');
 assert.equal(ask('M&M vs BAJAJ-AUTO').intent,'COMPARE');assert.deepEqual(ask('M&M vs BAJAJ-AUTO').symbols,['M&M','BAJAJ-AUTO']);
 assert.equal(ask('compare TCS').intent,'NEEDS_INPUT');
 assert.equal(ask('any signals for today').intent,'SIGNALS');assert.equal(ask('gap up stocks').intent,'GAPS');assert.equal(ask('check my holdings').intent,'PORTFOLIO_FIT');
 assert.equal(ask('   ').intent,'EMPTY');assert.equal(ask('what is the weather').intent,'UNKNOWN');assert.equal(parseQuestion(42 as any).intent,'EMPTY');
 // Unknown tickers are not invented.
 assert.deepEqual(ask('Analyse ZZZZ').symbols,[]);
});
test('screens: conditions, styles, sectors, limits and sort direction',()=>{
 const a=ask('ROE above 20 and P/E below 30');
 assert.deepEqual(a.screen,{filters:[{column:'roe',op:'gte',value:20},{column:'pe',op:'lte',value:30}],sortBy:'roe',sortDirection:'desc',limit:10});
 const b=ask('Top 5 growth stocks with sales 3y above 12% and profit 3y at least 15');
 assert.deepEqual(b.screen,{filters:[{column:'revenueGrowth3y',op:'gte',value:12},{column:'profitGrowth3y',op:'gte',value:15}],sortBy:'score:growth',sortDirection:'desc',limit:5});
 const c=ask('Pharma stocks with debt to equity below 0.5');
 assert.equal(c.industry,'Healthcare');assert.deepEqual(c.screen,{filters:[{column:'debtToEquity',op:'lte',value:0.5}],sortBy:'debtToEquity',sortDirection:'asc',limit:10});
 assert.equal(ask('Best compounders in IT').industry,'Information Technology');
 assert.equal(ask('Best compounders in IT').screen!.sortBy,'score:compounder');
 // "it" in lower case is the pronoun, not the sector.
 assert.equal(ask('is it a good time for TCS').intent,'ANALYSE');
 assert.equal(ask('top 500 value stocks').screen!.limit,MAX_RESULTS);
 const d=ask('banks with dividend yield above 2');assert.equal(d.industry,'Financial Services');assert.deepEqual(d.ignored,['dividend yield above 2']);
 assert.equal(ask(Array.from({length:9},(_,i)=>`roe above ${i}`).join(' and ')).intent,'NEEDS_INPUT');
});

// Twelve real NIFTY 50 members scored by the production scorer; i grows ROE and D/E together.
const scored=async()=>{
 const {scoreUniverse}=await import('../server/scorecards.js');
 const members=['TCS','INFY','HCLTECH','TECHM','SUNPHARMA','CIPLA','DRREDDY','ITC','HINDUNILVR','NESTLEIND','TITAN','LT'].map(sym=>universe.find(m=>m.symbol===sym)!);
 const f=(i:number)=>({scopes:{Consolidated:{latestAnnualPeriod:{start:'2025-04-01',end:'2026-03-31'},ratios:['roce','roe','debtToEquity','pe','peg'].map(key=>({key,value:key==='peg'?null:i+1,status:key==='peg'?'INPUT_UNAVAILABLE':'CALCULATED_REQUIRES_REVIEW',warnings:[],inputs:[]})),
  growth:['revenue','totalProfit'].flatMap(key=>[1,3,5].map(years=>({key,years,valuePct:i,status:'CALCULATED_REQUIRES_REVIEW',warnings:[]})))}}});
 const card=scoreUniverse(members.map((m,i)=>({symbol:m.symbol,isin:m.isin,instrumentKey:'NSE_EQ|'+m.isin,fundamentals:f(i),price:null})));
 return {...card,universe:{name:'NIFTY50',asOf:'x',source:'x'},computedAt:'x',coverage:{companies:12,withAnnualPeriod:12,withPrice:0,truncatedFilingReads:0},limitations:[]} as any;
};
test('answers run the plan on scorecards and say what matched',async()=>{
 const {answerPlan}=await import('../src/services/assistant');
 const data=await scored(),run=(q:string,d:any=data)=>answerPlan(ask(q),d,universe);
 const s=run('IT stocks with ROE above 2') as any;
 assert.equal(s.kind,'table');assert.deepEqual(s.rows.map((r:any)=>r.symbol),['TECHM','HCLTECH','INFY']);
 assert.match(s.notes[0],/^3 of 4 companies in Information Technology meet the conditions\.$/);
 const low=run('Pharma stocks with debt to equity below 10') as any;
 assert.deepEqual(low.rows.map((r:any)=>r.symbol),['SUNPHARMA','CIPLA','DRREDDY'],'lowest debt first for an at-most condition');
 const top=run('Top 2 value stocks') as any;assert.equal(top.rows.length,2);assert.deepEqual(top.columns.slice(0,2),['close','score:value']);
 const ignored=run('roe above 5 and dividend yield above 2') as any;assert.match(ignored.notes.at(-1),/Not understood and not applied: dividend yield above 2/);
 const cmp=run('Compare TCS and LT and RELIANCE') as any;
 assert.deepEqual(cmp.rows.map((r:any)=>r.symbol),['TCS','LT']);assert.deepEqual(cmp.notes,['No scorecard for RELIANCE.']);
 assert(cmp.verdicts.LT.some((l:string)=>l.startsWith('Value: ')),'comparison carries per-style verdict sentences');
 const one=run('Analyse LT') as any;assert.equal(one.kind,'analyse');assert(one.scored);assert(one.verdicts.length===5);
 assert.equal((run('Analyse RELIANCE') as any).scored,false);
 assert.deepEqual(run('show opening gaps',null),{kind:'route',tab:'Opening gaps',text:'Opening gaps are read from the NSE pre-open session (09:00 to 09:08 IST).'});
 assert.equal((run('Analyse LT',null) as any).kind,'message','no data, no answer');
 assert.equal((run('what is the weather') as any).kind,'message');
});
test('Investing page shows its tabs and the assistant examples',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const {InvestingPage}=await import('../src/components/InvestingPage');const {INVESTING_TABS}=await import('../src/services/investing');
 const {AnswerView}=await import('../src/components/AssistantPanel');
 const html=renderToStaticMarkup(createElement(InvestingPage,{tab:'Nope',onTab:()=>{}}));
 for(const [,label] of INVESTING_TABS)assert(html.includes(`>${label}</button>`),label);
 assert.match(html,/aria-current="page"[^>]*>Stacks</);
 const {answerPlan}=await import('../src/services/assistant');
 const plan=ask('Compare TCS and INFY'),view=renderToStaticMarkup(createElement(AnswerView,{plan,answer:answerPlan(plan,await scored(),universe),onTab:()=>{}}));
 assert.match(view,/Understood: Companies: TCS, INFY/);assert.match(view,/TCS: plus and minus by style/);assert.match(view,/<th class="text-right">P\/E<\/th>/);
});
test('pages round-trip through the URL hash; unknown pages and bad symbols are ignored',async()=>{
 const {routeHash,parseRoute}=await import('../src/services/route');
 const tabs=['Analysis','Stacks','Portfolio fit','Opening gaps'];
 assert.equal(routeHash('Portfolio fit'),'#/portfolio-fit');assert.deepEqual(parseRoute('#/portfolio-fit',tabs),{tab:'Portfolio fit',symbol:undefined});
 assert.equal(routeHash('Analysis','M&M'),'#/analysis/M%26M');assert.deepEqual(parseRoute('#/analysis/M%26M',tabs),{tab:'Analysis',symbol:'M&M'});
 assert.equal(routeHash('Stacks','INFY'),'#/stacks');
 assert.equal(parseRoute('#/nope',tabs),null);assert.equal(parseRoute('',tabs),null);
 assert.deepEqual(parseRoute('#/analysis/%E0%A4',tabs),{tab:'Analysis',symbol:undefined});assert.deepEqual(parseRoute('#/analysis/a%20b',tabs),{tab:'Analysis',symbol:undefined});
});
