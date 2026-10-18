// Spec execution engine: one deterministic state machine for strategy specs, shared by the backtester and
// spec paper runs. Decisions are made on completed bars and filled on the next step; nothing looks ahead.
// State is plain JSON so a paper run can persist it between scheduler cycles.
import {computeStrategySeries,evaluateCondition} from './strategyConditions.js';
export const ENGINE_VERSION='spec-engine-v1';
const IST=19800000;
const istDay=ms=>new Date(ms+IST).toISOString().slice(0,10);
const istMinute=ms=>{const d=new Date(ms+IST);return d.getUTCHours()*60+d.getUTCMinutes();};
const istWeekday=ms=>{const d=new Date(ms+IST).getUTCDay();return d===0?7:d;};
const clock=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
export const TIMEFRAME_MS=Object.freeze({'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'1d':86400000});
const levelPrice=(entry,level,dir)=>level.unit==='percent'?entry*(1+dir*level.value/100):entry+dir*level.value;

// options: {capital, costBps (per side, on notional), costPerOrder (₹), slippageBps, lotSize, maxUnitsPerOrder}
export function createEngineState(spec,options){
 if(!(options.capital>0))throw new RangeError('capital must be positive');
 return {version:ENGINE_VERSION,status:'FLAT',legs:[],pending:null,realized:0,costs:0,orders:0,entries:[],dayEntries:{},lastExit:null,armed:true,ambiguousBars:0,events:[],
  options:{costBps:0,costPerOrder:0,slippageBps:0,lotSize:null,maxUnitsPerOrder:null,...options}};
}
const unitsOf=(leg,lotSize)=>leg.quantity.units??leg.quantity.lots*(lotSize??1);
function fill(state,leg,side,price,units,time,reason){
 const o=state.options,max=o.maxUnitsPerOrder,children=max?Math.ceil(units/max):1;
 const slip=side==='BUY'?1+o.slippageBps/1e4:1-o.slippageBps/1e4,px=price*slip,notional=px*units;
 const cost=notional*o.costBps/1e4+o.costPerOrder*children;
 state.costs+=cost;state.orders+=children;
 // Tranching: a quantity above maxUnitsPerOrder is recorded as several child orders at the same step.
 state.events.push({time,kind:'FILL',leg:leg.id,side,price:px,units,children,cost,reason});
 return {px,cost};
}
const legPnl=(l,mark)=>(mark-l.entry)*l.units*l.dir;

// One completed bar of the underlying at index i of `series` (from computeStrategySeries), plus quotes for
// legs that are pending or open: legId → {open, high, low, close, bid?, ask?, instrument?, lotSize?}.
export function stepEngine(spec,state,series,i,quotes){
 const time=series.price.time[i],tf=TIMEFRAME_MS[spec.timeframe],closeTime=time+tf,day=istDay(time),o=state.options;
 const intraday=spec.mode==='intraday',sq=intraday&&spec.schedule.squareOff?clock(spec.schedule.squareOff):null;
 const ev=(kind,extra={})=>state.events.push({time,kind,...extra});
 // 1. Fill pending decisions at this bar's open (ask/bid when quoted). Multi-leg entries are all-or-nothing.
 if(state.pending?.kind==='ENTRY'){
  const p=state.pending;state.pending=null;
  if(!spec.legs.every(l=>quotes?.[l.id]&&Number.isFinite(quotes[l.id].open))){ev('ENTRY_CANCELLED',{reason:'LEG_QUOTE_MISSING'});}
  else if(sq!==null&&istMinute(time)>=sq){ev('ENTRY_CANCELLED',{reason:'AFTER_SQUARE_OFF'});}
  else{
   state.status='OPEN';const entryIndex=state.entries.length,costsBefore=state.costs,realizedBefore=state.realized;
   state.legs=spec.legs.map(l=>{
    const q=quotes[l.id],dir=l.side==='BUY'?1:-1,units=unitsOf(l,q.lotSize??o.lotSize);
    const {px}=fill(state,l,l.side,(l.side==='BUY'?q.ask:q.bid)??q.open,units,time,'ENTRY');
    return {id:l.id,dir,units,entry:px,instrument:q.instrument??null,open:true,stop:l.stopLoss?levelPrice(px,l.stopLoss,-dir):null,target:l.target?levelPrice(px,l.target,dir):null,trailSteps:0,mark:px};
   });
   state.entries.push({index:entryIndex,day,time,decidedAt:p.time,exitTime:null,reason:null,pnl:null,mae:0,mfe:0,costsBefore,realizedBefore});
   state.dayEntries[day]=(state.dayEntries[day]||0)+1;ev('ENTERED');
  }
 }
 const exitLeg=(l,price,reason)=>{
  const spec_=spec.legs.find(x=>x.id===l.id),{px}=fill(state,spec_,l.dir===1?'SELL':'BUY',price,l.units,time,reason);
  state.realized+=legPnl(l,px);l.open=false;l.exitReason=reason;l.mark=px;state.lastLegExit=reason;
 };
 const closeAll=(reason,priceOf)=>{for(const l of state.legs)if(l.open)exitLeg(l,priceOf(l),reason);};
 if(state.pending?.kind==='EXIT'&&state.status==='OPEN'){
  const reason=state.pending.reason;state.pending=null;
  closeAll(reason,l=>{const q=quotes?.[l.id];return q?((l.dir===1?q.bid:q.ask)??q.open):l.mark;});
 }
 // 2. Intraday square-off at the first bar at or after the square-off time, or at the next open if that bar was missing.
 const carried=intraday&&state.status==='OPEN'&&state.entries.at(-1)?.day!==day;
 if(carried)closeAll('SQUARE_OFF_MISSED_SESSION_END',l=>quotes?.[l.id]?.open??l.mark);
 if(state.status==='OPEN'&&sq!==null&&istMinute(time)>=sq)closeAll('SQUARE_OFF',l=>{const q=quotes?.[l.id];return q?((l.dir===1?q.bid:q.ask)??q.open):l.mark;});
 // 3. Leg levels within the bar. A gap through a level fills at the open; stop is assumed first when both are touched.
 if(state.status==='OPEN')for(const l of state.legs){
  if(!l.open)continue;const q=quotes?.[l.id];if(!q)continue;
  const adverse=l.dir===1?q.low:q.high,favour=l.dir===1?q.high:q.low;
  const stopHit=l.stop!==null&&(l.dir===1?adverse<=l.stop:adverse>=l.stop),targetHit=l.target!==null&&(l.dir===1?favour>=l.target:favour<=l.target);
  if(stopHit&&targetHit)state.ambiguousBars++;
  if(stopHit){exitLeg(l,l.dir===1?Math.min(q.open,l.stop):Math.max(q.open,l.stop),'STOP_LOSS');continue;}
  if(targetHit){exitLeg(l,l.dir===1?Math.max(q.open,l.target):Math.min(q.open,l.target),'TARGET');continue;}
  // Trailing stop: for every `trigger` of favourable move from entry, tighten the stop by `step`; applies from the next bar.
  const t=spec.legs.find(x=>x.id===l.id).trailingStop;
  if(t){const move=t.unit==='percent'?(favour/l.entry-1)*100*l.dir:(favour-l.entry)*l.dir,steps=Math.floor(move/t.trigger);
   if(steps>l.trailSteps){const delta=(steps-l.trailSteps)*(t.unit==='percent'?l.entry*t.step/100:t.step);l.stop=l.stop+l.dir*delta;l.trailSteps=steps;ev('TRAIL',{leg:l.id,stop:l.stop});}}
 }
 // 4. Mark to close, track MAE/MFE, then strategy-level limits and exit conditions decided at this close.
 const entry=state.entries.at(-1);
 if(state.status==='OPEN'){
  const open=state.legs.filter(l=>l.open);
  for(const l of open){const c=quotes?.[l.id]?.close;if(Number.isFinite(c))l.mark=c;}
  // Trade P&L includes its own entry and exit costs.
  const tradePnl=state.realized-entry.realizedBefore+open.reduce((a,l)=>a+legPnl(l,l.mark),0)-(state.costs-entry.costsBefore);
  entry.mae=Math.min(entry.mae,tradePnl);entry.mfe=Math.max(entry.mfe,tradePnl);
  if(!open.length){state.status='FLAT';entry.exitTime=time;entry.reason=state.lastLegExit;entry.pnl=tradePnl;state.lastExit={time:closeTime,reason:entry.reason,day};ev('EXITED',{reason:entry.reason,pnl:tradePnl});}
  if(state.status==='OPEN'&&!state.pending){
   const r=spec.risk,amount=a=>a.unit==='amount'?a.value:o.capital*a.value/100;
   const days=(closeTime-entry.time)/86400000;
   if(r?.maxLoss&&tradePnl<=-amount(r.maxLoss))state.pending={kind:'EXIT',reason:'STRATEGY_MAX_LOSS',time:closeTime};
   else if(r?.target&&tradePnl>=amount(r.target))state.pending={kind:'EXIT',reason:'STRATEGY_TARGET',time:closeTime};
   else if(r?.maxHoldingDays&&days>=r.maxHoldingDays)state.pending={kind:'EXIT',reason:'MAX_HOLDING_DAYS',time:closeTime};
   else if(spec.exit&&evaluateCondition(spec.exit,series,i)===true)state.pending={kind:'EXIT',reason:'EXIT_CONDITION',time:closeTime};
  }
 }
 // 5. Entry decision. Entries are edge-triggered (the condition must be false or unknown after the last exit);
 // intraday strategies enter once a day unless re-entry allows more after a matching exit.
 const cond=state.status==='FLAT'&&!state.pending?evaluateCondition(spec.entry,series,i):null;
 if(state.status==='FLAT'&&!state.pending){
  if(cond!==true)state.armed=true;
  else{
   const s=spec.schedule,m=istMinute(closeTime),inWindow=s.weekdays.includes(istWeekday(time))&&(spec.timeframe==='1d'||(m>=clock(s.entryStart)&&m<=clock(s.entryEnd)));
   const re=spec.risk?.reEntry,count=state.dayEntries[day]||0,last=state.lastExit;
   const reEntryOk=re&&last&&last.day===day&&(re.after==='any'||(re.after==='stop-loss'&&last.reason==='STOP_LOSS')||(re.after==='target'&&last.reason==='TARGET'))&&count<=re.maxCount&&closeTime-last.time>=(re.cooldownMinutes??0)*60000;
   const allowed=intraday?(count===0||reEntryOk):(state.armed||reEntryOk);
   if(inWindow&&allowed&&(state.armed||reEntryOk)){state.pending={kind:'ENTRY',time:closeTime};state.armed=false;ev('ENTRY_DECIDED');}
  }
 }
 return state;
}
// Net P&L since the run started: realised, minus all costs, plus open legs at their latest mark.
export function markToMarket(state){
 return state.realized-state.costs+state.legs.reduce((a,l)=>a+(l.open?legPnl(l,l.mark):0),0);
}
export {computeStrategySeries};
