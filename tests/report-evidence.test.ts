import test from 'node:test';import assert from 'node:assert/strict';
import {createReportEvidenceHandler} from '../api/_report-evidence.js';
const reference={requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',symbol:'TEST',segment:'equities',id:'b'.repeat(64),documentHash:'c'.repeat(64)};
const res=()=>({statusCode:0,body:null as any,setHeader(){},status(n:number){this.statusCode=n;return this;},json(b:any){this.body=b;}});
const req=(body:any)=>({method:'POST',headers:{host:'test'},body});
test('archive saves server evidence only and retry never rereads or overwrites source',async()=>{
 let saved:any=null,reads=0;const handler=createReportEvidenceHandler({store:()=>({prior:async()=>saved,save:async(id:string,report:any)=>saved={id,report}}),read:async()=>{reads++;return {...reference,note:'This preview is not saved with a portfolio.',topics:[]};}});
 const first=res();await handler(req(reference),first);assert.equal(first.statusCode,201);assert(!first.body.evidence.report.note.includes('not saved'));
 const retry=res();await handler(req(reference),retry);assert.equal(retry.statusCode,200);assert.equal(reads,1);
 const conflict=res();await handler(req({...reference,documentHash:'d'.repeat(64)}),conflict);assert.equal(conflict.statusCode,409);
});
test('changed PDF is rejected without any database write',async()=>{let saves=0;const handler=createReportEvidenceHandler({store:()=>({prior:async()=>null,save:async()=>{saves++;}}),read:async()=>({...reference,documentHash:'d'.repeat(64)})});const r=res();await handler(req(reference),r);assert.equal(r.statusCode,409);assert.equal(saves,0);});
test('client passages and archive outages are rejected without a local success',async()=>{
 const handler=createReportEvidenceHandler({store:()=>{throw Error('private key');}});
 const bad=res();await handler(req({...reference,topics:[]}),bad);assert.equal(bad.statusCode,400);
 const failed=res();await handler({method:'GET',headers:{host:'test'}},failed);assert.equal(failed.statusCode,503);assert(!failed.body.error.includes('private key'));
});
