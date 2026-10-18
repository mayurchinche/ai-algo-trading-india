import test from 'node:test';import assert from 'node:assert/strict';
import {parseStrategySpec} from '../shared/strategySpec.js';
import {createEngineState,stepEngine,markToMarket,computeStrategySeries} from '../shared/specEngine.js';
import {runSpecBacktest} from '../shared/specBacktest.js';
import {computeMetrics} from '../shared/backtestMetrics.js';
const near=(a:number,b:number,tol=1e-6)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
const DAY=86400000,t0=Date.parse('2026-01-05T00:00:00+05:30');// Monday
const daily=(closes:number[],{gap=0}:{gap?:number}={})=>closes.map((c,i)=>({time:t0+i*DAY,open:i?closes[i-1]+gap:c,high:Math.max(c,i?closes[i-1]+gap:c)+0.5,low:Math.min(c,i?closes[i-1]+gap:c)-0.5,close:c,volume:1000}));
const spec=(over:any={})=>{const r=parseStrategySpec({schemaVersion:1,name:'t',mode:'positional',underlying:{symbol:'TEST',exchange:'NSE',kind:'equity'},timeframe:'1d',schedule:{weekdays:[1,2,3,4,5],entryStart:'09:15',entryEnd:'15:30'},
 indicators:[{id:'fast',type:'sma',params:{length:2}},{id:'slow',type:'sma',params:{length:4}}],entry:{compare:{left:{indicator:'fast'},op:'gt',right:{indicator:'slow'}}},
 legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units:10}}],...over});assert(r.ok,JSON.stringify(!r.ok&&r.issues));return r.spec;};
const weekdays=(n:number)=>{const out:number[]=[];for(let d=0;out.length<n;d++){const w=new Date(t0+d*DAY+19800000).getUTCDay();if(w>0&&w<6)out.push(t0+d*DAY);}return out;};
const bars=(closes:number[],opts:any={})=>{const ts=weekdays(closes.length);return daily(closes,opts).map((b,i)=>({...b,time:ts[i]}));};

test('decisions on a completed bar fill at the next open; nothing uses later bars',()=>{
 const closes=[10,10,10,10,11,12,13,14,13,12,11,10,9,10,11,12];
 const r:any=runSpecBacktest(spec({exit:{compare:{left:{indicator:'fast'},op:'lt',right:{indicator:'slow'}}}}),bars(closes),{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 assert.equal(r.status,'OK');const t=r.trades[0];
 const b=bars(closes);assert.equal(t.entryTime,b[5].time,'entry decided at bar 4 close fills at bar 5 open');
 const full=r,prefix:any=runSpecBacktest(spec({exit:{compare:{left:{indicator:'fast'},op:'lt',right:{indicator:'slow'}}}}),bars(closes).slice(0,10),{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 assert.deepEqual(prefix.curve,full.curve.slice(0,10));
 near(t.pnl,(b.find((x:any)=>x.time===t.exitTime)!.open-b[5].open)*10);
 assert.equal(r.curve.length,closes.length);
});
test('costs, slippage and tranching are charged per fill and per child order',()=>{
 const s=spec({indicators:[],entry:{compare:{left:{price:'close'},op:'gt',right:{value:0}}},legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units:250}}],risk:{maxHoldingDays:2}});
 const r:any=runSpecBacktest(s,bars([100,100,100,100,100]),{capital:100000,costBps:10,costPerOrder:20,slippageBps:0,maxUnitsPerOrder:100});
 const t=r.trades[0];assert.equal(r.orders%3,0,'250 units in orders of at most 100 = 3 child orders per fill');
 near(t.grossPnl-t.pnl,2*(100*250*10/1e4+3*20));
});
test('stop-loss fills at the level or a worse gap open; stop wins an ambiguous bar; target fills at the level',()=>{
 const s=(lvl:any)=>spec({indicators:[],entry:{compare:{left:{price:'close'},op:'gt',right:{value:0}}},legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units:1},...lvl}]});
 const base=(rows:any[])=>rows.map((r,i)=>({time:weekdays(rows.length)[i],volume:1,...r}));
 const gap:any=runSpecBacktest(s({stopLoss:{unit:'percent',value:5}}),base([{open:100,high:100,low:100,close:100},{open:100,high:101,low:99,close:100},{open:90,high:91,low:89,close:90}]),{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 assert.equal(gap.trades[0].reason,'STOP_LOSS');near(gap.trades[0].pnl,-10,1e-9);
 const both:any=runSpecBacktest(s({stopLoss:{unit:'points',value:2},target:{unit:'points',value:2}}),base([{open:100,high:100,low:100,close:100},{open:100,high:100,low:100,close:100},{open:100,high:103,low:97,close:100}]),{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 assert.equal(both.trades[0].reason,'STOP_LOSS');assert.equal(both.ambiguousBars,1);near(both.trades[0].pnl,-2);
 const tgt:any=runSpecBacktest(s({target:{unit:'points',value:2}}),base([{open:100,high:100,low:100,close:100},{open:100,high:100,low:100,close:100},{open:101,high:103,low:100,close:102}]),{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 near(tgt.trades[0].pnl,2);assert.equal(tgt.trades[0].reason,'TARGET');
});
test('trailing stop tightens by step for each trigger of favourable move, from the next bar',()=>{
 const s=spec({indicators:[],entry:{compare:{left:{price:'close'},op:'gt',right:{value:0}}},legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units:1},stopLoss:{unit:'points',value:5},trailingStop:{unit:'points',trigger:2,step:1}}]});
 const rows=[[100,100,100,100],[100,100,100,100],[100,106,100,105],[105,105,97.5,100]].map(([open,high,low,close],i)=>({time:weekdays(4)[i],open,high,low,close,volume:1}));
 const r:any=runSpecBacktest(s,rows,{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 assert.equal(r.trades[0].reason,'STOP_LOSS');near(r.trades[0].pnl,-2,1e-9);// stop 95 → 98 after a 6-point move
});
test('strategy max loss exits at the next open; re-entry after a stop allows a second intraday entry',()=>{
 const s=spec({indicators:[],entry:{compare:{left:{price:'close'},op:'gt',right:{value:0}}},risk:{maxLoss:{unit:'amount',value:15}}});
 const r:any=runSpecBacktest(s,bars([100,100,98,97,96,95]),{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 assert.equal(r.trades[0].reason,'STRATEGY_MAX_LOSS');
 const min=(m:number)=>Date.parse('2026-01-05T09:15:00+05:30')+m*300000;
 const intraday=(re:any)=>{const r2=parseStrategySpec({schemaVersion:1,name:'i',mode:'intraday',underlying:{symbol:'TEST',exchange:'NSE',kind:'equity'},timeframe:'5m',schedule:{weekdays:[1,2,3,4,5],entryStart:'09:20',entryEnd:'14:00',squareOff:'15:15'},indicators:[],entry:{compare:{left:{price:'close'},op:'gt',right:{value:0}}},legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units:1},stopLoss:{unit:'points',value:1}}],...(re?{risk:{reEntry:re}}:{})});assert(r2.ok);return r2.spec;};
 const rows=[100,100,100,98,100,100,100,100].map((c,k)=>({time:min(k),open:k===3?98:100,high:100,low:c===98?98:99.5,close:c,volume:1}));
 const once:any=runSpecBacktest(intraday(null),rows,{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 const twice:any=runSpecBacktest(intraday({maxCount:1,after:'stop-loss'}),rows,{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 assert.equal(once.trades.length,1);assert.equal(twice.trades.length+(twice.openTrade?1:0),2);
});
test('intraday positions are squared off at the square-off bar and never carried overnight',()=>{
 const s=parseStrategySpec({schemaVersion:1,name:'i',mode:'intraday',underlying:{symbol:'TEST',exchange:'NSE',kind:'equity'},timeframe:'5m',schedule:{weekdays:[1,2,3,4,5],entryStart:'09:20',entryEnd:'15:00',squareOff:'15:15'},indicators:[],entry:{compare:{left:{price:'close'},op:'gt',right:{value:0}}},legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units:1}}]}) as any;
 const at=(d:string,hm:string,c:number)=>({time:Date.parse(`${d}T${hm}:00+05:30`),open:c,high:c,low:c,close:c,volume:1});
 const r:any=runSpecBacktest(s.spec,[at('2026-01-05','09:20',100),at('2026-01-05','09:25',101),at('2026-01-05','15:15',105),at('2026-01-05','15:20',106)],{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 assert.equal(r.trades[0].reason,'SQUARE_OFF');near(r.trades[0].pnl,4);
 const missed:any=runSpecBacktest(s.spec,[at('2026-01-05','09:20',100),at('2026-01-05','09:25',101),at('2026-01-05','14:00',102),at('2026-01-06','09:15',90)],{capital:1000,costBps:0,costPerOrder:0,slippageBps:0});
 assert.equal(missed.trades[0].reason,'SQUARE_OFF_MISSED_SESSION_END');
});
test('option legs and futures without a lot size are rejected explicitly',()=>{
 const opt=parseStrategySpec({schemaVersion:1,name:'o',mode:'positional',underlying:{symbol:'NIFTY',exchange:'NSE',kind:'index'},timeframe:'1d',schedule:{weekdays:[1],entryStart:'09:15',entryEnd:'10:00'},indicators:[],entry:{compare:{left:{price:'close'},op:'gt',right:{value:0}}},legs:[{id:'ce',side:'SELL',instrument:{type:'option',optionType:'CE',expiry:'current-week',strike:{mode:'atm-offset',steps:1}},quantity:{lots:1}}]}) as any;
 assert.equal((runSpecBacktest(opt.spec,bars([1,2,3])) as any).status,'UNSUPPORTED_OPTION_LEGS');
 const fut=parseStrategySpec({...JSON.parse(JSON.stringify(opt.spec)),legs:[{id:'f',side:'BUY',instrument:{type:'future',expiry:'current-month'},quantity:{lots:1}}]}) as any;
 assert.equal(runSpecBacktest(fut.spec,bars([1,2,3])).status,'LOT_SIZE_REQUIRED');assert.equal(runSpecBacktest(fut.spec,bars([1,2,3]),{lotSize:75}).status,'OK');
 const st=createEngineState(spec(),{capital:1});assert.equal(markToMarket(st),0);assert.throws(()=>createEngineState(spec(),{capital:0}));
 const series=computeStrategySeries(spec(),bars([1,2]));stepEngine(spec(),st,series,0,null);assert.equal(st.status,'FLAT');
});

test('metrics: grade withheld under 10 trades, deterministic Monte-Carlo and documented flags',()=>{
 const curve=Array.from({length:300},(_,i)=>({time:t0+i*DAY,equity:100000*(1+0.0005*i+(i%7===0?-0.002:0))}));
 const trades=Array.from({length:40},(_,i)=>({pnl:i%3===0?-300:500,grossPnl:(i%3===0?-300:500)+50,mae:-100,mfe:600,exitTime:t0+i*7*DAY}));
 const m:any=computeMetrics({curve,trades,capital:100000,costs:2000,paramCount:2,mcPaths:500,seed:7});
 assert.equal(m.status,'OK');assert.equal(m.trades.count,40);near(m.trades.winRate,26/40);assert.deepEqual(m.monteCarlo,(computeMetrics({curve,trades,capital:100000,costs:2000,paramCount:2,mcPaths:500,seed:7}) as any).monteCarlo);
 assert(m.monteCarlo.finalReturn.p5<=m.monteCarlo.finalReturn.p50&&m.monteCarlo.finalReturn.p50<=m.monteCarlo.finalReturn.p95);
 assert.match(m.grade.grade,/^[A-F]$/);assert.equal(m.grade.score,100-m.grade.deductions.reduce((a:number,d:any)=>a+d.points,0));
 const few:any=computeMetrics({curve,trades:trades.slice(0,5),capital:100000,costs:0});assert.equal(few.grade.grade,'N/A');assert(few.flags.some((f:any)=>f.id==='FEW_TRADES'));assert.equal(few.monteCarlo,null);
 const conc:any=computeMetrics({curve,trades:[...trades.slice(0,12).map(t=>({...t,pnl:-10})),{pnl:10000,grossPnl:10000,mae:0,mfe:0,exitTime:t0}],capital:100000,costs:0});
 assert(conc.flags.some((f:any)=>f.id==='PROFIT_CONCENTRATION'));
 assert.equal(computeMetrics({curve:[],trades:[],capital:1,costs:0}).status,'NO_DATA');
});
