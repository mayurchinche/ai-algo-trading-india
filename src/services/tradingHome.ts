import type {PaperOrder} from './paperWorkspace';
import type {StrongCandidate} from './strongSignalPolicy';
import {strongSignalRejection} from './strongSignalPolicy';
import {istDate} from './tradingTime';
export function dailyResult(orders:PaperOrder[],now=Date.now()):number|null {
 const closed=orders.filter(o=>o.status==='CLOSED'&&o.exitTime&&Number.isFinite(Date.parse(o.exitTime))&&istDate(o.exitTime)===istDate(now));
 return closed.some(o=>!Number.isFinite(o.netPnl))?null:closed.reduce((sum,o)=>sum+o.netPnl!,0);
}
export function opportunityStatus(stock:StrongCandidate,marketOpen:boolean,enabled:boolean,now=Date.now()) {
 if(!marketOpen)return 'Market unavailable or closed';
 const rejection=strongSignalRejection(stock,now);
 if(rejection)return ({OUTSIDE_SESSION:'Outside trading hours',ENTRY_CUTOFF_1515_IST:'Entry cutoff reached',SCANNER_BLOCKED:'Scanner checks not passed',SCORE_BELOW_70:'Watching',NOT_STRONG_DIRECTION:'Watching',SIGNAL_NOT_FRESH:'Signal expired',QUOTE_NOT_FRESH:'Quote stale or missing',INVALID_RISK_LEVELS:'Risk levels unavailable',INVALID_SCORE:'Score unavailable'} as Record<string,string>)[rejection]||'Unavailable';
 return enabled?'Strong setup · account checks apply':'Strong setup · entries paused';
}
export const rupees=(value?:number|null)=>value==null||!Number.isFinite(value)?'Unavailable':value.toLocaleString('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2});
