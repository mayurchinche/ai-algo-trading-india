import {parseStrategySpec} from '../shared/strategySpec.js';
import {createEngineState,stepEngine,monitorEngine,fillPending,markToMarket,closeAtMarks,computeStrategySeries,fundsOf,unitsOf,TIMEFRAME_MS,ENGINE_VERSION} from '../shared/specEngine.js';
import {MarketDataError} from './upstoxReadOnly.js';
import {segmentOfSpec} from '../shared/tradingHorizon.js';
// Forward paper runs of strategy specs on live read-only data, executed the way a live order flow would be:
// - every cycle (each minute) checks resting stop and target orders of an open position against the
//   contracts' 1-minute candles since the last check plus the live quote, squares off intraday positions by
//   wall-clock time and applies strategy-level P&L limits;
// - when a new strategy bar completes, the strategy decides on it and the decision is executed in the same
//   cycle at the live book: market orders walk visible 5-level depth, entries need a broker margin quote
//   and enough paper funds, and charges follow the published broker tariff;
// - every event is appended to a permanent ledger in the same transaction as the state change.
// No order is ever sent to a broker.
export const SPEC_PAPER_VERSION='spec-paper-v2';
export const KEEP_EVENTS=200;
export const MAX_CYCLE_EVENTS=1000;
const RANGES={capital:[1000,1e8],costBps:[0,100],costPerOrder:[0,1000],slippageBps:[0,100]};
const KEYS=[...Object.keys(RANGES),'maxUnitsPerOrder','costModel','requireMargin','singleTrade','signalId'];
export function validatePaperOptions(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!KEYS.includes(k)))throw new Error('Invalid paper options');
 const o={};for(const [k,[min,max]] of Object.entries(RANGES)){const v=input[k]??(k==='capital'?undefined:0);if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`Invalid ${k}`);o[k]=v;}
 const m=input.maxUnitsPerOrder??null;if(m!==null&&!(Number.isInteger(m)&&m>=1&&m<=1e6))throw new Error('Invalid maxUnitsPerOrder');
 const costModel=input.costModel??'broker-tariff';if(!['flat','broker-tariff'].includes(costModel))throw new Error('Invalid costModel');
 const requireMargin=input.requireMargin??true;if(typeof requireMargin!=='boolean')throw new Error('Invalid requireMargin');
 const singleTrade=input.singleTrade??false;if(typeof singleTrade!=='boolean')throw new Error('Invalid singleTrade');
 const signalId=input.signalId??null;if(signalId!==null&&!(typeof signalId==='string'&&/^[a-z0-9-]{1,64}:[A-Z0-9&-]{1,30}:[0-9]{10,14}$/.test(signalId)))throw new Error('Invalid signalId');
 return {...o,maxUnitsPerOrder:m,costModel,requireMargin,singleTrade,...(signalId?{signalId}:{})};
}
const newPaper=now=>({version:SPEC_PAPER_VERSION,createdAt:new Date(now).toISOString(),lastBarTime:null,barsCheckedAt:null,lastCycleAt:null,cycles:0,missedBars:0,eventSeq:0,lastOutcome:null});
export function newPaperState(spec,options,now){return {...createEngineState(spec,options),paper:newPaper(now)};}

// Runs created by spec-paper-v1 keep their flat cost model and are not margin-checked; their in-state
// events (the v1 history) are written to the ledger on the first v2 cycle.
export function upgradeState(state,now){
 if(state.paper?.version===SPEC_PAPER_VERSION)return {state:structuredClone(state),backlog:0};
 const s=structuredClone(state);
 s.version=ENGINE_VERSION;s.options={costModel:'flat',requireMargin:false,...s.options};
 s.orderSeq??=s.orders??0;s.tradeSeq??=s.entries.length;s.blocked??=0;
 s.entries.forEach((e,k)=>{e.tradeId??='T'+(k+1);e.margin??=0;});
 for(const l of s.legs){l.entryTime??=s.entries.at(-1)?.time??null;l.entryCharges??=0;l.exitPrice??=l.open?null:l.mark;l.exitTime??=null;l.exitCharges??=0;}
 s.paper={...newPaper(Date.parse(state.paper?.createdAt)||now),...state.paper,version:SPEC_PAPER_VERSION,barsCheckedAt:null,eventSeq:0};
 s.events.push({time:now,at:now,kind:'RUN_UPGRADED',from:state.paper?.version??null,droppedV1Events:state.paper?.droppedEvents??0});
 return {state:s,backlog:s.events.length};
}
// Daily strategies are re-read at most every 30 minutes; intraday ones once the next bar can have completed.
const barsDue=(spec,state,at)=>{
 const p=state.paper,last=p.lastBarTime,tf=TIMEFRAME_MS[spec.timeframe];
 if(last===null||p.barsCheckedAt===null)return true;
 return spec.timeframe==='1d'?at-p.barsCheckedAt>=1800000:at>=last+2*tf;
};
const errCode=(e,fallback)=>e instanceof MarketDataError?e.code:fallback;

// Live leg quotes for the given contracts. With `withBars`, each quote carries the contract's completed
// 1-minute candles since its last check followed by the live trade price as a final point.
async function legQuotes(market,contracts,at,{withBars=false,since={}}={}){
 const quotes=await market.quotes([...new Set(Object.values(contracts).map(c=>c.instrumentKey))],at),out={},missing=[],barGaps=[];
 for(const [id,c] of Object.entries(contracts)){
  const q=quotes.get(c.instrumentKey);if(!q){missing.push(id);continue;}
  const lq={open:q.price,high:q.price,low:q.price,close:q.price,bid:q.bid,ask:q.ask,depth:q.depth,timestamp:q.timestamp,source:q.source,instrument:c,lotSize:c.lotSize};
  if(withBars){
   let bars=[];try{bars=await market.minuteBars(c.instrumentKey,since[id],at);}catch(e){barGaps.push({leg:id,reason:errCode(e,'MINUTE_BARS_FAILED')});}
   const t=Date.parse(q.timestamp);
   lq.bars=[...bars.filter(b=>b.time+60000<=t||!Number.isFinite(t)).map(b=>({...b,source:'UPSTOX_1M_CANDLE'})),{time:t,open:q.price,high:q.price,low:q.price,close:q.price,source:q.source}];
   lq.checkedTo=bars.length?bars.at(-1).time+60000:since[id];
  }
  out[id]=lq;
 }
 return {quotes:out,missing,barGaps};
}

// Margin the broker would block for the whole entry basket, from its margin calculator.
async function entryMargin(spec,market,contracts,quotes){
 const items=spec.legs.map(l=>({instrumentKey:contracts[l.id]?.instrumentKey,quantity:unitsOf(l,quotes[l.id]?.lotSize),side:l.side,product:spec.mode==='intraday'?'I':'D'}));
 if(items.some(i=>!i.instrumentKey))return {status:'UNAVAILABLE',reason:'CONTRACT_UNRESOLVED'};
 try{return await market.margin(items);}catch(e){return {status:'UNAVAILABLE',reason:errCode(e,'MARGIN_FAILED')};}
}

export async function cycleRun(run,{market,now}){
 const parsed=parseStrategySpec(run.spec);if(!parsed.ok)return {outcome:'INVALID_SPEC',stop:true};
 const spec=parsed.spec,at=now(),{state,backlog}=upgradeState(run.state,at),before=state.events.length-backlog,o=state.options;
 const notes={missed:0,quotesMissing:[],barGaps:[]};let stepped=false;
 const open=()=>Object.fromEntries(state.legs.filter(l=>l.open).map(l=>[l.id,l.instrument]));
 // 1. Monitor the open position.
 if(state.status==='OPEN'){
  const since=Object.fromEntries(state.legs.filter(l=>l.open).map(l=>[l.id,l.checkedTo??l.entryTime]));
  const q=await legQuotes(market,open(),at,{withBars:true,since});
  notes.quotesMissing.push(...q.missing);notes.barGaps.push(...q.barGaps);
  monitorEngine(spec,state,q.quotes,{at});
  for(const l of state.legs)if(q.quotes[l.id]?.checkedTo!==undefined)l.checkedTo=q.quotes[l.id].checkedTo;
  if(q.missing.length)state.events.push({time:at,at,kind:'QUOTE_MISSING',legs:q.missing});
  if(q.barGaps.length)state.events.push({time:at,at,kind:'MINUTE_BARS_UNAVAILABLE',legs:q.barGaps});
 }
 // 2. Decide on a newly completed strategy bar.
 if(barsDue(spec,state,at)){
  const key=await market.underlyingKey(spec),bars=await market.bars(spec,key,at),last=state.paper.lastBarTime;
  state.paper.barsCheckedAt=at;const i=bars.length-1;
  if(i>=0&&(last===null||bars[i].time>last)){
   notes.missed=last===null?0:bars.filter(b=>b.time>last).length-1;
   const q=state.status==='OPEN'?(await legQuotes(market,open(),at)).quotes:{};
   stepEngine(spec,state,computeStrategySeries(spec,bars),i,q,{at});
   Object.assign(state.paper,{lastBarTime:bars[i].time,missedBars:state.paper.missedBars+Math.max(0,notes.missed)});stepped=true;
  }
 }
 // 3. Execute a decision now, at the live book.
 if(state.pending){
  let contracts={};
  if(state.pending.kind==='ENTRY'){
   const key=await market.underlyingKey(spec),unresolved=[];
   for(const leg of spec.legs){try{contracts[leg.id]=await market.resolveLeg(spec,leg,key,at);}catch(e){unresolved.push({leg:leg.id,reason:errCode(e,'CONTRACT_UNAVAILABLE')});}}
   if(unresolved.length)state.events.push({time:at,at,kind:'CONTRACT_UNRESOLVED',legs:unresolved});
  }else contracts=open();
  const q=await legQuotes(market,contracts,at);notes.quotesMissing.push(...q.missing);
  const margin=state.pending.kind==='ENTRY'&&o.requireMargin&&!q.missing.length&&Object.keys(contracts).length===spec.legs.length?await entryMargin(spec,market,contracts,q.quotes):undefined;
  fillPending(spec,state,q.quotes,{at,...(margin?{entryMargin:margin}:{})},at);
  if(margin)state.events.at(-1).marginQuote={status:margin.status,required:margin.required??null,reason:margin.reason??null,source:margin.source??null};
 }
 // A single-trade run (one per signal) finishes after its trade closes, after its entry is rejected, or when
 // its first decision bar passes without an entry (the signal no longer holds).
 let final=null;
 if(o.singleTrade&&state.status!=='OPEN'&&!state.pending){
  if(state.entries.some(e=>e.pnl!==null))final='TRADE_COMPLETED';
  else if(state.events.slice(Math.max(0,before)).some(e=>e.kind==='ENTRY_CANCELLED'))final='ENTRY_REJECTED';
  else if(stepped&&!state.entries.length)final='SIGNAL_EXPIRED';
  if(final)state.events.push({time:at,at,kind:'RUN_STOPPED',reason:final});
 }
 const events=state.events.slice(Math.max(0,before));
 if(!stepped&&!events.length&&state.status!=='OPEN')return {outcome:'IDLE'};
 if(events.length>MAX_CYCLE_EVENTS)throw new Error('Cycle event limit exceeded');
 const outcome=final??(stepped?'STEPPED':state.status==='OPEN'||events.length?'MONITORED':'IDLE');
 Object.assign(state.paper,{lastCycleAt:new Date(at).toISOString(),cycles:state.paper.cycles+1,eventSeq:state.paper.eventSeq+events.length,lastOutcome:outcome});
 if(state.events.length>KEEP_EVENTS)state.events.splice(0,state.events.length-KEEP_EVENTS);
 return {outcome,state,events,final:!!final,...notes};
}

export async function runSpecPaperCycle({store,market,now=Date.now,budgetMs=45000}){
 const started=now();
 let isOpen;try{isOpen=await market.marketOpen();}catch(e){return {status:'MARKET_STATUS_UNAVAILABLE',reason:errCode(e,'MARKET_STATUS_FAILED'),runs:[]};}
 if(!isOpen)return {status:'MARKET_CLOSED',runs:[]};
 const runs=(await (store.active?store.active():store.list())).filter(r=>r.status==='ACTIVE'),results=[];
 for(const run of runs){
  if(now()-started>budgetMs){results.push({id:run.id,outcome:'DEFERRED'});continue;}
  try{
   const r=await cycleRun(run,{market,now});
   if(r.stop){const {state}=upgradeState(run.state,now()),ev={time:now(),at:now(),kind:'RUN_STOPPED',reason:r.outcome};state.events.push(ev);state.paper.lastOutcome=r.outcome;state.paper.eventSeq+=1;await store.commit(run.id,run.version,state,'STOPPED',[ev]);}
   else if(r.state&&!(await store.commit(run.id,run.version,r.state,r.final?'STOPPED':'ACTIVE',r.events))){results.push({id:run.id,outcome:'VERSION_CONFLICT'});continue;}
   results.push({id:run.id,outcome:r.outcome,events:r.events?.length??0,missedBars:r.missed??0,quotesMissing:r.quotesMissing??[],minuteBarGaps:r.barGaps??[]});
  }catch(e){results.push({id:run.id,outcome:'CYCLE_FAILED',reason:errCode(e,'UNEXPECTED_ERROR')});}
 }
 const failed=results.filter(r=>['CYCLE_FAILED','VERSION_CONFLICT'].includes(r.outcome)).length;
 return {status:failed?'PARTIAL':'COMPLETED',startedAt:new Date(started).toISOString(),runs:results};
}

// Stopping closes open legs at their last marks; the run then accepts no further cycles.
export function stopRunState(run,now){
 const parsed=parseStrategySpec(run.spec),{state,backlog}=upgradeState(run.state,now),before=state.events.length-backlog;
 if(parsed.ok)closeAtMarks(parsed.spec,state,now,'RUN_STOPPED');
 state.events.push({time:now,at:now,kind:'RUN_STOPPED',reason:'USER'});
 const events=state.events.slice(Math.max(0,before));
 state.paper.lastOutcome='STOPPED';state.paper.eventSeq+=events.length;
 if(state.events.length>KEEP_EVENTS)state.events.splice(0,state.events.length-KEEP_EVENTS);
 return {state,events};
}

// Closed-trade statistics on net P&L (after charges). Drawdown is on the closed-trade equity curve.
export function tradeStats(trades){
 const pnl=trades.map(t=>t.pnl),wins=pnl.filter(p=>p>0),losses=pnl.filter(p=>p<=0),sum=a=>a.reduce((x,y)=>x+y,0);
 let peak=0,eq=0,dd=0;for(const p of pnl){eq+=p;peak=Math.max(peak,eq);dd=Math.max(dd,peak-eq);}
 return {trades:pnl.length,wins:wins.length,losses:losses.length,winRate:pnl.length?wins.length/pnl.length:null,net:sum(pnl),gross:sum(trades.map(t=>t.gross??t.pnl)),charges:sum(trades.map(t=>t.charges??0)),
  expectancy:pnl.length?sum(pnl)/pnl.length:null,avgWin:wins.length?sum(wins)/wins.length:null,avgLoss:losses.length?sum(losses)/losses.length:null,
  profitFactor:losses.length&&sum(losses)<0?sum(wins)/-sum(losses):null,maxDrawdown:dd,bestTrade:pnl.length?Math.max(...pnl):null,worstTrade:pnl.length?Math.min(...pnl):null};
}
export function summarizeRun(run){
 const s=run.state,closed=s.entries.filter(e=>e.pnl!==null),current=s.status==='OPEN'?s.entries.at(-1):null;
 const parsed=parseStrategySpec(run.spec);
 return {id:run.id,createdAt:run.created_at,updatedAt:run.updated_at,status:run.status,version:run.version,name:run.spec?.name,segment:parsed.ok?segmentOfSpec(parsed.spec):null,underlying:run.spec?.underlying,timeframe:run.spec?.timeframe,mode:run.spec?.mode,options:s.options??run.options,
  position:s.status,pending:s.pending,netPnl:markToMarket(s),realized:s.realized,costs:s.costs,orders:s.orders,trades:closed.length,wins:closed.filter(e=>e.pnl>0).length,
  funds:s.paper?.version===SPEC_PAPER_VERSION?fundsOf(s):null,stats:tradeStats(closed),
  openTrade:current?{tradeId:current.tradeId,time:current.time,margin:current.margin,mae:current.mae,mfe:current.mfe}:null,
  legs:s.legs.map(l=>({id:l.id,dir:l.dir,units:l.units,entry:l.entry,entryTime:l.entryTime??null,mark:l.mark,open:l.open,stop:l.stop,target:l.target,exitPrice:l.exitPrice??null,exitTime:l.exitTime??null,exitReason:l.exitReason??null,contract:l.instrument?.description??null,instrumentKey:l.instrument?.instrumentKey??null})),
  closedTrades:closed.slice(-100).map(e=>({tradeId:e.tradeId??null,time:e.time,exitTime:e.exitTime,reason:e.reason,pnl:e.pnl,gross:e.gross??null,charges:e.charges??null,mae:e.mae,mfe:e.mfe,margin:e.margin??0,legs:e.legs??[]})),
  events:s.events.slice(-100),paper:s.paper};
}
