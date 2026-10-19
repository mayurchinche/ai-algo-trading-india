import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {scoreUniverse,companyMetrics,STYLES,MIN_PEERS} from '../server/scorecards.js';
import {priceFacts,createDailyBarsReader} from '../server/dailyClose.js';
import {createScorecardsHandler,buildScorecards} from '../api/_scorecards.js';
import {researchRoutes} from '../api/research.js';
import {ScorecardTable,ScorecardDetail} from '../src/components/ScorecardsPage';
import {sortScorecards} from '../src/services/scorecards';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';

// Minimal deriveFundamentals-shaped result: one scope, given ratio and growth values.
const fundamentals=(end:string|null,ratios:Record<string,number|null>,growth:Record<string,number|null>={},warnings:string[]=[])=>({scopes:end===null?{}:{Consolidated:{latestAnnualPeriod:{start:'x',end},
 ratios:['roce','roe','debtToEquity','pe','peg'].map(key=>({key,value:ratios[key]??null,status:ratios[key]==null?'INPUT_UNAVAILABLE':'CALCULATED_REQUIRES_REVIEW',warnings,inputs:[{source:{url:'https://nsearchives.nseindia.com/corporate/xbrl/'+end+'.xml',publishedAt:'2026-05-01T00:00:00Z',symbol:'S'}}]})),
 growth:['revenue','totalProfit'].flatMap(key=>[1,3,5].map(years=>{const v=growth[key+years]??null;return {key,years,valuePct:v,status:v===null?'BASE_PERIOD_MISSING':'CALCULATED_REQUIRES_REVIEW',warnings:[]};}))}}});
const company=(i:number,f:any,price:any={status:'PRICE_UNAVAILABLE'})=>({symbol:'C'+i,isin:'INE'+String(i).padStart(9,'0'),instrumentKey:'k'+i,fundamentals:f,price});
const peers=(n:number,end='2026-03-31')=>Array.from({length:n},(_,i)=>company(i,fundamentals(end,{roce:i,roe:i,debtToEquity:i,pe:i+1},{revenue1:i,totalProfit1:i})));
const style=(c:any,id:string)=>c.styles.find((s:any)=>s.id===id);

test('percentiles rank within the peer set, follow each direction and share ties',()=>{
 const r=scoreUniverse(peers(11)),top=r.companies[10],bottom=r.companies[0];
 const roe=(c:any)=>style(c,'value').criteria.find((x:any)=>x.metric==='roe');
 assert.equal(roe(top).percentile,100);assert.equal(roe(bottom).percentile,0);assert.equal(roe(top).peers,11);
 const de=(c:any)=>style(c,'value').criteria.find((x:any)=>x.metric==='debtToEquity');
 assert.equal(de(top).percentile,0,'lower debt/equity is better');assert.equal(de(bottom).percentile,100);
 const tied=scoreUniverse(Array.from({length:10},(_,i)=>company(i,fundamentals('2026-03-31',{roe:5})))).companies.map((c:any)=>roe(c).percentile);
 assert(tied.every((p:number)=>p===50));
});
test('a style is scored only with two-thirds of its weight ranked; missing criteria are named',()=>{
 const c=scoreUniverse(peers(11)).companies[10];
 const value=style(c,'value');assert.equal(value.status,'SCORED');assert(Math.abs(value.coverage-0.9)<1e-9);assert.deepEqual(value.missing,['profitGrowth5y']);
 assert.equal(value.score,(100*25+100*25)/90,"top ROE and ROCE, worst D/E and P/E");
 const growth=style(c,'growth');assert.equal(growth.status,'INSUFFICIENT_INPUTS');assert.equal(growth.score,null);assert(growth.partialScore!==null);assert.deepEqual(growth.missing,['revenueGrowth3y','profitGrowth3y']);
 assert.equal(style(c,'garp').status,'INSUFFICIENT_INPUTS');
 assert.equal(c.composite.status,'INSUFFICIENT_STYLES');assert.deepEqual(c.composite.styles,['value']);
});
test('peers are grouped by financial year end; small groups and unsupported companies are not ranked',()=>{
 const r=scoreUniverse([...peers(MIN_PEERS),...peers(3,'2025-03-31').map((c:any,i:number)=>({...c,symbol:'OLD'+i})),company(99,fundamentals(null,{}))]);
 assert.deepEqual(r.peerGroups,[{periodEnd:'2026-03-31',size:10},{periodEnd:'2025-03-31',size:3}]);
 const old=r.companies.find((c:any)=>c.symbol==='OLD0');assert(style(old,'value').criteria.filter((x:any)=>x.status!=='INPUT_UNAVAILABLE').every((x:any)=>x.status==='TOO_FEW_PEERS'));
 const none=r.companies.find((c:any)=>c.symbol==='C99');assert.equal(none.basis,null);assert(none.styles.every((s:any)=>s.status==='INSUFFICIENT_INPUTS'));
});
test('composite needs three scored styles; symbol-change warnings and source filings carry through',()=>{
 const rich=Array.from({length:10},(_,i)=>company(i,fundamentals('2026-03-31',{roce:i,roe:i,debtToEquity:i,pe:i+1,peg:i+1},{revenue1:i,revenue3:i,revenue5:i,totalProfit1:i,totalProfit3:i,totalProfit5:i},i===9?['FILED_SYMBOL_CHANGED']:[])));
 const c=scoreUniverse(rich).companies[9];
 assert.equal(c.composite.status,'SCORED');assert.equal(c.composite.styles.length,4,'momentum lacks price data');
 assert.deepEqual(style(c,'value').warnings,['FILED_SYMBOL_CHANGED']);assert.equal(c.sources.length,1);
 assert.equal(companyMetrics(fundamentals('2026-03-31',{}),{status:'OBSERVED',return12mPct:12,belowHighPct:3}).metrics.return12m.value,12);
 assert.deepEqual(STYLES.map(s=>s.criteria.reduce((a,c)=>a+c.weight,0)),[100,100,100,100,100]);
});

const day=(i:number)=>new Date(Date.UTC(2025,9,18)+i*86400000).toISOString().slice(0,10);
const asOf=Date.parse('2026-10-18T06:00:00Z');
const history=(closes:number[],start=0)=>({status:'OBSERVED',instrumentKey:'k',currency:'INR',source:'TEST',bars:closes.map((close,i)=>({date:day(start+i),close,high:close+1}))});
test('price facts use one year of completed bars and refuse stale, short or discontinuous history',()=>{
 const closes=Array.from({length:365},(_,i)=>100+i*0.1);
 const p=priceFacts(history(closes),asOf);assert.equal(p.status,'OBSERVED');assert.equal(p.from,'2025-10-18');assert.equal(p.to,'2026-10-17');
 assert(Math.abs(p.return12mPct-((closes.at(-1)!/100-1)*100))<1e-9);assert(Math.abs(p.belowHighPct-(1-closes.at(-1)!/(closes.at(-1)!+1))*100)<1e-9);
 assert.equal(priceFacts(history(closes.slice(0,300)),asOf).status,'PRICE_STALE');
 assert.equal(priceFacts(history(closes.slice(60),60),asOf).status,'INSUFFICIENT_PRICE_HISTORY');
 const split=[...closes];for(let i=200;i<365;i++)split[i]=closes[i]/2;assert.equal(priceFacts(history(split),asOf).status,'POSSIBLE_UNADJUSTED_CORPORATE_ACTION');
 assert.equal(priceFacts({status:'UNAVAILABLE',reason:'UPSTOX_TOKEN_MISSING'},asOf).reason,'UPSTOX_TOKEN_MISSING');
});
test('bars reader drops in-progress and invalid candles and rejects conflicting duplicates',async()=>{
 const read=async()=>({candles:[['2026-10-18T00:00:00+05:30',1,9,1,9],['2026-10-16T00:00:00+05:30',1,11,1,10],['2026-10-15T00:00:00+05:30',1,5,1,10],['2026-10-14T00:00:00+05:30',1,12,1,11]]});
 const h=await createDailyBarsReader({read})('k',asOf,30);assert.deepEqual(h.bars.map((b:any)=>b.date),['2026-10-14','2026-10-16']);
 await assert.rejects(createDailyBarsReader({read:async()=>({candles:[['2026-10-16T00:00:00+05:30',1,11,1,10],['2026-10-16T00:00:00+05:30',1,11,1,10.5]]})})('k',asOf,30),/AMBIGUOUS/);
});

const filing=(isin:string)=>({policy:'fundamental-filing-v1',status:'EXTRACTED_REQUIRES_REVIEW',id:isin.padEnd(64,'0').toLowerCase(),documentHash:'h',symbol:'S',instrumentKey:'NSE_EQ|'+isin,scope:'Consolidated',url:'https://nsearchives.nseindia.com/corporate/xbrl/x.xml',publishedAt:'2026-05-01T00:00:00Z',observedAt:'2026-05-01T00:00:00Z',
 periods:[{contextId:'D',start:'2025-04-01',end:'2026-03-31',facts:[{key:'totalProfit',value:100,currency:'INR'},{key:'profitBeforeTax',value:130,currency:'INR'},{key:'financeCosts',value:10,currency:'INR'}],unavailable:[]}],
 positions:[{contextId:'I',instant:'2026-03-31',facts:[{key:'totalAssets',value:1000+isin.charCodeAt(5)*10,currency:'INR'},{key:'currentLiabilities',value:200,currency:'INR'},{key:'equity',value:500,currency:'INR'},{key:'borrowingsNoncurrent',value:50,currency:'INR'},{key:'borrowingsCurrent',value:0,currency:'INR'}],unavailable:[]}],rejectedContexts:[]});
const response=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}});
test('scorecards are built from stored filings with price outages degrading only price criteria',async()=>{
 let reads=0;const store=()=>({forInstrument:async(key:string)=>{reads++;return key.endsWith('INE009A01021')?[]:[{filing:filing(key.split('|')[1])}];}});
 const data=await buildScorecards(NIFTY50_UNIVERSE,{store,bars:async()=>{throw Error('token');},now:()=>asOf});
 assert.equal(reads,50);assert.equal(data.coverage.withAnnualPeriod,49);assert.equal(data.coverage.withPrice,0);
 const infy=data.companies.find((c:any)=>c.symbol==='INFY');assert.equal(infy.basis,null);
 const any=data.companies.find((c:any)=>c.basis);assert.equal(any.metrics.roce.status,'CALCULATED_REQUIRES_REVIEW');assert.equal(any.metrics.return12m.status,'PRICE_UNAVAILABLE');
 assert.equal(any.metrics.pe.status,'INPUT_UNAVAILABLE');assert.equal(any.peerGroup.size,49);
});
test('handler validates the universe, caches for ten minutes and never falls back on storage failure',async()=>{
 let builds=0,t=asOf;const store=()=>{builds++;return {forInstrument:async()=>[]};};
 const handler=createScorecardsHandler({store,bars:async()=>{throw Error('x');},now:()=>t});
 const req=(query:any)=>({method:'GET',headers:{host:'test'},query});
 const a=response();await handler(req({universe:'NIFTY50'}),a);assert.equal(a.code,200);const b=response();await handler(req({universe:'NIFTY50'}),b);assert.equal(builds,1);
 t+=600001;await handler(req({universe:'NIFTY50'}),response());assert.equal(builds,2);
 for(const q of [{},{universe:'NIFTY500'},{universe:'NIFTY50',x:'1'},{universe:'__proto__'}]){const r=response();await handler(req(q),r);assert.equal(r.code,400);}
 const down=response();await createScorecardsHandler({store:()=>({forInstrument:async()=>{throw Error('secret');}}),bars:async()=>{throw Error('x');}})(req({universe:'NIFTY50'}),down);
 assert.equal(down.code,503);assert(!down.body.error.includes('secret'));assert.equal(typeof researchRoutes.scorecards,'function');
});
test('table sorts by the chosen style and shows unavailable scores and the detail breakdown',()=>{
 const scored=scoreUniverse(peers(11));const data={...scored,universe:{name:'N',asOf:'d',source:'s'},computedAt:'2026-10-18T00:00:00Z',coverage:{companies:11,withAnnualPeriod:11,withPrice:0,truncatedFilingReads:0},limitations:[]} as any;
 assert.deepEqual(sortScorecards(data.companies,'value').slice(0,2).map((c:any)=>c.symbol),['C10','C9']);
 const html=renderToStaticMarkup(createElement(ScorecardTable,{data,sort:'value'}));assert.match(html,/Composite/);assert.match(html,/2026-03-31 · cons\./);assert.match(html,/—/);
 const detail=renderToStaticMarkup(createElement(ScorecardDetail,{company:data.companies[10]}));assert.match(detail,/percentile 100 of 11/);assert.match(detail,/not scored/);
});

test('style verdicts list top-30% criteria as plus, bottom-30% as minus and unranked criteria with reasons',async()=>{
 const {styleVerdict,styleVerdicts,verdictSentence}=await import('../shared/styleVerdicts.js');
 const {StyleVerdicts}=await import('../src/components/StyleVerdicts');
 const c=(metric:string,percentile:number|null,status='RANKED')=>({metric,label:metric.toUpperCase(),weight:25,value:1,percentile,status});
 const style={id:'value',label:'Value',status:'SCORED',score:55,criteria:[c('roe',90),c('pe',12),c('roce',50),c('debtToEquity',70),c('profitGrowth5y',null,'INPUT_UNAVAILABLE')]};
 const v=styleVerdict(style);
 assert.deepEqual([v.fit,v.plus.map((x:any)=>x.metric),v.minus.map((x:any)=>x.metric),v.neutral,v.unavailable],['PARTIAL_FIT',['roe','debtToEquity'],['pe'],1,[{metric:'profitGrowth5y',label:'PROFITGROWTH5Y',reason:'INPUT_UNAVAILABLE'}]]);
 assert.equal(verdictSentence(v),'Value: partial fit (55). Plus: ROE (top 10%), DEBTTOEQUITY (top 30%). Minus: PE (bottom 12%). Not ranked: PROFITGROWTH5Y.');
 assert.equal(styleVerdict({...style,score:70}).fit,'STRONG_FIT');assert.equal(styleVerdict({...style,score:30}).fit,'WEAK_FIT');
 const unscored=styleVerdict({...style,status:'INSUFFICIENT_INPUTS',score:null});assert.equal(unscored.fit,'NOT_SCORED');assert.equal(unscored.score,null);
 assert.deepEqual(styleVerdicts(null),[]);
 // End to end: verdicts read the percentiles scoreUniverse produced.
 const universe=scoreUniverse(Array.from({length:MIN_PEERS},(_,i)=>({symbol:'S'+i,isin:'I'+i,instrumentKey:'K'+i,fundamentals:fundamentals('2026-03-31',{roe:i,roce:i,debtToEquity:i,pe:i}),price:null})));
 const best=styleVerdicts(universe.companies[9]).find((x:any)=>x.id==='value');
 assert.deepEqual(best.plus.map((x:any)=>x.metric),['roe','roce']);assert.deepEqual(best.minus.map((x:any)=>x.metric),['debtToEquity','pe']);
 const html=renderToStaticMarkup(createElement(StyleVerdicts,{verdicts:[v]}));
 assert.match(html,/Partial fit · 55/);assert.match(html,/\+ ROE · top 10%/);assert.match(html,/− PE · bottom 12%/);assert.match(html,/Not ranked: PROFITGROWTH5Y/);
});
