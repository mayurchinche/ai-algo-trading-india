// Library signals: validation of each library strategy on history, live scanning of validated strategy-symbol
// pairs on completed bars, automatic single-trade paper runs for new signals, and the daily market capture.
import {createHash} from 'node:crypto';
import {STRATEGIES,INDEX_UNDERLYINGS,buildStrategySpec,strategyById} from '../shared/strategyLibrary.js';
import {backtestSymbol,poolResults,validationRecord} from '../shared/strategyValidation.js';
import {createEngineState,stepEngine,computeStrategySeries,TIMEFRAME_MS} from '../shared/specEngine.js';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';
import {OPTION_UNDERLYINGS} from './optionChain.js';
import {MarketDataError} from './upstoxReadOnly.js';
import {newPaperState,validatePaperOptions} from './specPaperRunner.js';
import {readDeals,readFlows} from './marketIntel.js';
export const SIGNAL_VERSION='library-signal-v1';
const DAY=86400000;
export const VALIDATION_DAYS=Object.freeze({'1d':3650,'15m':120});
export const SCAN_DAYS=Object.freeze({'1d':420,'15m':12});
export const VALIDATION_MAX_AGE=6*DAY;
const code=(e,f)=>e instanceof MarketDataError?e.code:e?.code??f;
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await fn(items[i]);}}));return out;}

export function universeOf(strategy){
 const stocks=NIFTY50_UNIVERSE.members.map(m=>({symbol:m.symbol,key:'NSE_EQ|'+m.isin}));
 return strategy.universe==='fno'?[...stocks,...INDEX_UNDERLYINGS.map(s=>({symbol:s,key:OPTION_UNDERLYINGS[s],index:true}))]:stocks;
}
// Research lot for validation: about ₹1 lakh notional, so per-trade returns compare across symbols.
const researchLot=bars=>{const c=bars.map(b=>b.close).sort((a,b)=>a-b);return c.length?Math.max(1,Math.round(1e5/c[Math.floor(c.length/2)])):1;};

// Upstox rate-limits bursts; a limited request is retried with backoff before it counts as unavailable.
async function withRetry(fn,{tries=4,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 for(let k=1;;k++){try{return await fn();}catch(e){if(k>=tries||code(e,'')!=='UPSTOX_RATE_LIMITED')throw e;await wait(1500*2**(k-1));}}
}
// A validation is complete only when history was read for nearly the whole universe; otherwise nothing is
// saved, because a data outage is not evidence that a strategy loses money.
export const MIN_UNIVERSE_COVERAGE=0.95;
// Validates every given strategy that shares one bar size, reading each instrument's history once.
export async function validateStrategies(strategies,{market,now,wait,budgetMs=30000}){
 const at=now(),proxies=strategies.map(s=>s.validationProxy?strategyById(s.validationProxy):s),tf=proxies[0].timeframe,days=VALIDATION_DAYS[tf]??3650;
 if(proxies.some(p=>p.timeframe!==tf))throw new Error('Strategies must share a timeframe');
 const universe=[...new Map(strategies.flatMap(universeOf).map(u=>[u.symbol,u])).values()];
 // The fetch has a time budget so the whole tick fits the function limit; unread symbols count as missing.
 const history=new Map(await mapLimit(universe,4,async u=>{if(now()-at>budgetMs)return [u.symbol,{error:'TIME_BUDGET_EXHAUSTED'}];try{return [u.symbol,{bars:await withRetry(()=>market.history(u.key,tf,at-days*DAY,at),{wait})}];}catch(e){return [u.symbol,{error:code(e,'HISTORY_UNAVAILABLE')}];}}));
 const computedAt=new Date(at).toISOString(),out=[];
 for(const [i,strategy] of strategies.entries()){
  const proxy=proxies[i],members=universeOf(strategy),missing=members.filter(u=>history.get(u.symbol).error);
  if(missing.length>members.length*(1-MIN_UNIVERSE_COVERAGE)){out.push({strategy,status:'DATA_UNAVAILABLE',missing:missing.length,of:members.length,reason:history.get(missing[0].symbol).error});continue;}
  const results=members.map(u=>{const h=history.get(u.symbol);return {u,r:h.error?{status:h.error}:backtestSymbol(buildStrategySpec(proxy,{symbol:u.symbol}),h.bars,{lotSize:researchLot(h.bars)})};});
  const pool=poolResults(results.map(x=>x.r));
  out.push({strategy,status:'COMPLETED',pool,records:results.map(x=>validationRecord(strategy,x.u.symbol,x.r,pool,{computedAt,dataSource:'UPSTOX_HISTORICAL_CANDLE_V3',validatedWith:proxy.id===strategy.id?null:proxy.id}))});
 }
 return out;
}
export async function validateStrategy(strategy,deps){const [r]=await validateStrategies([strategy],deps);return r;}
// Strategies whose validation is missing, older than the refresh age, or was computed on too little data.
export function staleStrategies(validations,now){
 const by=new Map();for(const v of validations){if(!by.has(v.strategy_id))by.set(v.strategy_id,[]);by.get(v.strategy_id).push(v);}
 return STRATEGIES.map(s=>{const rows=by.get(s.id)??[],t=rows.length?Math.min(...rows.map(v=>Date.parse(v.computed_at))):-Infinity,covered=rows.length?Math.min(...rows.map(v=>v.record?.pooled?.symbols??0)):0;
  return {s,t,stale:now-t>VALIDATION_MAX_AGE||covered<universeOf(s).length*MIN_UNIVERSE_COVERAGE};}).filter(x=>x.stale).sort((a,b)=>a.t-b.t).map(x=>x.s);
}
export const staleStrategy=(validations,now)=>staleStrategies(validations,now)[0]??null;

// Runs the engine over completed bars exactly as a paper run would and reports an entry decided at the
// close of the last bar. A position the simulation already holds suppresses a new signal.
export function entryDecidedOnLastBar(spec,bars){
 if(bars.length<2)return null;
 const state=createEngineState(spec,{capital:1e9}),series=computeStrategySeries(spec,bars),last=bars.length-1;
 for(let i=0;i<bars.length;i++){const b=bars[i],q={open:b.open,high:b.high,low:b.low,close:b.close};stepEngine(spec,state,series,i,Object.fromEntries(spec.legs.map(l=>[l.id,q])));}
 const close=bars[last].time+TIMEFRAME_MS[spec.timeframe];
 return state.pending?.kind==='ENTRY'&&state.pending.time===close?{barTime:bars[last].time,decidedAt:close}:null;
}
const levelText=(l,dir)=>l?`${l.unit==='percent'?l.value+'%':'₹'+l.value} ${dir}`:null;
export function signalRecord(strategy,spec,validation,bars,decision,instrumentKey){
 const b=bars.at(-1),daily=spec.timeframe==='1d';
 const legs=spec.legs.map(l=>({id:l.id,side:l.side,instrument:l.instrument,quantity:l.quantity,stopLoss:l.stopLoss??null,target:l.target??null,trailingStop:l.trailingStop??null,
  levels:l.instrument.type==='option'?null:{stop:l.stopLoss?.unit==='percent'?b.close*(1-(l.side==='BUY'?1:-1)*l.stopLoss.value/100):null,target:l.target?.unit==='percent'?b.close*(1+(l.side==='BUY'?1:-1)*l.target.value/100):null}}));
 // A daily signal is acted on in the next session; an intraday one within the next bar.
 const validUntil=daily?decidedAtNextSessionClose(decision.decidedAt):decision.decidedAt+TIMEFRAME_MS[spec.timeframe];
 return {id:`${strategy.id}:${validation.symbol}:${decision.barTime}`,version:SIGNAL_VERSION,strategyId:strategy.id,strategyName:strategy.name,segment:strategy.segment,symbol:validation.symbol,instrumentKey,
  timeframe:spec.timeframe,barTime:decision.barTime,decidedAt:decision.decidedAt,validUntil,close:b.close,direction:spec.legs[0].side==='SELL'?'SHORT':(spec.legs.some(l=>l.instrument.optionType==='PE'&&l.side==='BUY')?'BEARISH':'LONG'),
  rule:strategy.rule,reference:strategy.reference,legs,maxHoldingDays:spec.risk?.maxHoldingDays??null,summary:[...legs.flatMap(l=>[levelText(l.stopLoss,'stop'),levelText(l.target,'target')]).filter(Boolean)].join(', ')||null,
  validation:{verdict:validation.verdict,computedAt:validation.computedAt,validatedWith:validation.validatedWith,onSymbol:validation.onSymbol,pooled:{symbols:validation.pooled.symbols,stats:validation.pooled.stats,halves:validation.pooled.halves}}};
}
function decidedAtNextSessionClose(ms){
 let d=new Date(ms+19800000);d=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1));
 while([0,6].includes(d.getUTCDay()))d=new Date(d.getTime()+DAY);
 return Date.parse(d.toISOString().slice(0,10)+'T15:30:00+05:30');
}

// Deterministic UUID v4-shaped id from a signal id, so a retried auto-paper creation is idempotent.
export function runIdFor(signalId){const h=createHash('sha256').update('paper:'+signalId).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${((parseInt(h[16],16)&3)|8).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;}
// A paper run for one signal: sized to the capital, a single trade, broker tariff and margin check.
export function paperRunFor(signal,capital){
 const strategy=strategyById(signal.strategyId);if(!strategy)throw new Error('Unknown strategy');
 // Derivative margin for one lot can exceed a small equity allocation; futures runs get at least ₹3 lakh.
 if(strategy.segment==='futures')capital=Math.max(capital,300000);
 const units=Math.max(1,Math.floor(capital*0.95/signal.close));
 const spec=buildStrategySpec(strategy,{symbol:signal.symbol,units,lots:1});
 const options=validatePaperOptions({capital,slippageBps:5,maxUnitsPerOrder:null,costModel:'broker-tariff',requireMargin:true,singleTrade:true,signalId:signal.id});
 return {id:runIdFor(signal.id),spec,options};
}

// timeframes: which strategy bar sizes to scan. Daily bars are read up to the previous session (the history
// reader excludes today), so a daily scan in the morning acts on yesterday's close in today's session.
export async function scanSignals({market,store,paperStore,now,budgetMs=40000,autoPaper=true,capital=100000,timeframes=['1d','15m'],lookbackBars=10}){
 const started=now(),validated=(await store.validations()).filter(v=>v.verdict==='VALIDATED'),out={scanned:0,signals:[],failures:[],deferred:0,paper:[]};
 const pairs=validated.map(v=>({v:v.record,s:strategyById(v.strategy_id)})).filter(p=>p.s&&timeframes.includes(p.s.timeframe));
 await mapLimit(pairs,6,async({v,s})=>{
  if(now()-started>budgetMs){out.deferred++;return;}
  const u=universeOf(s).find(x=>x.symbol===v.symbol);if(!u)return;
  try{
   const bars=await market.history(u.key,s.timeframe,started-SCAN_DAYS[s.timeframe]*DAY,started);out.scanned++;
   const spec=buildStrategySpec(s,{symbol:u.symbol});
   // The latest bar plus earlier bars in the lookback, so recent setups are on record (older ones expired).
   for(let k=0;k<lookbackBars&&bars.length-k>1;k++){const b=bars.slice(0,bars.length-k),d=entryDecidedOnLastBar(spec,b);if(d)out.signals.push(signalRecord(s,spec,v,b,d,u.key));}
  }catch(e){out.failures.push({strategy:s.id,symbol:v.symbol,reason:code(e,'SCAN_FAILED')});}
 });
 for(let i=0;i<out.signals.length;i+=400)out.recorded=(out.recorded??0)+await store.recordSignals(out.signals.slice(i,i+400));
 out.active=out.signals.filter(x=>x.validUntil>started).length;
 // Only signals still actionable are paper-traded; expired history is recorded, not traded.
 if(autoPaper)for(const sig of out.signals.filter(x=>x.validUntil>started)){
  try{const r=paperRunFor(sig,capital);await paperStore.create(r.id,r.spec,r.options,newPaperState(r.spec,r.options,now()));out.paper.push({signal:sig.id,run:r.id});}
  catch(e){out.paper.push({signal:sig.id,error:e instanceof Error&&/limit/.test(e.message)?'ACTIVE_RUN_LIMIT':'PAPER_RUN_FAILED'});}
 }
 return {status:out.failures.length?'PARTIAL':'COMPLETED',timeframes,validatedPairs:pairs.length,...out};
}
// Validates the stalest strategy together with every other stale strategy on the same bar size.
export async function runValidation({market,store,now,wait}){
 const stale=staleStrategies(await store.validations(),now());
 if(!stale.length)return {status:'UP_TO_DATE'};
 const tf=s=>(s.validationProxy?strategyById(s.validationProxy):s).timeframe,group=stale.filter(s=>tf(s)===tf(stale[0]));
 const results=await validateStrategies(group,{market,now,wait}),done=results.filter(r=>r.status==='COMPLETED');
 // One call per strategy: the save function accepts at most 200 rows per call.
 for(const r of done)await store.saveValidations(r.records);
 const validated=done.flatMap(r=>r.records.filter(x=>x.verdict==='VALIDATED').map(x=>`${r.strategy.id}:${x.symbol}`));
 return {status:done.length===results.length?'COMPLETED':done.length?'PARTIAL':'DATA_UNAVAILABLE',timeframe:tf(stale[0]),strategy:group.map(s=>s.id).join(','),strategies:results.length,
  passed:done.some(r=>r.pool.passed),validated,results:results.map(r=>r.status==='COMPLETED'?{id:r.strategy.id,passed:r.pool.passed,trades:r.pool.stats.trades}:{id:r.strategy.id,status:r.status,missing:r.missing,reason:r.reason})};
}
export async function captureMarketDay({store,fetcher=fetch}){
 const [deals,flows]=await Promise.allSettled([readDeals({fetcher}),readFlows({fetcher})]);
 const saved=await store.recordMarketDay(deals.status==='fulfilled'?deals.value:[],flows.status==='fulfilled'?flows.value:[]);
 return {status:deals.status==='fulfilled'&&flows.status==='fulfilled'?'COMPLETED':'PARTIAL',saved,deals:deals.status==='fulfilled'?deals.value.length:{error:code(deals.reason,'DEALS_UNAVAILABLE')},flows:flows.status==='fulfilled'?flows.value.length:{error:code(flows.reason,'FLOWS_UNAVAILABLE')}};
}
// Signals list for the UI: recent signals with their state, and the validation table per strategy.
export function summarizeSignals(rows,validations,now){
 const signals=rows.map(r=>({...r.signal,recordedAt:r.recorded_at,status:now>r.signal.validUntil?'EXPIRED':'ACTIVE',paperRunId:runIdFor(r.signal.id)}));
 const strategies=STRATEGIES.map(s=>{
  const v=validations.filter(x=>x.strategy_id===s.id),any=v[0]?.record;
  return {id:s.id,segment:s.segment,name:s.name,timeframe:s.timeframe,rule:s.rule,reference:s.reference,universe:s.universe,validatedWith:s.validationProxy??null,
   computedAt:any?.computedAt??null,pooled:any?.pooled??null,
   symbols:{validated:v.filter(x=>x.verdict==='VALIDATED').map(x=>({symbol:x.symbol,stats:x.record.onSymbol?.stats??null,buyHoldPct:x.record.onSymbol?.buyHoldPct??null})),unproven:v.filter(x=>x.verdict==='UNPROVEN').length,rejected:v.filter(x=>x.verdict==='REJECTED').length},
   status:!any?'NOT_VALIDATED_YET':any.pooled.passed?'PASSED':any.pooled.insufficient?'INSUFFICIENT_EVIDENCE':'FAILED'};
 });
 return {signals,strategies};
}
