import {paperBalance} from './paperFunds.js';
import {advancePaper} from './paperEngine.js';
export const DEFAULT_EXECUTION={mode:'AUTOMATIC',delaySeconds:0};
const live=['WAITING','REVIEW','APPROVED'];
const record=(state,events,now,kind,intent,extra={})=>events.push({id:++state.sequence,at:new Date(now).toISOString(),kind,orderId:null,signalId:intent?.signalId,...extra});
export function configureExecution(previous,settings,now=Date.now()){
 if(!['AUTOMATIC','MANUAL'].includes(settings?.mode)||![0,30,60].includes(settings.delaySeconds))throw new Error('Select manual or automatic execution and a 0, 30 or 60 second delay.');
 const state=structuredClone(previous),events=[];
 state.execution={mode:settings.mode,delaySeconds:settings.delaySeconds};
 // Changing policy must not silently approve existing queued signals.
 for(const i of state.intents||[])if(live.includes(i.status)){i.status='CANCELLED';i.reason='Execution settings changed';record(state,events,now,'SIGNAL_CANCELLED',i,{reason:i.reason});}
 record(state,events,now,'EXECUTION_SETTINGS_CHANGED',null,state.execution);return {state,events};
}
export function reviewIntent(previous,{signalId,orderType='MARKET',quantity,limitPrice,triggerPrice,validity='TTL2',dismiss=false},now=Date.now()){
 const state=structuredClone(previous),events=[];const i=state.intents?.find(i=>i.signalId===signalId);
 if(!i)throw new Error('Signal is no longer available.');
 if(i.status==='APPROVED')throw new Error('This signal is already approved; check Orders.');
 if(!live.includes(i.status))throw new Error('Signal has already been handled.');
 if(dismiss){i.status='CANCELLED';i.reason='Dismissed by user';record(state,events,now,'SIGNAL_CANCELLED',i,{reason:i.reason});return {state,events};}
 if(i.status!=='REVIEW'||now>=Date.parse(i.expiresAt))throw new Error('This signal is not available for review or has expired.');
 if(!['MARKET','LIMIT','STOP'].includes(orderType)||!Number.isInteger(quantity)||quantity<1||quantity>1000000)throw new Error('Enter a valid order type and positive whole quantity.');
 if(orderType==='LIMIT'&&(!Number.isFinite(limitPrice)||limitPrice<=0))throw new Error('Enter a positive limit price.');
 if(orderType==='STOP'&&(!Number.isFinite(triggerPrice)||triggerPrice<=0))throw new Error('Enter a positive stop-entry trigger.');
 if(!['TTL2','DAY','IOC'].includes(validity)||validity==='IOC'&&orderType==='STOP')throw new Error('Choose a supported validity; stop entries do not support IOC.');
 const intended=orderType==='LIMIT'?limitPrice:orderType==='STOP'?triggerPrice:null;
 if(intended!=null&&!(i.side==='BUY'?i.stop<intended&&intended<i.target:i.target<intended&&intended<i.stop))throw new Error('Entry price must remain inside the signal stop and target.');
 i.ticket={orderType,quantity,validity,...(orderType==='LIMIT'?{limitPrice}:{}),...(orderType==='STOP'?{triggerPrice}:{})};
 i.status='APPROVED';i.approvedAt=new Date(now).toISOString();i.dueAt=i.approvedAt;
 record(state,events,now,'SIGNAL_APPROVED',i,{ticket:i.ticket});return {state,events};
}
export function advanceWorkflow(previous,input){
 let state=structuredClone(previous);const events=[],now=input.now;state.intents??=[];
 const settings=state.execution||DEFAULT_EXECUTION;
 for(const candidate of input.candidates||[]){
  if(state.intents.some(i=>i.signalId===candidate.signalId)||state.orders.some(o=>o.signalId===candidate.signalId))continue;
  const signalMs=Date.parse(candidate.signalTime);
  if(!Number.isFinite(signalMs)||signalMs>now||now-signalMs>=120000)continue;
  const i={...candidate,executionMode:settings.mode,reactionDelaySeconds:settings.mode==='MANUAL'?0:settings.delaySeconds,status:settings.mode==='MANUAL'?'REVIEW':'WAITING',observedAt:new Date(now).toISOString(),dueAt:new Date(now+settings.delaySeconds*1000).toISOString(),expiresAt:new Date(signalMs+120000).toISOString()};
  state.intents.push(i);record(state,events,now,'SIGNAL_QUEUED',i,{dueAt:i.dueAt,expiresAt:i.expiresAt,mode:settings.mode});
 }
 const ready=[];
 for(const i of state.intents){
  if(!live.includes(i.status))continue;
  if(now>=Date.parse(i.expiresAt)){i.status='EXPIRED';i.reason='Signal expired before order submission';record(state,events,now,'SIGNAL_EXPIRED',i,{reason:i.reason});continue;}
  if(!input.acceptEntries){i.status='CANCELLED';i.reason='New entries paused';record(state,events,now,'SIGNAL_CANCELLED',i,{reason:i.reason});continue;}
  if(i.status!=='REVIEW'&&now>=Date.parse(i.dueAt))ready.push({...i,...i.ticket});
 }
 const result=advancePaper(state,{...input,candidates:ready});state=result.state;events.push(...result.events);
 for(const s of ready){const i=state.intents.find(i=>i.signalId===s.signalId);const o=state.orders.find(o=>o.signalId===s.signalId);
  i.status=o?'SUBMITTED':'REJECTED';i.reason=o?'Order submitted; waiting for eligible quote':result.events.find(e=>e.signalId===s.signalId&&e.kind==='ORDER_REJECTED')?.reason||'Account, session, quote or signal admission rejected';
  record(state,events,now,o?'SIGNAL_SUBMITTED':'SIGNAL_REJECTED',i,{reason:i.reason});
 }
 return {state,events};
}
export function cancelEntryRemainder(previous,orderId,now=Date.now()){
 const state=structuredClone(previous),events=[];const o=state.orders.find(o=>o.id===orderId);
 if(!o||o.filled>=o.quantity||['CLOSED','CANCELLED','EXIT_PENDING'].includes(o.status))throw new Error('No unfilled entry quantity can be cancelled.');
 const cancelled=o.quantity-o.filled;o.quantity=o.filled;o.status=o.filled?'OPEN':'CANCELLED';
 events.push({id:++state.sequence,at:new Date(now).toISOString(),kind:'ENTRY_REMAINDER_CANCELLED',orderId:o.id,quantity:cancelled,reason:'User cancelled unfilled quantity; existing position preserved'});return {state,events};
}

export function amendPendingEntry(previous,{orderId,quantity,price},now=Date.now()){
 const state=structuredClone(previous),events=[];const o=state.orders.find(o=>o.id===orderId);
 if(!o||o.status!=='PENDING'||o.filled||o.entryTriggeredAt||!['LIMIT','STOP'].includes(o.orderType))throw new Error('Only unfilled, untriggered limit or stop entries can be amended.');
 if(!Number.isInteger(quantity)||quantity<1||quantity>o.quantity)throw new Error('Amendments may retain or reduce the remaining quantity.');
 if(!Number.isFinite(price)||price<=0||!(o.side==='BUY'?o.stop<price&&price<o.target:o.target<price&&price<o.stop))throw new Error('Price must be inside the original stop and target.');
 if(o.validity!=='DAY'&&now-Date.parse(o.submittedAt)>120000)throw new Error('Order has expired; await the next scan.');
 const reference=price*(o.side==='BUY'?1.0005:.9995);
 if(reference*quantity>5000||40+(Math.abs(reference-o.stop)+reference*.001)*quantity>o.riskBudget)throw new Error('Amendment exceeds the original risk allowance.');
 const before={quantity:o.quantity,limitPrice:o.limitPrice,triggerPrice:o.triggerPrice};
 o.quantity=quantity;if(o.orderType==='LIMIT')o.limitPrice=price;else o.triggerPrice=price;
 o.referencePrice=reference;o.modifiedAt=new Date(now).toISOString();
 const balance=paperBalance(state,now);
 if(balance.equity==null||balance.reserved>Math.min(balance.balance,balance.equity)*.9)throw new Error('Amendment exceeds available capital or uses stale position marks.');
 events.push({id:++state.sequence,at:o.modifiedAt,kind:'ORDER_AMENDED',orderId:o.id,before,quantity,price,note:'Original submission and fill history retained'});return {state,events};
}
