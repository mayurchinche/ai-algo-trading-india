// Pure paper-account accounting. Deposits and withdrawals never move real money.
const round=n=>Math.round(n*100)/100;
export class PaperAccountError extends Error {}
export const fundedCapital=s=>round(s.capital+(s.transfers||[]).reduce((n,t)=>n+(t.kind==='DEPOSIT'?t.amount:-t.amount),0));
export function paperBalance(s,now=Date.now()) {
 const active=s.orders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status));
 const balance=round(fundedCapital(s)+s.realized);
 const reserved=round(active.reduce((n,o)=>n+o.quantity*Math.max(o.referencePrice,o.entryPrice||0)+40,0));
 const stale=active.some(o=>o.filled>o.exited&&(!Number.isFinite(Date.parse(o.lastQuoteTime))||now-Date.parse(o.lastQuoteTime)>120000||Date.parse(o.lastQuoteTime)>now));
 const positionPnl=stale?null:round(active.reduce((n,o)=>{
  if(!o.filled)return n;
  const remaining=o.filled-o.exited,estimatedExit=o.exitValue+o.lastPrice*remaining;
  return n+(estimatedExit-o.entryValue)*(o.side==='BUY'?1:-1)-(40+(o.entryValue+estimatedExit)*.0005);
 },0));
 const equity=positionPnl==null?null:round(balance+positionPnl);
 return {principal:fundedCapital(s),deposits:round((s.transfers||[]).filter(t=>t.kind==='DEPOSIT').reduce((n,t)=>n+t.amount,0)),withdrawals:round((s.transfers||[]).filter(t=>t.kind==='WITHDRAWAL').reduce((n,t)=>n+t.amount,0)),realized:s.realized,balance,reserved,positionPnl,equity,available:equity==null?0:Math.max(0,round(Math.min(balance,equity)-reserved)),valuationStale:stale};
}
export function transferPaperFunds(previous,{id,kind,amount},now=Date.now()) {
 if(typeof id!=='string'||!/^[\w-]{10,80}$/.test(id)||!['DEPOSIT','WITHDRAWAL'].includes(kind)||!Number.isFinite(amount)||amount<=0||amount>100000000||Math.abs(amount*100-Math.round(amount*100))>0.000001)throw new PaperAccountError('Enter a positive paper amount with at most two decimal places (maximum ₹10 crore).');
 amount=round(amount);
 const state=structuredClone(previous);state.transfers??=[];
 const prior=state.transfers.find(t=>t.id===id);
 if(prior){if(prior.kind!==kind||prior.amount!==amount)throw new PaperAccountError('This transaction ID already belongs to a different adjustment.');return {state,events:[]};}
 const before=paperBalance(state,now);
 if(kind==='WITHDRAWAL'&&amount>before.available)throw new PaperAccountError(before.valuationStale?'Withdrawal paused: open-position quotes are stale.':`Insufficient available paper balance. Available: ₹${before.available.toFixed(2)}`);
 const at=new Date(now).toISOString();state.transfers.push({id,kind,amount,at});
 const event={id:++state.sequence,at,kind,amount,transactionId:id,balanceBefore:before.balance,balanceAfter:paperBalance(state,now).balance};
 return {state,events:[event]};
}
export function importLegacyPaper(previous,ledger,now=Date.now()) {
 if(previous.legacyImport)throw new PaperAccountError('Earlier journal has already been reconciled; it cannot be counted twice.');
 if(previous.orders.length||previous.transfers?.length||previous.realized!==0)throw new PaperAccountError('Import earlier history into an unused paper account before new trades or funding. Export both journals for reconciliation if this account already has activity.');
 if(!ledger||!Array.isArray(ledger.trades)||ledger.trades.length>10000||!Number.isFinite(ledger.archivedNet)||Math.abs(ledger.archivedNet)>1e10)throw new PaperAccountError('Invalid earlier paper journal.');
 const state=structuredClone(previous),events=[],at=new Date(now).toISOString(),ids=new Set();state.realized=round(ledger.archivedNet);
 for(const t of ledger.trades){
  const isOpen=t.status==='OPEN';
  if(typeof t.id!=='string'||!t.id||ids.has(t.id)||typeof t.symbol!=='string'||!t.symbol||!['BUY','SELL'].includes(t.side)||!Number.isInteger(t.quantity)||t.quantity<=0||t.quantity>1000000000||!Number.isFinite(t.entryPrice)||t.entryPrice<=0||t.entryPrice*t.quantity>1e10||(!isOpen&&Math.abs(t.netPnl)>1e10)||!Number.isFinite(Date.parse(t.entryTime))||Date.parse(t.entryTime)>now||(!isOpen&&(!Number.isFinite(t.netPnl)||!Number.isFinite(Date.parse(t.exitTime))||Date.parse(t.exitTime)<Date.parse(t.entryTime)||Date.parse(t.exitTime)>now||!Number.isFinite(t.exitPrice)||t.exitPrice<=0)))throw new PaperAccountError('Earlier journal has duplicate, missing or invalid trade data; no balance was changed.');
  if(isOpen&&(![t.stopLoss,t.target].every(v=>Number.isFinite(v)&&v>0)||!(t.side==='BUY'?t.stopLoss<t.entryPrice&&t.entryPrice<t.target:t.target<t.entryPrice&&t.entryPrice<t.stopLoss)))throw new PaperAccountError('An earlier open trade has invalid risk levels; reconcile it before import.');
  ids.add(t.id);const id=`legacy:${t.id}`;
  const order={id,signalId:t.signalId||id,symbol:t.symbol,side:t.side,score:t.score||0,signalTime:t.signalTime,submittedAt:t.entryTime,orderTimeUnknown:true,entryTime:t.entryTime,entryQuoteTime:t.entryQuoteTime,entryPrice:t.entryPrice,entryValue:t.entryPrice*t.quantity,referencePrice:t.entryPrice,quantity:t.quantity,filled:t.quantity,exited:isOpen?0:t.quantity,exitValue:isOpen?0:t.exitPrice*t.quantity,exitPrice:t.exitPrice,exitTime:t.exitTime,exitQuoteTime:t.exitQuoteTime,exitReason:isOpen?undefined:t.status,fees:t.brokerage,netPnl:isOpen?undefined:t.netPnl,stop:t.stopLoss,target:t.target,status:isOpen?'OPEN':'CLOSED',lastPrice:Number.isFinite(t.lastPrice)?t.lastPrice:t.entryPrice,lastQuoteTime:t.lastQuoteTime||t.entryQuoteTime||t.entryTime,monitoringGap:true,legacy:true};
  state.orders.push(order);if(!isOpen)state.realized=round(state.realized+t.netPnl);
  events.push({id:++state.sequence,at,kind:'LEGACY_TRADE_IMPORTED',orderId:id,original:t,note:'Existing simulation imported, not a newly verified exchange fill'});
 }
 state.legacyImport={at,count:ledger.trades.length,archivedCount:ledger.archivedCount||0,archivedNet:ledger.archivedNet};
 events.push({id:++state.sequence,at,kind:'LEGACY_BALANCE_RECONCILED',...state.legacyImport,realized:state.realized,balance:state.capital+state.realized});
 return {state,events};
}
