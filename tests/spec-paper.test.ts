import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {parseStrategySpec} from '../shared/strategySpec.js';
import {cycleRun,runSpecPaperCycle,newPaperState,validatePaperOptions,stopRunState,summarizeRun,MAX_EVENTS} from '../server/specPaperRunner.js';
import {parseCandles,createSpecPaperMarket} from '../server/specPaperMarket.js';
import {createSpecPaperHandler,createSpecPaperCycleHandler} from '../api/_spec-paper.js';
import {researchRoutes} from '../api/research.js';
import {RunDetail} from '../src/components/SpecPaperPage';
import {buildWizardSpec} from '../shared/optionsWizard.js';

const t0=Date.parse('2026-10-19T09:15:00+05:30'),M=300000;
const opts={capital:100000,costBps:5,costPerOrder:20,slippageBps:0,maxUnitsPerOrder:null};
const equitySpec=(parseStrategySpec({schemaVersion:1,name:'e',mode:'intraday',underlying:{symbol:'INFY',exchange:'NSE',kind:'equity'},timeframe:'5m',schedule:{weekdays:[1,2,3,4,5],entryStart:'09:20',entryEnd:'15:00',squareOff:'15:15'},indicators:[],entry:{compare:{left:{price:'close'},op:'gt',right:{value:0}}},legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units:10},stopLoss:{unit:'points',value:5}}]}) as any).spec;
const bar=(k:number,c=100)=>({time:t0+k*M,open:c,high:c+1,low:c-1,close:c,volume:1});
// Fake read-only market: bars up to `n`, a live quote per key, contracts by leg.
const market=(over:any={})=>{const state={n:2,price:100,calls:[] as string[],...over};return {state,
 underlyingKey:async()=>'NSE_EQ|INE009A01021',bars:async()=>Array.from({length:state.n},(_,k)=>bar(k,state.price)),
 quotes:async(keys:string[])=>{state.calls.push('quotes:'+keys.join(','));return new Map(keys.filter(k=>!state.noQuote?.includes(k)).map(k=>[k,{symbol:k,price:state.price,bid:state.price-0.1,ask:state.price+0.1}]));},
 resolveLeg:async(_s:any,leg:any)=>{if(state.unresolved?.includes(leg.id))throw Object.assign(new Error('x'),{});return {instrumentKey:'K_'+leg.id,lotSize:leg.instrument.type==='option'?75:1,description:'C '+leg.id};},
 marketOpen:async()=>state.open??true,...over.methods};};
const run=(spec:any,state:any,version=0)=>({id:'r1',status:'ACTIVE',version,spec,options:opts,state,created_at:'c',updated_at:'u'});

test('a cycle decides on the latest completed bar, fills at the next cycle on the live ask and skips repeated bars',async()=>{
 const m=market(),now=()=>t0+3*M;
 const r1:any=await cycleRun(run(equitySpec,newPaperState(equitySpec,opts,t0)),{market:m,now});
 assert.equal(r1.outcome,'STEPPED');assert.equal(r1.state.pending.kind,'ENTRY');assert.equal(r1.state.paper.lastBarTime,t0+M);
 assert.equal((await cycleRun(run(equitySpec,r1.state),{market:m,now})).outcome,'NO_NEW_BAR');
 m.state.n=3;const r2:any=await cycleRun(run(equitySpec,r1.state),{market:m,now});
 assert.equal(r2.state.status,'OPEN');assert.equal(r2.state.legs[0].entry,100.1);assert.equal(r2.state.legs[0].instrument.instrumentKey,'K_eq');assert.equal(r2.state.legs[0].stop,95.1);
 m.state.n=6;m.state.price=94;const r3:any=await cycleRun(run(equitySpec,r2.state),{market:m,now});
 assert.equal(r3.missed,2);assert.equal(r3.state.paper.missedBars,2);assert.equal(r3.state.entries[0].reason,'STOP_LOSS');
 // Gap through the 95.1 stop: sells at the 93.9 bid; P&L includes both fills' costs (5 bps + ₹20 each).
 const costs=(100.1*10+93.9*10)*5/1e4+40;assert(Math.abs(r3.state.entries[0].pnl-((93.9-100.1)*10-costs))<1e-9);
});
test('multi-leg option entries resolve every contract or cancel; missing quotes are reported',async()=>{
 const ic=(buildWizardSpec({preset:'iron-condor',underlying:'NIFTY',kind:'index',expiry:'current-week',lots:2,w:2,g:2}) as any).spec;
 const m=market({unresolved:['pe_wing']}),now=()=>t0+3*M;
 const r1:any=await cycleRun(run(ic,newPaperState(ic,opts,t0)),{market:m,now});m.state.n=3;
 const r2:any=await cycleRun(run(ic,r1.state),{market:m,now});
 assert.equal(r2.state.status,'FLAT');assert(r2.state.events.some((e:any)=>e.kind==='ENTRY_CANCELLED'&&e.reason==='LEG_QUOTE_MISSING'));assert(r2.state.events.some((e:any)=>e.kind==='CONTRACT_UNRESOLVED'));
 const ok=market({}),s1:any=await cycleRun(run(ic,newPaperState(ic,opts,t0)),{market:ok,now});ok.state.n=3;
 const s2:any=await cycleRun(run(ic,s1.state),{market:ok,now});
 assert.equal(s2.state.status,'OPEN');assert.deepEqual(s2.state.legs.map((l:any)=>l.units),[150,150,150,150],'2 lots × lot size 75');
 ok.state.n=4;ok.state.noQuote=['K_ce_short'];const s3:any=await cycleRun(run(ic,s2.state),{market:ok,now});assert.deepEqual(s3.quotesMissing,['ce_short']);
 const stopped=stopRunState(run(ic,s3.state),t0+5*M);assert.equal(stopped.status,'FLAT');assert.equal(stopped.entries.at(-1).reason,'RUN_STOPPED');
});
test('scheduler cycle respects market hours, version conflicts, failures and the time budget',async()=>{
 const runs=[run(equitySpec,newPaperState(equitySpec,opts,t0)),{...run(equitySpec,newPaperState(equitySpec,opts,t0)),id:'r2'},{...run({bad:true},newPaperState(equitySpec,opts,t0)),id:'r3'}];
 const saves:any[]=[];const store={list:async()=>runs,save:async(id:string,v:number,state:any,status:string)=>{saves.push([id,status]);return id==='r2'?null:{id};}};
 assert.equal((await runSpecPaperCycle({store,market:market({open:false}),now:()=>t0})).status,'MARKET_CLOSED');
 const r:any=await runSpecPaperCycle({store,market:market(),now:()=>t0+3*M});
 assert.deepEqual(r.runs.map((x:any)=>x.outcome),['STEPPED','VERSION_CONFLICT','INVALID_SPEC']);assert.equal(r.status,'PARTIAL');assert.deepEqual(saves.at(-1),['r3','STOPPED']);
 let t=t0;const slow:any=await runSpecPaperCycle({store,market:market(),now:()=>(t+=30000),budgetMs:45000});assert(slow.runs.some((x:any)=>x.outcome==='DEFERRED'));
 const failing:any=await runSpecPaperCycle({store:{list:async()=>[runs[0]],save:async()=>({})},market:{...market(),bars:async()=>{throw new Error('secret token');}},now:()=>t0});
 assert.equal(failing.runs[0].outcome,'CYCLE_FAILED');assert(!JSON.stringify(failing).includes('secret'));
});
test('events are capped and candles keep completed, valid, de-duplicated bars',async()=>{
 const s=newPaperState(equitySpec,opts,t0);s.events=Array.from({length:MAX_EVENTS+20},(_,k)=>({time:k,kind:'X'}));
 const r:any=await cycleRun(run(equitySpec,s),{market:market(),now:()=>t0+3*M});assert.equal(r.state.events.length,MAX_EVENTS);assert(r.state.paper.droppedEvents>=21);
 const c=parseCandles([['2026-10-19T09:20:00+05:30',1,2,1,1,5],['2026-10-19T09:15:00+05:30',1,2,1,1,5],['2026-10-19T09:15:00+05:30',1,2,1,1,5],['2026-10-19T09:25:00+05:30',1,0.5,1,1,5],['2026-10-19T09:30:00+05:30',1,2,1,1,5]],'5m',Date.parse('2026-10-19T09:33:00+05:30'));
 assert.deepEqual(c.map(b=>new Date(b.time).toISOString()),['2026-10-19T03:45:00.000Z','2026-10-19T03:50:00.000Z']);
 const paths:string[]=[];const mk=createSpecPaperMarket({read:async(p:string)=>{paths.push(p);return {candles:[]};},master:async()=>[{segment:'NSE_EQ',instrument_type:'EQ',trading_symbol:'INFY',instrument_key:'NSE_EQ|INE009A01021'},{segment:'NSE_FO',instrument_type:'FUT',underlying_key:'NSE_EQ|INE009A01021',expiry:t0+10*86400000,lot_size:400,instrument_key:'NSE_FO|F1',trading_symbol:'INFY FUT'}],chains:async()=>{throw new Error('x');}});
 assert.equal(await mk.underlyingKey(equitySpec),'NSE_EQ|INE009A01021');await mk.bars(equitySpec,'NSE_EQ|INE009A01021',t0);
 assert(paths[0].startsWith('/v3/historical-candle/NSE_EQ%7CINE009A01021/minutes/5/'));assert.equal(paths[1],'/v3/historical-candle/intraday/NSE_EQ%7CINE009A01021/minutes/5');
 assert.deepEqual(await mk.resolveLeg(equitySpec,{instrument:{type:'future',expiry:'current-month'}},'NSE_EQ|INE009A01021',t0),{instrumentKey:'NSE_FO|F1',lotSize:400,description:'INFY FUT',expiry:'2026-10-29'});
 await assert.rejects(mk.resolveLeg(equitySpec,{instrument:{type:'future',expiry:'next-month'}},'NSE_EQ|INE009A01021',t0),/FUTURE_NOT_FOUND/);
});
const response=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}});
test('API validates specs and options, creates idempotently, stops with a version check and guards the cycle',async()=>{
 const rows=new Map<string,any>();const store=()=>({list:async()=>[...rows.values()],get:async(id:string)=>rows.get(id)??null,
  create:async(id:string,spec:any,options:any,state:any)=>{if(!rows.has(id))rows.set(id,{id,status:'ACTIVE',version:0,spec,options,state,created_at:'c',updated_at:'u'});return rows.get(id);},
  save:async(id:string,v:number,state:any,status:string)=>{const r=rows.get(id);if(!r||r.version!==v)return null;Object.assign(r,{state,status,version:v+1});return r;}});
 const h=createSpecPaperHandler({store,now:()=>t0}),post=(body:any)=>({method:'POST',headers:{host:'x'},body});
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const ok=response();await h(post({action:'create',id,spec:equitySpec,options:opts}),ok);assert.equal(ok.code,201);assert.equal(ok.body.run.position,'FLAT');
 const bad=response();await h(post({action:'create',id,spec:{...equitySpec,legs:[]},options:opts}),bad);assert.equal(bad.code,400);assert(bad.body.issues.length);
 const badOpt=response();await h(post({action:'create',id,spec:equitySpec,options:{...opts,costBps:500}}),badOpt);assert.equal(badOpt.code,400);
 assert.throws(()=>validatePaperOptions({...opts,extra:1}));assert.throws(()=>validatePaperOptions({...opts,maxUnitsPerOrder:0}));
 const stop=response();await h(post({action:'stop',id}),stop);assert.equal(stop.code,200);assert.equal(stop.body.run.status,'STOPPED');
 const list=response();await h({method:'GET',headers:{host:'x'}},list);assert.equal(list.body.runs.length,1);
 const noId=response();await h(post({action:'create'}),noId);assert.equal(noId.code,400);
 const cyc=createSpecPaperCycleHandler({store,market:market(),secret:()=>'s'.repeat(32),now:()=>t0});
 const unauth=response();await cyc({method:'POST',headers:{authorization:'Bearer x'},body:{}},unauth);assert.equal(unauth.code,401);
 const authed=response();await cyc({method:'POST',headers:{authorization:'Bearer '+'s'.repeat(32)},body:{}},authed);assert.equal(authed.code,200);
 assert.equal(typeof researchRoutes['spec-paper'],'function');assert.equal(typeof researchRoutes['spec-paper-cycle'],'function');
 const html=renderToStaticMarkup(createElement(RunDetail,{run:summarizeRun(rows.get(id))}));assert.match(html,/stopped/);assert.match(html,/Net P&amp;L/);
});
