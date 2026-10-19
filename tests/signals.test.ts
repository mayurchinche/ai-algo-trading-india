import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {STRATEGIES,buildStrategySpec,strategyById} from '../shared/strategyLibrary.js';
import {segmentOfSpec} from '../shared/tradingHorizon.js';
import {backtestSymbol,poolResults,symbolVerdict,returnStats,validationRecord,CRITERIA} from '../shared/strategyValidation.js';
import {entryDecidedOnLastBar,scanSignals,runValidation,staleStrategy,paperRunFor,runIdFor,summarizeSignals,captureMarketDay} from '../server/signalEngine.js';
import {parseDeals,parseFlows,parseDelivery,csvRows,nseDate,createDeliveryReader} from '../server/marketIntel.js';
import {technicalProfile,optionChainSummary,buildSwot,dealsSummary} from '../shared/stockAnalysis.js';
import {analyzeStock,strategyStates} from '../server/stockAnalysis.js';
import {createSignalsHandler} from '../api/_signals.js';
import {createStockAnalysisHandler} from '../api/_stock-analysis.js';
import {cycleRun} from '../server/specPaperRunner.js';
import {researchRoutes} from '../api/research.js';
import {SignalsPage} from '../src/components/SignalsPage';

const DAY=86400000,d0=Date.parse('2016-01-04T00:00:00+05:30');
// Trading days only (Monday to Friday), as exchange data has no weekend bars.
const bday=(i:number)=>d0+(Math.floor(i/5)*7+i%5)*DAY;const nextBday=(t:number)=>{let n=t+DAY;while([0,6].includes(new Date(n+19800000).getUTCDay()))n+=DAY;return n;};
// Deterministic daily series: a rising trend with regular pullbacks and breakouts.
const series=(n:number,{drift=0.001,amp=0.03,seed=1}={})=>{let p=100,s=seed;const r=()=>{s=(s*16807)%2147483647;return s/2147483647-0.5;};
 return Array.from({length:n},(_,i)=>{const o=p;p=p*(1+drift+amp*Math.sin(i/9)/9+r()*0.01);const hi=Math.max(o,p)*1.004,lo=Math.min(o,p)*0.996;return {time:bday(i),open:o,high:hi,low:lo,close:p,volume:1e6};});};

// 80 quiet sessions, then a steady rise that breaks the 20-day high above a rising 50-day average.
const breakout=()=>{const b=series(80,{drift:0,amp:0.002});let p=b.at(-1).close;for(let i=0;i<40;i++){p*=1.01;b.push({time:nextBday(b.at(-1).time),open:p/1.01,high:p*1.002,low:p/1.012,close:p,volume:1});}return b;};
test('every library strategy builds a valid spec in its declared segment',()=>{
 for(const s of STRATEGIES){const spec=buildStrategySpec(s,{symbol:s.universe==='fno'?'NIFTY':'INFY',units:10,lots:1});assert.equal(segmentOfSpec(spec),s.segment,s.id);assert(s.rule&&s.reference,s.id);}
 assert.equal(segmentOfSpec(buildStrategySpec(strategyById('futures-supertrend-long'),{symbol:'INFY'})),'futures');
 assert.equal(buildStrategySpec(strategyById('futures-supertrend-long'),{symbol:'INFY'}).underlying.kind,'equity');
});
test('validation pools trades, requires both halves and separates missing evidence from losses',()=>{
 const s=strategyById('short-term-donchian'),bars=series(2500);
 const r=backtestSymbol(buildStrategySpec(s,{symbol:'INFY'}),bars);assert.equal(r.status,'OK');assert(r.trades.length>5);assert(r.trades.every((t:any)=>t.half===1||t.half===2));
 assert(r.trades.every((t:any)=>Number.isFinite(t.retPct)&&Math.sign(t.retPct)===Math.sign(t.net)),"returns are net of charges, in percent of entry notional");
 const pool=poolResults(Array.from({length:30},()=>r));assert.equal(pool.stats.trades,r.trades.length*30);
 const loser={status:'OK',trades:Array.from({length:200},(_,i)=>({retPct:i%2?-1:0.5,half:i<100?1:2}))};
 const lp=poolResults([loser]);assert.equal(lp.passed,false);assert.equal(lp.insufficient,false);assert.equal(symbolVerdict(loser as any,lp).verdict,'REJECTED');
 const few={status:'OK',trades:[{retPct:5,half:1},{retPct:3,half:2}],stats:returnStats([5,3])};const fp=poolResults([few]);assert.equal(fp.insufficient,true);assert.equal(symbolVerdict(few as any,fp).verdict,'UNPROVEN');
 const good={status:'OK',trades:Array.from({length:120},(_,i)=>({retPct:i%3?1.5:-1,half:i<60?1:2})),stats:returnStats(Array.from({length:120},(_,i)=>i%3?1.5:-1))};
 const gp=poolResults([good]);assert.equal(gp.passed,true);assert.equal(symbolVerdict(good as any,gp).verdict,'VALIDATED');
 const thin={status:'OK',trades:[],stats:returnStats([1,2])};assert.equal(symbolVerdict(thin as any,gp).verdict,'UNPROVEN');
 const rec=validationRecord(s,'INFY',good,gp,{computedAt:'2026-10-19T00:00:00.000Z',dataSource:'X'});assert.equal(rec.verdict,'VALIDATED');assert(!('trades' in rec.onSymbol));assert.equal(rec.criteria,CRITERIA);
 const st=returnStats([2,-1,3,-1]);assert.equal(st.winRate,0.5);assert.equal(st.profitFactor,2.5);assert.equal(st.expectancyPct,0.75);
});
test('a signal is the engine’s entry decision on the last completed bar, and nothing while in a position',()=>{
 const spec=buildStrategySpec(strategyById('short-term-donchian'),{symbol:'INFY'});
 const up=breakout();
 let found=-1;for(let k=60;k<=up.length;k++){if(entryDecidedOnLastBar(spec,up.slice(0,k))){found=k;break;}}
 assert(found>0,'a breakout above the 20-day high produces a signal');
 const d=entryDecidedOnLastBar(spec,up.slice(0,found))!;assert.equal(d.barTime,up[found-1].time);assert.equal(d.decidedAt,up[found-1].time+DAY,'a daily decision is made at the end of the bar day');
 assert.equal(entryDecidedOnLastBar(spec,up.slice(0,found+5)),null,'no repeat signal while the simulation holds the position');
});
const valRow=(id:string,symbol:string,verdict='VALIDATED')=>({strategy_id:id,symbol,verdict,computed_at:new Date().toISOString(),record:{strategyId:id,segment:strategyById(id).segment,symbol,verdict,computedAt:'c',validatedWith:null,onSymbol:{stats:returnStats([1,2]),buyHoldPct:50,period:{from:0,to:1,bars:2},timeInMarket:0.5},pooled:{symbols:50,stats:returnStats([1,2,-1]),halves:{first:returnStats([1]),second:returnStats([2])},passed:true,insufficient:false,reasons:[]}}});
test('scan records validated signals once and auto-starts single-trade paper runs',async()=>{
 const spec=buildStrategySpec(strategyById('short-term-donchian'),{symbol:'INFY'});
 const all=breakout(),bars:any[]=[];for(const b of all){bars.push(b);if(bars.length>60&&entryDecidedOnLastBar(spec,bars))break;}
 const now=bars.at(-1).time+16*3600000;// 16:00 IST on the signal day
 const recorded:any[]=[],created:any[]=[];
 const store={validations:async()=>[valRow('short-term-donchian','INFY'),valRow('swing-rsi2','TCS','REJECTED')],recordSignals:async(rows:any[])=>{recorded.push(...rows);return rows.length;}};
 const paperStore={create:async(id:string,spec:any,options:any,state:any)=>{created.push({id,spec,options,state});return {id};}};
 const market={history:async(key:string)=>{assert.equal(key,'NSE_EQ|INE009A01021');return bars;}};
 const r:any=await scanSignals({market,store,paperStore,now:()=>now});
 assert.equal(r.scanned,1);assert.equal(r.signals.length,1);const sig=r.signals[0];
 assert.equal(sig.id,`short-term-donchian:INFY:${bars.at(-1).time}`);assert.equal(sig.segment,'short-term');assert.equal(sig.direction,'LONG');assert.equal(sig.validation.verdict,'VALIDATED');
 assert(sig.validUntil>sig.decidedAt);assert.equal(recorded.length,1);
 assert.equal(created.length,1);assert.equal(created[0].id,runIdFor(sig.id));assert.equal(created[0].options.singleTrade,true);assert.equal(created[0].options.signalId,sig.id);assert.equal(created[0].options.costModel,'broker-tariff');
 assert.equal(created[0].spec.legs[0].quantity.units,Math.floor(100000*0.95/sig.close));
 const intradayOnly:any=await scanSignals({market,store,paperStore,now:()=>now,timeframes:['15m']});assert.equal(intradayOnly.scanned,0,'an intraday scan skips daily strategies');
 assert.match(runIdFor('x:Y:1234567890'),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 const sum=summarizeSignals([{id:sig.id,recorded_at:'r',signal:sig}],[valRow('short-term-donchian','INFY')],sig.validUntil+1);
 assert.equal(sum.signals[0].status,'EXPIRED');assert.equal(sum.strategies.find((s:any)=>s.id==='short-term-donchian').status,'PASSED');assert.equal(sum.strategies.find((s:any)=>s.id==='swing-rsi2').status,'NOT_VALIDATED_YET');
 const html=renderToStaticMarkup(createElement(SignalsPage));assert.match(html,/Signals/);
});
test('single-trade paper runs stop after their trade, a rejected entry or an expired signal',async()=>{
 const sig={id:'long-term-golden-trend:INFY:1760000000000',strategyId:'long-term-golden-trend',symbol:'INFY',close:1500};
 const r=paperRunFor(sig,100000);assert.equal(r.options.singleTrade,true);
 const {newPaperState}=await import('../server/specPaperRunner.js');
 const t0=Date.parse('2026-10-19T09:16:00+05:30'),flat=series(300,{drift:-0.001,amp:0.001}).map((b,i)=>({...b,time:Date.parse('2025-08-01T00:00:00+05:30')+i*DAY}));
 const market={underlyingKey:async()=>'NSE_EQ|INE009A01021',bars:async()=>flat,quotes:async()=>new Map(),minuteBars:async()=>[],margin:async()=>({status:'OK',required:1}),resolveLeg:async()=>({instrumentKey:'K',lotSize:1}),marketOpen:async()=>true};
 const out:any=await cycleRun({id:r.id,status:'ACTIVE',version:0,spec:r.spec,options:r.options,state:newPaperState(r.spec,r.options,t0)},{market,now:()=>t0});
 assert.equal(out.outcome,'SIGNAL_EXPIRED');assert.equal(out.final,true);assert.equal(out.events.at(-1).kind,'RUN_STOPPED');
});
test('validation job refreshes the stalest strategy and market-day capture parses NSE files',async()=>{
 const now=Date.parse('2026-10-19T12:00:00Z');
 assert.equal(staleStrategy([],now).id,STRATEGIES[0].id);
 const row=(id:string,t:number,symbols=52)=>({strategy_id:id,computed_at:new Date(t).toISOString(),record:{pooled:{symbols}}});
 const fresh=STRATEGIES.map(s=>row(s.id,now-DAY));fresh[3]=row(STRATEGIES[3].id,now-10*DAY);
 assert.equal(staleStrategy(fresh,now).id,STRATEGIES[3].id);assert.equal(staleStrategy(fresh.map(f=>({...f,computed_at:new Date(now).toISOString()})),now),null);
 const thin=fresh.map(f=>({...f,computed_at:new Date(now).toISOString()}));thin[5]=row(STRATEGIES[5].id,now,3);
 assert.equal(staleStrategy(thin,now).id,STRATEGIES[5].id,'a validation computed on too little data is redone');
 const saved:any[]=[];const store={validations:async()=>fresh,saveValidations:async(rows:any[])=>{saved.push(...rows);return rows.length;}};
 const bars=series(900);const v:any=await runValidation({market:{history:async()=>bars},store,now:()=>now});
 assert.equal(v.strategy,STRATEGIES[3].id);assert.equal(v.status,'COMPLETED');assert.equal(saved.length,50);assert(saved.every(r=>['VALIDATED','UNPROVEN','REJECTED'].includes(r.verdict)));
 // Rate limits are retried; a lasting outage saves nothing instead of rejecting the strategy.
 const limited=()=>Object.assign(new Error('UPSTOX_RATE_LIMITED'),{code:'UPSTOX_RATE_LIMITED'});
 let calls=0;const flaky={history:async()=>{if(++calls%2)throw limited();return bars;}};saved.length=0;
 const retried:any=await runValidation({market:flaky,store,now:()=>now,wait:async()=>{}});assert.equal(retried.status,'COMPLETED');assert.equal(saved.length,50);
 saved.length=0;const down:any=await runValidation({market:{history:async()=>{throw limited();}},store,now:()=>now,wait:async()=>{}});
 assert.equal(down.status,'DATA_UNAVAILABLE');assert.equal(saved.length,0,'an outage is not recorded as a rejection');assert.equal(down.results[0].reason,'UPSTOX_RATE_LIMITED');
 // Stale strategies on the same bar size are validated together from one read of each symbol.
 let reads=0;saved.length=0;const all:any=await runValidation({market:{history:async()=>{reads++;return bars;}},store:{validations:async()=>[],saveValidations:async(r:any[])=>{saved.push(...r);return r.length;}},now:()=>now});
 assert.equal(all.timeframe,'15m');assert.equal(all.strategies,2);assert.equal(reads,50);
 assert.equal(nseDate('16-OCT-2026'),'2026-10-16');assert.equal(nseDate('bad'),null);
 assert.deepEqual(csvRows('a,"b,c",d\n'),[['a','b,c','d']]);
 const deals=parseDeals('Date,Symbol,Security Name,Client Name,Buy/Sell,Quantity Traded,Trade Price / Wght. Avg. Price,Remarks\n16-OCT-2026,INFY,Infosys,"ABC FUND, LLP",BUY,70889,1524.91,-\n16-OCT-2026,INFY,Infosys,X,HOLD,1,1,-\nNO RECORDS,,,,,,\n','BULK');
 assert.deepEqual(deals,[{date:'2026-10-16',kind:'BULK',symbol:'INFY',client:'ABC FUND, LLP',side:'BUY',quantity:70889,price:1524.91}]);
 assert.throws(()=>parseDeals('x,y\n1,2','BLOCK'),/header/);
 assert.deepEqual(parseFlows('[{"buyValue":"17201.8","category":"DII","date":"16-Oct-2026","netValue":"-3661.28","sellValue":"20863.08"}]'),[{date:'2026-10-16',category:'DII',buy:17201.8,sell:20863.08,net:-3661.28}]);
 const bhav='SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER\nINFY, EQ, 16-Oct-2026, 1, 1, 1, 1, 1, 1500.5, 1, 1000, 15, 10, 600, 60.00\nINFY, BE, 16-Oct-2026, 1, 1, 1, 1, 1, 9, 1, 1, 1, 1, 1, 1\n';
 assert.deepEqual(parseDelivery(bhav,'INFY'),{date:'2026-10-16',close:1500.5,volume:1000,deliveredQty:600,deliveryPct:60,trades:10,turnoverLakh:15});
 const urls:string[]=[];const reader=createDeliveryReader({maxDays:2,fetcher:(async(u:string)=>{urls.push(u);return u.includes('16102026')||u.includes('15102026')?new Response(bhav):new Response('',{status:404});}) as any});
 const dl=await reader('INFY',Date.parse('2026-10-19T10:00:00+05:30'));assert.equal(dl.days.length,2);assert(urls[0].endsWith('sec_bhavdata_full_16102026.csv'),'weekend days are skipped');
 const day:any={};const cap:any=await captureMarketDay({store:{recordMarketDay:async(d:any,f:any)=>{day.d=d;day.f=f;return {deals:d.length,flows:f.length};}},fetcher:(async(u:string)=>u.includes('fiidii')?new Response('[{"buyValue":"1","category":"FII/FPI","date":"16-Oct-2026","netValue":"1","sellValue":"0"}]'):new Response('Date,Symbol,Security Name,Client Name,Buy/Sell,Quantity Traded,Trade Price / Wght. Avg. Price\n16-OCT-2026,TCS,T,C,SELL,10,3000\n')) as any});
 assert.equal(cap.status,'COMPLETED');assert.equal(day.d.length,2);assert.equal(day.f.length,1);
});
test('stock analysis: technicals, option chain, SWOT with cited facts, and the aggregated report',async()=>{
 const bars=series(520);const t:any=technicalProfile(bars);
 assert.equal(t.status,'OK');assert(Math.abs(t.close-bars.at(-1).close)<1e-9);assert(t.movingAverages.sma200>0);assert(t.levels.r1>t.levels.s1);assert(t.range.high52w>=t.close);
 assert.equal(technicalProfile(bars.slice(0,10)).status,'INSUFFICIENT_HISTORY');
 const chain={expiry:'2026-10-27',spot:100,atmStrike:100,strikeStep:5,observedAt:'o',strikes:[90,95,100,105,110].map(k=>({strike:k,CE:{oi:k>=100?k*10:10,iv:0.2,lotSize:50},PE:{oi:k<=100?(200-k)*10:10,iv:0.22,lotSize:50}}))};
 const cs:any=optionChainSummary(chain);assert(cs.putCallOiRatio>0);assert.equal(cs.callOiWall[0].strike,110);assert.equal(cs.putOiWall[0].strike,90);assert.equal(cs.lotSize,50);assert(cs.maxPain>=90&&cs.maxPain<=110);
 const ds=dealsSummary([{side:'BUY',quantity:10,price:100},{side:'SELL',quantity:5,price:100}] as any);assert.equal(ds.netValue,500);
 const swot=buildSwot({tech:t,ranks:[{metric:'roe',label:'ROE',value:30,percentile:90,peers:40},{metric:'pe',label:'P/E',value:80,percentile:10,peers:40}],deals:ds,flows:[{date:'2026-10-16',category:'FII/FPI',net:-100}]});
 assert(swot.strengths.some(s=>/ROE ranks in the top 10%/.test(s.text)));assert(swot.weaknesses.some(s=>/P\/E ranks in the bottom 10%/.test(s.text)));
 assert(swot.opportunities.some(s=>s.basis.includes('deals')));assert(swot.threats.some(s=>s.basis.includes('flows')));
 assert(strategyStates('INFY',bars).every(s=>['ENTRY_SIGNAL_TODAY','EXIT_SIGNAL_TODAY','IN_POSITION','WAITING'].includes(s.state)));
 const at=Date.parse('2026-10-19T10:00:00+05:30');
 const master=async()=>[{segment:'NSE_EQ',instrument_type:'EQ',trading_symbol:'INFY',instrument_key:'NSE_EQ|INE009A01021',name:'INFOSYS LIMITED'},{segment:'NSE_FO',instrument_type:'FUT',underlying_key:'NSE_EQ|INE009A01021',expiry:at+5*DAY,lot_size:400,instrument_key:'NSE_FO|F1',trading_symbol:'INFY FUT'}];
 const market={history:async()=>bars,quotes:async()=>new Map([['NSE_EQ|INE009A01021',{price:100,bid:99.9,ask:100.1,spread:0.002,timestamp:'t',depth:{buy:[],sell:[]}}],['NSE_FO|F1',{price:100.5}]]),optionChain:async()=>chain};
 const throwing={forInstrument:()=>{throw new Error('Push backend is not configured');}};
 const signals={validations:async()=>[valRow('long-term-golden-trend','INFY')],signals:async()=>[],dealsFor:async()=>[{trade_date:'2026-10-01',kind:'BULK',client:'C',side:'BUY',quantity:'100',price:'50'}],flows:async()=>[{trade_date:'2026-10-16',category:'DII',buy_value:1,sell_value:2,net_value:-1}]};
 const a:any=await analyzeStock('INFY',{market,master,fundamentals:throwing,scorecards:async()=>({companies:[]}),signals,delivery:async()=>({days:[{date:'2026-10-16',deliveryPct:55}],source:'s'}),news:async()=>({articles:[],summary:{status:'insufficient_evidence',counts:{positive:0,negative:0,unclear:0}},source:'g'}),announcements:async()=>[{date:'2026-10-13',subject:'Board Meeting',text:'results',url:null,industry:'IT'}],now:()=>at,fetcher:(async()=>new Response('Date,Symbol,Security Name,Client Name,Buy/Sell,Quantity Traded,Trade Price / Wght. Avg. Price\n')) as any});
 assert.equal(a.status,'OK');assert.equal(a.fundamentals.status,'UNAVAILABLE','a storage outage is contained to its section');assert.equal(a.futures.nearest.lotSize,400);assert(Math.abs(a.futures.nearest.basisPct-0.5)<1e-9);
 assert.equal(a.deals.count,1);assert.equal(a.optionChain.callOiWall[0].strike,110);assert.equal(a.segments.length,6);assert.equal(a.industry,'IT');
 assert.equal(a.segments.find((s:any)=>s.id==='long-term').strategies.find((s:any)=>s.id==='long-term-golden-trend').verdict,'VALIDATED');
 assert(a.swot.opportunities.some((s:any)=>/Board Meeting/.test(s.text)));
 assert.equal((await analyzeStock('NOPE',{market,master,fundamentals:throwing,scorecards:async()=>({}),signals,delivery:async()=>({days:[]}),now:()=>at} as any)).status,'NOT_FOUND');
});
const response=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;},end(){return this;}});
test('signals and analysis routes validate input and protect scheduler jobs',async()=>{
 const sig={id:'long-term-golden-trend:INFY:1760000000000',strategyId:'long-term-golden-trend',symbol:'INFY',close:1500,validUntil:Date.now()+DAY};
 const created:any[]=[];const store=()=>({signals:async()=>[{id:sig.id,recorded_at:'r',signal:sig}],validations:async()=>[],signal:async(id:string)=>id===sig.id?{id,signal:sig}:null});
 const h=createSignalsHandler({automation:{read:async()=>({lastTickAt:'t'})} as any,store,paperStore:()=>({create:async(id:string,spec:any,options:any,state:any)=>{created.push(id);return {id,status:'ACTIVE',version:0,spec,options,state,created_at:'c',updated_at:'u'};}}),secret:()=>'s'.repeat(32),env:{}});
 const g=response();await h({method:'GET',headers:{host:'x'},query:{}},g);assert.equal(g.code,200);assert.equal(g.body.signals.length,1);assert.equal(g.body.automation.lastTickAt,'t');assert.equal(g.body.autoPaper,true);
 const p=response();await h({method:'POST',headers:{host:'x'},query:{},body:{action:'paper',signalId:sig.id,capital:50000}},p);assert.equal(p.code,201);assert.equal(created[0],runIdFor(sig.id));assert.equal(p.body.run.segment,'long-term');
 const bad=response();await h({method:'POST',headers:{host:'x'},query:{},body:{action:'paper',signalId:sig.id,capital:5}},bad);assert.equal(bad.code,400);
 const nf=response();await h({method:'POST',headers:{host:'x'},query:{},body:{action:'paper',signalId:'nope:X:1234567890',capital:5000}},nf);assert.equal(nf.code,404);
 const unauth=response();await h({method:'POST',headers:{authorization:'Bearer x'},query:{job:'scan'},body:{}},unauth);assert.equal(unauth.code,401);
 const badJob=response();await h({method:'POST',headers:{authorization:'Bearer '+'s'.repeat(32)},query:{job:'drop'},body:{}},badJob);assert.equal(badJob.code,400);
 const ah=createStockAnalysisHandler({market:{} as any,master:async()=>{throw new Error('x');},now:()=>0});
 const a1=response();await ah({method:'GET',headers:{host:'x'},query:{symbol:'bad symbol!'}},a1);assert.equal(a1.code,400);
 const a2=response();await ah({method:'GET',headers:{host:'x'},query:{symbol:'INFY'}},a2);assert.equal(a2.code,503);
 assert.equal(typeof researchRoutes['signals'],'function');assert.equal(typeof researchRoutes['stock-analysis'],'function');
});
import {backgroundJob,runAutomationTick,mergeStatus,inAutomationWindow} from '../server/automation.js';
import {createAutomationHandler} from '../api/_automation.js';
test('automation tick runs paper every minute plus one due job and records a heartbeat',async()=>{
 const ist=(hm:string)=>Date.parse(`2026-10-19T${hm}:00+05:30`);
 assert.equal(backgroundJob(ist('09:16')),'daily');assert.equal(backgroundJob(ist('09:31')),'daily');assert.equal(backgroundJob(ist('10:01')),'intraday-scan');
 assert.equal(backgroundJob(ist('10:03')),'validate');assert.equal(backgroundJob(ist('10:37')),'fundamentals');assert.equal(backgroundJob(ist('10:04')),null);
 assert.equal(inAutomationWindow(ist('09:14')),false);assert.equal(inAutomationWindow(ist('15:35')),true);assert.equal(inAutomationWindow(Date.parse('2026-10-18T10:00:00+05:30')),false,'Sunday');
 const calls:string[]=[];const jobs={paper:async(b:number)=>{calls.push('paper:'+b);return {status:'COMPLETED',runs:[{outcome:'MONITORED'},{outcome:'TRADE_COMPLETED'}]};},
  scan:async(tf:string[])=>{calls.push('scan:'+tf.join('+'));return {status:'COMPLETED',signals:[{}],failures:[],validatedPairs:62};},marketDay:async()=>{calls.push('day');throw Object.assign(new Error('x'),{code:'NSE_UNAVAILABLE'});},
  validate:async()=>{calls.push('validate');return {status:'COMPLETED',strategy:'swing-rsi2'};},fundamentals:async()=>{calls.push('fund');return {status:'COMPLETED'};}};
 let saved:any=null;const t:any=await runAutomationTick({now:()=>ist('09:16'),...jobs,status:async(x:any)=>{saved=x;}});
 assert.deepEqual(calls,['paper:25000','day','scan:1d+15m']);assert.equal(t.marketDay.status,'FAILED');assert.equal(t.marketDay.reason,'NSE_UNAVAILABLE','one failing job does not stop the others');assert.equal(saved,t);
 const st=mergeStatus(null,t);assert.equal(st.jobs.paper.runs,2);assert.deepEqual(st.jobs.paper.outcomes,{MONITORED:1,TRADE_COMPLETED:1});assert.equal(st.jobs.scan.signals,1);assert.equal(st.jobs.scan.validatedPairs,62);assert.equal(st.ticksToday,1);assert.equal(st.day,'2026-10-19');
 const t2:any=await runAutomationTick({now:()=>ist('10:03'),...jobs,status:async()=>{}});const st2=mergeStatus(st,t2);
 assert.equal(st2.ticksToday,2);assert.equal(st2.jobs.validate.strategy,'swing-rsi2');assert.equal(st2.jobs.scan.at,st.jobs.scan.at,'earlier job results are kept');
 calls.length=0;await runAutomationTick({now:()=>ist('10:08'),...jobs,validate:async()=>({status:'COMPLETED',passed:true,validated:['INFY']}),status:async()=>{}});
 assert.deepEqual(calls,['paper:25000','scan:1d+15m'],'a newly passed strategy is scanned immediately');
 const writes:any[]=[];const h=createAutomationHandler({now:()=>ist('10:03'),secret:()=>'s'.repeat(32),env:{},jobs,status:{read:async()=>null,write:async(d:any)=>{writes.push(d);}}});
 const ok=response();await h({method:'POST',headers:{authorization:'Bearer '+'s'.repeat(32)},body:{}},ok);assert.equal(ok.code,200);assert.equal(ok.body.job,'validate');assert.equal(writes.length,1);
 const no=response();await h({method:'POST',headers:{authorization:'Bearer nope'},body:{}},no);assert.equal(no.code,401);
 const off=response();await createAutomationHandler({now:()=>ist('10:03'),secret:()=>'s'.repeat(32),env:{AUTOMATION_ENABLED:'false'},jobs,status:{read:async()=>null,write:async()=>{}}})({method:'POST',headers:{authorization:'Bearer '+'s'.repeat(32)},body:{}},off);assert.equal(off.body.status,'AUTOMATION_DISABLED');
 const night=response();await createAutomationHandler({now:()=>ist('20:00'),secret:()=>'s'.repeat(32),env:{},jobs,status:{read:async()=>null,write:async()=>{}}})({method:'POST',headers:{authorization:'Bearer '+'s'.repeat(32)},body:{}},night);assert.equal(night.body.status,'OUTSIDE_AUTOMATION_WINDOW');
});
