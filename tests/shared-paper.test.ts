import test from 'node:test';import assert from 'node:assert/strict';
import {createSharedPaperHandler,applySharedAction} from '../server/sharedPaper.js';
import {newPaperAccount} from '../server/paperEngine.js';
import {randomUUID} from 'node:crypto';
const now=Date.parse('2026-09-25T04:16:00Z');
const response=()=>({code:0,body:null as any,setHeader(){},status(code:number){this.code=code;return this;},json(body:unknown){this.body=body;return this;},end(){return this;}});
function memoryStore(id='user1',capital=20000){let account={id,enabled:false,revision:0,state:{...newPaperAccount(),capital}},leased=false;const events:any[]=[],requests=new Map();return {
 async account(){return structuredClone(account);},async prior(id:string){return requests.get(id);},
 async commit(before:any,result:any,id?:string,action?:unknown){if(id&&requests.has(id))return 'duplicate';if(before.revision!==account.revision)return 'conflict';account={...account,state:structuredClone(result.state),enabled:result.enabled,revision:account.revision+1};events.push(...result.events);if(id)requests.set(id,{action});return 'saved';},
 async opportunities(before:number,until:number){return events.filter(e=>e.kind==='OPPORTUNITY_RECORDED'&&e.id<before&&e.id<=until).slice().reverse().slice(0,101).map(event=>({sequence:event.id,event}));},
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
 const candidate={symbol:'TEST',signalId:'shared-signal',signalTime:new Date(now).toISOString(),signalQuoteTime:new Date(now).toISOString(),signalPrice:100,side:'BUY',score:80,stop:98,target:104};
 const handler=createSharedPaperHandler({store:()=>store,enabled:()=>true,now:()=>clock,observe:async()=>({marketOpen:true,candidates:[candidate],quotes:[{symbol:'TEST',price:100,timestamp:new Date(clock).toISOString(),source:'isolated-test'}]})});
 const enabled=response();await handler(req('POST',{requestId:randomUUID(),action:{enabled:true}}),enabled);assert.equal(enabled.code,200);
 await handler(req('POST',{tick:true}),response());clock+=20000;await handler(req('POST',{tick:true}),response());
 const web=response(),android=response();await handler(req(),web);await handler(req(),android);
 assert.equal(web.body.account.state.orders.length,1);assert(web.body.account.state.orders[0].filled>0);assert.deepEqual(web.body.account,android.body.account);
 assert.equal(web.body.account.state.orders[0].entryTime,new Date(clock).toISOString());assert(web.body.events.some((row:any)=>row.event.kind==='ENTRY_FILL'));
});

import {tradingSegments} from '../shared/tradingSegments.js';
test('five portfolios isolate funds, request IDs and history; unsupported execution fails closed',async()=>{
 const stores=new Map(tradingSegments.map(s=>[s.id,memoryStore(s.accountId,s.capital)]));let observations=0;
 const handler=createSharedPaperHandler({store:(segment:string)=>stores.get(segment),enabled:()=>true,now:()=>now,observe:async()=>{observations++;return {};}});
 const requestId=randomUUID();
 for(const segment of tradingSegments){
  const query={segment:segment.id};const body={requestId,action:{transfer:{id:'isolated-funding-test',kind:'DEPOSIT',amount:100}}};
  for(let retry=0;retry<2;retry++){const res=response();await handler(req('POST',body,query),res);assert.equal(res.code,200);assert.equal(res.body.balance.balance,segment.capital+100);assert.equal(res.body.account.id,segment.accountId);assert.equal(res.body.events.length,1);}
  if(!segment.executionReady)for(const body of [{tick:true},{requestId:randomUUID(),action:{enabled:true}},{requestId:randomUUID(),action:{execution:{mode:'AUTO'}}},{requestId:randomUUID(),action:{transfer:{},enabled:true}}]){
   const res=response();await handler(req('POST',body,query),res);assert.equal(res.code,409);
  }
 }
 assert.equal(observations,0);
 const rejected=response();await handler(req('POST',{requestId:randomUUID(),action:{transfer:{id:'overdraw-short-term',kind:'WITHDRAWAL',amount:999999}}},{segment:'short-term'}),rejected);assert.equal(rejected.code,400);
 const untouched=response();await handler(req('GET',undefined,{segment:'options'}),untouched);assert.equal(untouched.body.balance.balance,50100);
 const invalid=createSharedPaperHandler({store:()=>{throw new Error('must not access database');},enabled:()=>true});
 for(const segment of ['typo','user1',['options']]){const res=response();await invalid(req('GET',undefined,{segment}),res);assert.equal(res.code,400);}
});
test('client scopes retry IDs to segment and rejects a different account response',async()=>{
 const original=globalThis.fetch;const sent:{url:string;id:string}[]=[];
 globalThis.fetch=async(url,init)=>{sent.push({url:String(url),id:JSON.parse(String(init?.body)).requestId});throw new Error('lost');};
 try{
  const action={transfer:{id:'client-scope-test',kind:'DEPOSIT',amount:10}};
  for(const segment of ['options','futures','options'] as const)await assert.rejects(sharedPaperRequest(action,0,undefined,undefined,segment));
  assert.equal(sent[0].id,sent[2].id);assert.notEqual(sent[0].id,sent[1].id);assert.match(sent[0].url,/segment=options/);
  globalThis.fetch=async()=>new Response(JSON.stringify({account:{id:'user1',name:'user1',storage:'shared-backend',segment:'intraday',state:{orders:[]}},balance:{},events:[]}));
  await assert.rejects(sharedPaperRequest(undefined,0,undefined,undefined,'options'),/Invalid shared account/);
 }finally{globalThis.fetch=original;}
});

import {recordOpportunities} from '../server/sharedOpportunities.js';
const sharedCandidate=(clock=now)=>({symbol:'TEST',signalId:'2026-09-25:TEST:BUY:strong-equity-observed-v2',signalTime:new Date(clock).toISOString(),signalQuoteTime:new Date(clock).toISOString(),side:'BUY',score:80,signalPrice:100,stop:98,target:104,strategy:{id:'test',reasons:['test observation']}});
test('shared opportunity first observation is immutable and expired or invalid observations are not recorded',()=>{
 const initial=recordOpportunities(newPaperAccount(),[sharedCandidate()],now,true);
 assert.equal(initial.events.length,1);assert.equal(initial.events[0].generatedAt,new Date(now).toISOString());
 const later=recordOpportunities(initial.state,[{...sharedCandidate(now+30000),signalPrice:101}],now+30000,true);
 assert.equal(later.events.length,0);assert.equal(later.state.opportunityIds[sharedCandidate().signalId],new Date(now).toISOString());
 for(const candidate of [{...sharedCandidate(),score:69},{...sharedCandidate(),signalPrice:97},sharedCandidate(now-120000),sharedCandidate(now+1),{...sharedCandidate(),signalQuoteTime:'invalid'}])assert.equal(recordOpportunities(newPaperAccount(),[candidate],now,true).events.length,0);
 assert.equal(recordOpportunities(newPaperAccount(),[sharedCandidate()],now,false).events.length,0);
 const cutoff=Date.parse('2026-09-25T09:44:30Z');assert.equal(recordOpportunities(newPaperAccount(),[sharedCandidate(cutoff)],cutoff,true).events[0].expiresAt,'2026-09-25T09:45:00.000Z');
});
test('paused accounts record shared signals without orders and web/Android return the same feed',async()=>{
 const store=memoryStore();let clock=now;
 const handler=createSharedPaperHandler({store:()=>store,enabled:()=>true,now:()=>clock,observe:async()=>({marketOpen:true,candidates:[sharedCandidate(clock)],quotes:[]})});
 const tick=response();await handler(req('POST',{tick:true}),tick);assert.equal(tick.code,200);assert.equal(tick.body.account.state.orders.length,0);
 const web=response(),android=response();await handler(req('GET',undefined,{feed:'opportunities'}),web);await handler({...req('GET',undefined,{feed:'opportunities'}),headers:{origin:'https://localhost',host:'test.local'}},android);
 assert.deepEqual(web.body.events,android.body.events);assert.equal(web.body.events.length,1);assert.equal(web.body.events[0].event.kind,'OPPORTUNITY_RECORDED');
 clock+=30000;await handler(req('POST',{tick:true}),response());const next=response();await handler(req('GET',undefined,{feed:'opportunities'}),next);assert.deepEqual(next.body.events,web.body.events);
 const bad=response();const revision=(await store.account()).revision;await handler(req('POST',{requestId:randomUUID(),action:{enabled:true}},{feed:'opportunities'}),bad);assert.equal(bad.code,400);assert.equal((await store.account()).revision,revision);
});
test('shared opportunity history uses descending stable cursors and excludes later events',async()=>{
 const store=memoryStore();let a=await store.account();const events=Array.from({length:102},(_,i)=>({id:i+1,kind:'OPPORTUNITY_RECORDED',signalId:`s${i}`}));
 await store.commit(a,{state:{...a.state,sequence:102},events,enabled:false});
 const handler=createSharedPaperHandler({store:()=>store,enabled:()=>true});const first=response();await handler(req('GET',undefined,{feed:'opportunities'}),first);
 assert.equal(first.body.events.length,100);assert.equal(first.body.events[0].sequence,102);assert.equal(first.body.nextCursor,3);assert.equal(first.body.hasMore,true);
 a=await store.account();await store.commit(a,{state:{...a.state,sequence:103},events:[{id:103,kind:'OPPORTUNITY_RECORDED'}],enabled:false});
 const second=response();await handler(req('GET',undefined,{feed:'opportunities',until:'102',before:'3'}),second);assert.deepEqual(second.body.events.map((r:any)=>r.sequence),[2,1]);assert.equal(second.body.hasMore,false);
 for(const before of ['0','-1','oops','104']){const bad=response();await handler(req('GET',undefined,{feed:'opportunities',until:'102',before}),bad);assert.equal(bad.code,400);}
});

test('expired reference quotes cannot produce either a shared signal or a new order',async()=>{
 const store=memoryStore();const handler=createSharedPaperHandler({store:()=>store,enabled:()=>true,now:()=>now,observe:async()=>({marketOpen:true,candidates:[{...sharedCandidate(),signalQuoteTime:new Date(now-121000).toISOString()}],quotes:[{symbol:'TEST',price:100,timestamp:new Date(now).toISOString(),source:'test'}]})});
 await handler(req('POST',{requestId:randomUUID(),action:{enabled:true}}),response());
 const result=response();await handler(req('POST',{tick:true}),result);assert.equal(result.code,200);assert.equal(result.body.account.state.orders.length,0);assert.equal(result.body.account.state.intents.length,0);assert(!result.body.events.some((r:any)=>r.event.kind==='OPPORTUNITY_RECORDED'));
});

import {opportunityDecisions} from '../server/sharedOpportunities.js';
test('opportunity decisions project only matching account records and never invent closed P&L',()=>{
 const state={...newPaperAccount(),intents:[{signalId:'blocked',status:'REJECTED',reason:'Daily loss limit reached'},{signalId:'active',status:'SUBMITTED'}],orders:[{id:'one',signalId:'active',status:'PARTIAL',quantity:10,filled:4,exited:0,netPnl:999,fees:99},{id:'other-account-signal',signalId:'hidden',status:'CLOSED',netPnl:88}]};
 const before=structuredClone(state),decisions=opportunityDecisions(state,['blocked','active','unknown']);
 assert.equal(decisions.blocked.intent.reason,'Daily loss limit reached');assert.equal(decisions.blocked.order,null);assert.equal(decisions.active.order.filled,4);assert.equal(decisions.active.order.netPnl,undefined);assert.equal(decisions.active.order.fees,undefined);assert.equal(decisions.hidden,undefined);assert.deepEqual(decisions.unknown,{order:null,intent:null});assert.deepEqual(state,before);
 state.orders[0].status='CLOSED';assert.equal(opportunityDecisions(state,['active']).active.order.netPnl,999);
});
test('shared feed returns current decision separately from unchanged opportunity event',async()=>{
 const store=memoryStore();const before=await store.account();const event={id:1,kind:'OPPORTUNITY_RECORDED',signalId:'blocked'};
 await store.commit(before,{state:{...before.state,sequence:1,intents:[{signalId:'blocked',status:'REJECTED',reason:'Insufficient capital or risk allowance'}]},events:[event],enabled:false});
 const handler=createSharedPaperHandler({store:()=>store,enabled:()=>true}),res=response();await handler(req('GET',undefined,{feed:'opportunities'}),res);
 assert.equal(res.code,200);assert.deepEqual(res.body.events[0].event,event);assert.equal(res.body.decisions.blocked.intent.reason,'Insufficient capital or risk allowance');assert.equal(res.body.decisionRevision,res.body.account.revision);
});
