// Read-only, closed-trade statistics. Never substitutes estimates for ledger P&L.
const round = n => Math.round(n * 100) / 100;
function metrics(orders) {
 const n=orders.length,wins=orders.filter(o=>o.netPnl>0),losses=orders.filter(o=>o.netPnl<0);
 const profit=wins.reduce((s,o)=>s+o.netPnl,0),loss=-losses.reduce((s,o)=>s+o.netPnl,0);
 let cumulative=0,peak=0,drawdown=0;
 for(const o of [...orders].sort((a,b)=>Date.parse(a.exitTime)-Date.parse(b.exitTime)||a.id.localeCompare(b.id))){cumulative+=o.netPnl;peak=Math.max(peak,cumulative);drawdown=Math.max(drawdown,peak-cumulative);}
 // Wilson interval describes the observed win proportion, not future profitability.
 const p=n?wins.length/n:0,z=1.959963984540054,den=1+z*z/(n||1);
 const center=(p+z*z/(2*(n||1)))/den,margin=z*Math.sqrt((p*(1-p)+z*z/(4*(n||1)))/(n||1))/den;
 return {closedTrades:n,wins:wins.length,losses:losses.length,breakeven:n-wins.length-losses.length,
  netPnl:n?round(profit-loss):null,winRatePct:n?round(100*p):null,
  winRateInterval95Pct:n?[round(100*(center-margin)),round(100*(center+margin))]:null,
  expectancy:n?round((profit-loss)/n):null,profitFactor:loss>0?round(profit/loss):null,
  profitFactorUnavailableReason:loss>0?null:n?'No net losing trades':'No eligible closed trades',
  closedTradeDrawdown:n?round(drawdown):null};
}
export function evaluatePaperPerformance(state){
 if(!state||!Array.isArray(state.orders)||!Number.isFinite(state.realized))throw new Error('Invalid ledger snapshot');
 const ids=new Set();for(const o of state.orders){if(!o.id||ids.has(o.id))throw new Error('Missing or duplicate order ID');ids.add(o.id);}
 const closed=state.orders.filter(o=>o.status==='CLOSED'),excluded=[];
 const eligible=closed.filter(o=>{
  let reason=null;
  const times=[o.signalTime,o.submittedAt,o.entryQuoteTime,o.entryTime,o.exitQuoteTime,o.exitTime].map(Date.parse);
  if(o.monitoringGap!==false)reason='Monitoring continuity not verified';
  else if(!Number.isFinite(o.netPnl)||!Number.isFinite(o.fees)||o.fees<0||!Number.isFinite(o.grossPnl)||Math.abs(o.grossPnl-o.fees-o.netPnl)>.011)reason='Missing or inconsistent net ledger result';
  else if(!Number.isInteger(o.filled)||o.filled<=0||o.exited!==o.filled)reason='Incomplete fills';
  else if(times.some(t=>!Number.isFinite(t))||times.some((t,i)=>i>0&&t<times[i-1])||times[2]<=times[1]||times[4]<=times[2])reason='Missing or inconsistent execution timestamps';
  if(reason){excluded.push({orderId:o.id,reason});return false;}return true;
 });
 const cohorts={};for(const o of eligible){const policy=o.signalId?.match(/:(strong-equity-observed-v\d+)$/)?.[1]||'unversioned';(cohorts[policy]??=[]).push(o);}
 const retainedNet=closed.every(o=>Number.isFinite(o.netPnl))?round(closed.reduce((s,o)=>s+o.netPnl,0)):null;
 return {kind:'recorded-paper-executions',ledgerRealized:state.realized,retainedClosedNet:retainedNet,
  realizedOutsideRetainedOrders:retainedNet===null?null:round(state.realized-retainedNet),
  totalOrders:state.orders.length,closedOrders:closed.length,openOrPending:state.orders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status)).length,
  excluded,qualified:metrics(eligible),byPolicy:Object.fromEntries(Object.entries(cohorts).map(([k,v])=>[k,metrics(v)])),
  limitations:['Retained orders only; archived or imported P&L is not reconstructed as trades.',
   'Closed-trade drawdown excludes unrealized losses; it is not full account equity drawdown.',
   'Paper fills and charges are simulator estimates, not broker executions.',
   'The win-rate interval assumes independent outcomes; correlated trades reduce its usefulness.',
   'No measured win rate is a probability of future profitability.']};
}
