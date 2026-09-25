// Presentation of recorded executions only; never fabricates a mark or a trade.
export interface PaperOrder {
 id:string;requestedQuantity?:number;symbol:string;side:string;status:string;quantity:number;filled:number;exited:number;
 submittedAt:string;signalTime?:string;orderTimeUnknown?:boolean;entryTime?:string;exitTime?:string;
 entryQuoteTime?:string;exitQuoteTime?:string;entryPrice?:number;exitPrice?:number;netPnl?:number;
 fees?:number;monitoringGap?:boolean;exitReason?:string;exitRequestedAt?:string;
 lastPrice?:number;lastQuoteTime?:string;entryValue:number;exitValue:number;stop?:number;target?:number;
 legacy?:boolean;product?:string;orderType?:string;validity?:string;modifiedAt?:string;limitPrice?:number;triggerPrice?:number;approvedAt?:string;executionMode?:string;reactionDelaySeconds?:number;strategy?:{id:string;score:number;signal:string;recordedAt:string;reasons?:string[];components?:Record<string,number>;strategies?:string[]};
}
export type PaperView='orders'|'positions'|'closed';
export function inPaperView(o:PaperOrder,view:PaperView){
 if(view==='positions')return o.filled>o.exited&&!['CLOSED','CANCELLED'].includes(o.status);
 if(view==='closed')return ['CLOSED','CANCELLED'].includes(o.status);
 return true;
}
export function orderValuation(o:PaperOrder,now=Date.now()){
 const remaining=Math.max(0,o.filled-o.exited);
 if(o.status==='CLOSED')return {remaining:0,stale:false,gross:o.netPnl==null||o.fees==null?null:o.netPnl+o.fees,net:o.netPnl??null,fees:o.fees??null};
 const age=now-Date.parse(o.lastQuoteTime||'');
 const stale=!Number.isFinite(age)||age<0||age>120000||!Number.isFinite(o.lastPrice)||!(o.lastPrice!>0);
 if(!o.filled||stale)return {remaining,stale,gross:null,net:null,fees:null};
 const exitValue=o.exitValue+o.lastPrice!*remaining;
 const gross=(exitValue-o.entryValue)*(o.side==='BUY'?1:-1);
 const fees=40+(o.entryValue+exitValue)*.0005;
 const round=(n:number)=>Math.round(n*100)/100;
 return {remaining,stale:false,gross:round(gross),net:round(gross-fees),fees:round(fees)};
}
