import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {parseCompanyHistory,createCompanyHistoryReader,captureCompanyHistories} from '../server/companyHistory.js';
import {createCompanyHistoryHandler} from '../api/_company-history.js';
import {CompanyHistoryView} from '../src/components/CompanyHistoryResearch';
const now=Date.parse('2026-10-04T06:00:00Z');
const row={companyName:'Test fixture',fromYr:'2025',toYr:'2026',submission_type:'Revised',broadcast_dttm:'30-MAY-2026 20:04:13',disseminationDateTime:'30-MAY-2026 20:04:14',fileName:'https://nsearchives.nseindia.com/annual_reports/test.pdf'};
const parse=(rows:any[])=>parseCompanyHistory(JSON.stringify({data:rows}),'TEST','equities',now);
test('annual history uses dissemination time, retains unknown dates and revisions separately',()=>{
 const h=parse([row,{...row,fileName:row.fileName.replace('test.pdf','old.zip'),submission_type:'New',disseminationDateTime:'-',broadcast_dttm:'-'}]);
 assert.equal(h.reports.length,2);assert.equal(h.reports[0].publishedAt,'2026-05-30T14:34:14.000Z');assert.equal(h.reports[1].publishedAt,null);assert.equal(h.reports[1].timingStatus,'PUBLICATION_UNKNOWN');assert.equal(h.reports[1].format,'ZIP');
 const html=renderToStaticMarkup(createElement(CompanyHistoryView,{history:h}));assert(html.includes('cannot establish historical availability'));assert(html.includes('Revised'));
});
test('unsafe links, future publication and invalid payloads cannot become valid history',()=>{
 for(const change of [{fileName:'https://evil.test/a.pdf'},{fileName:row.fileName+'?secret=x'},{disseminationDateTime:'30-MAY-2027 20:04:14'},{fromYr:'bad'}])assert.equal(parse([{...row,...change}]).status,'NO_VALID_REPORTS');
 assert.throws(()=>parseCompanyHistory('{}','TEST','equities',now));assert.equal(parse([]).status,'EMPTY_INDEX');
});
test('bounded reader caches the original receipt and constructs only the fixed company URL',async()=>{
 let calls=0;const read=createCompanyHistoryReader({clock:()=>now,fetcher:async(url:string)=>{calls++;assert.equal(url,'https://www.nseindia.com/api/annual-reports?index=equities&symbol=M%26M');return new Response(JSON.stringify({data:[row]}));}});
 const h=await read('M&M');assert.deepEqual(await read('M&M'),h);assert.equal(calls,1);await assert.rejects(read('https://evil.test'));await assert.rejects(read('TEST','unknown'));
});
test('snapshot records bounded histories, missing sources and unassessed SCRAP requirements',async()=>{
 const snapshot=await captureCompanyHistories(['D','C','B','A','A'].map(symbol=>({symbol})),{clock:()=>now,reader:async(symbol:string)=>{if(symbol==='B')throw Error('private failure');return {symbol};}});
 assert.deepEqual(snapshot.observations.map((x:any)=>x.symbol),['A','B','C']);assert.deepEqual(snapshot.notSelected,['D']);assert.equal(snapshot.observations[1].status,'UNAVAILABLE');assert.equal(snapshot.research.status,'INSUFFICIENT_EVIDENCE');assert.equal(snapshot.research.pillars.length,5);assert(snapshot.research.pillars.every((p:any)=>p.status==='NOT_ASSESSED'));assert(!JSON.stringify(snapshot).includes('private failure'));
});
test('API rejects arbitrary URLs and source outages are unavailable rather than empty success',async()=>{
 const handler=createCompanyHistoryHandler(async()=>{throw Error('private failure');});
 const res=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;}});
 const bad=res();await handler({method:'GET',headers:{host:'test'},query:{symbol:'TEST',url:'https://evil.test'}},bad);assert.equal(bad.code,400);
 const outage=res();await handler({method:'GET',headers:{host:'test'},query:{symbol:'TEST'}},outage);assert.equal(outage.code,503);assert(!outage.body.error.includes('private failure'));
});
