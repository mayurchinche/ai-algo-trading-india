import test from 'node:test';import assert from 'node:assert/strict';
import {captureFinancialEvidence} from '../server/financialEvidenceSnapshot.js';
import {evidenceHash} from '../server/decisionEvidence.js';
const clock=()=>Date.parse('2026-10-04T06:00:00Z');
const items=Array.from({length:6},(_,i)=>({id:String(i),format:'XML',url:'https://example.com/test/'+i,publishedAt:'2026-10-01T10:00:00Z'}));
const doc=(id:string)=>({...items[Number(id)],observedAt:'2026-10-04T05:00:00Z',symbol:'TEST',periods:[{revenue:100}],documentHash:'test-fixture'});
test('snapshot captures bounded documents, exact observations and omissions',async()=>{
 const calls:string[]=[];const r=await captureFinancialEvidence({clock,reader:{feed:async()=>({items}),document:async(id:string)=>{calls.push(id);return doc(id);}}});
 assert.equal(r.status,'CAPTURED_SAMPLE');assert.deepEqual(calls,['0','1','2','3']);assert.equal(r.coverage.notSelected,2);assert.equal(r.documents[0].observedAt,'2026-10-04T05:00:00Z');assert.equal(r.verification,'EXTRACTED_REQUIRES_REVIEW');
 const hash=evidenceHash(r);r.documents[0].periods[0].revenue=101;assert.notEqual(hash,evidenceHash(r));
});
test('partial source failures and oversized documents remain explicit',async()=>{
 const r=await captureFinancialEvidence({clock,reader:{feed:async()=>({items}),document:async(id:string)=>{if(id==='0')throw Error('private provider detail');return id==='1'?{...doc(id),large:'x'.repeat(50001)}:doc(id);}}});
 assert.equal(r.status,'PARTIAL');assert.equal(r.documents.length,2);assert.equal(r.outcomes[0].status,'UNAVAILABLE');assert.equal(r.outcomes[1].status,'DOCUMENT_SIZE_LIMIT');assert(!JSON.stringify(r).includes('private provider'));
});
test('future or mismatched observations cannot enter a saved evidence sample',async()=>{
 const r=await captureFinancialEvidence({clock,reader:{feed:async()=>({items}),document:async(id:string)=>({...doc(id),...(id==='0'?{id:'wrong'}:id==='1'?{url:'https://other.test'}:id==='2'?{observedAt:'2026-10-05T00:00:00Z'}:{publishedAt:'2026-10-01T09:00:00Z'})})}});
 assert.equal(r.status,'UNAVAILABLE');assert.equal(r.documents.length,0);assert(r.outcomes.every((o:any)=>o.status==='INVALID_PROVENANCE'));
});
test('feed outage differs from a feed with no structured filings',async()=>{
 const failed=await captureFinancialEvidence({clock,reader:{feed:async()=>{throw Error('failure');}}});assert.equal(failed.status,'UNAVAILABLE');assert.equal(failed.feed,null);
 const empty=await captureFinancialEvidence({clock,reader:{feed:async()=>({items:[]})}});assert.equal(empty.status,'NO_STRUCTURED_FILINGS');
});
