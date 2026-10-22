import test from 'node:test';import assert from 'node:assert/strict';
import {AGGRESSIVE_POLICY,aggressiveCandidates,newBook,stepBook,bookSummary,runAggressiveCycle,overnightScan} from '../server/aggressiveBook.js';
import {buildToday,netDeals} from '../server/todayBoard.js';
import {runAutomationTick,mergeStatus} from '../server/automation.js';

const at=(hhmm:string,date='2026-10-21')=>Date.parse(`${date}T${hhmm}:00+05:30`);
const stock=(o:any={})=>({symbol:'ABC',overallScore:64,signal:'BUY',ltp:200,avgVolume:500000,changePct:3,quoteTime:new Date(at('10:00')-30000).toISOString(),...o});
const q=(price:number,spread=0.1)=>({price,bid:price-spread/2,ask:price+spread/2});
const keyOf=(s:string)=>'NSE_EQ|'+s;

test('Discover candidates need score 60, a matching signal, ₹10, ₹2 crore turnover and no circuit-sized move',()=>{
 const now=at('10:00');
 const {candidates,rejected}=aggressiveCandidates({now,discoveries:[stock(),stock({symbol:'PCJ',overallScore:52,ltp:18}),stock({symbol:'LOW',ltp:8}),stock({symbol:'THIN',avgVolume:1000}),stock({symbol:'RUN',changePct:14}),stock({symbol:'MIX',signal:'HOLD'}),stock({symbol:'SHORT',overallScore:-66,signal:'STRONG_SELL'}),stock({symbol:'OLD',quoteTime:new Date(now-300000).toISOString()})]});
 assert.deepEqual(candidates.map(c=>[c.symbol,c.side]),[['ABC','BUY'],['SHORT','SELL']]);
 assert.deepEqual(Object.fromEntries(rejected.map(r=>[r.symbol,r.reason])),{PCJ:'Score 52 below 60',LOW:'Price below ₹10',THIN:'Average daily turnover below ₹2 crore',RUN:'Already moved 14% today (circuit risk)',MIX:'Signal does not match the score direction',OLD:'Quote older than 2 minutes'});
 const gaps=aggressiveCandidates({now,board:{rows:[{state:'NEAR_TRIGGER',strategyId:'short-term-donchian',strategyName:'20-day breakout',symbol:'INFY',trigger:{level:1200,condition:'next close above the 20-day high'}},{state:'NEAR_TRIGGER',strategyId:'long-term-golden-trend',symbol:'TCS',trigger:{level:1}},{state:'NEAR_TRIGGER',strategyId:'futures-breakout-long',symbol:'NIFTY',trigger:{level:1}}]}});
 assert.deepEqual(gaps.candidates.map(c=>[c.setup,c.symbol,c.product]),[['breakout-early','INFY','equity-delivery']]);
 assert.equal(aggressiveCandidates({now:at('09:17'),discoveries:[stock({quoteTime:new Date(at('09:17')).toISOString()})]}).candidates[0].blocked,'Intraday entries open at 09:20');
});

test('the book enters at the live ask with slippage, sizes ₹25,000, and exits at stop, target and 15:15 square-off',()=>{
 const c=(symbol:string,side='BUY')=>({setup:'discover-momentum',symbol,side,product:'equity-intraday',why:'x',score:65});
 let {state,events}=stepBook(newBook(at('10:00')),{now:at('10:00'),candidates:[c('A'),c('B','SELL')],quotes:new Map([['NSE_EQ|A',q(200)],['NSE_EQ|B',q(100)]]),keyOf,marketOpen:true});
 const a=state.positions.find((p:any)=>p.symbol==='A')!,b=state.positions.find((p:any)=>p.symbol==='B')!;
 assert.equal(a.entryPrice,200.15);assert.equal(a.qty,124);assert.equal(a.stop,197.15);assert.equal(a.target,206.15);assert(a.entryCharges>0);
 assert.equal(b.side,'SELL');assert.equal(b.entryPrice,99.9);assert.equal(b.stop,101.4);assert.equal(b.target,96.9);
 assert.deepEqual(events.map((e:any)=>e.kind),['ENTRY','ENTRY']);
 ({state}=stepBook(state,{now:at('10:05'),quotes:new Map([['NSE_EQ|A',q(207)],['NSE_EQ|B',q(102)]]),keyOf,marketOpen:true}));
 assert.deepEqual(state.closed.map((x:any)=>[x.symbol,x.exitReason]).sort(),[['A','TARGET'],['B','STOP']]);
 const A=state.closed.find((x:any)=>x.symbol==='A');assert(A.net<A.gross&&A.net>0,'charges reduce a winning trade');
 assert.equal(state.bySetup['discover-momentum'].trades,2);
 // The same stock is not re-entered the same day; another is, and is squared off at 15:15.
 ({state}=stepBook(state,{now:at('11:00'),candidates:[c('A'),c('C')],quotes:new Map([['NSE_EQ|A',q(207)],['NSE_EQ|C',q(50)]]),keyOf,marketOpen:true}));
 assert.deepEqual(state.positions.map((p:any)=>p.symbol),['C']);assert.equal(state.lastCycle.decisions.find((d:any)=>d.symbol==='A').reason,'Already traded with this setup today or holding the stock');
 ({state}=stepBook(state,{now:at('15:15'),quotes:new Map([['NSE_EQ|C',q(50.2)]]),keyOf,marketOpen:true}));
 assert.equal(state.closed[0].exitReason,'SQUARE_OFF_1515');assert.equal(state.positions.length,0);
});

test('limits: five open positions, the entry window, the daily loss stop and early-breakout triggers',()=>{
 const syms=['A','B','C','D','E','F'],quotes=new Map(syms.map(s=>['NSE_EQ|'+s,q(100)]));
 const c=(symbol:string)=>({setup:'discover-momentum',symbol,side:'BUY',product:'equity-intraday',why:'x',score:70});
 let {state}=stepBook(newBook(0),{now:at('10:00'),candidates:syms.map(c),quotes,keyOf,marketOpen:true});
 assert.equal(state.positions.length,AGGRESSIVE_POLICY.maxOpen);assert.equal(state.lastCycle.decisions.at(-1).reason,'Book full (5 open positions)');
 // A ₹10,000 open loss stops new entries for the day but keeps managing positions (stops at 1.5% are not hit here).
 const deep=newBook(0);deep.positions=[{id:'x',setup:'discover-momentum',symbol:'X',key:'NSE_EQ|X',side:'BUY',product:'equity-intraday',qty:1000,entryPrice:100,stop:50,target:200,entryCharges:0,mark:100,why:''}];
 ({state}=stepBook(deep,{now:at('10:00'),candidates:[c('A')],quotes:new Map([['NSE_EQ|X',q(89.9)],['NSE_EQ|A',q(100)]]),keyOf,marketOpen:true}));
 assert.equal(state.days['2026-10-21'].stopped,true);assert.equal(state.lastCycle.decisions[0].reason,'Daily loss stop reached');
 assert.equal(stepBook(newBook(0),{now:at('14:45'),candidates:[c('A')],quotes,keyOf,marketOpen:true}).state.lastCycle.decisions[0].reason,'Outside this setup’s entry window');
 const br={setup:'breakout-early',symbol:'INFY',side:'BUY',product:'equity-delivery',trigger:1200,why:'x',score:null};
 assert.match(stepBook(newBook(0),{now:at('10:00'),candidates:[br],quotes:new Map([['NSE_EQ|INFY',q(1190)]]),keyOf,marketOpen:true}).state.lastCycle.decisions[0].reason,/below trigger/);
 const held=stepBook(newBook(0),{now:at('10:00'),candidates:[br],quotes:new Map([['NSE_EQ|INFY',q(1201)]]),keyOf,marketOpen:true}).state;
 // Delivery positions are held up to 10 trading sessions (weekends skipped).
 assert.equal(held.positions[0].exitBy,'2026-11-04');assert.equal(held.positions[0].stop,1141.57,'5% below the ₹1,201.65 fill');
 assert.equal(stepBook(held,{now:at('15:20'),quotes:new Map([['NSE_EQ|INFY',q(1205)]]),keyOf,marketOpen:true}).state.positions.length,1,'delivery is not squared off');
 const s=bookSummary(held,at('10:00'));assert.equal(s.open[0].openPnl!<0,true,'entry charges make a fresh position negative');assert.equal(s.policy.capitalPerTrade,25000);
});

test('the cycle saves with compare-and-set and skips quotes when nothing is open or wanted',async()=>{
 let saved:any=null;const store={read:async()=>({data:newBook(0),updated_at:'t1'}),save:async(d:any,e:string)=>{saved={d,e};return 'saved';},create:async()=>'saved'};
 const market={quotes:async()=>{throw new Error('no quotes expected');}};
 const r=await runAggressiveCycle({store,market,master:async()=>[],observation:{marketOpen:true,discoveries:[stock({overallScore:40})]},now:()=>at('10:00')});
 assert.equal(r.status,'SAVED');assert.equal(saved.e,'t1');assert.equal(saved.d.lastCycle.scanObserved,true);
 const conflict=await runAggressiveCycle({store:{...store,save:async()=>'conflict'},market,master:async()=>[],now:()=>at('10:00')});assert.equal(conflict.status,'CONFLICT');
 assert.equal((await runAggressiveCycle({store,market,master:async()=>[],now:()=>at('18:00')})).status,'MARKET_CLOSED');
});

test('the tick runs the aggressive book after the alert scan and records it',async()=>{
 const order:string[]=[];const job=(n:string)=>async()=>{order.push(n);return {status:'COMPLETED'};};
 const t:any=await runAutomationTick({now:()=>at('10:02'),paper:async()=>({status:'MARKET_CLOSED'}),alerts:async()=>{await new Promise(r=>setTimeout(r,5));order.push('alerts');return {status:'SAVED'};},aggressive:async()=>{order.push('aggressive');return {status:'SAVED',open:1,candidates:3,entries:1,exits:0};},validate:job('v'),scan:job('s'),marketDay:job('m'),fundamentals:job('f'),status:async()=>{}});
 assert.deepEqual(order.slice(0,2),['alerts','aggressive']);assert.equal(mergeStatus(null,t).jobs.aggressive.candidates,3);
});

test('Today ranks validated signals, aggressive positions, watch items, then passed ideas, with reasons',()=>{
 const now=at('10:30');let {state}=stepBook(newBook(0),{now:at('10:00'),candidates:[{setup:'discover-momentum',symbol:'ABC',side:'BUY',product:'equity-intraday',why:'Discover 65',score:65}],quotes:new Map([['NSE_EQ|ABC',q(200)]]),keyOf,marketOpen:true});
 state.lastCycle.rejected=[{setup:'discover-momentum',symbol:'PCJ',reason:'Score 52 below 60'}];
 const sig={id:'short-term-donchian:INFY:1',strategyId:'short-term-donchian',strategyName:'20-day breakout',segment:'short-term',symbol:'INFY',direction:'LONG',timeframe:'1d',barTime:at('00:00','2026-10-20'),decidedAt:at('00:00','2026-10-21'),close:1200,rule:'r'};
 const out=buildToday({now,signals:[{signal:sig}],book:state,board:{rows:[{state:'NEAR_TRIGGER',strategyId:'long-term-52w-high',strategyName:'52w',segment:'long-term',symbol:'TCS',close:2400,trigger:{level:2450,distancePct:2.1,condition:'c'}},{state:'NEAR_TRIGGER',strategyId:'short-term-donchian',strategyName:'20d',segment:'short-term',symbol:'TCS',close:2400,trigger:{level:2440,distancePct:1.7,condition:'c'}},{state:'IN_POSITION',symbol:'BSE'}]},
  discoveries:[{symbol:'PCJ',side:'BUY',max_score:52,first_seen_at:'2026-10-21T04:08:00Z',first_price:18.29,details:{reasons:[]}}],verdicts:[{strategy_id:'short-term-donchian',symbol:'INFY',verdict:'VALIDATED'}],deals:[{trade_date:'2026-10-20',kind:'BULK',symbol:'X',client:'Fund',side:'BUY',quantity:1000,price:500}]});
 assert.deepEqual(out.items.map(i=>[i.kind,i.symbol]),[['VALIDATED','INFY'],['AGGRESSIVE_OPEN','ABC'],['NEAR_TRIGGER','TCS'],['DISCOVER','PCJ']]);
 assert.equal(out.items[3].status,'Score 52 below 60');assert.equal(out.items[2].title,'52w · 20d','one row per stock names every rule near its trigger');assert.equal(out.items[2].distancePct,1.7);assert.equal(out.held.length,1);assert.equal(out.deals.rows[0].value,500000);
 assert.equal(out.coverage.find(c=>c.id==='short-term')!.validated,1);
});

test('smart-money deals are netted per client and same-day round trips are left out',()=>{
 const d=(client:string,side:string,quantity:number,price=100,symbol='X')=>({trade_date:'2026-10-19',kind:'BULK',symbol,client,side,quantity,price});
 const r=netDeals([d('Jump','BUY',1000),d('Jump','SELL',990),d('Fund','BUY',500),d('Fund','SELL',100),d('Seller','SELL',300,90,'Y')]);
 assert.deepEqual(r.rows.map(x=>[x.client,x.side,x.quantity,x.value]),[['Fund','BUY',400,40000],['Seller','SELL',300,27000]]);assert.equal(r.roundTrips,1);
});

const lv=(o:any={})=>({key:'NSE_EQ|S',prevClose:100,avgVolume20:1e6,high20:104,...o});
const fq=(price:number,o:any={})=>({price,bid:price-0.05,ask:price+0.05,open:100,dayHigh:price,dayLow:99,volume:2.5e6,...o});
test('overnight scan: up 3% on 2x volume, or a top-of-range close at a new 20-day high on 2x volume with NIFTY up',()=>{
 const levels={niftyPrevClose:20000,rows:{A:lv({key:'a'}),B:lv({key:'b'}),C:lv({key:'c'}),D:lv({key:'d'})}};
 const quotes=new Map<string,any>([['a',fq(103.5)],['b',fq(105,{dayHigh:105.2})],['c',fq(103.5,{volume:1.2e6})],['d',fq(101)]]);
 const up=overnightScan({levels,quotes,niftyPrice:20100,now:at('15:10')});
 assert.deepEqual(up.rows.filter(r=>r.qualifies).map(r=>[r.symbol,r.rule]).sort(),[['A','up 3%+ on 2× volume'],['B','up 3%+ on 2× volume']]);
 const c=up.rows.find(r=>r.symbol==='C')!;assert.deepEqual(c.needs,['volume 2× (now 1.2×)']);
 // B on a smaller move qualifies only by the range rule, which needs NIFTY up.
 const q2=new Map<string,any>([['b',fq(102.9,{dayHigh:103,volume:2.2e6})]]);const l2={niftyPrevClose:20000,rows:{B:lv({key:'b',high20:102})}};
 assert.equal(overnightScan({levels:l2,quotes:q2,niftyPrice:20100,now:at('15:10')}).rows[0].qualifies,true);
 assert.equal(overnightScan({levels:l2,quotes:q2,niftyPrice:19900,now:at('15:10')}).rows[0].qualifies,false);
});
test('overnight gap: one futures lot bought 15:15-15:25, held overnight without square-off, sold at the next open',()=>{
 const overnight={rows:[{symbol:'A',qualifies:true,rule:'up 3%+ on 2× volume',retPct:3.5,volumeRatio:2.5}]};
 const {candidates}=aggressiveCandidates({now:at('15:16'),overnight});assert.equal(candidates[0].product,'futures');
 const contractOf=()=>({key:'NSE_FO|A',lotSize:500,description:'A NOV FUT'});
 assert.equal(stepBook(newBook(0),{now:at('15:00'),candidates,quotes:new Map([['NSE_FO|A',q(1000)]]),keyOf,contractOf,marketOpen:true}).state.lastCycle.decisions[0].reason,'Entry window 15:15–15:25');
 let {state}=stepBook(newBook(0),{now:at('15:16'),candidates,quotes:new Map([['NSE_FO|A',q(1000)]]),keyOf,contractOf,marketOpen:true});
 const p=state.positions[0];assert.equal(p.qty,500);assert.equal(p.target,null);assert.equal(p.stop,950.52,'5% below the ₹1,000.55 fill');assert.equal(p.exitOn,'2026-10-22');
 ({state}=stepBook(state,{now:at('15:20'),quotes:new Map([['NSE_FO|A',q(1001)]]),keyOf,marketOpen:true}));assert.equal(state.positions.length,1,'not squared off at 15:15');
 assert.equal(stepBook(newBook(0),{now:at('15:16'),candidates,quotes:new Map([['NSE_FO|A',q(4000)]]),keyOf,contractOf,marketOpen:true}).state.lastCycle.decisions[0].reason,'One lot is ₹20 lakh, above the ₹15 lakh cap');
 ({state}=stepBook(state,{now:at('09:16','2026-10-22'),quotes:new Map([['NSE_FO|A',q(1006)]]),keyOf,marketOpen:true}));
 const c=state.closed[0];assert.equal(c.exitReason,'NEXT_OPEN');assert.equal(c.exitPrice,1005.45,'bid ₹1,005.95 less 5 bps');assert(c.net>0&&c.net<c.gross,'futures charges reduce the gap gain');
});
test('the cycle loads daily levels once and scans the NIFTY 50 from 10:00',async()=>{
 let saved:any=null,histories=0;const store={read:async()=>({data:newBook(0),updated_at:'t'}),save:async(d:any)=>{saved=d;return 'saved';},create:async()=>'saved'};
 const bars=Array.from({length:25},(_,i)=>({time:i,open:100,high:101,low:99,close:100,volume:1e6}));
 const market={history:async()=>{histories++;return bars;},quotes:async(keys:string[])=>new Map(keys.map(k=>[k,fq(104)])),indexPrice:async()=>20100,nextFuture:async()=>({instrumentKey:'F',lotSize:100,description:'F'})};
 const master=async()=>[{segment:'NSE_EQ',instrument_type:'EQ',trading_symbol:'INFY',instrument_key:'NSE_EQ|INFY'},{segment:'NSE_EQ',instrument_type:'EQ',trading_symbol:'TCS',instrument_key:'NSE_EQ|TCS'}];
 const r=await runAggressiveCycle({store,market,master,observation:{marketOpen:true,discoveries:[]},now:()=>at('10:30')});
 assert.equal(saved.levels.rows.INFY.prevClose,100);assert.equal(saved.overnight.qualifying,2);assert.equal(r.overnightQualifying,2);assert.equal(histories,3,'NIFTY plus the two listed stocks');
 assert.equal(saved.days['2026-10-21'].rejections['Entry window N:N–N:N'],2,'reasons are counted per session');
});
