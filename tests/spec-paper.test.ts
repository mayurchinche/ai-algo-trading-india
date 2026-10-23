import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {parseStrategySpec} from '../shared/strategySpec.js';
import {cycleRun,runSpecPaperCycle,newPaperState,validatePaperOptions,stopRunState,summarizeRun,upgradeState,tradeStats,KEEP_EVENTS} from '../server/specPaperRunner.js';
import {createUpstoxMarginCalculator} from '../server/upstoxMargin.js';
import {parseCandles,createSpecPaperMarket} from '../server/specPaperMarket.js';
import {createSpecPaperHandler,createSpecPaperCycleHandler} from '../api/_spec-paper.js';
import {researchRoutes} from '../api/research.js';
import {RunDetail} from '../src/components/PaperTradingPage';
import {buildWizardSpec} from '../shared/optionsWizard.js';

const t0=Date.parse('2026-10-19T09:15:00+05:30'),M=300000,MIN=60000;
const opts={capital:100000,costBps:0,costPerOrder:0,slippageBps:0,maxUnitsPerOrder:null};
const equitySpec=(parseStrategySpec({schemaVersion:1,name:'e',mode:'intraday',underlying:{symbol:'INFY',exchange:'NSE',kind:'equity'},timeframe:'5m',schedule:{weekdays:[1,2,3,4,5],entryStart:'09:20',entryEnd:'15:00',squareOff:'15:15'},indicators:[],entry:{compare:{left:{price:'close'},op:'gt',right:{value:0}}},legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units:10},stopLoss:{unit:'points',value:5}}]}) as any).spec;
const bar=(k:number,c=100)=>({time:t0+k*M,open:c,high:c+1,low:c-1,close:c,volume:1});
// Fake market: bars up to `n`, a live quote with 5-level depth per key, 1-minute candles, contracts, margin.
const market=(over:any={})=>{const state:any={n:2,price:100,depthQty:1000,minute:[] as any[],margin:{status:'OK',required:2000,source:'TEST'},calls:[] as string[],...over};return {state,
 underlyingKey:async()=>'NSE_EQ|INE009A01021',bars:async()=>{state.calls.push('bars');return Array.from({length:state.n},(_,k)=>bar(k,state.price));},
 quotes:async(keys:string[],at:number)=>new Map(keys.filter(k=>!state.noQuote?.includes(k)).map(k=>[k,{symbol:k,price:state.price,bid:state.price-0.1,ask:state.price+0.1,depth:{buy:[{price:state.price-0.1,quantity:state.depthQty}],sell:[{price:state.price+0.1,quantity:state.depthQty}]},timestamp:new Date(at-1000).toISOString(),source:'UPSTOX_FULL_QUOTE_V3'}])),
 minuteBars:async(_k:string,since:number)=>state.minute.filter((b:any)=>b.time>=since),
 margin:async(items:any[])=>{state.marginItems=items;if(state.margin instanceof Error)throw state.margin;return state.margin;},
 resolveLeg:async(_s:any,leg:any)=>{if(state.unresolved?.includes(leg.id))throw new Error('x');return {instrumentKey:'K_'+leg.id,lotSize:leg.instrument.type==='option'?75:1,description:'C '+leg.id};},
 marketOpen:async()=>state.open??true};};
const run=(spec:any,state:any,version=0)=>({id:'r1',status:'ACTIVE',version,spec,options:opts,state,created_at:'c',updated_at:'u'});
const fresh=(spec=equitySpec,o:any={})=>newPaperState(spec,validatePaperOptions({...opts,...o}),t0);
const kinds=(r:any)=>r.events.map((e:any)=>e.kind);

test('a decision on a completed bar executes in the same cycle at the live book, with margin, depth and tariff charges',async()=>{
 const m=market(),at=t0+3*M;
 const r1:any=await cycleRun(run(equitySpec,fresh()),{market:m,now:()=>at});
 assert.equal(r1.outcome,'STEPPED');assert.deepEqual(kinds(r1),['ENTRY_DECIDED','ORDER','ENTERED']);
 const order=r1.events[1];assert.equal(order.avgPrice,100.1);assert.equal(order.charges.tariff,'zerodha-nse-published-2026-10-18');assert.equal(order.product,'equity-intraday');assert.equal(order.status,'FILLED');
 assert.deepEqual(m.state.marginItems,[{instrumentKey:'K_eq',quantity:10,side:'BUY',product:'I'}]);
 assert.equal(r1.events[2].marginQuote.required,2000);assert.equal(r1.state.blocked,2000);assert.equal(r1.state.paper.eventSeq,3);
 assert.equal(r1.state.legs[0].stop,95.1);
 // Same bar, one minute later: nothing new is decided; the position is monitored and saved.
 const r2:any=await cycleRun(run(equitySpec,r1.state),{market:m,now:()=>at+MIN});assert.equal(r2.outcome,'MONITORED');assert.equal(r2.events.length,0);
 // A completed 1-minute candle trades through the stop between cycles: SL-M fills at the trigger.
 m.state.minute=[{time:at,open:99,high:100,low:94,close:96,volume:1}];
 const r3:any=await cycleRun(run(equitySpec,r2.state),{market:m,now:()=>at+2*MIN});
 assert.deepEqual(kinds(r3),['ORDER','TRADE_CLOSED']);assert.equal(r3.events[0].orderType,'SL-M');assert.equal(r3.events[0].avgPrice,95.1);assert.equal(r3.events[0].trigger.at,at);
 const t=r3.events[1];assert(Math.abs(t.gross-(-50))<1e-9);assert(Math.abs(t.charges-(order.charges.total+r3.events[0].charges.total))<1e-9);assert(Math.abs(t.net-(t.gross-t.charges))<1e-9);
 assert.equal(t.legs[0].entryPrice,100.1);assert.equal(t.legs[0].exitReason,'STOP_LOSS');assert.equal(r3.state.blocked,0);
 assert.equal(r3.state.paper.eventSeq,5);
 const sum=summarizeRun(run(equitySpec,r3.state));assert.equal(sum.closedTrades[0].tradeId,'T1');assert.equal(sum.stats.losses,1);assert(sum.funds!.ledger<100000);
});
test('entries are rejected for thin visible depth, missing or insufficient margin, and late square-off',async()=>{
 const at=t0+3*M,cancelled=async(over:any,o:any={},now=at)=>{const r:any=await cycleRun(run(equitySpec,fresh(equitySpec,o)),{market:market(over),now:()=>now});return r.events.find((e:any)=>e.kind==='ENTRY_CANCELLED');};
 assert.equal((await cancelled({depthQty:5})).reason,'INSUFFICIENT_VISIBLE_DEPTH');
 assert.equal((await cancelled({margin:new Error('down')})).reason,'MARGIN_UNAVAILABLE');
 const funds=await cancelled({margin:{status:'OK',required:500000}});assert.equal(funds.reason,'INSUFFICIENT_FUNDS');assert.equal(funds.available,100000);
 assert.equal(await cancelled({margin:new Error('down')},{requireMargin:false}),undefined,'margin can be waived per run');
});
test('intraday positions are squared off by wall-clock time and strategy limits act immediately',async()=>{
 const m=market(),r1:any=await cycleRun(run(equitySpec,fresh()),{market:m,now:()=>t0+3*M});
 const sq=Date.parse('2026-10-19T15:15:30+05:30');m.state.n=2;
 const r2:any=await cycleRun(run(equitySpec,r1.state),{market:m,now:()=>sq});
 const closed=r2.events.find((e:any)=>e.kind==='TRADE_CLOSED');assert.equal(closed.reason,'SQUARE_OFF');
 const limited={...equitySpec,risk:{maxLoss:{unit:'amount',value:5}}};
 const l1:any=await cycleRun(run(limited,fresh(limited)),{market:m,now:()=>t0+3*M});m.state.price=99;
 const l2:any=await cycleRun(run(limited,l1.state),{market:m,now:()=>t0+3*M+MIN});
 assert.deepEqual(l2.events.filter((e:any)=>['EXIT_DECIDED','TRADE_CLOSED'].includes(e.kind)).map((e:any)=>e.reason),['STRATEGY_MAX_LOSS','STRATEGY_MAX_LOSS']);
});
test('multi-leg option entries need every contract; flat runs without news are not saved',async()=>{
 const ic=(buildWizardSpec({preset:'iron-condor',underlying:'NIFTY',kind:'index',expiry:'current-week',lots:2,w:2,g:2}) as any).spec;
 const r:any=await cycleRun(run(ic,fresh(ic)),{market:market({unresolved:['pe_wing']}),now:()=>t0+3*M});
 assert(kinds(r).includes('CONTRACT_UNRESOLVED'));assert.equal(r.events.find((e:any)=>e.kind==='ENTRY_CANCELLED').reason,'LEG_QUOTE_MISSING');assert.equal(r.state.status,'FLAT');
 const ok:any=await cycleRun(run(ic,fresh(ic)),{market:market(),now:()=>t0+3*M});
 assert.equal(ok.state.status,'OPEN');assert.deepEqual(ok.state.legs.map((l:any)=>l.units),[150,150,150,150],'2 lots × lot size 75');
 assert.deepEqual([...new Set(ok.events.filter((e:any)=>e.kind==='ORDER').map((e:any)=>e.product))],['options']);
 const idle:any=await cycleRun(run(ic,r.state),{market:market(),now:()=>t0+3*M+MIN});assert.equal(idle.outcome,'IDLE');assert.equal(idle.state,undefined);
 const {state,events}=stopRunState(run(ic,ok.state),t0+4*M);assert.equal(state.status,'FLAT');assert.equal(state.entries.at(-1).reason,'RUN_STOPPED');assert.equal(events.at(-1).kind,'RUN_STOPPED');
});
test('v1 runs are upgraded and their history is written to the ledger',async()=>{
 const v1:any=fresh();v1.paper={version:'spec-paper-v1',createdAt:'2026-10-18T00:00:00Z',lastBarTime:null,lastCycleAt:null,cycles:3,missedBars:0,droppedEvents:2,lastOutcome:null};
 delete v1.orderSeq;delete v1.tradeSeq;delete v1.blocked;v1.options={capital:100000,costBps:5,costPerOrder:20,slippageBps:0,maxUnitsPerOrder:null};v1.events=[{time:1,kind:'FILL'}];
 const {state,backlog}=upgradeState(v1,t0);assert.equal(backlog,2);assert.equal(state.options.costModel,'flat');assert.equal(state.options.requireMargin,false);assert.equal(state.paper.cycles,3);
 const r:any=await cycleRun(run(equitySpec,v1),{market:market(),now:()=>t0+3*M});assert.deepEqual(kinds(r).slice(0,2),['FILL','RUN_UPGRADED']);assert.equal(r.state.paper.eventSeq,r.events.length);
});
test('scheduler cycle commits state with its events, respects market hours, conflicts, failures and the time budget',async()=>{
 const runs=[run(equitySpec,fresh()),{...run(equitySpec,fresh()),id:'r2'},{...run({bad:true},fresh()),id:'r3'}];
 const commits:any[]=[];const store={list:async()=>runs,commit:async(id:string,_v:number,_s:any,status:string,events:any[])=>{commits.push([id,status,events.map((e:any)=>e.kind)]);return id==='r2'?null:{id};}};
 assert.equal((await runSpecPaperCycle({store,market:market({open:false}),now:()=>t0})).status,'MARKET_CLOSED');
 const r:any=await runSpecPaperCycle({store,market:market(),now:()=>t0+3*M});
 assert.deepEqual(r.runs.map((x:any)=>x.outcome),['STEPPED','VERSION_CONFLICT','INVALID_SPEC']);assert.equal(r.status,'PARTIAL');
 assert.deepEqual(commits.find((c:any)=>c[0]==='r1')[2],['ENTRY_DECIDED','ORDER','ENTERED']);assert.deepEqual(commits.find((c:any)=>c[0]==='r3'),['r3','STOPPED',['RUN_STOPPED']]);
 let t=t0;const slow:any=await runSpecPaperCycle({store,market:market(),now:()=>(t+=30000),budgetMs:45000});assert(slow.runs.some((x:any)=>x.outcome==='DEFERRED'));
 const failing:any=await runSpecPaperCycle({store:{list:async()=>[runs[0]],commit:async()=>({})},market:{...market(),bars:async()=>{throw new Error('secret token');}},now:()=>t0});
 assert.equal(failing.runs[0].outcome,'CYCLE_FAILED');assert(!JSON.stringify(failing).includes('secret'));
 const s=fresh();s.events=Array.from({length:KEEP_EVENTS+20},(_,k)=>({time:k,kind:'X'}));
 const capped:any=await cycleRun(run(equitySpec,s),{market:market(),now:()=>t0+3*M});assert.equal(capped.state.events.length,KEEP_EVENTS);assert.equal(capped.events.length,3,'only new events are committed');
});
test('trade statistics, options validation, candles and market paths',async()=>{
 const st=tradeStats([{pnl:100,gross:110,charges:10},{pnl:-50,gross:-45,charges:5},{pnl:-30,gross:-25,charges:5},{pnl:80,gross:85,charges:5}]);
 assert.equal(st.winRate,0.5);assert.equal(st.expectancy,25);assert.equal(st.profitFactor,180/80);assert.equal(st.maxDrawdown,80);assert.equal(st.charges,25);
 assert.deepEqual(validatePaperOptions({capital:5000}),{capital:5000,costBps:0,costPerOrder:0,slippageBps:0,maxUnitsPerOrder:null,costModel:'broker-tariff',requireMargin:true,singleTrade:false});
 assert.throws(()=>validatePaperOptions({...opts,extra:1}));assert.throws(()=>validatePaperOptions({...opts,maxUnitsPerOrder:0}));assert.throws(()=>validatePaperOptions({...opts,costModel:'x'}));
 const c=parseCandles([['2026-10-19T09:20:00+05:30',1,2,1,1,5],['2026-10-19T09:15:00+05:30',1,2,1,1,5],['2026-10-19T09:15:00+05:30',1,2,1,1,5],['2026-10-19T09:25:00+05:30',1,0.5,1,1,5],['2026-10-19T09:30:00+05:30',1,2,1,1,5]],'5m',Date.parse('2026-10-19T09:33:00+05:30'));
 assert.deepEqual(c.map(b=>new Date(b.time).toISOString()),['2026-10-19T03:45:00.000Z','2026-10-19T03:50:00.000Z']);
 const paths:string[]=[];const mk=createSpecPaperMarket({read:async(p:string)=>{paths.push(p);return {candles:[['2026-10-19T09:20:00+05:30',1,2,1,1,5]]};},master:async()=>[{segment:'NSE_EQ',instrument_type:'EQ',trading_symbol:'INFY',instrument_key:'NSE_EQ|INE009A01021'},{segment:'NSE_FO',instrument_type:'FUT',underlying_key:'NSE_EQ|INE009A01021',expiry:t0+10*86400000,lot_size:400,instrument_key:'NSE_FO|F1',trading_symbol:'INFY FUT'}],chains:async()=>{throw new Error('x');},margin:async()=>({})});
 assert.equal(await mk.underlyingKey(equitySpec),'NSE_EQ|INE009A01021');await mk.bars(equitySpec,'NSE_EQ|INE009A01021',t0);
 assert(paths[0].startsWith('/v3/historical-candle/NSE_EQ%7CINE009A01021/minutes/5/'));assert.equal(paths[1],'/v3/historical-candle/intraday/NSE_EQ%7CINE009A01021/minutes/5');
 paths.length=0;const mb=await mk.minuteBars('NSE_FO|F1',Date.parse('2026-10-16T10:00:00+05:30'),Date.parse('2026-10-19T09:30:00+05:30'));
 assert.equal(paths[0],'/v3/historical-candle/intraday/NSE_FO%7CF1/minutes/1');assert.equal(paths[1],'/v3/historical-candle/NSE_FO%7CF1/minutes/1/2026-10-18/2026-10-16');assert.equal(mb.length,1);
 assert.deepEqual(await mk.resolveLeg(equitySpec,{instrument:{type:'future',expiry:'current-month'}},'NSE_EQ|INE009A01021',t0),{instrumentKey:'NSE_FO|F1',lotSize:400,description:'INFY FUT',expiry:'2026-10-29'});
 await assert.rejects(mk.resolveLeg(equitySpec,{instrument:{type:'future',expiry:'next-month'}},'NSE_EQ|INE009A01021',t0),/FUTURE_NOT_FOUND/);
});
test('the margin client posts only to the margin calculator and validates its reply',async()=>{
 const calls:any[]=[];const calc=createUpstoxMarginCalculator({token:()=>'tok',fetcher:(async(url:string,init:any)=>{calls.push([url,init.method,JSON.parse(init.body)]);return new Response(JSON.stringify({status:'success',data:{required_margin:1200,final_margin:1000,margins:[]}}));}) as any});
 assert.deepEqual(await calc([{instrumentKey:'K',quantity:10,side:'BUY',product:'I'}]),{status:'OK',required:1000,beforeBenefit:1200,perInstrument:[],source:'UPSTOX_MARGIN_CALCULATOR'});
 assert.deepEqual(calls[0],['https://api.upstox.com/v2/charges/margin','POST',{instruments:[{instrument_key:'K',quantity:10,transaction_type:'BUY',product:'I'}]}]);
 await assert.rejects(calc([{instrumentKey:'K',quantity:0,side:'BUY',product:'I'}]),/MARGIN_INVALID_ITEM/);
 const bad=createUpstoxMarginCalculator({token:()=>'tok',fetcher:(async()=>new Response('{"status":"success","data":{}}')) as any});await assert.rejects(bad([{instrumentKey:'K',quantity:1,side:'SELL',product:'D'}]),/UPSTOX_INVALID_RESPONSE/);
});
const response=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}});
test('API validates specs and options, creates idempotently, stops with a version check and guards the cycle',async()=>{
 const rows=new Map<string,any>();const store=()=>({list:async()=>[...rows.values()],get:async(id:string)=>rows.get(id)??null,
  create:async(id:string,spec:any,options:any,state:any)=>{if(!rows.has(id))rows.set(id,{id,status:'ACTIVE',version:0,spec,options,state,created_at:'c',updated_at:'u'});return rows.get(id);},
  commit:async(id:string,v:number,state:any,status:string,events:any[])=>{const r=rows.get(id);if(!r||r.version!==v)return null;Object.assign(r,{state,status,version:v+1});r.ledger=[...(r.ledger??[]),...events.map((e:any,k:number)=>({seq:(r.ledger?.length??0)+k+1,kind:e.kind,event:e}))];return r;},
  events:async(id:string,after:number,limit:number)=>(rows.get(id)?.ledger??[]).filter((e:any)=>e.seq>after).slice(0,limit)});
 const h=createSpecPaperHandler({store,now:()=>t0,automation:{read:async()=>null} as any}),post=(body:any)=>({method:'POST',headers:{host:'x'},body});
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const ok=response();await h(post({action:'create',id,spec:equitySpec,options:opts}),ok);assert.equal(ok.code,201);assert.equal(ok.body.run.position,'FLAT');
 const bad=response();await h(post({action:'create',id,spec:{...equitySpec,legs:[]},options:opts}),bad);assert.equal(bad.code,400);assert(bad.body.issues.length);
 const badOpt=response();await h(post({action:'create',id,spec:equitySpec,options:{...opts,costBps:500}}),badOpt);assert.equal(badOpt.code,400);
 assert.throws(()=>validatePaperOptions({...opts,extra:1}));assert.throws(()=>validatePaperOptions({...opts,maxUnitsPerOrder:0}));
 const stop=response();await h(post({action:'stop',id}),stop);assert.equal(stop.code,200);assert.equal(stop.body.run.status,'STOPPED');
 const list=response();await h({method:'GET',headers:{host:'x'}},list);assert.equal(list.body.runs.length,1);
 const led=response();await h({method:'GET',headers:{host:'x'},query:{ledger:id,after:'0',limit:'10'}},led);assert.equal(led.code,200);assert.deepEqual(led.body.events.map((e:any)=>e.kind),['RUN_STOPPED']);
 const badLed=response();await h({method:'GET',headers:{host:'x'},query:{ledger:'x'}},badLed);assert.equal(badLed.code,400);
 const noId=response();await h(post({action:'create'}),noId);assert.equal(noId.code,400);
 const cyc=createSpecPaperCycleHandler({store,market:market(),secret:()=>'s'.repeat(32),now:()=>t0});
 const unauth=response();await cyc({method:'POST',headers:{authorization:'Bearer x'},body:{}},unauth);assert.equal(unauth.code,401);
 const authed=response();await cyc({method:'POST',headers:{authorization:'Bearer '+'s'.repeat(32)},body:{}},authed);assert.equal(authed.code,200);
 assert.equal(typeof researchRoutes['spec-paper'],'function');assert.equal(typeof researchRoutes['spec-paper-cycle'],'function');
 const html=renderToStaticMarkup(createElement(RunDetail,{run:summarizeRun(rows.get(id))}));assert.match(html,/stopped/);assert.match(html,/Net P&amp;L/);assert.match(html,/Export CSV/);
});
test('broker tariff itemises charges per product and side',async()=>{
 const {orderCharges}=await import('../shared/brokerCharges.js');
 const d=orderCharges('equity-delivery','SELL',100000);assert.equal(d.items.brokerage,0);assert.equal(d.items.stt,100);assert.equal(d.items.dp,15.34);assert.equal(d.items.stamp,0);
 const i=orderCharges('equity-intraday','BUY',100000);assert.equal(i.items.brokerage,20);assert.equal(i.items.stt,0);assert(Math.abs(i.items.stamp-3)<1e-9);assert(Math.abs(i.items.gst-(20+3.07+0.1)*0.18)<1e-9);
 const o=orderCharges('options','SELL',10000);assert.equal(o.items.brokerage,20);assert(Math.abs(o.items.stt-15)<1e-9);
 assert.throws(()=>orderCharges('crypto','BUY',1));assert.throws(()=>orderCharges('futures','HOLD',1));
});
