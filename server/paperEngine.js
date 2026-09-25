import { fundedCapital } from './paperFunds.js';
// Deterministic paper execution only. This module never places broker orders.
export const PAPER_VERSION = 'durable-paper-v1';
const day = ms => new Date(new Date(ms).getTime() + 19800000).toISOString().slice(0,10);
const minute = ms => { const d = new Date(new Date(ms).getTime()+19800000); return d.getUTCHours()*60+d.getUTCMinutes(); };
const round = n => Math.round(n*100)/100;
const cost = (entry,exit,qty) => round(40+(entry+exit)*qty*.0005);
export function newPaperAccount() { return {version:PAPER_VERSION,capital:20000,transfers:[],realized:0,sequence:0,orders:[],lastCycleAt:null}; }
export function advancePaper(previous, {now,quotes=[],candidates=[],marketOpen=false,acceptEntries=false}) {
 const state=structuredClone(previous), events=[];
 if(state.version!==PAPER_VERSION || !Number.isFinite(state.realized)) throw new Error('Unsupported or invalid paper account');
 const at=new Date(now).toISOString(), date=day(now);
 const event=(o,kind,extra={})=>events.push({id:++state.sequence,orderId:o?.id||null,at,kind,...extra});
 const valid=q=>q && Number.isFinite(q.price) && q.price>0 && q.source && Number.isFinite(Date.parse(q.timestamp)) && now-Date.parse(q.timestamp)>=0 && now-Date.parse(q.timestamp)<=120000;
 const bySymbol=new Map(quotes.filter(valid).map(q=>[q.symbol,q]));
 const execution=(q,side,remaining)=>{
  const book=Number.isFinite(q.bid)&&Number.isFinite(q.ask)&&q.bid>0&&q.ask>=q.bid;
  const size=side==='BUY'?q.askSize:q.bidSize;
  const qty=book&&Number.isFinite(size)?Math.min(remaining,Math.max(0,Math.floor(size))):remaining;
  return {quantity:qty,price:round((book?(side==='BUY'?q.ask:q.bid):q.price)*(side==='BUY'?1.0005:.9995)),model:book?'TOP_OF_BOOK_WITH_SLIPPAGE':'LTP_ESTIMATE_LIQUIDITY_UNKNOWN'};
 };
 for(const o of state.orders) {
  if(['CLOSED','CANCELLED'].includes(o.status)) continue;
  if(o.filled<o.quantity && ((o.validity!=='DAY'&&now-Date.parse(o.submittedAt)>120000) || !acceptEntries || day(o.submittedAt)!==date || minute(now)>=915)) {
   o.quantity=o.filled; o.status=o.filled?'OPEN':'CANCELLED';
   event(o,'ENTRY_REMAINDER_CANCELLED',{reason:'Expired, paused or entry cutoff'});
   if(!o.filled) continue;
  }
  const q=bySymbol.get(o.symbol);
  if(!q || Date.parse(q.timestamp)<=Date.parse(o.lastQuoteTime||o.submittedAt)) continue;
  // Source time and received/processed time are distinct; never fill from pre-order quotes.
  if(Date.parse(q.timestamp)<=Date.parse(o.modifiedAt||o.submittedAt)) continue;
  const overnight=day(o.submittedAt)!==day(q.timestamp);
  if(Date.parse(q.timestamp)-Date.parse(o.lastQuoteTime||o.submittedAt)>120000 || overnight) {
   if(!o.monitoringGap) event(o,'MONITORING_GAP',{quoteTime:q.timestamp,note:'Earlier crossings and fills are unknown'});
   o.monitoringGap=true;
  }
  o.lastQuoteTime=q.timestamp;o.lastPrice=q.price;
  if(!marketOpen || minute(now)<555 || minute(now)>=930 || minute(q.timestamp)<555 || minute(q.timestamp)>=930) continue;
  if(o.exitRequestedAt) {
   if(Date.parse(q.timestamp)<=Date.parse(o.exitRequestedAt)) continue;
   const f=execution(q,o.side==='BUY'?'SELL':'BUY',o.filled-o.exited);
   if(!f.quantity) continue;
   o.exitValue+=f.price*f.quantity;o.exited+=f.quantity;
   event(o,'EXIT_FILL',{...f,quoteTime:q.timestamp,source:q.source,reason:o.exitReason});
   if(o.exited===o.filled) {
    o.exitTime=at;o.exitQuoteTime=q.timestamp;o.exitPrice=round(o.exitValue/o.exited);o.status='CLOSED';
    o.grossPnl=round((o.exitValue-o.entryValue)*(o.side==='BUY'?1:-1));o.fees=cost(o.entryValue/o.filled,o.exitValue/o.exited,o.filled);o.netPnl=round(o.grossPnl-o.fees);state.realized=round(state.realized+o.netPnl);
    event(o,'CLOSED',{netPnl:o.netPnl,fees:o.fees});
   }
   continue;
  }
  if(o.filled>o.exited) {
   const stop=o.side==='BUY'?q.price<=o.stop:q.price>=o.stop;
   const target=o.side==='BUY'?q.price>=o.target:q.price<=o.target;
   const reason=overnight?'MISSED_SESSION_CLOSE':minute(now)>=925?'EOD':stop?'STOP':target?'TARGET':null;
   if(reason) {o.exitRequestedAt=at;o.exitReason=reason;o.quantity=o.filled;o.status='EXIT_PENDING';event(o,'EXIT_REQUESTED',{reason,quoteTime:q.timestamp});continue;}
  }
  if(o.filled<o.quantity && minute(now)<915 && !overnight) {
   const cancelIoc=()=>{if(o.validity==='IOC'&&o.filled<o.quantity){const quantity=o.quantity-o.filled;o.quantity=o.filled;o.status=o.filled?'OPEN':'CANCELLED';event(o,'ENTRY_REMAINDER_CANCELLED',{quantity,reason:'IOC remainder after first eligible quote'});}};
   if(o.orderType==='STOP'&&!o.entryTriggeredAt){
    if(o.side==='BUY'?q.price>=o.triggerPrice:q.price<=o.triggerPrice){o.entryTriggeredAt=at;event(o,'ENTRY_STOP_TRIGGERED',{quoteTime:q.timestamp,triggerPrice:o.triggerPrice});}
    continue;
   }
   if(o.entryTriggeredAt&&Date.parse(q.timestamp)<=Date.parse(o.entryTriggeredAt))continue;
   const f=execution(q,o.side,o.quantity-o.filled);
   if(o.orderType==='LIMIT'&&(o.side==='BUY'?f.price>o.limitPrice:f.price<o.limitPrice)){cancelIoc();continue;}
   if(!f.quantity){cancelIoc();continue;}
   const allowed=Math.max(o.filled,Math.floor(Math.min(5000/f.price,(o.riskBudget-40)/(Math.abs(f.price-o.stop)+f.price*.001))));
   o.quantity=Math.min(o.quantity,allowed);f.quantity=Math.min(f.quantity,o.quantity-o.filled);
   if(f.quantity<=0){o.status=o.filled?'OPEN':'CANCELLED';event(o,'ENTRY_REMAINDER_CANCELLED',{reason:'Fill exceeds risk budget'});continue;}
   if(!(o.side==='BUY'?o.stop<f.price&&f.price<o.target:o.target<f.price&&f.price<o.stop)) {o.quantity=o.filled;o.status=o.filled?'OPEN':'CANCELLED';event(o,'ENTRY_REMAINDER_CANCELLED',{reason:'Gap invalidated entry risk levels'});continue;}
   o.entryValue+=f.price*f.quantity;o.filled+=f.quantity;o.entryPrice=round(o.entryValue/o.filled);o.entryTime??=at;o.entryQuoteTime??=q.timestamp;o.status=o.filled===o.quantity?'OPEN':'PARTIAL';
   event(o,'ENTRY_FILL',{...f,quoteTime:q.timestamp,source:q.source});cancelIoc();
  }
 }
 const occupied=state.orders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status));
 const equity=fundedCapital(state)+state.realized+occupied.reduce((n,o)=>n+(o.filled?(o.lastPrice-o.entryPrice)*(o.filled-o.exited)*(o.side==='BUY'?1:-1):0),0);
 let reserved=occupied.reduce((n,o)=>n+o.quantity*o.referencePrice+40,0);
 const today=state.orders.filter(o=>day(o.submittedAt)===date);
 const dailyRealized=state.orders.filter(o=>o.exitTime&&day(o.exitTime)===date).reduce((n,o)=>n+o.netPnl,0);
 const openPnl=occupied.reduce((n,o)=>n+(o.filled?((o.lastPrice-o.entryPrice)*(o.filled-o.exited)*(o.side==='BUY'?1:-1)):0),0);
 for(const s of candidates) {
  const reject=reason=>event(null,'ORDER_REJECTED',{signalId:s.signalId,symbol:s.symbol,reason});
  if(s.product&&s.product!=='INTRADAY'){reject('Product lacks a verified execution adapter');continue;}
  if(!['MARKET','LIMIT','STOP'].includes(s.orderType||'MARKET')){reject('Unsupported order type');continue;}
  if(!['TTL2','DAY','IOC'].includes(s.validity||'TTL2')||s.validity==='IOC'&&s.orderType==='STOP'){reject('Unsupported order validity');continue;}
  if(s.quantity!=null&&(!Number.isInteger(s.quantity)||s.quantity<1)){reject('Quantity must be a positive whole number');continue;}
  if(s.orderType==='LIMIT'&&(!Number.isFinite(s.limitPrice)||s.limitPrice<=0)||s.orderType==='STOP'&&(!Number.isFinite(s.triggerPrice)||s.triggerPrice<=0)){reject('Invalid entry price');continue;}
  if(state.orders.some(o=>o.signalId===s.signalId || day(o.submittedAt)===date&&o.symbol===s.symbol)){continue;}
  const q=bySymbol.get(s.symbol);
  if(!acceptEntries){reject('New entries paused');continue;}
  if(!marketOpen||minute(now)<555||minute(now)>=915){reject('Market closed or intraday entry cutoff reached');continue;}
  if(!valid(q)){reject('Fresh source-timestamped quote unavailable');continue;}
  if(today.length>=3){reject('Daily three-order limit reached');continue;}
  if(dailyRealized+openPnl<=-Math.max(0,fundedCapital(state)+state.realized-dailyRealized)*.02){reject('Daily loss limit reached');continue;}
  if(occupied.some(o=>day(o.submittedAt)!==date || o.filled>o.exited&&!bySymbol.has(o.symbol))){reject('Existing exposure has unresolved overnight risk or missing quotes');continue;}
  if(!s.signalId||!['BUY','SELL'].includes(s.side)||!Number.isFinite(s.score)||Math.abs(s.score)<70||Math.abs(s.score)>100||!Number.isFinite(Date.parse(s.signalTime))||now-Date.parse(s.signalTime)<0||now-Date.parse(s.signalTime)>120000){reject('Signal expired, invalid or below the strong threshold');continue;}
  if(![s.stop,s.target].every(n=>Number.isFinite(n)&&n>0) || !(s.side==='BUY'?s.stop<q.price&&q.price<s.target:s.target<q.price&&q.price<s.stop)){reject('Current quote invalidates the signal stop or target');continue;}
  const reference=q.price*(s.side==='BUY'?1.0005:.9995);
  const quantity=Math.floor(Math.min(5000/reference,(equity*.9-reserved-40)/reference,Math.max(0,equity*.005-40)/(Math.abs(reference-s.stop)+reference*.001)));
  if(quantity<1){reject('Insufficient capital or risk allowance');continue;}
  if(s.quantity!=null&&s.quantity>quantity){reject(`Requested quantity exceeds current risk allowance (${quantity})`);continue;}
  const o={id:s.signalId,signalId:s.signalId,symbol:s.symbol,side:s.side,score:s.score,signalTime:s.signalTime,submittedAt:at,referencePrice:reference,riskBudget:equity*.005,stop:s.stop,target:s.target,quantity:s.quantity??quantity,requestedQuantity:s.quantity??quantity,orderType:s.orderType||'MARKET',validity:s.validity||'TTL2',limitPrice:s.limitPrice,triggerPrice:s.triggerPrice,product:'INTRADAY',strategy:s.strategy,executionMode:s.executionMode,reactionDelaySeconds:s.reactionDelaySeconds,approvedAt:s.approvedAt,filled:0,exited:0,entryValue:0,exitValue:0,status:'PENDING',lastPrice:q.price,lastQuoteTime:q.timestamp,monitoringGap:false};
  state.orders.push(o);today.push(o);reserved+=o.quantity*reference+40;event(o,'ORDER_SUBMITTED',{quantity:o.quantity,orderType:o.orderType,signalTime:s.signalTime,quoteTime:q.timestamp});
 }
 state.lastCycleAt=at;
 return {state,events};
}
