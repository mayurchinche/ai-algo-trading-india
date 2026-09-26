import type {PaperOrder} from './paperWorkspace';
export interface OpportunityDecision {intent:{status:string;reason?:string;dueAt?:string;expiresAt?:string}|null;order:Pick<PaperOrder,'economics'|'id'|'status'|'quantity'|'requestedQuantity'|'filled'|'exited'|'entryPrice'|'exitPrice'|'submittedAt'|'entryTime'|'exitTime'|'netPnl'|'fees'|'monitoringGap'>|null}
export type DecisionGroup='review'|'active'|'closed'|'blocked'|'unknown';
export function describeOpportunity(decision:OpportunityDecision|undefined,now:number,feedFresh:boolean){
 const order=decision?.order,intent=decision?.intent;
 if(order){
  if(order.status==='CLOSED')return {group:'closed' as const,label:'Trade closed',reason:'Recorded net result includes execution costs.'};
  if(order.status==='CANCELLED')return {group:'blocked' as const,label:'Order cancelled',reason:'No remaining entry order. See its timeline for the cancellation reason.'};
  const label=order.status==='EXIT_PENDING'?'Exit pending':order.status==='PARTIAL'?'Partially filled':order.status==='OPEN'?'Position open':'Order submitted';
  return {group:'active' as const,label,reason:order.filled>order.exited?`${order.filled-order.exited} units remain open.`:'Waiting for an eligible fill. Submission is not a fill.'};
 }
 if(!intent)return {group:'unknown' as const,label:'Decision not recorded',reason:'A strong score alone does not confirm an accepted paper order.'};
 if(['REJECTED','CANCELLED','EXPIRED'].includes(intent.status))return {group:'blocked' as const,label:intent.status==='REJECTED'?'Trade blocked':intent.status==='EXPIRED'?'Signal expired':'Signal cancelled',reason:intent.reason||'See the paper decision history.'};
 const expiry=Date.parse(intent.expiresAt||'');
 if(Number.isFinite(expiry)&&now>=expiry)return {group:'blocked' as const,label:'Review window expired',reason:'No new approval is available. The backend will reconcile this on the next scan.'};
 if(intent.status==='REVIEW')return {group:'review' as const,label:feedFresh?'Needs your review':'Review pending · feed unavailable',reason:feedFresh?'Review quantity, order type and current risk before approving.':'Wait for fresh market observations before acting.'};
 if(['WAITING','APPROVED'].includes(intent.status))return {group:'review' as const,label:intent.status==='APPROVED'?'Approved · awaiting checks':'Waiting for execution checks',reason:intent.reason||'The next scan checks session, quote freshness, funds and risk limits.'};
 return {group:'unknown' as const,label:'Awaiting order record',reason:intent.reason||'No matching order is present in this account snapshot.'};
}
