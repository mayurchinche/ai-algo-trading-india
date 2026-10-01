import test from 'node:test';import assert from 'node:assert/strict';
import {createScheduledPaperHandler,scheduledPaperWindow} from '../server/scheduledPaper.js';
const secret='isolated-test-token-not-a-real-secret',now=Date.parse('2026-10-01T09:20:00+05:30');
const response=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}});
const req=(authorization='Bearer '+secret,body:any={})=>({method:'POST',headers:{authorization},body});
test('scheduler fails closed on missing configuration or invalid authorization before database access',async()=>{
 for(const [token,config,expected] of [['wrong',secret,401],['Bearer '+secret,'',503]]){
  const res=response();await createScheduledPaperHandler({secret:()=>config,store:()=>{throw Error('must not access');}})(req(token),res);assert.equal(res.code,expected);
 }
});
test('authorized scheduler targets shared intraday cycle and rejects client prices',async()=>{
 let calls=0;const handler=createScheduledPaperHandler({secret:()=>secret,enabled:()=>true,now:()=>now,store:(s:string)=>{assert.equal(s,'intraday');return {};},run:async(args:any)=>{calls++;assert.equal(args.source,'scheduler');return {status:'SAVED',scan:{status:'NO_ELIGIBLE_SIGNALS'}};}});
 const res=response();await handler(req(),res);assert.equal(res.code,200);assert.equal(calls,1);
 const bad=response();await handler(req('Bearer '+secret,{quotes:[{price:1}]}),bad);assert.equal(bad.code,400);assert.equal(calls,1);
});
test('scheduler window uses IST, includes exit monitoring and excludes weekends',()=>{
 for(const [time,expected] of [['2026-10-01T09:14:59+05:30',false],['2026-10-01T09:15:00+05:30',true],['2026-10-01T15:35:00+05:30',true],['2026-10-01T15:36:00+05:30',false],['2026-10-03T10:00:00+05:30',false]] as const)assert.equal(scheduledPaperWindow(Date.parse(time)),expected);
});
test('failed scan is not a successful scheduler response; lease contention is a safe skip',async()=>{
 for(const [result,code] of [[{status:'SAVED',scan:{status:'SCAN_FAILED'}},503],[{status:'BUSY'},200]] as const){const res=response();await createScheduledPaperHandler({secret:()=>secret,enabled:()=>true,now:()=>now,store:()=>({}),run:async()=>result})(req(),res);assert.equal(res.code,code);}
});
