import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {STRATEGIES,buildStrategySpec,strategyById} from '../shared/strategyLibrary.js';
import {segmentOfSpec} from '../shared/tradingHorizon.js';
import {backtestSymbol,poolResults,symbolVerdict,returnStats,validationRecord,CRITERIA} from '../shared/strategyValidation.js';
import {decidedAtNextSessionClose,entryDecidedOnLastBar,scanSignals,runValidation,staleStrategy,paperRunFor,runIdFor,summarizeSignals,captureMarketDay} from '../server/signalEngine.js';
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
import {openingRange} from '../shared/indicators.js';
test('opening range is defined only once the range has formed, per session',()=>{
 const s=['d1','d1','d1','d2','d2','d2'],o=[10,11,12,20,21,22],h=[11,13,12.5,21,23,22.5],l=[9,10.5,11,19,20,21],c=[10.5,12,12,20.5,22,22];
 const r=openingRange(o,h,l,c,s,2);
 assert(Number.isNaN(r.high[0])&&Number.isNaN(r.high[3]),'not visible before the range completes');
 assert.deepEqual([r.high[1],r.low[1],r.close[1],r.open[1]],[13,9,12,10]);assert.equal(r.high[2],13,'later bars keep the range');
 assert.deepEqual([r.high[4],r.low[4],r.open[4],r.prevClose[4]],[23,19,20,12]);assert(Number.isNaN(r.prevClose[1]),'no previous session for the first day');
});
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
 const store={validations:async()=>[valRow('short-term-donchian','INFY'),valRow('long-term-golden-trend','INFY'),valRow('swing-rsi2','TCS','REJECTED')],recordSignals:async(rows:any[])=>{recorded.push(...rows);return rows.length;}};
 const paperStore={create:async(id:string,spec:any,options:any,state:any)=>{created.push({id,spec,options,state});return {id};}};
 let reads=0;const market={history:async(key:string)=>{reads++;assert.equal(key,'NSE_EQ|INE009A01021');return bars;}};
 const boards:any[]=[];const r:any=await scanSignals({market,store,paperStore,now:()=>now,saveBoard:async(b:any)=>{boards.push(b);}});
 assert.equal(reads,1,'one read serves both strategies on INFY');assert.deepEqual(boards.at(-1).rows.map((b:any)=>b.strategyId),[],'a fresh signal is not also listed on the board');assert.equal(r.scanned,2);assert.equal(r.signals.length,1,'earlier bars in the lookback had no setup');const sig=r.signals[0];assert.equal(r.active,1);
 const later:any=await scanSignals({market,store:{...store,recordSignals:async(rows:any[])=>rows.length},paperStore,now:()=>now+5*DAY});
 assert.equal(later.signals.length,1);
 const held:any=await scanSignals({market:{history:async()=>[...bars,...breakout().slice(-5).map((b:any,i:number)=>({...b,time:bars.at(-1).time+(i+1)*DAY}))]},store:{...store,recordSignals:async(rows:any[])=>rows.length},paperStore,now:()=>now+5*DAY,saveBoard:async(b:any)=>{boards.push(b);}});
 assert(held&&boards.at(-1).rows.some((b:any)=>b.state==='IN_POSITION'&&b.symbol==='INFY'&&b.strategyId==='short-term-donchian'),'the rule’s open position is on the board');assert.equal(later.active,0,'an older setup is recorded but no longer actionable');assert.equal(later.paper.length,0);
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
test('a daily signal is valid for the first session on or after its decision date',()=>{
 const thu=Date.parse('2026-10-16T00:00:00+05:30'),sat=Date.parse('2026-10-17T00:00:00+05:30');
 assert.equal(new Date(decidedAtNextSessionClose(thu)).toISOString(),'2026-10-16T10:00:00.000Z','Thursday close → Friday session');
 assert.equal(new Date(decidedAtNextSessionClose(sat)).toISOString(),'2026-10-19T10:00:00.000Z','Friday close → Monday session');
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
 let reads=0;saved.length=0;const batches:number[]=[];const save=async(r:any[])=>{batches.push(r.length);saved.push(...r);return r.length;};
 const all:any=await runValidation({market:{history:async()=>{reads++;return bars;}},store:{validations:async()=>[],saveValidations:save},now:()=>now});
 assert.equal(all.timeframe,'15m');assert.equal(all.strategies,STRATEGIES.filter(s=>s.timeframe==='15m').length);assert.equal(reads,50);
 reads=0;batches.length=0;const daily:any=await runValidation({market:{history:async()=>{reads++;return bars;}},store:{validations:async()=>STRATEGIES.filter(s=>s.timeframe==='15m').map(s=>row(s.id,now)),saveValidations:save},now:()=>now});
 assert.equal(daily.timeframe,'1d');assert.equal(daily.strategies,STRATEGIES.filter(s=>s.timeframe==='1d').length);assert.equal(reads,52,'one read per symbol for every daily strategy');assert(batches.every(n=>n<=200),'each save stays within the 200-row limit');
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
 const day=Date.parse('2026-10-20T00:00:00+05:30'),sig={id:'long-term-golden-trend:INFY:1760000000000',strategyId:'long-term-golden-trend',symbol:'INFY',close:1500,timeframe:'1d',decidedAt:day};
 const created:any[]=[];const store=()=>({signals:async()=>[{id:sig.id,recorded_at:'r',signal:sig}],validations:async()=>[],signal:async(id:string)=>id===sig.id?{id,signal:sig}:null});
 const h=createSignalsHandler({automation:{read:async()=>({lastTickAt:'t'})} as any,store,paperStore:()=>({create:async(id:string,spec:any,options:any,state:any)=>{created.push(id);return {id,status:'ACTIVE',version:0,spec,options,state,created_at:'c',updated_at:'u'};}}),secret:()=>'s'.repeat(32),env:{},now:()=>day+10*3600000});
 const g=response();await h({method:'GET',headers:{host:'x'},query:{}},g);assert.equal(g.code,200);assert.equal(g.body.signals.length,1);assert.equal(g.body.automation.lastTickAt,'t');assert.equal(g.body.autoPaper,true);
 const p=response();await h({method:'POST',headers:{host:'x'},query:{},body:{action:'paper',signalId:sig.id,capital:50000}},p);assert.equal(p.code,201);assert.equal(created[0],runIdFor(sig.id));assert.equal(p.body.run.segment,'long-term');
 const bad=response();await h({method:'POST',headers:{host:'x'},query:{},body:{action:'paper',signalId:sig.id,capital:5}},bad);assert.equal(bad.code,400);
 const old=response();const hOld=createSignalsHandler({automation:{read:async()=>null} as any,store,paperStore:()=>({create:async()=>{throw new Error('no');}}),secret:()=>'s'.repeat(32),env:{},now:()=>day+10*DAY});await hOld({method:'POST',headers:{host:'x'},query:{},body:{action:'paper',signalId:sig.id,capital:50000}},old);assert.equal(old.code,409);
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
 let saved:any=null;const t:any=await runAutomationTick({now:()=>ist('09:16'),...jobs,alerts:async()=>{calls.push('alerts');return {status:'COMPLETED',scan:{status:'COMPLETED'}};},status:async(x:any)=>{saved=x;}});
 assert(calls.includes('alerts'),'the alert scanner runs every tick');calls.splice(calls.indexOf('alerts'),1);assert.equal(mergeStatus(null,t).jobs.alerts.status,'COMPLETED');
 assert.deepEqual(calls,['paper:25000','day','scan:1d+15m']);assert.equal(t.dailyScan.signals.length,1);assert.equal(t.marketDay.status,'FAILED');assert.equal(t.marketDay.reason,'NSE_UNAVAILABLE','one failing job does not stop the others');assert.equal(saved,t);
 const st=mergeStatus(null,t);assert.equal(st.jobs.paper.runs,2);assert.deepEqual(st.jobs.paper.outcomes,{MONITORED:1,TRADE_COMPLETED:1});assert.equal(st.jobs.dailyScan.signals,1);assert.equal(st.jobs.dailyScan.validatedPairs,62);assert.equal(st.ticksToday,1);assert.equal(st.day,'2026-10-19');
 const t2:any=await runAutomationTick({now:()=>ist('10:08'),...jobs,status:async()=>{}});const st2=mergeStatus(st,t2);
 assert.equal(st2.ticksToday,2);assert.equal(st2.jobs.validate.strategy,'swing-rsi2');assert.equal(st2.jobs.dailyScan.at,st.jobs.dailyScan.at,'earlier job results are kept');
 calls.length=0;await runAutomationTick({now:()=>ist('10:08'),...jobs,validate:async()=>({status:'COMPLETED',passed:true,validated:['INFY']}),status:async()=>{}});
 assert.deepEqual(calls,['paper:25000','scan:1d+15m'],'a newly passed strategy is scanned immediately');
 assert.equal(backgroundJob(ist('10:14')),'daily-scan');assert.equal(backgroundJob(ist('10:44')),'daily-scan');
 calls.length=0;await runAutomationTick({now:()=>ist('10:44'),...jobs,status:async()=>{}});assert.deepEqual(calls,['paper:25000','scan:1d'],'safety-net daily scan every 30 minutes');
 calls.length=0;await runAutomationTick({now:()=>ist('10:08'),...jobs,validate:async()=>({status:'UP_TO_DATE'}),status:async()=>{}});assert.deepEqual(calls,['paper:25000']);
 const writes:any[]=[];const h=createAutomationHandler({now:()=>ist('10:03'),secret:()=>'s'.repeat(32),env:{},jobs,status:{read:async()=>null,write:async(d:any)=>{writes.push(d);}}});
 const ok=response();await h({method:'POST',headers:{authorization:'Bearer '+'s'.repeat(32)},body:{}},ok);assert.equal(ok.code,200);assert.equal(ok.body.job,'validate');assert.equal(writes.length,1);
 const no=response();await h({method:'POST',headers:{authorization:'Bearer nope'},body:{}},no);assert.equal(no.code,401);
 const off=response();await createAutomationHandler({now:()=>ist('10:03'),secret:()=>'s'.repeat(32),env:{AUTOMATION_ENABLED:'false'},jobs,status:{read:async()=>null,write:async()=>{}}})({method:'POST',headers:{authorization:'Bearer '+'s'.repeat(32)},body:{}},off);assert.equal(off.body.status,'AUTOMATION_DISABLED');
 const night=response();await createAutomationHandler({now:()=>ist('20:00'),secret:()=>'s'.repeat(32),env:{},jobs,status:{read:async()=>null,write:async()=>{}}})({method:'POST',headers:{authorization:'Bearer '+'s'.repeat(32)},body:{}},night);assert.equal(night.body.status,'OUTSIDE_AUTOMATION_WINDOW');
});
import {triggerLevel} from '../shared/strategyLibrary.js';
test('futures positions roll into the next contract before expiry within the same trade',async()=>{
 const {newPaperState}=await import('../server/specPaperRunner.js');
 const s=strategyById('futures-breakout-long'),spec=buildStrategySpec(s,{symbol:'INFY',lots:1});
 const r=paperRunFor({id:'futures-breakout-long:INFY:1760000000000',strategyId:'futures-breakout-long',symbol:'INFY',close:1500},100000);assert.equal(r.options.capital,300000,'futures runs get margin-sized capital');
 const at=Date.parse('2026-10-26T10:00:00+05:30'),state:any=newPaperState(spec,r.options,at-5*DAY);
 const oldK={instrumentKey:'NSE_FO|OCT',lotSize:400,description:'INFY FUT OCT',expiry:'2026-10-27'},newK={instrumentKey:'NSE_FO|NOV',lotSize:400,description:'INFY FUT NOV',expiry:'2026-11-24'};
 Object.assign(state,{status:'OPEN',legs:[{id:'fut',dir:1,units:400,entry:1500,entryTime:at-5*DAY,entryCharges:20,instrument:oldK,open:true,stop:1380,target:null,trailSteps:0,mark:1520,exitPrice:null,exitTime:null,exitCharges:0,checkedTo:at-60000}],entries:[{index:0,tradeId:'T1',day:'2026-10-21',time:at-5*DAY,decidedAt:at-5*DAY,exitTime:null,reason:null,pnl:null,mae:0,mfe:0,costsBefore:0,realizedBefore:0,margin:0}],tradeSeq:1});
 state.paper.lastBarTime=Date.parse('2026-10-23T00:00:00+05:30');state.paper.barsCheckedAt=at;
 const q=(k:string,p:number)=>({symbol:k,price:p,bid:p-0.5,ask:p+0.5,depth:{buy:[{price:p-0.5,quantity:5000}],sell:[{price:p+0.5,quantity:5000}]},timestamp:new Date(at-1000).toISOString(),source:'T'});
 const market={underlyingKey:async()=>'NSE_EQ|INE009A01021',nextFuture:async(_k:string,after:string)=>{assert.equal(after,'2026-10-27');return newK;},minuteBars:async()=>[],bars:async()=>[],
  quotes:async(keys:string[])=>new Map(keys.map(k=>[k,q(k,k==='NSE_FO|OCT'?1520:1530)])),margin:async()=>({status:'OK',required:1}),resolveLeg:async()=>oldK,marketOpen:async()=>true};
 const out:any=await cycleRun({id:r.id,status:'ACTIVE',version:0,spec,options:r.options,state},{market,now:()=>at});
 const kinds=out.events.map((e:any)=>e.kind);assert.deepEqual(kinds.filter((k:string)=>['ORDER','ROLLED'].includes(k)),['ORDER','ORDER','ROLLED']);
 const legs=out.state.legs;assert.equal(legs.length,2);assert.equal(legs[0].open,false);assert.equal(legs[0].exitReason,'ROLL');assert.equal(legs[1].instrument.instrumentKey,'NSE_FO|NOV');
 const rolled=out.events.find((e:any)=>e.kind==='ROLLED');assert(Math.abs(rolled.spread-(1530.5*1.0005-1519.5*0.9995))<1e-9,'spread = new fill − old fill, after slippage');
 assert(Math.abs(legs[1].stop-(1380+rolled.spread))<1e-9,'the stop shifts by the calendar spread paid');assert.equal(out.state.status,'OPEN','the trade stays open across the roll');
 const far:any=await cycleRun({id:r.id,status:'ACTIVE',version:1,spec,options:r.options,state:out.state},{market,now:()=>at+60000});assert(!far.events.some((e:any)=>e.kind==='ROLLED'),'the new contract is not rolled again');
 const up=series(300,{drift:0.002,amp:0.001}),t=triggerLevel('short-term-donchian',up);assert(t===null||t.level>=Math.max(...up.slice(-20).map(b=>b.high))-1e-9);
});
import {gapPercent,volumeRatio} from '../shared/indicators.js';
import {parsePreOpen,buildGapBoard,readRecentAnnouncements} from '../server/openingGaps.js';
import {createOpeningGapsHandler} from '../api/_opening-gaps.js';
test('gap indicators and the opening-gap board',async()=>{
 assert.deepEqual(gapPercent([10,11,9.9],[10,10,11]).map(v=>Number.isNaN(v)?null:Math.round(v*100)/100),[null,10,-1]);
 assert.deepEqual(volumeRatio([1,1,1,4],3).map(v=>Number.isNaN(v)?null:v),[null,null,null,4],'compared with the bars before it only');
 const po={data:[{metadata:{symbol:'PNB',previousClose:116.3,iep:120.87,pChange:3.93,finalQuantity:1011483,totalTurnover:1,yearHigh:135.15,yearLow:98.5},detail:{preOpenMarket:{totalBuyQuantity:1333404,totalSellQuantity:658031,lastUpdateTime:'19-Oct-2026 09:09:18'}}},
  {metadata:{symbol:'TCS',previousClose:3000,iep:2955,pChange:-1.5,yearHigh:3500},detail:{preOpenMarket:{totalBuyQuantity:1,totalSellQuantity:3}}},{metadata:{symbol:'INFY',previousClose:1500,iep:1503,pChange:0.2},detail:{}},{metadata:{symbol:'bad name',previousClose:1,iep:1,pChange:9}}]};
 const rows=parsePreOpen(po);assert.equal(rows.length,3);assert(Math.abs(rows[0].imbalance-(1333404-658031)/(1333404+658031))<1e-12);
 assert.throws(()=>parsePreOpen({msg:'x'}),/format/);
 const board=buildGapBoard(rows,{quotes:new Map([['PNB',{price:119,open:121}],['TCS',{price:3001,open:2950}]]),board:[{symbol:'PNB',strategyId:'short-term-donchian',strategyName:'20-day breakout',state:'NEAR_TRIGGER',trigger:{level:122,distancePct:1}}],
  validations:[{symbol:'PNB',strategy_id:'short-term-gap-continuation',verdict:'VALIDATED'}],announcements:new Map([['PNB',[{subject:'Outcome of Board Meeting'}]]])});
 assert.deepEqual(board.map((r:any)=>[r.symbol,r.direction,r.status]),[['PNB','UP','HOLDING'],['TCS','DOWN','FILLED']],'INFY within 1% is left out; ordered by gap size');
 assert.equal(board[0].catalyst[0].subject,'Outcome of Board Meeting');assert.deepEqual(board[0].validated,['short-term-gap-continuation']);assert.equal(board[0].rules[0].state,'NEAR_TRIGGER');
 assert.equal(buildGapBoard(rows)[0].status,'PRE_OPEN');
 const urls:string[]=[];await readRecentAnnouncements(Date.parse('2026-10-19T09:20:00+05:30'),{fetcher:(async(u:string)=>{urls.push(u);return new Response('[{"symbol":"PNB","an_dt":"17-Oct-2026 18:00:00","desc":"Results"}]');}) as any});
 assert.match(urls[0],/from_date=16-10-2026&to_date=19-10-2026$/,'Monday looks back to Friday');
 const h=createOpeningGapsHandler({fetcher:(async(u:string)=>new Response(u.includes('pre-open')?JSON.stringify(po):'[]')) as any,signals:()=>({validations:async()=>[]}) as any,board:{read:async()=>null} as any,scorecards:async()=>null,master:async()=>[],now:()=>Date.parse('2026-10-19T20:00:00+05:30')});
 const res=response();await h({method:'GET',headers:{host:'x'},query:{}},res);assert.equal(res.code,200);assert.equal(res.body.summary.gapUp,1);assert.equal(res.body.rows.length,2);assert.equal(res.body.strategies.length,3);
 const spec=buildStrategySpec(strategyById('short-term-gap-continuation'),{symbol:'INFY'});assert.equal(segmentOfSpec(spec),'short-term');
});
import {observationRows,computeOutcome,accuracySummary,updateDiscoveryOutcomes} from '../server/discoveryLedger.js';
import {createDiscoveryHandler} from '../api/_discovery.js';
test('Discover ledger records first sightings and measures their outcomes',async()=>{
 const at=Date.parse('2026-10-19T10:05:00+05:30'),stock=(symbol:string,score:number,ltp=18.13)=>({symbol,name:symbol,overallScore:score,ltp,quoteTime:'2026-10-19T04:34:00.000Z',signal:'BUY',scores:{},reasons:['x'],strategies:['Breakout'],trend:'UP',rsi:70,changePct:11.36,volumeRatio:5.1,prevClose:16.28,foAnalysis:{suggestedStopLoss:16,suggestedTarget:21,riskReward:1.5},eligible:false,blockedReasons:['Price below ₹50 research liquidity guard']});
 const rows=observationRows([stock('PCJEWELLER',64),stock('TCS',42),stock('INFY',-55,1500),stock('bad sym',90)],at);
 assert.deepEqual(rows.map(r=>r.id),['2026-10-19:PCJEWELLER:BUY','2026-10-19:INFY:SELL'],'only scores of 50 or more, valid symbols');
 assert.equal(rows[0].seenAt,new Date(at).toISOString());assert.equal(rows[0].details.target,21);assert.deepEqual(rows[0].details.blockedReasons,['Price below ₹50 research liquidity guard']);
 const day=(d:string,o:number,h:number,l:number,c:number)=>({time:Date.parse(d+'T00:00:00+05:30'),open:o,high:h,low:l,close:c,volume:1});
 const row={side:'BUY',first_price:18.13,session_date:'2026-10-19',details:{stop:16,target:21}};
 const bars=[day('2026-10-16',16,16.5,15.9,16.28),day('2026-10-19',16.3,18.5,16.2,18.2),day('2026-10-20',18.2,19,17.5,18.9),day('2026-10-21',18.9,21.5,18.5,21)];
 const o:any=computeOutcome(row,bars,at);
 assert.equal(o.sessionClose,0.39);assert.equal(o.d1,4.25);assert.equal(o.levels.result,'TARGET');assert.equal(o.levels.at,'2026-10-21');assert.equal(o.complete,false);assert.equal(o.sessions,2);
 assert.equal(computeOutcome(row,bars.slice(0,1),at).status,'PENDING');
 const s=accuracySummary([{side:'BUY',first_score:64,outcome:o},{side:'BUY',first_score:55,outcome:null},{side:'SELL',first_score:-72,outcome:{d5:-1,levels:{result:'STOP'}}}]);
 const b60=s.find((x:any)=>x.side==='BUY'&&x.band==='60–69');assert.equal(b60.signals,1);assert.equal(b60.targetFirst,100);assert.equal(s.find((x:any)=>x.side==='SELL'&&x.band==='70+').targetFirst,0);
 const set:any[]=[];const store={pending:async(before:string)=>{assert.equal(before,'2026-10-22');return [{id:'2026-10-19:PCJEWELLER:BUY',...row,symbol:'PCJEWELLER'},{id:'2026-10-19:NOPE:BUY',...row,symbol:'NOPE'}];},setOutcomes:async(r:any[])=>{set.push(...r);return r.length;}};
 const u:any=await updateDiscoveryOutcomes({store,market:{history:async()=>bars},master:async()=>[{segment:'NSE_EQ',instrument_type:'EQ',trading_symbol:'PCJEWELLER',instrument_key:'NSE_EQ|INE785J01023'}],now:()=>Date.parse('2026-10-22T10:00:00+05:30')});
 assert.equal(u.updated,1);assert.equal(u.failures,1);assert.equal(u.failureReason,'INSTRUMENT_NOT_FOUND');assert.equal(set[0].outcome.levels.result,'TARGET');
 const h=createDiscoveryHandler({store:()=>({day:async()=>[{id:'x'}],since:async()=>[]}) as any,now:()=>at});
 const res=response();await h({method:'GET',headers:{host:'x'},query:{}},res);assert.equal(res.code,200);assert.equal(res.body.date,'2026-10-19');assert.equal(res.body.study.stocks,475);
 const bad=response();await h({method:'GET',headers:{host:'x'},query:{date:'yesterday'}},bad);assert.equal(bad.code,400);
 const down=response();await createDiscoveryHandler({store:()=>{throw new Error('x');},now:()=>at})({method:'GET',headers:{host:'x'},query:{}},down);assert.equal(down.code,503);assert(down.body.study,'the study is returned even without the ledger');
 assert.equal(backgroundJob(Date.parse('2026-10-19T10:22:00+05:30')),'outcomes');
});
