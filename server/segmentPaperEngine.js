import {segmentPolicy,segmentFees} from '../shared/segmentExecution.js';
import {paperBalance} from './paperFunds.js';
const day=t=>new Date(t+19800000).toISOString().slice(0,10);
const minute=t=>{const d=new Date(t+19800000);return d.getUTCHours()*60+d.getUTCMinutes();};
const active=o=>!['CLOSED','CANCELLED'].includes(o.status);
const round=n=>Math.round(n*100)/100;
export function advanceSegmentPaper(previous,{segment,now,quotes=[],candidates=[],marketOpen=false,acceptEntries=false}){
 const policy=segmentPolicy[segment];if(!policy)throw Error('Unknown segment execution policy');
 const state=structuredClone(previous),events=[],at=new Date(now).toISOString();
 const event=(o,kind,extra={})=>events.push({id:++state.sequence,at,kind,orderId:o?.id||null,...extra});
 const session=marketOpen&&minute(now)>=555&&minute(now)<930;
 const fresh=q=>q&&q.source==='UPSTOX_FULL_QUOTE_V3'&&[q.price,q.bid,q.ask,q.bidSize,q.askSize].every(n=>Number.isFinite(n)&&n>0)&&q.ask>=q.bid&&Number.isFinite(Date.parse(q.timestamp))&&now-Date.parse(q.timestamp)>=0&&now-Date.parse(q.timestamp)<=120000&&day(Date.parse(q.timestamp))===day(now)&&minute(Date.parse(q.timestamp))>=555&&minute(Date.parse(q.timestamp))<930;
 const map=new Map(quotes.filter(fresh).map(q=>[q.symbol,q]));
 const fill=(q,side,remaining,lot)=>({quantity:Math.floor(Math.min(remaining,side==='BUY'?q.askSize:q.bidSize)/lot)*lot,price:round((side==='BUY'?q.ask*1.0005:q.bid*.9995)),model:'OBSERVED_BOOK_WITH_SLIPPAGE'});
 for(const o of state.orders.filter(active)){
  if(o.filled<o.quantity&&(!acceptEntries||now-Date.parse(o.submittedAt)>=120000||day(Date.parse(o.submittedAt))!==day(now)||minute(now)>=915)){
   o.quantity=o.filled;o.status=o.filled?'OPEN':'CANCELLED';event(o,'ENTRY_REMAINDER_CANCELLED',{reason:'Entry expired, paused or session cutoff'});if(!o.filled)continue;
  }
  const q=map.get(o.instrumentKey);if(!session||!q||Date.parse(q.timestamp)<=Date.parse(o.lastQuoteTime||o.submittedAt))continue;
  const prior=Date.parse(o.lastQuoteTime||o.submittedAt),overnight=day(prior)!==day(now);
  // Scheduled overnight closure is not an intraday monitoring outage. Delivery outcomes
  // still exclude corporate-action-unverified evidence via evaluationExcludedReason.
  const gap=overnight?!policy.holdingDays:Date.parse(q.timestamp)-prior>120000;
  if(gap&&!o.monitoringGap){o.monitoringGap=true;event(o,'MONITORING_GAP',{quoteTime:q.timestamp,reason:'Unobserved session interval; no retrospective fill'});}
  o.lastQuoteTime=q.timestamp;o.lastPrice=q.price;
  if(o.expiry&&day(now)>=day(o.expiry)){
   o.evaluationExcludedReason='Expired or expiry-day exposure requires settlement reconciliation';if(!o.settlementBlocked){o.settlementBlocked=true;event(o,'SETTLEMENT_BLOCKED',{reason:o.evaluationExcludedReason});}continue;
  }
  if(o.exitRequestedAt){
   if(Date.parse(q.timestamp)<=Date.parse(o.exitRequestedAt))continue;
   const f=fill(q,o.side==='BUY'?'SELL':'BUY',o.filled-o.exited,o.lotSize);if(!f.quantity)continue;
   o.exitValue+=f.price*f.quantity;o.exited+=f.quantity;event(o,'EXIT_FILL',{...f,quoteTime:q.timestamp,source:q.source,reason:o.exitReason});
   if(o.exited===o.filled){o.exitTime=at;o.exitQuoteTime=q.timestamp;o.exitPrice=round(o.exitValue/o.exited);o.status='CLOSED';o.grossPnl=round((o.exitValue-o.entryValue)*(o.side==='BUY'?1:-1));o.fees=segmentFees(segment,o.entryValue/o.filled,o.exitPrice,o.filled);o.netPnl=round(o.grossPnl-o.fees);state.realized=round(state.realized+o.netPnl);event(o,'CLOSED',{netPnl:o.netPnl,fees:o.fees});}
   continue;
  }
  if(o.filled>o.exited){
   const reason=!policy.holdingDays&&(overnight||minute(now)>=925)?'SESSION_EXIT':now-Date.parse(o.entryTime)>=policy.holdingDays*86400000&&policy.holdingDays?'HOLDING_LIMIT':(o.side==='BUY'?q.bid<=o.stop:q.ask>=o.stop)?'STOP':(o.side==='BUY'?q.bid>=o.target:q.ask<=o.target)?'TARGET':null;
   if(reason){o.exitRequestedAt=at;o.exitReason=reason;o.quantity=o.filled;o.status='EXIT_PENDING';event(o,'EXIT_REQUESTED',{reason,quoteTime:q.timestamp});continue;}
  }
  if(o.filled<o.quantity){
   if(Date.parse(q.timestamp)<=Date.parse(o.submittedAt)||q.spread>.01)continue;
   const f=fill(q,o.side,o.quantity-o.filled,o.lotSize);if(!f.quantity)continue;
   const correct=o.side==='BUY'?o.stop<f.price&&f.price<o.target:o.target<f.price&&f.price<o.stop;
   const allQuantity=o.filled+f.quantity;
   const risk=Math.abs(f.price-o.stop)*allQuantity+segmentFees(segment,f.price,o.stop,allQuantity);
   const balance=paperBalance(state,now),extra=Math.max(0,f.price-o.referencePrice)*o.quantity;
   if(!correct||risk>o.riskBudget||extra>balance.available){o.quantity=o.filled;o.status=o.filled?'OPEN':'CANCELLED';event(o,'ENTRY_REMAINDER_CANCELLED',{reason:'Observed fill exceeds original risk/capital or invalidates levels'});continue;}
   o.entryValue+=f.price*f.quantity;o.filled+=f.quantity;o.entryPrice=round(o.entryValue/o.filled);o.entryTime??=at;o.entryQuoteTime??=q.timestamp;o.status=o.filled===o.quantity?'OPEN':'PARTIAL';event(o,'ENTRY_FILL',{...f,quoteTime:q.timestamp,source:q.source});
  }
 }
 for(const s of candidates){
  const reject=(reason,details={})=>event(null,'ORDER_REJECTED',{signalId:s.signalId,symbol:s.symbol,reason,...details});
  if(state.orders.some(o=>o.signalId===s.signalId||active(o)&&o.instrumentKey===s.instrumentKey))continue;
  if(!acceptEntries){reject('ENTRIES_PAUSED');continue;}
  if(!session||minute(now)>=915){reject('MARKET_CLOSED_OR_ENTRY_CUTOFF');continue;}
  const derivative=!policy.holdingDays,q=map.get(s.instrumentKey);
  if(!fresh(q)||q.spread>.01){reject('FRESH_LIQUID_BOOK_UNAVAILABLE');continue;}
  if(!s.signalId||s.segment!==segment||!['BUY','SELL'].includes(s.side)||s.side==='SELL'&&segment!=='futures'||!Number.isFinite(Date.parse(s.signalTime))||now-Date.parse(s.signalTime)<0||now-Date.parse(s.signalTime)>120000||!Number.isInteger(s.lotSize)||s.lotSize<1){reject('INVALID_SEGMENT_SIGNAL');continue;}
  if(derivative&&(!Number.isFinite(s.expiry)||day(s.expiry)<=day(now)||s.underlyingType!=='INDEX')){reject('CONTRACT_EXPIRY_OR_METADATA_UNVERIFIED');continue;}
  if(!derivative&&s.lotSize!==1){reject('DELIVERY_LOT_INVALID');continue;}
  const balance=paperBalance(state,now),open=state.orders.filter(active);
  if(balance.equity==null){reject('EXPOSURE_VALUATION_UNAVAILABLE');continue;}
  if(open.length>=policy.maxPositions){reject('POSITION_LIMIT');continue;}
  if(state.orders.filter(o=>day(Date.parse(o.submittedAt))===day(now)).length>=3){reject('DAILY_ORDER_LIMIT');continue;}
  if(state.orders.some(o=>o.instrumentKey===s.instrumentKey&&day(Date.parse(o.submittedAt))===day(now))){reject('ALREADY_TRADED_TODAY');continue;}
  const todayNet=state.orders.filter(o=>o.exitTime&&day(Date.parse(o.exitTime))===day(now)).reduce((n,o)=>n+o.netPnl,0);
  if(todayNet+(balance.positionPnl||0)<=-balance.principal*.02){reject('DAILY_LOSS_LIMIT');continue;}
  const reference=(s.side==='BUY'?q.ask*1.0005:q.bid*.9995),direction=s.side==='BUY'?1:-1;
  const stop=round(reference*(1-direction*policy.stopFraction)),target=round(reference*(1+direction*policy.targetFraction));
  const riskBudget=Math.max(0,balance.equity*policy.riskFraction);
  // Full premium for options, full cash for delivery and full notional for futures.
  // No guessed margin or fictitious fractional contract lots.
  const riskPerUnit=Math.abs(reference-stop)+(segmentFees(segment,reference,stop,100000)-40)/100000;
  const quantity=Math.floor(Math.min((riskBudget-40)/riskPerUnit,(Math.min(balance.available*.9,balance.equity*policy.allocationFraction)-40)/reference)/s.lotSize)*s.lotSize;
  if(quantity<s.lotSize){const lotCost=reference*s.lotSize+40,lotRisk=riskPerUnit*s.lotSize+40;reject('INSUFFICIENT_CAPITAL_OR_WHOLE_LOT_RISK',{lotSize:s.lotSize,minimumCapital:Math.ceil(Math.max(lotRisk/policy.riskFraction,lotCost/policy.allocationFraction,lotCost/.9)),note:'Model-specific minimum for one lot before existing reservations; not a profitability guarantee'});continue;}
  const o={...s,id:s.signalId,product:segment,submittedAt:at,referencePrice:reference,riskBudget,stop,target,quantity,requestedQuantity:quantity,orderType:'MARKET',validity:'TTL2',executionMode:'AUTOMATIC',reactionDelaySeconds:0,filled:0,exited:0,entryValue:0,exitValue:0,status:'PENDING',lastPrice:q.price,lastQuoteTime:q.timestamp,monitoringGap:false,costModel:'segment-conservative-allowance-v1',evaluationExcludedReason:policy.holdingDays?'Corporate actions and delivery settlement not reconciled':undefined};
  state.orders.push(o);event(o,'ORDER_SUBMITTED',{quantity,signalTime:s.signalTime,quoteTime:q.timestamp,costModel:o.costModel,capitalModel:'FULL_NOTIONAL_OR_PREMIUM'});
 }
 state.segment=segment;state.lastCycleAt=at;return {state,events};
}
