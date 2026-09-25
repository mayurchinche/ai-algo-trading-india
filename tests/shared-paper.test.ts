import test from 'node:test';import assert from 'node:assert/strict';
import {createSharedPaperHandler,applySharedAction} from '../server/sharedPaper.js';
import {newPaperAccount} from '../server/paperEngine.js';
import {randomUUID} from 'node:crypto';
const now=Date.parse('2026-09-25T04:16:00Z');
const response=()=>({code:0,body:null as any,setHeader(){},status(code:number){this.code=code;return this;},json(body:unknown){this.body=body;return this;},end(){return this;}});
function memoryStore(){let account={id:'user1',enabled:false,revision:0,state:newPaperAccount()},leased=false;const events:any[]=[],requests=new Map();return {
 async account(){return structuredClone(account);},async prior(id:string){return requests.get(id);},
 async commit(before:any,result:any,id?:string,action?:unknown){if(id&&requests.has(id))return 'duplicate';if(before.revision!==account.revision)return 'conflict';account={...account,state:structuredClone(result.state),enabled:result.enabled,revision:account.revision+1};events.push(...result.events);if(id)requests.set(id,{action});return 'saved';},
 async lease(){if(leased)return false;leased=true;return true;},async release(){leased=false;},
 async events(after:number,until:number,orderId?:string,signalId?:string){return events.filter(e=>e.id>after&&e.id<=until&&(!orderId||e.orderId===orderId||e.signalId===signalId)).slice(0,501).map(event=>({sequence:event.id,event}));}
 };}
const req=(method='GET',body?:unknown,query={})=>({method,body,query,headers:{host:'test.local'}});
test('web and Android read one account; retries do not double-credit transfers',async()=>{
 const store=memoryStore(),handler=createSharedPaperHandler({store:()=>store,enabled:()=>true,now:()=>now});
 const body={requestId:randomUUID(),action:{transfer:{id:'shared-transfer-test',kind:'DEPOSIT',amount:500}}};
 for(let i=0;i<2;i++){const res=response();await handler(req('POST',body),res);assert.equal(res.code,200);assert.equal(res.body.balance.balance,20500);}
 const android=response();await handler({...req(),headers:{origin:'https://localhost',host:'test.local'}},android);assert.equal(android.body.account.name,'user1');assert.equal(android.body.events.length,1);assert.equal(android.body.balance.balance,20500);
 const changed=response();await handler(req('POST',{...body,action:{enabled:true}}),changed);assert.equal(changed.code,409);
});
test('simultaneous clients run one server observation cycle and never submit caller prices',async()=>{
 const store=memoryStore();let observed=0;let release:()=>void=()=>{};const gate=new Promise<void>(r=>{release=r;});
 const handler=createSharedPaperHandler({store:()=>store,enabled:()=>true,now:()=>now,observe:async()=>{observed++;await gate;return {quotes:[],candidates:[],marketOpen:false};}});
 const web=response(),android=response();const first=handler(req('POST',{tick:true}),web);await new Promise(r=>setTimeout(r,0));await handler(req('POST',{tick:true}),android);release();await first;
 assert.equal(observed,1);assert.equal(web.code,200);assert.equal(android.code,200);
 const forged=response();await handler(req('POST',{tick:true,quotes:[{price:1}]}),forged);assert.equal(forged.code,400);
});
test('mutating controls during a slow observation discard the stale cycle',async()=>{
 const store=memoryStore();let release:()=>void=()=>{};const gate=new Promise<void>(r=>{release=r;});
 const handler=createSharedPaperHandler({store:()=>store,enabled:()=>true,now:()=>now,observe:async()=>{await gate;return {quotes:[],candidates:[],marketOpen:false};}});
 const cycle=handler(req('POST',{tick:true}),response());await new Promise(r=>setTimeout(r,0));
 await handler(req('POST',{requestId:randomUUID(),action:{transfer:{id:'concurrent-transfer',kind:'DEPOSIT',amount:100}}}),response());release();await cycle;
 assert.equal((await store.account()).state.transfers.length,1);assert.equal((await store.account()).state.lastCycleAt,null);
});
test('shared service fails closed before activation, on provider failure and for unsupported actions',async()=>{
 const disabled=createSharedPaperHandler({enabled:()=>false,store:()=>{throw new Error('must not read');}}),res=response();await disabled(req(),res);assert.equal(res.code,503);
 const store=memoryStore(),handler=createSharedPaperHandler({store:()=>store,enabled:()=>true,observe:async()=>{throw new Error('provider unavailable');}});
 const failure=response();await handler(req('POST',{tick:true}),failure);assert.equal(failure.code,503);assert.equal((await store.account()).revision,0);
 assert.throws(()=>applySharedAction({state:newPaperAccount(),enabled:false},{quotes:[]}));
 assert.throws(()=>applySharedAction({state:newPaperAccount(),enabled:false},{enabled:true,transfer:{}}));
 for(const query of [{after:'-1'},{until:'999'},{orderId:'x,account_id.neq.user1'}]){const res=response();await handler(req('GET',undefined,query),res);assert.equal(res.code,400);}
});
test('shared manual controls use server time and pause cancels queued intents',()=>{
 const state={...newPaperAccount(),intents:[{signalId:'s',status:'REVIEW'}]};const result=applySharedAction({state,enabled:true},{enabled:false},now);
 assert.equal(result.enabled,false);assert.equal(result.state.intents[0].status,'CANCELLED');assert.equal(result.events[0].at,new Date(now).toISOString());
});
import {sharedPaperRequest} from '../src/services/sharedPaperAccount';
import {discoverStocks} from '../src/services/stockDiscovery';
test('shared client has no local fallback and keeps the same request ID after uncertain network delivery',async()=>{
 const original=globalThis.fetch;Object.defineProperty(globalThis,'window',{value:new EventTarget(),configurable:true});
 const sent:any[]=[];globalThis.fetch=async(url,init)=>{assert.match(String(url),/\/api\/shared-paper/);sent.push(JSON.parse(String(init?.body)));throw new Error('response lost');};
 try{const action={enabled:false};await assert.rejects(sharedPaperRequest(action),/No device trades/);await assert.rejects(sharedPaperRequest(action));assert.equal(sent[0].requestId,sent[1].requestId);
 globalThis.fetch=async()=>new Response('<html>SPA</html>');await assert.rejects(sharedPaperRequest(),/Deploy the shared-account backend/);
 globalThis.fetch=async()=>new Response(JSON.stringify({account:{name:'someone-else'},events:[],balance:{}}));await assert.rejects(sharedPaperRequest(),/Invalid shared account/);
 }finally{globalThis.fetch=original;}
});
test('server scanner injects provider IO into history calls as well as screeners',async()=>{
 const paths:string[]=[];await assert.rejects(discoverStocks(async(path:string)=>{paths.push(path);return path.includes('screener')?{finance:{result:[{quotes:[{symbol:'TEST.NS',regularMarketPrice:100,regularMarketVolume:200000}]}]}}:{chart:{result:[]}};}));
 assert(paths.some(path=>path.includes('/chart/TEST.NS')));assert.equal(paths.length,4);
});
test('one shared signal produces one order and both clients see its later fill and audit history',async()=>{
 const store=memoryStore();let clock=now;
 const candidate={symbol:'TEST',signalId:'shared-signal',signalTime:new Date(now).toISOString(),side:'BUY',score:80,stop:98,target:104};
 const handler=createSharedPaperHandler({store:()=>store,enabled:()=>true,now:()=>clock,observe:async()=>({marketOpen:true,candidates:[candidate],quotes:[{symbol:'TEST',price:100,timestamp:new Date(clock).toISOString(),source:'isolated-test'}]})});
 const enabled=response();await handler(req('POST',{requestId:randomUUID(),action:{enabled:true}}),enabled);assert.equal(enabled.code,200);
 await handler(req('POST',{tick:true}),response());clock+=20000;await handler(req('POST',{tick:true}),response());
 const web=response(),android=response();await handler(req(),web);await handler(req(),android);
 assert.equal(web.body.account.state.orders.length,1);assert(web.body.account.state.orders[0].filled>0);assert.deepEqual(web.body.account,android.body.account);
 assert.equal(web.body.account.state.orders[0].entryTime,new Date(clock).toISOString());assert(web.body.events.some((row:any)=>row.event.kind==='ENTRY_FILL'));
});
