import test from 'node:test';import assert from 'node:assert/strict';
import {parseFinancialDisclosure} from '../server/financialStatements.js';
import {toFundamentalFiling,deriveFundamentals} from '../server/fundamentals.js';
import {ingestFundamentalFilings} from '../server/fundamentalsIngest.js';
import {createFundamentalsHandler} from '../api/_fundamentals.js';
import {researchRoutes} from '../api/research.js';
import {createDailyCloseReader,observeDailyClose} from '../server/dailyClose.js';
const KEY='NSE_EQ|INE000A01010',secret='isolated-test-token-not-a-real-secret';
const fy=(y:number)=>({start:`${y-1}-04-01`,end:`${y}-03-31`});
const fact=(key:string,value:number,currency='INR')=>({key,value,raw:String(value),currency,decimals:'-5',tag:key,...(key==='basicEps'?{unit:'perShare'}:{})});
const position=(instant:string,facts:any[])=>({contextId:'I'+instant,instant,facts,unavailable:[]});
const period=(p:{start:string,end:string},facts:any[])=>({contextId:p.end,...p,facts,unavailable:[]});
const filing=(c:string,publishedAt:string,periods:any[],extra:any={})=>({policy:'fundamental-filing-v1',status:'EXTRACTED_REQUIRES_REVIEW',id:c.repeat(64),documentHash:c.repeat(64),symbol:'TEST',instrumentKey:KEY,company:'Fixture',scope:'Consolidated',url:`https://nsearchives.nseindia.com/corporate/xbrl/${c}.xml`,publishedAt,observedAt:publishedAt,periods,rejectedContexts:[],...extra});
const history=[
 filing('a','2021-05-20T10:00:00Z',[period(fy(2021),[fact('revenue',500)])]),
 filing('b','2023-05-20T10:00:00Z',[period(fy(2023),[fact('revenue',800),fact('totalProfit',60)]),period(fy(2022),[fact('revenue',650)])]),
 filing('c','2024-05-20T10:00:00Z',[period(fy(2024),[fact('revenue',900)])]),
 filing('d','2026-05-20T10:00:00Z',[period(fy(2026),[fact('revenue',1600),fact('totalProfit',120),fact('profitBeforeTax',150),fact('financeCosts',30),fact('basicEps',12)]),period(fy(2025),[fact('revenue',1000),fact('totalProfit',-10)])],
  {positions:[position('2026-03-31',[fact('totalAssets',2000),fact('currentLiabilities',400),fact('equity',1000),fact('borrowingsNoncurrent',200),fact('borrowingsCurrent',100)]),position('2025-03-31',[fact('equity',800)])]}),
];
const growth=(r:any,key:string,years:number,scope='Consolidated')=>r.scopes[scope].growth.find((g:any)=>g.key===key&&g.years===years);
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('parsed filings keep issuer-reported facts and explicit non-reported statuses',()=>{
 const xml=`<xbrl><context id="P"><entity><identifier>1</identifier></entity><period><startDate>2025-04-01</startDate><endDate>2026-03-31</endDate></period></context><unit id="INR"><measure>iso4217:INR</measure></unit><Symbol contextRef="P">TEST</Symbol><ISIN contextRef="P">INE000A01010</ISIN><NameOfTheCompany contextRef="P">Fixture</NameOfTheCompany><NatureOfReportStandaloneConsolidated contextRef="P">Consolidated</NatureOfReportStandaloneConsolidated><RevenueFromOperations contextRef="P" unitRef="INR" decimals="-5">1000</RevenueFromOperations></xbrl>`;
 const doc=parseFinancialDisclosure(xml,{id:'e'.repeat(64),url:'https://nsearchives.nseindia.com/corporate/xbrl/t.xml',publishedAt:'2026-05-01T10:00:00Z'},Date.parse('2026-05-01T10:05:00Z'));
 const f=toFundamentalFiling(doc);
 assert.equal(f.instrumentKey,KEY);assert.equal(f.documentHash,doc.documentHash);assert.deepEqual(f.periods[0].facts.map((x:any)=>[x.key,x.value]),[['revenue',1000]]);
 assert.deepEqual(f.periods[0].unavailable.map((x:any)=>[x.key,x.status]),['continuingProfit','totalProfit','profitBeforeTax','financeCosts','basicEps'].map(k=>[k,'NOT_REPORTED']));
 assert.equal(f.parser,'nse-xbrl-financials-v2');assert.deepEqual(f.positions,[]);
 assert.throws(()=>toFundamentalFiling({kind:'ORDERS'}));
});
test('annual growth uses exact prior years: percent change for 1y and CAGR for 3y and 5y',()=>{
 const r=deriveFundamentals(history,{instrumentKey:KEY,asOf:Date.parse('2026-06-01T00:00:00Z')});
 assert.equal(r.status,'DERIVED_REQUIRES_REVIEW');assert.deepEqual(r.scopes.Consolidated.latestAnnualPeriod,fy(2026));assert.equal(r.scopes.Consolidated.annualPeriods,6);
 near(growth(r,'revenue',1).valuePct,60);near(growth(r,'revenue',3).valuePct,(Math.pow(2,1/3)-1)*100);near(growth(r,'revenue',5).valuePct,(Math.pow(3.2,1/5)-1)*100);
 assert.equal(growth(r,'revenue',3).base.source.filingId,'b'.repeat(64));assert.equal(growth(r,'revenue',3).method,'CAGR');
 assert.equal(growth(r,'totalProfit',1).status,'NON_POSITIVE_BASE');near(growth(r,'totalProfit',3).valuePct,(Math.pow(2,1/3)-1)*100);assert.equal(growth(r,'totalProfit',5).status,'BASE_PERIOD_MISSING');assert.equal(growth(r,'continuingProfit',1).status,'CURRENT_VALUE_UNAVAILABLE');
 assert.equal(r.scopes.Standalone,undefined);
});
test('latest revision published by asOf wins; later filings and other instruments are excluded',()=>{
 const restated=[...history,filing('f','2026-08-01T10:00:00Z',[period(fy(2026),[fact('revenue',1500)]),period({start:'2026-04-01',end:'2026-06-30'},[fact('revenue',400)])]),filing('g','2026-05-21T10:00:00Z',[period(fy(2026),[fact('revenue',9999)])],{instrumentKey:'NSE_EQ|INE999Z01019'})];
 const before=deriveFundamentals(restated,{instrumentKey:KEY,asOf:Date.parse('2026-07-01T00:00:00Z')});
 assert.equal(growth(before,'revenue',1).current.value,1600);assert.equal(before.coverage.publishedAfterAsOf,1);assert.equal(before.coverage.otherInstrument,1);
 const after=deriveFundamentals(restated,{instrumentKey:KEY,asOf:Date.parse('2026-09-01T00:00:00Z')});
 assert.equal(growth(after,'revenue',1).current.value,1500);assert.equal(growth(after,'revenue',1).current.priorDistinctValues,1);assert.deepEqual(after.scopes.Consolidated.latestAnnualPeriod,fy(2026));
});
test('conflicting same-time revisions, mixed currencies and quarter-only data never produce growth',()=>{
 const asOf=Date.parse('2026-06-01T00:00:00Z');
 const conflict=deriveFundamentals([...history,filing('h','2026-05-20T10:00:00Z',[period(fy(2026),[fact('revenue',1700)])])],{instrumentKey:KEY,asOf});
 assert.equal(growth(conflict,'revenue',1).status,'AMBIGUOUS_REVISION');assert.equal(growth(conflict,'revenue',1).valuePct,null);
 const usd=deriveFundamentals([history[3],filing('i','2026-05-21T10:00:00Z',[period(fy(2025),[fact('revenue',12,'USD')])])],{instrumentKey:KEY,asOf});
 assert.equal(growth(usd,'revenue',1).status,'CURRENCY_MISMATCH');
 const quarter=deriveFundamentals([filing('j','2026-08-01T10:00:00Z',[period({start:'2026-04-01',end:'2026-06-30'},[fact('revenue',400)])])],{instrumentKey:KEY,asOf:Date.parse('2026-09-01T00:00:00Z')});
 assert.equal(quarter.scopes.Consolidated.latestAnnualPeriod,null);assert(quarter.scopes.Consolidated.growth.every((g:any)=>g.status==='NO_ANNUAL_PERIOD'));
 assert.equal(deriveFundamentals([],{instrumentKey:KEY,asOf}).status,'NO_FILINGS');
});
const price=(extra:any={})=>({status:'OBSERVED',instrumentKey:KEY,value:240,currency:'INR',date:'2026-05-29',source:'TEST',...extra});
const ratioOf=(r:any,key:string)=>r.scopes.Consolidated.ratios.find((x:any)=>x.key===key);
test('ROCE, ROE, D/E, P/E and PEG use year-end positions, annual facts and a dated close',()=>{
 const r=deriveFundamentals(history,{instrumentKey:KEY,asOf:Date.parse('2026-06-01T00:00:00Z'),price:price()});
 near(ratioOf(r,'roce').value,11.25);near(ratioOf(r,'roe').value,120/900*100);near(ratioOf(r,'debtToEquity').value,0.3);near(ratioOf(r,'pe').value,20);near(ratioOf(r,'peg').value,20/((Math.pow(2,1/3)-1)*100));
 assert(r.scopes.Consolidated.ratios.every((x:any)=>x.status==='CALCULATED_REQUIRES_REVIEW'&&x.formulaVersion==='fundamental-ratios-v2'));
 const roe=ratioOf(r,'roe');assert.deepEqual(roe.inputs.map((i:any)=>[i.name,i.period]),[['totalProfit',fy(2026)],['openingEquity',{instant:'2025-03-31'}],['closingEquity',{instant:'2026-03-31'}]]);
 assert.equal(roe.inputs[2].source.filingId,'d'.repeat(64));assert.equal(ratioOf(r,'pe').inputs[0].date,'2026-05-29');
});
test('missing positions, non-positive denominators and unusable prices leave ratios unavailable with reasons',()=>{
 const asOf=Date.parse('2026-06-01T00:00:00Z');
 const noOpening=history.map((f:any)=>f.positions?{...f,positions:f.positions.slice(0,1)}:f);
 const a=deriveFundamentals(noOpening,{instrumentKey:KEY,asOf,price:price()});
 assert.equal(ratioOf(a,'roe').status,'INPUT_UNAVAILABLE');assert.deepEqual(ratioOf(a,'roe').missingInputs,['openingEquity']);assert.equal(ratioOf(a,'roe').value,null);assert.equal(ratioOf(a,'roce').status,'CALCULATED_REQUIRES_REVIEW');
 const negative=history.map((f:any)=>f.positions?{...f,periods:[period(fy(2026),[fact('revenue',1600),fact('totalProfit',120),fact('basicEps',-1)]),f.periods[1]],positions:[position('2026-03-31',[fact('totalAssets',400),fact('currentLiabilities',400),fact('equity',-5),fact('borrowingsNoncurrent',1),fact('borrowingsCurrent',1)]),f.positions[1]]}:f);
 const b=deriveFundamentals(negative,{instrumentKey:KEY,asOf,price:price()});
 assert.equal(ratioOf(b,'debtToEquity').status,'NON_POSITIVE_EQUITY');assert.equal(ratioOf(b,'pe').status,'NON_POSITIVE_EPS');assert.equal(ratioOf(b,'peg').status,'INPUT_UNAVAILABLE');assert.deepEqual(ratioOf(b,'roce').missingInputs,['profitBeforeTax','financeCosts']);
 for(const [p,status] of [[undefined,'PRICE_NOT_REQUESTED'],[{status:'UNAVAILABLE',reason:'UPSTOX_TOKEN_MISSING'},'PRICE_UNAVAILABLE'],[price({date:'2026-05-01'}),'PRICE_STALE'],[price({date:'2026-06-02'}),'PRICE_AFTER_AS_OF'],[price({instrumentKey:'NSE_EQ|INE999Z01019'}),'PRICE_INVALID'],[price({value:0}),'PRICE_INVALID']] as const){
  const c=deriveFundamentals(history,{instrumentKey:KEY,asOf,price:p as any});assert.equal(c.price.status,status);assert.equal(ratioOf(c,'pe').status,'INPUT_UNAVAILABLE');assert.equal(ratioOf(c,'pe').inputs[0].status,status);assert.equal(ratioOf(c,'roe').status,'CALCULATED_REQUIRES_REVIEW');
 }
 const quarterOnly=deriveFundamentals([filing('j','2026-08-01T10:00:00Z',[period({start:'2026-04-01',end:'2026-06-30'},[fact('revenue',400)])])],{instrumentKey:KEY,asOf:Date.parse('2026-09-01T00:00:00Z')});
 assert(quarterOnly.scopes.Consolidated.ratios.every((x:any)=>x.status==='NO_ANNUAL_PERIOD'&&x.value===null));
});
test('daily close is the latest completed bar before the asOf IST date and failures stay explicit',async()=>{
 const asOf=Date.parse('2026-06-01T05:00:00Z');let path='';
 const reader=createDailyCloseReader({read:async(p:string)=>{path=p;return {candles:[['2026-06-01T00:00:00+05:30',1,1,1,999,1,0],['2026-05-28T00:00:00+05:30',1,1,1,230,1,0],['2026-05-29T00:00:00+05:30',1,1,1,240,1,0],['bad',1,1,1,5,1,0]]};}});
 const close=await reader(KEY,asOf);assert.equal(close.value,240);assert.equal(close.date,'2026-05-29');assert.equal(path,'/v3/historical-candle/NSE_EQ%7CINE000A01010/days/1/2026-05-31/2026-05-18');
 const empty=await observeDailyClose(createDailyCloseReader({read:async()=>({candles:[]})}),KEY,asOf);assert.deepEqual([empty.status,empty.reason],['UNAVAILABLE','NO_RECENT_DAILY_CLOSE']);
 const conflict=await observeDailyClose(createDailyCloseReader({read:async()=>({candles:[['2026-05-29T00:00:00+05:30',1,1,1,240],['2026-05-29T00:00:00+05:30',1,1,1,241]]})}),KEY,asOf);assert.equal(conflict.reason,'AMBIGUOUS_DAILY_CLOSE');
 const down=await observeDailyClose(async()=>{throw Error('token abc');},KEY,asOf);assert.deepEqual(down,{status:'UNAVAILABLE',instrumentKey:KEY,reason:'PRICE_SOURCE_FAILED'});
});

const item=(c:string)=>({id:c.repeat(64),url:`https://nsearchives.nseindia.com/corporate/xbrl/${c}.xml`,publishedAt:'2026-10-01T10:00:00Z',format:'XML'});
const doc=(i:any)=>({kind:'FINANCIALS',...i,documentHash:i.id,symbol:'TEST',instrumentKey:KEY,company:'Fixture',scope:'Consolidated',observedAt:'2026-10-01T10:01:00Z',periods:[{contextId:'P',...fy(2026),metrics:[{key:'revenue',value:1,raw:'1',currency:'INR',status:'ISSUER_REPORTED',tag:'RevenueFromOperations'}]}]});
const feed=(items:any[])=>({source:'feed',receivedAt:'2026-10-01T10:01:00Z',sourceHash:'h',status:'AVAILABLE',coverage:{},items});
test('ingestion skips stored filings and keeps every failure explicit',async()=>{
 const items=[item('a'),item('b'),item('c'),item('d'),item('e'),item('g'),{...item('f'),format:'PDF'}],saved:any[]=[],read:string[]=[];
 const reader={feed:async()=>feed(items),document:async(id:string)=>{read.push(id[0]);if(id[0]==='b')throw Error('private detail');if(id[0]==='g')throw Object.assign(Error('bank'),{code:'UNSUPPORTED_FINANCIAL_FORMAT'});return id[0]==='c'?{...doc(item('c')),url:'https://other.test'}:doc(items.find(i=>i.id===id));}};
 const store={known:async(ids:string[])=>ids.filter(id=>id[0]==='a').map(id=>({id})),save:async(f:any)=>{if(f.id[0]==='e')throw Error('db');saved.push(f);return {id:f.id};}};
 const r=await ingestFundamentalFilings({store,reader,clock:()=>Date.parse('2026-10-01T10:02:00Z')});
 assert.deepEqual(read.sort(),['b','c','d','e','g']);assert.deepEqual(saved.map(f=>f.id[0]),['d']);assert.equal(saved[0].policy,'fundamental-filing-v1');
 assert.deepEqual(Object.fromEntries(r.outcomes.map((o:any)=>[o.id[0],o.status])),{a:'ALREADY_RECORDED',b:'READ_FAILED',c:'INVALID_PROVENANCE',d:'RECORDED',e:'STORE_FAILED',g:'UNSUPPORTED_FORMAT'});
 assert.equal(r.status,'PARTIAL');assert.equal(r.coverage.pdfItemsNotIngested,1);assert.equal(r.coverage.failed,3);assert.equal(r.coverage.unsupportedFormat,1);assert(!JSON.stringify(r).includes('private detail'));
});
test('ingestion defers work past its time budget and reports an empty structured feed',async()=>{
 let t=0;const items=['a','b','c','d','e'].map(item);
 const r=await ingestFundamentalFilings({store:{known:async()=>[],save:async(f:any)=>({id:f.id})},reader:{feed:async()=>feed(items),document:async(id:string)=>{t+=41000;return doc(items.find(i=>i.id===id));}},clock:()=>t});
 assert.equal(r.coverage.recorded,4);assert.equal(r.coverage.deferred,1);assert.equal(r.coverage.failed,0);assert.equal(r.status,'PARTIAL');
 const empty=await ingestFundamentalFilings({store:{known:async()=>[],save:async()=>{throw Error('unused');}},reader:{feed:async()=>feed([]),document:async()=>{throw Error('unused');}}});
 assert.equal(empty.status,'NO_STRUCTURED_FILINGS');
});

const response=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}});
test('GET derives one validated instrument; storage failure has no fallback',async()=>{
 const asked:string[]=[];const handler=createFundamentalsHandler({now:()=>Date.parse('2026-06-01T00:00:00Z'),close:async(k:string)=>price({instrumentKey:k}),store:()=>({forInstrument:async(k:string)=>{asked.push(k);return history.map(filing=>({filing}));}}) as any});
 const ok=response();await handler({method:'GET',headers:{host:'test'},query:{instrumentKey:KEY}},ok);assert.equal(ok.code,200);near(growth(ok.body,'revenue',1).valuePct,60);near(ratioOf(ok.body,'pe').value,20);assert.deepEqual(asked,[KEY]);
 const noPrice=response();await createFundamentalsHandler({now:()=>Date.parse('2026-06-01T00:00:00Z'),close:async()=>{throw Error('down');},store:()=>({forInstrument:async()=>history.map(filing=>({filing}))}) as any})({method:'GET',headers:{host:'test'},query:{instrumentKey:KEY}},noPrice);
 assert.equal(noPrice.code,200);assert.equal(noPrice.body.price.status,'PRICE_UNAVAILABLE');near(ratioOf(noPrice.body,'roce').value,11.25);
 for(const query of [{},{instrumentKey:'TEST'},{instrumentKey:KEY,symbol:'TEST'}]){const r=response();await handler({method:'GET',headers:{host:'test'},query},r);assert.equal(r.code,400);}
 const down=response();await createFundamentalsHandler({store:()=>{throw Error('private key');}})({method:'GET',headers:{host:'test'},query:{instrumentKey:KEY}},down);assert.equal(down.code,503);assert(!down.body.error.includes('private key'));
});
test('POST ingestion requires the scheduler secret and an empty body before any source access',async()=>{
 const untouched=()=>{throw Error('must not access');};
 for(const [authorization,config,body,code] of [['Bearer wrong',secret,{},401],['Bearer '+secret,'',{},503],['Bearer '+secret,secret,{x:1},400]] as const){
  const r=response();await createFundamentalsHandler({secret:()=>config,store:untouched as any})({method:'POST',headers:{authorization},body},r);assert.equal(r.code,code);
 }
 const r=response();await createFundamentalsHandler({secret:()=>secret,store:()=>({known:async()=>[],save:async()=>null}) as any,reader:{feed:async()=>feed([])} as any})({method:'POST',headers:{authorization:'Bearer '+secret},body:{}},r);
 assert.equal(r.code,200);assert.equal(r.body.status,'NO_STRUCTURED_FILINGS');
 const failed=response();await createFundamentalsHandler({secret:()=>secret,store:()=>({}) as any,reader:{feed:async()=>{throw Error('down');}} as any})({method:'POST',headers:{authorization:'Bearer '+secret},body:{}},failed);assert.equal(failed.code,503);
 assert.equal(typeof researchRoutes.fundamentals,'function');
});
