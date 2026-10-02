import test from 'node:test';import assert from 'node:assert/strict';
import {advanceSegmentPaper} from '../server/segmentPaperEngine.js';
import {newPaperAccount} from '../server/paperEngine.js';
import {normalizeUpstoxQuotes,createUpstoxReader} from '../server/upstoxReadOnly.js';
import {trendDecision,selectContract,createSegmentObserver} from '../server/segmentObservation.js';
import {createScheduledPaperHandler} from '../server/scheduledPaper.js';
import {paperBalance} from '../server/paperFunds.js';
const now=Date.parse('2026-10-01T10:00:00+05:30');
const quote=(time=now,price=100)=>({symbol:'NSE_EQ|TEST',price,bid:price-.01,ask:price+.01,bidSize:10000,askSize:10000,spread:.0002,timestamp:new Date(time).toISOString(),source:'UPSTOX_FULL_QUOTE_V3'});
const candidate=(segment='short-term',time=now)=>({segment,instrumentKey:'NSE_EQ|TEST',symbol:'TEST',lotSize:1,side:'BUY',signalId:segment+':test',signalTime:new Date(time).toISOString()});
const input=(segment='short-term',time=now)=>({segment,now:time,marketOpen:true,acceptEntries:true,quotes:[quote(time)],candidates:[candidate(segment,time)]});
test('all four segment engines submit only; a later quote fills and exits post net balance once',()=>{
 for(const segment of ['short-term','long-term','options','futures']){
  const args:any=input(segment);if(['options','futures'].includes(segment))Object.assign(args.candidates[0],{lotSize:10,expiry:now+7*86400000,underlyingType:'INDEX'});
  const a=advanceSegmentPaper({...newPaperAccount(),capital:1000000},args);assert.equal(a.state.orders.length,1);assert.equal(a.state.orders[0].filled,0);
  const repeat=advanceSegmentPaper(a.state,args);assert.equal(repeat.state.orders[0].filled,0);assert.equal(repeat.state.orders.length,1);
  const b=advanceSegmentPaper(a.state,{...args,now:now+60000,quotes:[quote(now+60000)],candidates:[]});const o=b.state.orders[0];assert(o.filled>0);assert.equal(o.filled%o.lotSize,0);
  const target=o.target+1;
  const c=advanceSegmentPaper(b.state,{...args,now:now+120000,quotes:[quote(now+120000,target)],candidates:[]});assert.equal(c.state.orders[0].status,'EXIT_PENDING');assert.equal(c.state.realized,0);
  const d=advanceSegmentPaper(c.state,{...args,now:now+180000,quotes:[quote(now+180000,target)],candidates:[]});assert.equal(d.state.orders[0].status,'CLOSED');assert(d.state.realized>0);
  const e=advanceSegmentPaper(d.state,{...args,now:now+240000,quotes:[quote(now+240000,target)],candidates:[]});assert.equal(e.state.realized,d.state.realized);
 }
});
test('delivery carries overnight without forced intraday close; intraday contract exits remain separate',()=>{
 const a=advanceSegmentPaper({...newPaperAccount(),capital:100000},input());
 const b=advanceSegmentPaper(a.state,{...input('short-term',now+60000),candidates:[]});
 const c=advanceSegmentPaper(b.state,{...input('short-term',now+86400000),candidates:[]});assert.equal(c.state.orders[0].status,'OPEN');assert.equal(c.state.orders[0].monitoringGap,false);assert(c.state.orders[0].evaluationExcludedReason);
});
test('capital checks reject an unaffordable whole futures lot, expiry and short delivery',()=>{
 const args:any=input('futures');args.candidates[0]={...candidate('futures'),lotSize:1000,expiry:now+86400000,underlyingType:'INDEX'};
 let result=advanceSegmentPaper(newPaperAccount(),args);assert.equal(result.state.orders.length,0);assert.equal(result.events[0].reason,'INSUFFICIENT_CAPITAL_OR_WHOLE_LOT_RISK');
 args.candidates[0].expiry=now;result=advanceSegmentPaper(newPaperAccount(),args);assert.equal(result.events[0].reason,'CONTRACT_EXPIRY_OR_METADATA_UNVERIFIED');
 const delivery:any=input();delivery.candidates[0].side='SELL';assert.equal(advanceSegmentPaper(newPaperAccount(),delivery).events[0].reason,'INVALID_SEGMENT_SIGNAL');
});
test('stale/crossed/missing books and repeated timestamps never create entries',()=>{
 for(const q of [quote(now-121000),{...quote(),bid:102,ask:100},{...quote(),source:'UNVERIFIED'}, {...quote(),askSize:0}]){
  const r=advanceSegmentPaper(newPaperAccount(),{...input(),quotes:[q]});assert.equal(r.state.orders.length,0);
 }
});
test('partial fills stay in whole lots and retain capital reservation',()=>{
 const args:any=input('options');args.candidates[0]={...candidate('options'),lotSize:10,expiry:now+86400000,underlyingType:'INDEX'};
 const a=advanceSegmentPaper({...newPaperAccount(),capital:1000000},args);
 const b=advanceSegmentPaper(a.state,{...args,now:now+60000,quotes:[{...quote(now+60000),askSize:17}],candidates:[]});assert.equal(b.state.orders[0].filled,10);assert.equal(b.state.orders[0].status,'PARTIAL');assert(paperBalance(b.state,now+60000).reserved>1000);
});
test('Upstox response timestamp cannot disguise an old last trade or invalid book',()=>{
 const raw={a:{instrument_token:'key',last_price:100,last_trade_time:String(now),timestamp:new Date(now).toISOString(),depth:{buy:[{price:99,quantity:10}],sell:[{price:101,quantity:10}]}}};
 assert.equal(normalizeUpstoxQuotes(raw,['key'],now).length,1);raw.a.last_trade_time=String(now-121000);assert.equal(normalizeUpstoxQuotes(raw,['key'],now).length,0);
});
test('read-only adapter rejects order APIs and does not expose credentials in failures',async()=>{
 let calls=0;const read=createUpstoxReader({token:()=> 'secret-not-for-output',fetcher:async()=>{calls++;return new Response('private provider details',{status:401});}});
 await assert.rejects(read('/v2/order/place'),/UNSUPPORTED_READ_PATH/);assert.equal(calls,0);
 await assert.rejects(read('/v2/market/status/NSE'),/UPSTOX_AUTH_FAILED/);
 await assert.rejects(createUpstoxReader({token:()=>''})('/v2/market/status/NSE'),/UPSTOX_TOKEN_MISSING/);
});
test('completed-bar policy excludes future candles and differentiates long-term warmup',()=>{
 const rows=Array.from({length:60},(_,i)=>[new Date(now-(60-i)*86400000).toISOString(),100+i,101+i,99+i,100+i,1000]);
 rows.at(-1)![4]=162;rows.at(-1)![2]=163;
 const baseline=trendDecision(rows,'short-term',now);assert.equal(baseline.side,'BUY');assert.equal(trendDecision(rows,'long-term',now).reason,'INSUFFICIENT_COMPLETED_BARS');
 assert.deepEqual(trendDecision([...rows,[new Date(now+86400000).toISOString(),999,1000,998,999,1]],'short-term',now),baseline);
});
test('contract selection excludes expired and equity derivatives and picks nearest expiry ATM',()=>{
 const base={segment:'NSE_FO',underlying_type:'INDEX',underlying_key:'index',expiry:now+86400000,lot_size:50,instrument_type:'CE'};
 const rows=[{...base,instrument_key:'far',strike_price:200},{...base,instrument_key:'atm',strike_price:100},{...base,instrument_key:'expired',expiry:now,strike_price:100},{...base,instrument_key:'stock',underlying_type:'EQUITY',strike_price:100}];
 assert.equal(selectContract(rows,'options','index',{side:'BUY',price:100},now).instrument_key,'atm');
});
test('missing token produces scan failure rather than no eligible signal',async()=>{
 const observe=createSegmentObserver({read:createUpstoxReader({token:()=>''}),clock:()=>now});
 const result=await observe({id:'user1:options',state:{orders:[]}},now);assert.equal(result.discoveryError,'UPSTOX_TOKEN_MISSING');assert.equal(result.candidates.length,0);
});
test('all-mode scheduler isolates one account failure and still attempts the other four',async()=>{
 const calls:string[]=[];const run=async({segment='intraday'}:any)=>{calls.push(segment);if(segment==='options')throw Error('feed unavailable');return {status:'SAVED'};};
 const handler=createScheduledPaperHandler({secret:()=> 'x'.repeat(32),enabled:()=>true,multiEnabled:()=>true,now:()=>now,store:()=>({}),run,runSegment:run});
 const res:any={code:0,body:null,setHeader(){},status(n:number){this.code=n;return this;},json(v:any){this.body=v;return this;}};
 await handler({method:'POST',headers:{authorization:'Bearer '+'x'.repeat(32)},body:{}},res);assert.equal(res.code,503);assert.equal(calls.length,5);assert.equal(res.body.segments.options.status,'CYCLE_FAILED');assert.equal(res.body.segments['long-term'].status,'SAVED');
});
import {runSegmentPaperCycle} from '../server/segmentPaperCycle.js';
test('segment cycle records immutable first signal before order and isolates paused-account evidence',async()=>{
 let account:any={id:'user1:short-term',enabled:false,revision:0,state:{...newPaperAccount(),capital:100000}};
 const committed:any[]=[];const db={account:async()=>structuredClone(account),lease:async()=>true,release:async()=>{},commit:async(before:any,result:any)=>{assert.equal(before.revision,account.revision);account={...account,state:result.state,revision:account.revision+1};committed.push(...result.events);return 'saved';}};
 const observe=async()=>({marketOpen:true,quotes:[quote()],candidates:[candidate()],scanDiagnostics:{scored:1}});
 await runSegmentPaperCycle({db,segment:'short-term',now:()=>now,observe});assert.equal(account.state.orders.length,0);assert.equal(committed[0].kind,'SEGMENT_SIGNAL_RECORDED');
 account.enabled=true;
 await runSegmentPaperCycle({db,segment:'short-term',now:()=>now+30000,observe:async()=>({marketOpen:true,quotes:[quote(now+30000)],candidates:[candidate('short-term',now+30000)]})});
 assert.equal(account.state.orders[0].signalTime,new Date(now).toISOString());assert.equal(committed.filter(e=>e.kind==='SEGMENT_SIGNAL_RECORDED').length,1);assert(committed.find(e=>e.kind==='ORDER_SUBMITTED').id>committed[0].id);
});
test('future candles and conflicting duplicate completed bars cannot influence qualification',()=>{
 const rows=Array.from({length:60},(_,i)=>[new Date(now-(60-i)*86400000).toISOString(),100+i,101+i,99+i,100+i,1000]);
 const conflict=[...rows[0]];conflict[4]=100.5;assert.equal(trendDecision([...rows,conflict],'short-term',now).reason,'CONFLICTING_DUPLICATE_BARS');
});
import {createUpstoxProbe} from '../server/upstoxReadOnly.js';
test('connection probe verifies read access only, caches results, and sanitizes auth failure',async()=>{
 let calls=0;const probe=createUpstoxProbe({clock:()=>now,read:async(path:string)=>{calls++;return path.includes('market/status')?{status:'CLOSED'}:{index:{instrument_token:'NSE_INDEX|Nifty 50',last_price:22000,last_trade_time:String(now-86400000)}};}});
 const result=await probe();assert.equal(result.status,'CONNECTED');assert.equal(result.marketStatus,'CLOSED');assert.match(result.note,/does not verify/);await probe();assert.equal(calls,2);
 const failure=await createUpstoxProbe({read:async()=>{throw Error('private credential');},clock:()=>now})();assert.equal(failure.reason,'UPSTOX_CONNECTION_FAILED');assert(!JSON.stringify(failure).includes('private credential'));
});
