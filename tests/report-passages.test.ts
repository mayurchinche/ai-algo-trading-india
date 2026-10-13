import test from 'node:test';import assert from 'node:assert/strict';
import {locateReportPassages,createReportPassageReader} from '../server/reportPassages.js';
const now=Date.parse('2026-10-04T06:00:00Z'),id='a'.repeat(64);
const record={id,format:'PDF',company:'Fixture',url:'https://nsearchives.nseindia.com/annual_reports/test.pdf',publishedAt:null};
const history=async()=>({observedAt:new Date(now).toISOString(),reports:[record]});
test('passage location preserves negation without classifying the issuer',()=>{
 const topics=locateReportPassages([{page:7,text:'There was no qualified opinion. This passage is a test fixture only.'}]);
 assert(topics[0].passages[0].text.includes('no qualified opinion'));assert.equal(topics[0].passages[0].page,7);assert.equal(topics[0].status,'PASSAGES_FOUND');assert.equal(topics[1].status,'NO_MATCH_IN_EXTRACTED_TEXT');
});
test('topic output is bounded while coverage counts every matching page',()=>{const topic=locateReportPassages(Array.from({length:10},(_,i)=>({page:i+1,text:'related party '.repeat(500)})))[3];assert.equal(topic.matchingPages,10);assert.equal(topic.passages.length,3);assert(topic.passages.every((p:any)=>p.text.length<=602));});
test('reader refuses unknown IDs and ZIPs before any network access',async()=>{let calls=0;const read=createReportPassageReader({history,fetcher:async()=>{calls++;throw Error();}});await assert.rejects(read('TEST','equities','bad'));assert.equal(calls,0);});
test('PDF identity, hash, sparse pages and cached observation are preserved',async()=>{
 let calls=0;const read=createReportPassageReader({history,clock:()=>now,fetcher:async()=>{calls++;return new Response('%PDF-fixture-only');},extract:async()=>[{page:1,text:''}]});
 const result=await read('TEST','equities',id);assert.equal(result.status,'OCR_OR_MANUAL_REVIEW_REQUIRED');assert.equal(result.coverage.lowTextPages,1);assert.equal(result.documentHash.length,64);assert.equal(result.publishedAt,null);assert.deepEqual(await read('TEST','equities',id),result);assert.equal(calls,1);
});
test('non-PDF responses and unsafe document sources never reach extraction',async()=>{
 const read=createReportPassageReader({history,fetcher:async()=>new Response('<html>blocked</html>'),extract:async()=>{throw Error('must not run');}});await assert.rejects(read('TEST','equities',id),/Not a PDF/);
 const unsafe=createReportPassageReader({history:async()=>({reports:[{...record,url:'https://evil.test/test.pdf'}]}),fetcher:async()=>{throw Error('must not run');}});await assert.rejects(unsafe('TEST','equities',id),/Unsupported source/);
});
