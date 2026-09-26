// Immutable first-observation records committed atomically with the paper cycle.
export function recordOpportunities(previous,candidates,now,marketOpen){
 const state=structuredClone(previous),events=[];
 state.opportunityIds=Object.fromEntries(Object.entries(state.opportunityIds||{}).filter(([,at])=>now-Date.parse(at)<30*86400000));
 if(!marketOpen)return {state,events};
 for(const c of candidates||[]){
  const signal=Date.parse(c.signalTime),quote=Date.parse(c.signalQuoteTime);
  const cutoff=Date.parse(new Date(now+19800000).toISOString().slice(0,10)+'T09:45:00Z');
  const expires=Math.min(signal+120000,quote+120000,cutoff);
  if(typeof c.signalId!=='string'||state.opportunityIds[c.signalId]||!Number.isFinite(expires)||expires<=now||signal>now||quote>now||!['BUY','SELL'].includes(c.side)||Math.abs(c.score)<70||Math.abs(c.score)>100||!Number.isFinite(c.score)||![c.signalPrice,c.stop,c.target].every(v=>Number.isFinite(v)&&v>0)||(c.side==='BUY'?!(c.stop<c.signalPrice&&c.signalPrice<c.target):!(c.target<c.signalPrice&&c.signalPrice<c.stop)))continue;
  const at=new Date(now).toISOString();state.opportunityIds[c.signalId]=at;
  events.push({id:++state.sequence,kind:'OPPORTUNITY_RECORDED',at,signalId:c.signalId,segment:'intraday',symbol:c.symbol,side:c.side,score:c.score,entry:c.signalPrice,stop:c.stop,target:c.target,generatedAt:c.signalTime,quoteTime:c.signalQuoteTime,expiresAt:new Date(expires).toISOString(),strategy:c.strategy});
 }
 return {state,events};
}

// Current execution state is separate from immutable signal observations.
export function opportunityDecisions(state,signalIds){
 const wanted=new Set(signalIds),intents=new Map((state.intents||[]).filter(i=>wanted.has(i.signalId)).map(i=>[i.signalId,i])),orders=new Map(state.orders.filter(o=>wanted.has(o.signalId)).map(o=>[o.signalId,o]));
 return Object.fromEntries(signalIds.map(id=>{const intent=intents.get(id),order=orders.get(id);
  return [id,{intent:intent?{status:intent.status,reason:intent.reason,dueAt:intent.dueAt,expiresAt:intent.expiresAt}:null,order:order?{id:order.id,status:order.status,economics:order.economics,quantity:order.quantity,requestedQuantity:order.requestedQuantity,filled:order.filled,exited:order.exited,entryPrice:order.entryPrice,exitPrice:order.exitPrice,submittedAt:order.submittedAt,entryTime:order.entryTime,exitTime:order.exitTime,netPnl:order.status==='CLOSED'?order.netPnl:undefined,fees:order.status==='CLOSED'?order.fees:undefined,monitoringGap:order.monitoringGap}:null}];
 }));
}
