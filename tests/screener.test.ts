import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {scoreUniverse,companyMetrics} from '../server/scorecards.js';
import {SCREENER_COLUMNS,COLUMN_GROUPS,DEFAULT_COLUMNS,parseColumnSelection,columnsFor,sortCompanies,filterCompanies,formatCell,screenerCsv,csvFileName} from '../src/services/screener';
import {ScreenerTable} from '../src/components/ScreenerPage';

const f=(end:string|null,ratios:Record<string,number|null>)=>({scopes:end===null?{}:{Consolidated:{latestAnnualPeriod:{start:'2025-04-01',end},
 ratios:['roce','roe','debtToEquity','pe','peg'].map(key=>({key,value:ratios[key]??null,status:ratios[key]==null?'INPUT_UNAVAILABLE':'CALCULATED_REQUIRES_REVIEW',warnings:[],inputs:[]})),
 growth:['revenue','totalProfit'].flatMap(key=>[1,3,5].map(years=>({key,years,valuePct:key==='revenue'&&years===1?ratios.rev1??null:null,status:key==='revenue'&&years===1&&ratios.rev1!=null?'CALCULATED_REQUIRES_REVIEW':'BASE_PERIOD_MISSING',warnings:[]})))}}});
const companies=[...Array.from({length:10},(_,i)=>({symbol:'S'+i,isin:'INE00000000'+i,instrumentKey:'k'+i,fundamentals:f('2026-03-31',{roe:i,roce:i,debtToEquity:i,pe:i+1,rev1:i-5}),price:{status:'PRICE_UNAVAILABLE'}})),
 {symbol:'BANK',isin:'INE0000000X1',instrumentKey:'kb',fundamentals:f(null,{}),price:{status:'OBSERVED',close:1234.5,to:'2026-10-16',return12mPct:-3,belowHighPct:8}}];
const data:any={...scoreUniverse(companies as any),universe:{name:'NIFTY 50',asOf:'2026-10-18',source:'s'},computedAt:'2026-10-18T06:00:00Z',coverage:{},limitations:[]};
const byId=(id:string)=>SCREENER_COLUMNS.find(c=>c.id===id)!;

test('every column has a known group and unique id; defaults and stored selections are validated',()=>{
 assert.equal(new Set(SCREENER_COLUMNS.map(c=>c.id)).size,SCREENER_COLUMNS.length);
 assert(SCREENER_COLUMNS.every(c=>COLUMN_GROUPS.includes(c.group)));assert.deepEqual(COLUMN_GROUPS.map(g=>SCREENER_COLUMNS.filter(c=>c.group===g).length),[4,6,5,6]);
 assert.equal(columnsFor(DEFAULT_COLUMNS).length,DEFAULT_COLUMNS.length);
 assert.deepEqual(parseColumnSelection(['roe','nope','roe',7,'score:garp']),['roe','score:garp']);
 assert.deepEqual(parseColumnSelection(['nope']),[...DEFAULT_COLUMNS]);assert.deepEqual(parseColumnSelection({}),[...DEFAULT_COLUMNS]);
});
test('columns read scorecard metrics and scores; close comes from observed price facts only',()=>{
 const bank=data.companies.find((c:any)=>c.symbol==='BANK'),top=data.companies.find((c:any)=>c.symbol==='S9');
 assert.equal(byId('close').value(bank),1234.5);assert.equal(bank.metrics.close.date,'2026-10-16');assert.equal(byId('roe').value(bank),null);assert.equal(byId('roe').status(bank),'NO_ANNUAL_PERIOD');
 assert.equal(byId('close').value(top),null);assert.equal(byId('close').status(top),'PRICE_UNAVAILABLE');
 assert.equal(byId('score:value').value(top),top.styles.find((s:any)=>s.id==='value').score);assert.equal(byId('score:composite').value(top),null);
 assert.equal(companyMetrics(f('2026-03-31',{}) as any,null).metrics.close.status,'PRICE_NOT_REQUESTED');
 const capped:any=companyMetrics({scopes:{Consolidated:{...(f('2026-03-31',{}) as any).scopes.Consolidated,marketCap:{value:4.8e12,status:'CALCULATED_REQUIRES_REVIEW',sharesAsOf:'2026-09-30'}}}} as any,null);
 assert.equal(byId('marketCap').value({metrics:capped.metrics} as any),480000);assert.equal(formatCell(480000,'₹ cr'),'4,80,000');assert.equal(bank.metrics.marketCap.status,'NO_ANNUAL_PERIOD');
});
test('sorting puts unavailable values last in both directions; filters match symbol, ISIN and filing support',()=>{
 const desc=sortCompanies(data.companies,{column:'roe',direction:'desc'}).map((c:any)=>c.symbol),asc=sortCompanies(data.companies,{column:'roe',direction:'asc'}).map((c:any)=>c.symbol);
 assert.deepEqual([desc[0],desc.at(-1),asc[0],asc.at(-1)],['S9','BANK','S0','BANK']);
 assert.deepEqual(sortCompanies(data.companies,{column:'rev1',direction:'desc'}).map((c:any)=>c.symbol).slice(0,2),['BANK','S0'],'unknown column keeps symbol order');
 assert.deepEqual(filterCompanies(data.companies,'s9',false).map((c:any)=>c.symbol),['S9']);assert.equal(filterCompanies(data.companies,'X1',false)[0].symbol,'BANK');
 assert.equal(filterCompanies(data.companies,'',true).length,10);
});
test('cells and CSV show unavailable as blank, keep negatives numeric and neutralise formula text',()=>{
 assert.deepEqual([formatCell(null,'%'),formatCell(12.345,'%'),formatCell(0.456,'x'),formatCell(71.6,'score'),formatCell(1234.5,'₹')],['—','12.3%','0.46','72','1,234.5']);
 const evil={...data.companies[0],symbol:'=HYPERLINK("x")',isin:'-1+1',basis:{scope:'Consolidated',period:{start:'a',end:'2026-03-31'}}};
 const csv=screenerCsv([evil,data.companies.find((c:any)=>c.symbol==='BANK')],columnsFor(['roe','revenueGrowth1y','return12m','score:value']));
 const lines=csv.trimEnd().split('\r\n');
 assert.equal(lines[0],'Symbol,ISIN,Year end,Basis,ROE (%),Sales 1Y (%),12M return (%),Value (0-100)');
 assert.equal(lines[1].split(',').slice(0,2).join(','),`"'=HYPERLINK(""x"")"`.concat(",'-1+1"));
 assert.equal(lines[1].split(',').at(2),'2026-03-31');assert(lines[1].includes(',0,-5,,'),'negative growth stays numeric');
 assert.equal(lines[2],'BANK,INE0000000X1,,No supported annual filing,,,-3,');
 assert.equal(csvFileName(data),'nifty50-screener-2026-10-18.csv');
});
test('table renders the selected columns with sort state',()=>{
 const html=renderToStaticMarkup(createElement(ScreenerTable,{data,columnIds:['roe','close'],sort:{column:'roe',direction:'desc'}}));
 assert.match(html,/ROE ↓/);assert.match(html,/1,234.5/);assert.match(html,/No supported filing/);assert.doesNotMatch(html,/PEG/);
 assert.match(renderToStaticMarkup(createElement(ScreenerTable,{data,columnIds:['roe'],sort:{column:'roe',direction:'desc'},search:'zzz'})),/No companies match/);
});
