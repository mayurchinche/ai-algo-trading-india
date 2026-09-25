import type {PaperOrder} from './paperWorkspace';
const round=(n:number)=>Math.round(n*100)/100;
export function paperEvidence(orders:PaperOrder[]){
 const closed=orders.filter(o=>o.status==='CLOSED');
 const usable=closed.filter(o=>!o.legacy&&!o.monitoringGap&&o.strategy?.id&&Number.isFinite(o.netPnl)&&[o.signalTime,o.submittedAt,o.entryTime,o.exitTime,o.entryQuoteTime,o.exitQuoteTime].every(t=>t&&Number.isFinite(Date.parse(t)))&&Date.parse(o.signalTime!)<=Date.parse(o.submittedAt)&&Date.parse(o.submittedAt)<Date.parse(o.entryQuoteTime!)&&Date.parse(o.entryQuoteTime!)<=Date.parse(o.entryTime!)&&Date.parse(o.entryTime!)<Date.parse(o.exitQuoteTime!)&&Date.parse(o.exitQuoteTime!)<=Date.parse(o.exitTime!));
 const groups=new Map<string,PaperOrder[]>();
 for(const o of usable){const key=`${o.strategy!.id} · ${o.executionMode||'UNRECORDED'} · ${o.reactionDelaySeconds??'unknown'}s · ${o.orderType||'MARKET'}`;groups.set(key,[...(groups.get(key)||[]),o]);}
 return {closed:closed.length,excluded:closed.length-usable.length,groups:[...groups].map(([policy,rows])=>{
  rows.sort((a,b)=>Date.parse(a.exitTime!)-Date.parse(b.exitTime!));
  let cumulative=0,peak=0,drawdown=0;for(const o of rows){cumulative+=o.netPnl!;peak=Math.max(peak,cumulative);drawdown=Math.max(drawdown,peak-cumulative);}
  const gains=rows.reduce((s,o)=>s+Math.max(0,o.netPnl!),0),losses=rows.reduce((s,o)=>s+Math.max(0,-o.netPnl!),0);
  return {policy,trades:rows.length,wins:rows.filter(o=>o.netPnl!>0).length,net:round(cumulative),expectancy:round(cumulative/rows.length),profitFactor:losses?round(gains/losses):null,realizedDrawdown:round(drawdown),firstExit:rows[0].exitTime,lastExit:rows.at(-1)!.exitTime};
 })};
}
