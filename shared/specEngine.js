// Spec execution engine: one deterministic state machine for strategy specs, shared by the backtester and
// spec paper runs. Decisions are made on completed bars and filled on the next step; nothing looks ahead.
// State is plain JSON so a paper run can persist it between scheduler cycles. Every executed order and
// closed trade is emitted as an event; paper runs append those events to a permanent ledger.
import {computeStrategySeries,evaluateCondition} from './strategyConditions.js';
import {orderCharges,productOf} from './brokerCharges.js';
export const ENGINE_VERSION='spec-engine-v2';
const IST=19800000;
const istDay=ms=>new Date(ms+IST).toISOString().slice(0,10);
const istMinute=ms=>{const d=new Date(ms+IST);return d.getUTCHours()*60+d.getUTCMinutes();};
const istWeekday=ms=>{const d=new Date(ms+IST).getUTCDay();return d===0?7:d;};
const clock=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
export const TIMEFRAME_MS=Object.freeze({'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'1d':86400000});
const levelPrice=(entry,level,dir)=>level.unit==='percent'?entry*(1+dir*level.value/100):entry+dir*level.value;
const legPnl=(l,mark)=>(mark-l.entry)*l.units*l.dir;
export const unitsOf=(leg,lotSize)=>leg.quantity.units??leg.quantity.lots*(lotSize??1);

// options: {capital, costModel 'flat'|'broker-tariff', costBps and costPerOrder (flat model), slippageBps,
// lotSize, maxUnitsPerOrder, requireMargin}. requireMargin makes entries need a margin quote and enough funds.
export function createEngineState(spec,options){
 if(!(options.capital>0))throw new RangeError('capital must be positive');
 const o={costModel:'flat',costBps:0,costPerOrder:0,slippageBps:0,lotSize:null,maxUnitsPerOrder:null,requireMargin:false,...options};
 if(!['flat','broker-tariff'].includes(o.costModel))throw new RangeError('Unknown cost model');
 return {version:ENGINE_VERSION,status:'FLAT',legs:[],pending:null,realized:0,costs:0,orders:0,orderSeq:0,tradeSeq:0,blocked:0,entries:[],dayEntries:{},lastExit:null,armed:true,ambiguousBars:0,events:[],options:o};
}
// Cash view of the run: capital plus realised P&L, less charges and margin blocked for the open position.
export function fundsOf(state){
 const o=state.options,ledger=o.capital+state.realized-state.costs,open=state.legs.reduce((a,l)=>a+(l.open?legPnl(l,l.mark):0),0);
 return {capital:o.capital,realized:state.realized,charges:state.costs,ledger,blocked:state.blocked,available:ledger-state.blocked,unrealized:open,equity:ledger+open};
}
// Walk the visible book on the side an order takes (asks to buy, bids to sell).
export function walkBook(levels,units){
 let remaining=units,value=0;const used=[];
 for(const lv of levels??[]){if(remaining<=0)break;if(!(lv.price>0&&lv.quantity>0))continue;const q=Math.min(remaining,lv.quantity);used.push({price:lv.price,quantity:q});value+=q*lv.price;remaining-=q;}
 return {filled:units-remaining,remaining,value,used};
}
const sideLevels=(q,side)=>side==='BUY'?q?.depth?.sell:q?.depth?.buy;
function chargesFor(state,product,side,price,units,children){
 const o=state.options;
 if(o.costModel==='flat'){const total=price*units*o.costBps/1e4+o.costPerOrder*children;return {tariff:'flat',items:{flat:total},total};}
 // Each child order is a separate executed order: brokerage caps and flat fees apply per order.
 const base=Math.floor(units/children),extra=units%children,items={};let total=0;
 for(let k=0;k<children;k++){const c=orderCharges(product,side,price*(base+(k<extra?1:0)));total+=c.total;for(const [n,v] of Object.entries(c.items))items[n]=(items[n]||0)+v;}
 return {tariff:orderCharges(product,side,0).tariff,items,total};
}

// Order and position operations bound to one step. `time` is the bar or wall-clock time the step represents.
function ops(spec,state,quotes,ctx,time){
 const o=state.options,at=ctx.at??null;
 const ev=(kind,extra={})=>state.events.push({time,...(at!==null?{at}:{}),kind,...extra});
 const legSpec=id=>spec.legs.find(x=>x.id===id);
 // Executes one order and records it. Market orders walk visible depth when the quote has it; resting
 // SL-M and LIMIT orders fill at the computed price from the bar that triggered them.
 const execute=({leg,instrument,side,units,quote,price,orderType,purpose,trigger})=>{
  const children=o.maxUnitsPerOrder?Math.ceil(units/o.maxUnitsPerOrder):1;
  let px=price,levels=null,beyondVisibleDepth=false;
  const book=orderType==='MARKET'?sideLevels(quote,side):null;
  if(book?.length){const w=walkBook(book,units);levels=w.used;
   if(w.remaining>0){beyondVisibleDepth=true;const worst=w.used.at(-1)?.price??price;w.value+=w.remaining*worst;levels.push({price:worst,quantity:w.remaining,beyondVisibleDepth:true});}
   px=w.value/units;}
  px*=side==='BUY'?1+o.slippageBps/1e4:1-o.slippageBps/1e4;
  const product=productOf(spec,leg),charges=chargesFor(state,product,side,px,units,children);
  state.costs+=charges.total;state.orders+=children;
  ev('ORDER',{orderId:'O'+(++state.orderSeq),leg:leg.id,instrumentKey:instrument?.instrumentKey??null,contract:instrument?.description??null,product,side,orderType,purpose,requestedUnits:units,filledUnits:units,avgPrice:px,levels,beyondVisibleDepth,
   quoteTime:quote?.timestamp??null,source:quote?.source??null,...(trigger?{trigger}:{}),children,charges,status:beyondVisibleDepth?'FILLED_BEYOND_VISIBLE_DEPTH':'FILLED'});
  return {px,charges:charges.total};
 };
 const exitLeg=(l,price,reason,orderType='MARKET',quote=null,trigger=null)=>{
  const {px,charges}=execute({leg:legSpec(l.id),instrument:l.instrument,side:l.dir===1?'SELL':'BUY',units:l.units,quote,price,orderType,purpose:reason,trigger});
  state.realized+=legPnl(l,px);Object.assign(l,{open:false,exitReason:reason,mark:px,exitPrice:px,exitTime:trigger?.at??at??time,exitCharges:charges});state.lastLegExit=reason;
 };
 const bookPrice=(l,q)=>q?((l.dir===1?q.bid:q.ask)??q.open):l.mark;
 const exitQuoted=(reason,priceOf=bookPrice)=>{for(const l of state.legs)if(l.open){const q=quotes?.[l.id];if(!q)ev('EXIT_AT_LAST_MARK',{leg:l.id,mark:l.mark});exitLeg(l,priceOf(l,q),reason,'MARKET',q);}};
 // Resting leg orders, checked bar by bar in time order: an SL-M stop fills at the trigger, or at the open
 // when the bar gaps through it; a LIMIT target fills at the target or the better gap open. When one bar
 // touches both, the stop is assumed first. Trailing stops tighten after each bar, effective from the next.
 const resting=()=>{
  if(state.status!=='OPEN')return;
  for(const l of state.legs){
   if(!l.open)continue;const q=quotes?.[l.id];if(!q)continue;
   const path=q.bars?.length?q.bars:[{time:q.timestamp?Date.parse(q.timestamp):time,open:q.open,high:q.high,low:q.low,close:q.close,ref:l.dir===1?(q.bid??q.open):(q.ask??q.open)}];
   const t=legSpec(l.id).trailingStop,barQuote=b=>({timestamp:new Date(b.time).toISOString(),source:b.source??(q.bars?.length?q.barSource??'MINUTE_CANDLE':q.source??'BAR')});
   for(const b of path){
    const adverse=l.dir===1?b.low:b.high,favour=l.dir===1?b.high:b.low,ref=b.ref??b.open;
    const stopHit=l.stop!==null&&(l.dir===1?adverse<=l.stop:adverse>=l.stop),targetHit=l.target!==null&&(l.dir===1?favour>=l.target:favour<=l.target);
    if(stopHit&&targetHit)state.ambiguousBars++;
    if(stopHit){exitLeg(l,l.dir===1?Math.min(ref,l.stop):Math.max(ref,l.stop),'STOP_LOSS','SL-M',barQuote(b),{price:l.stop,at:b.time});break;}
    if(targetHit){exitLeg(l,l.dir===1?Math.max(ref,l.target):Math.min(ref,l.target),'TARGET','LIMIT',barQuote(b),{price:l.target,at:b.time});break;}
    if(Number.isFinite(b.close))l.mark=b.close;
    if(t){const move=t.unit==='percent'?(favour/l.entry-1)*100*l.dir:(favour-l.entry)*l.dir,steps=Math.floor(move/t.trigger);
     if(steps>l.trailSteps){const delta=(steps-l.trailSteps)*(t.unit==='percent'?l.entry*t.step/100:t.step);l.stop=l.stop+l.dir*delta;l.trailSteps=steps;ev('TRAIL',{leg:l.id,stop:l.stop,barTime:b.time});}}
   }
  }
 };
 // Marks open legs, tracks MAE/MFE and closes the trade record when every leg is out. Returns the trade P&L.
 const markAndFinish=(closeTime)=>{
  if(state.status!=='OPEN')return null;
  const entry=state.entries.at(-1),open=state.legs.filter(l=>l.open);
  for(const l of open){const c=quotes?.[l.id]?.close;if(Number.isFinite(c))l.mark=c;}
  const tradePnl=state.realized-entry.realizedBefore+open.reduce((a,l)=>a+legPnl(l,l.mark),0)-(state.costs-entry.costsBefore);
  entry.mae=Math.min(entry.mae,tradePnl);entry.mfe=Math.max(entry.mfe,tradePnl);
  if(!open.length){finishTrade(state,entry,state.lastLegExit,time,closeTime,istDay(time),ev);return null;}
  return tradePnl;
 };
 const strategyLimit=tradePnl=>{
  const r=spec.risk,amount=a=>a.unit==='amount'?a.value:o.capital*a.value/100;
  if(r?.maxLoss&&tradePnl<=-amount(r.maxLoss))return 'STRATEGY_MAX_LOSS';
  if(r?.target&&tradePnl>=amount(r.target))return 'STRATEGY_TARGET';
  return null;
 };
 return {o,at,ev,legSpec,execute,exitLeg,exitQuoted,bookPrice,resting,markAndFinish,strategyLimit};
}

// Executes a pending entry or exit now, with the given quotes. Multi-leg entries are all-or-nothing and pass
// every pre-trade check first: quotes, square-off time, visible depth, then margin and funds when required.
export function fillPending(spec,state,quotes,ctx={},time=ctx.at){
 const p=state.pending;if(!p)return state;
 const x=ops(spec,state,quotes,ctx,time),{o}=x;state.pending=null;
 if(p.kind==='EXIT'){if(state.status==='OPEN')x.exitQuoted(p.reason);x.markAndFinish(time);return state;}
 const day=istDay(time),sq=spec.mode==='intraday'&&spec.schedule.squareOff?clock(spec.schedule.squareOff):null;
 const plan=spec.legs.map(l=>{const q=quotes?.[l.id];return {l,q,units:q?unitsOf(l,q.lotSize??o.lotSize):null};});
 const reject=(reason,detail={})=>x.ev('ENTRY_CANCELLED',{reason,...detail});
 const thin=plan.filter(v=>v.q?.depth&&walkBook(sideLevels(v.q,v.l.side),v.units).remaining>0);
 const margin=ctx.entryMargin,funds=fundsOf(state);
 if(plan.some(v=>!v.q||!Number.isFinite(v.q.open)))return reject('LEG_QUOTE_MISSING',{legs:plan.filter(v=>!v.q).map(v=>v.l.id)}),state;
 if(sq!==null&&istMinute(x.at??time)>=sq)return reject('AFTER_SQUARE_OFF'),state;
 if(thin.length)return reject('INSUFFICIENT_VISIBLE_DEPTH',{legs:thin.map(v=>({leg:v.l.id,requested:v.units,visible:walkBook(sideLevels(v.q,v.l.side),Infinity).filled}))}),state;
 if(o.requireMargin&&margin?.status!=='OK')return reject('MARGIN_UNAVAILABLE',{detail:margin?.reason??null}),state;
 if(o.requireMargin&&margin.required>funds.available)return reject('INSUFFICIENT_FUNDS',{required:margin.required,available:funds.available}),state;
 state.status='OPEN';const entryIndex=state.entries.length,costsBefore=state.costs,realizedBefore=state.realized;
 state.blocked=o.requireMargin?margin.required:0;
 state.legs=plan.map(({l,q,units})=>{
  const dir=l.side==='BUY'?1:-1,{px,charges}=x.execute({leg:l,instrument:q.instrument,side:l.side,units,quote:q,price:(l.side==='BUY'?q.ask:q.bid)??q.open,orderType:'MARKET',purpose:'ENTRY'});
  return {id:l.id,dir,units,entry:px,entryTime:x.at??time,entryCharges:charges,instrument:q.instrument??null,open:true,stop:l.stopLoss?levelPrice(px,l.stopLoss,-dir):null,target:l.target?levelPrice(px,l.target,dir):null,trailSteps:0,mark:px,exitPrice:null,exitTime:null,exitCharges:0};
 });
 const tradeId='T'+(++state.tradeSeq);
 state.entries.push({index:entryIndex,tradeId,day,time,decidedAt:p.time,exitTime:null,reason:null,pnl:null,mae:0,mfe:0,costsBefore,realizedBefore,margin:state.blocked});
 state.dayEntries[day]=(state.dayEntries[day]||0)+1;x.ev('ENTERED',{tradeId,margin:state.blocked});
 return state;
}

// Rolls an open future leg into a later contract at market, as a trader does before expiry: the expiring
// contract is sold (or bought back) and the same quantity is opened in the new one within the same trade.
// Stop and target keep their distance from price by shifting with the calendar spread actually paid.
export function rollLeg(spec,state,legId,oldQuote,newQuote,ctx){
 const leg=state.legs.find(l=>l.id===legId&&l.open);
 if(state.status!=='OPEN'||!leg||!oldQuote||!newQuote?.instrument)return state;
 const x=ops(spec,state,{[legId]:oldQuote},ctx,ctx.at),side=leg.dir===1?'BUY':'SELL';
 x.exitLeg(leg,x.bookPrice(leg,oldQuote),'ROLL','MARKET',oldQuote);
 const {px,charges}=x.execute({leg:x.legSpec(legId),instrument:newQuote.instrument,side,units:leg.units,quote:newQuote,price:(side==='BUY'?newQuote.ask:newQuote.bid)??newQuote.open,orderType:'MARKET',purpose:'ROLL'});
 const shift=px-leg.exitPrice;
 state.legs.push({id:leg.id,dir:leg.dir,units:leg.units,entry:px,entryTime:ctx.at,entryCharges:charges,instrument:newQuote.instrument,open:true,stop:leg.stop===null?null:leg.stop+shift,target:leg.target===null?null:leg.target+shift,trailSteps:leg.trailSteps,mark:px,exitPrice:null,exitTime:null,exitCharges:0});
 x.ev('ROLLED',{leg:legId,from:leg.instrument?.instrumentKey??null,to:newQuote.instrument.instrumentKey??null,fromContract:leg.instrument?.description??null,toContract:newQuote.instrument.description??null,spread:shift});
 return state;
}

// Continuous monitoring between strategy bars (paper runs call this every scheduler cycle): resting stop and
// target orders over the legs' sub-bars, intraday square-off by wall-clock time and strategy-level P&L limits.
// A strategy limit or square-off is executed immediately at the current book, as a live monitor would.
export function monitorEngine(spec,state,quotes,ctx){
 if(state.status!=='OPEN'||state.pending)return state;
 const time=ctx.at,x=ops(spec,state,quotes,ctx,time),sq=spec.mode==='intraday'&&spec.schedule.squareOff?clock(spec.schedule.squareOff):null;
 if(spec.mode==='intraday'&&state.entries.at(-1)?.day!==istDay(time)){x.exitQuoted('SQUARE_OFF_MISSED_SESSION_END',(l,q)=>q?.open??l.mark);x.markAndFinish(time);return state;}
 x.resting();
 if(state.status==='OPEN'&&sq!==null&&istMinute(time)>=sq)x.exitQuoted('SQUARE_OFF');
 const pnl=x.markAndFinish(time);
 const limit=pnl===null?null:x.strategyLimit(pnl);
 if(limit){x.ev('EXIT_DECIDED',{reason:limit,tradePnl:pnl});x.exitQuoted(limit);x.markAndFinish(time);}
 return state;
}

// One completed bar of the underlying at index i of `series`, plus quotes for legs that are pending or open:
// legId → {open, high, low, close, bid?, ask?, depth?, bars?, timestamp?, source?, instrument?, lotSize?}.
// A pending decision from the previous bar fills first at this bar. `bars` are a leg's own sub-bars since its
// last check (paper runs pass 1-minute candles). ctx: {at (wall-clock ms of the step), entryMargin}.
export function stepEngine(spec,state,series,i,quotes,ctx={}){
 const time=series.price.time[i],tf=TIMEFRAME_MS[spec.timeframe],closeTime=time+tf,day=istDay(time);
 const intraday=spec.mode==='intraday',sq=intraday&&spec.schedule.squareOff?clock(spec.schedule.squareOff):null;
 fillPending(spec,state,quotes,ctx,time);
 const x=ops(spec,state,quotes,ctx,time);
 // Intraday square-off at the first bar at or after the square-off time, or at the next open if that bar was missing.
 if(intraday&&state.status==='OPEN'&&state.entries.at(-1)?.day!==day)x.exitQuoted('SQUARE_OFF_MISSED_SESSION_END',(l,q)=>q?.open??l.mark);
 if(state.status==='OPEN'&&sq!==null&&istMinute(time)>=sq)x.exitQuoted('SQUARE_OFF');
 x.resting();
 // Mark to close, then strategy-level limits and exit conditions decided at this close.
 const tradePnl=x.markAndFinish(closeTime);
 if(state.status==='OPEN'&&!state.pending){
  const entry=state.entries.at(-1),r=spec.risk,limit=x.strategyLimit(tradePnl);
  if(limit)state.pending={kind:'EXIT',reason:limit,time:closeTime};
  else if(r?.maxHoldingDays&&(closeTime-entry.time)/86400000>=r.maxHoldingDays)state.pending={kind:'EXIT',reason:'MAX_HOLDING_DAYS',time:closeTime};
  else if(spec.exit&&evaluateCondition(spec.exit,series,i)===true)state.pending={kind:'EXIT',reason:'EXIT_CONDITION',time:closeTime};
  if(state.pending)x.ev('EXIT_DECIDED',{reason:state.pending.reason,tradePnl});
 }
 // Entry decision. Entries are edge-triggered (the condition must be false or unknown after the last exit);
 // intraday strategies enter once a day unless re-entry allows more after a matching exit.
 if(state.status==='FLAT'&&!state.pending){
  const cond=evaluateCondition(spec.entry,series,i);
  if(cond!==true)state.armed=true;
  else{
   const s=spec.schedule,m=istMinute(closeTime),inWindow=s.weekdays.includes(istWeekday(time))&&(spec.timeframe==='1d'||(m>=clock(s.entryStart)&&m<=clock(s.entryEnd)));
   const re=spec.risk?.reEntry,count=state.dayEntries[day]||0,last=state.lastExit;
   const reEntryOk=re&&last&&last.day===day&&(re.after==='any'||(re.after==='stop-loss'&&last.reason==='STOP_LOSS')||(re.after==='target'&&last.reason==='TARGET'))&&count<=re.maxCount&&closeTime-last.time>=(re.cooldownMinutes??0)*60000;
   const allowed=intraday?(count===0||reEntryOk):(state.armed||reEntryOk);
   if(inWindow&&allowed&&(state.armed||reEntryOk)){state.pending={kind:'ENTRY',time:closeTime};state.armed=false;x.ev('ENTRY_DECIDED');}
  }
 }
 return state;
}
// The closed-trade record: one row per leg with entry and exit price, time and charges, plus totals.
function finishTrade(state,entry,reason,time,closeTime,day,ev){
 const legs=state.legs.map(l=>({leg:l.id,instrumentKey:l.instrument?.instrumentKey??null,contract:l.instrument?.description??null,side:l.dir===1?'BUY':'SELL',units:l.units,entryPrice:l.entry,entryTime:l.entryTime,exitPrice:l.exitPrice,exitTime:l.exitTime,exitReason:l.exitReason,gross:(l.exitPrice-l.entry)*l.units*l.dir,charges:l.entryCharges+l.exitCharges}));
 const gross=legs.reduce((a,l)=>a+l.gross,0),charges=legs.reduce((a,l)=>a+l.charges,0);
 Object.assign(entry,{exitTime:time,reason,pnl:gross-charges,gross,charges,legs});
 state.status='FLAT';state.blocked=0;state.lastExit={time:closeTime,reason,day};
 ev('TRADE_CLOSED',{tradeId:entry.tradeId,reason,entryTime:entry.legs[0]?.entryTime??entry.time,exitTime:Math.max(...legs.map(l=>l.exitTime??0)),legs,gross,charges,net:gross-charges,mae:entry.mae,mfe:entry.mfe,margin:entry.margin});
}
// Net P&L since the run started: realised, minus all costs, plus open legs at their latest mark.
export function markToMarket(state){
 return state.realized-state.costs+state.legs.reduce((a,l)=>a+(l.open?legPnl(l,l.mark):0),0);
}
// Closes every open leg at its last mark (for example when a paper run is stopped) and finalises the trade.
export function closeAtMarks(spec,state,time,reason){
 if(state.status!=='OPEN')return state;
 const entry=state.entries.at(-1),ev=(kind,extra={})=>state.events.push({time,at:time,kind,...extra});
 for(const l of state.legs)if(l.open){
  const leg=spec.legs.find(x=>x.id===l.id),side=l.dir===1?'SELL':'BUY',product=productOf(spec,leg),charges=chargesFor(state,product,side,l.mark,l.units,1);
  state.costs+=charges.total;state.orders++;state.realized+=legPnl(l,l.mark);
  ev('ORDER',{orderId:'O'+(++state.orderSeq),leg:l.id,instrumentKey:l.instrument?.instrumentKey??null,contract:l.instrument?.description??null,product,side,orderType:'MARKET',purpose:reason,requestedUnits:l.units,filledUnits:l.units,avgPrice:l.mark,levels:null,beyondVisibleDepth:false,quoteTime:null,source:'LAST_MARK',children:1,charges,status:'FILLED_AT_LAST_MARK'});
  Object.assign(l,{open:false,exitReason:reason,exitPrice:l.mark,exitTime:time,exitCharges:charges.total});
 }
 state.pending=null;finishTrade(state,entry,reason,time,time,istDay(time),ev);return state;
}
export {computeStrategySeries};
