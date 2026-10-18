import test from 'node:test';import assert from 'node:assert/strict';
import {parseFilingIndex,backfillFundamentalFilings,filingIndexUrl} from '../server/fundamentalsBackfill.js';
import {deriveFundamentals} from '../server/fundamentals.js';
import {MAX_DOCUMENT_BYTES} from '../server/financialStatements.js';
const now=Date.parse('2026-10-18T00:00:00Z');
const x=(id:string)=>`https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_${id}_WEB.xml`;
const row=(id:string,qe:string,broadcast='23-Apr-2026 20:47:17',extra:any={})=>({xbrl:x(id),qe_Date:qe,broadcast_Date:broadcast,consolidated:'Consolidated',...extra});
const index=(data:any[],totalCount=data.length)=>JSON.stringify({data,totalCount});
test('index selects Ind AS filings for quarters ending 31 March and counts everything else',()=>{
 const r=parseFilingIndex(index([row('1','31-MAR-2026'),row('2','31-DEC-2025','14-Jan-2026 20:38:27'),{xbrl:'https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_GOVERNANCE_9_WEB.xml',qe_Date:'31-MAR-2026',broadcast_Date:'20-Apr-2026 10:07:19'},{xbrl:'https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_BANKING_8_WEB.xml'},row('3','31-MAR-2026','01-Jan-2099 00:00:00'),row('4','31-MAR-2026','23-Apr-2026 20:47:17',{xbrl:'https://example.com/corporate/xbrl/INTEGRATED_FILING_INDAS_4_WEB.xml'}),row('5','31-MAR-2025','17-Apr-2025 23:36:33',{symbol:'OTHER'})],12),'INFY',now);
 assert.deepEqual(r.items.map((i:any)=>[i.quarterEnd,i.publishedAt]),[['2026-03-31','2026-04-23T15:17:17.000Z']]);
 assert.deepEqual(r.coverage,{received:7,otherFilingTypes:2,notFinancialYearEnd:1,rejected:3,selected:1,totalCount:12,truncated:true});
 assert.equal(filingIndexUrl('M&M'),'https://www.nseindia.com/api/integrated-filing-results?index=equities&size=100&symbol=M%26M');
 assert.throws(()=>parseFilingIndex('{"rows":[]}','INFY',now));assert.throws(()=>filingIndexUrl('../x'));
});
// A minimal integrated filing as produced by NSE, with an annual period and its year-end balance sheet.
const filingXml=(symbol:string,isin:string,profit=100)=>`<xbrl><context id="OneD"><entity><identifier>1</identifier></entity><period><startDate>2025-04-01</startDate><endDate>2026-03-31</endDate></period></context><context id="OneI"><entity><identifier>1</identifier></entity><period><instant>2026-03-31</instant></period></context><unit id="INR"><measure>iso4217:INR</measure></unit><Symbol contextRef="OneD">${symbol}</Symbol><ISIN contextRef="OneD">${isin}</ISIN><NameOfTheCompany contextRef="OneD">Fixture</NameOfTheCompany><NatureOfReportStandaloneConsolidated contextRef="OneD">Consolidated</NatureOfReportStandaloneConsolidated><RevenueFromOperations contextRef="OneD" unitRef="INR" decimals="-5">1000</RevenueFromOperations><ProfitLossForPeriod contextRef="OneD" unitRef="INR" decimals="-5">${profit}</ProfitLossForPeriod><Equity contextRef="OneI" unitRef="INR" decimals="-5">500</Equity></xbrl>`;
const memoryStore=(known:string[]=[])=>{const saved:any[]=[];return {saved,known:async(ids:string[])=>ids.filter(id=>known.includes(id)).map(id=>({id})),save:async(f:any)=>{saved.push(f);return {id:f.id};}};};
test('ISIN is the identity: former or mistyped symbols are recorded, other issuers are rejected',async()=>{
 const docs:Record<string,string>={[x('1')]:filingXml('BAJAJAUTO','INE917I01010'),[x('2')]:filingXml('OTHERCO','INE000A01010')};
 const reads:any[]=[];const read=async(url:string,max?:number)=>{reads.push([url,max]);return url.includes('api')?index([row('1','31-MAR-2026'),row('2','31-MAR-2026','23-Apr-2026 20:47:18')]):docs[url];};
 const store=memoryStore();const r=await backfillFundamentalFilings({targets:[{symbol:'BAJAJ-AUTO',isin:'INE917I01010'}],store,read,clock:()=>now,pause:async()=>{}});
 assert.deepEqual(r.symbols[0].outcomes.map((o:any)=>[o.status,o.filedSymbol]),[['RECORDED','BAJAJAUTO'],['IDENTITY_MISMATCH','OTHERCO']]);
 assert.equal(r.symbols[0].status,'PARTIAL');assert.equal(store.saved[0].instrumentKey,'NSE_EQ|INE917I01010');assert.equal(store.saved[0].observedAt,new Date(now).toISOString());
 assert.deepEqual(reads.filter(([u]:any)=>!u.includes('api')).map(([,m]:any)=>m),[MAX_DOCUMENT_BYTES,MAX_DOCUMENT_BYTES]);
 const bySymbol=await backfillFundamentalFilings({targets:[{symbol:'BAJAJ-AUTO'}],store:memoryStore(),read,clock:()=>now,pause:async()=>{}});
 assert(bySymbol.symbols[0].outcomes.every((o:any)=>o.status==='IDENTITY_MISMATCH'),'without an ISIN the filed symbol must match');
 await assert.rejects(backfillFundamentalFilings({targets:[{symbol:'X',isin:'bad'}],store:memoryStore(),read,pause:async()=>{}}));
});
test('stored filings are skipped; index outages, HTML pages and unsupported formats stay explicit',async()=>{
 const items=[row('1','31-MAR-2026'),row('2','31-MAR-2026','23-Apr-2026 20:47:18'),row('3','31-MAR-2026','23-Apr-2026 20:47:19')];
 const ids=parseFilingIndex(index(items),'INFY',now).items.map((i:any)=>i.id);
 const read=async(url:string)=>url.includes('symbol=DOWN')?Promise.reject(Error('blocked')):url.includes('api')?index(items):url===x('2')?'<!DOCTYPE html><html></html>':filingXml('INFY','INE009A01021').replace(/<RevenueFromOperations[^]*?<\/RevenueFromOperations>/,'').replace(/<ProfitLossForPeriod[^]*?<\/ProfitLossForPeriod>/,'');
 const r=await backfillFundamentalFilings({targets:[{symbol:'INFY',isin:'INE009A01021'},{symbol:'DOWN'}],store:memoryStore([ids[0]]),read,clock:()=>now,pause:async()=>{}});
 assert.deepEqual(r.symbols[0].outcomes.map((o:any)=>o.status),['ALREADY_RECORDED','READ_FAILED','UNSUPPORTED_FORMAT']);
 assert.equal(r.symbols[1].status,'INDEX_UNAVAILABLE');assert.equal(r.coverage.indexUnavailable,1);assert.equal(r.coverage.failed,1);assert.equal(r.coverage.unsupportedFormat,1);
});
test('growth and ratios across filings with different symbols carry FILED_SYMBOL_CHANGED',()=>{
 const KEY='NSE_EQ|INE155A01022';
 const filing=(c:string,symbol:string,start:string,end:string,publishedAt:string,facts:any[],positions:any[])=>({policy:'fundamental-filing-v1',status:'EXTRACTED_REQUIRES_REVIEW',id:c.repeat(64),documentHash:c.repeat(64),symbol,instrumentKey:KEY,scope:'Consolidated',url:'u',publishedAt,observedAt:publishedAt,periods:[{contextId:'D',start,end,facts,unavailable:[]}],positions,rejectedContexts:[]});
 const f=(key:string,value:number)=>({key,value,currency:'INR',tag:key});
 const filings=[filing('a','TATAMOTORS','2024-04-01','2025-03-31','2025-05-13T00:00:00Z',[f('revenue',100)],[{contextId:'I',instant:'2025-03-31',facts:[f('equity',50)],unavailable:[]}]),
  filing('b','TMPV','2025-04-01','2026-03-31','2026-05-13T00:00:00Z',[f('revenue',80),f('totalProfit',40)],[{contextId:'I',instant:'2026-03-31',facts:[f('equity',70)],unavailable:[]}])];
 const d=deriveFundamentals(filings,{instrumentKey:KEY,asOf:now}),c=d.scopes.Consolidated;
 const rev=c.growth.find((g:any)=>g.key==='revenue'&&g.years===1);assert(Math.abs(rev.valuePct+20)<1e-9);assert.deepEqual(rev.warnings,['FILED_SYMBOL_CHANGED']);
 const roe=c.ratios.find((r:any)=>r.key==='roe');assert.equal(roe.status,'CALCULATED_REQUIRES_REVIEW');assert.deepEqual(roe.warnings,['FILED_SYMBOL_CHANGED']);
 assert.deepEqual(c.ratios.find((r:any)=>r.key==='roce').warnings,[]);
});
