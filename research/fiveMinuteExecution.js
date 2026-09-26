import {zerodhaIntradayCosts,sizeWithTariff,costModelId} from './zerodhaCosts.js';
import {paperExecutionFees} from '../server/paperCosts.js';
const round=n=>Math.round(n*100)/100;
// Deliberately separate from quote execution: OHLC does not reveal fill timestamps.
export function simulateFiveMinute({sessions,bars,signals,capital=10000,delaySeconds=60,slippageBps=5,costModel='legacy'}){
 if(!Array.isArray(sessions)||!Array.isArray(bars)||!Array.isArray(signals)||!Number.isFinite(capital)||capital<=0||![0,30,60].includes(delaySeconds)||!Number.isFinite(slippageBps)||slippageBps<0||slippageBps>100)throw new Error('Invalid research configuration');
 if(!['legacy',costModelId].includes(costModel))throw new Error('Unknown cost model');
 const fees=(o,exit,quantity=o.qty)=>costModel==='legacy'?paperExecutionFees(o.entry,exit,quantity):zerodhaIntradayCosts({entry:o.entry,exit,quantity,side:o.side,date:o.date}).total;
 const slip=slippageBps/10000,orders=[],rejections=[],curve=[],seen=new Set();let cash=capital,peak=capital,maxDD=0;
 const byKey=new Map();for(const b of bars){const key=b.symbol+':'+b.start;if(byKey.has(key))throw new Error('Duplicate bar');byKey.set(key,b);}
 const queue=[...signals].sort((a,b)=>a.at-b.at||Math.abs(b.score)-Math.abs(a.score)||a.symbol.localeCompare(b.symbol));
 const mark=(now)=>{
  const active=orders.filter(o=>['OPEN','UNRESOLVED'].includes(o.status));
  if(active.some(o=>o.status==='UNRESOLVED'||o.mark==null)){curve.push({at:now,equity:null});return;}
  const equity=cash+active.reduce((n,o)=>n+(o.mark-o.entry)*o.qty*o.direction-fees(o,o.mark),0);
  peak=Math.max(peak,equity);maxDD=Math.max(maxDD,peak-equity);curve.push({at:now,equity:round(equity)});
 };
 for(const date of sessions){
  const open=Date.parse(date+'T09:15:00+05:30'),close=Date.parse(date+'T15:30:00+05:30'),dayStart=cash;let submitted=0;
  for(let t=open;t<close;t+=300000){
   // Previously generated orders only. A decision published after a boundary cannot fill there.
   while(queue.length&&queue[0].at<t){
    const s=queue.shift(),reject=reason=>rejections.push({id:s.id,at:t,reason});
    if(s.at<open||s.at>=open+360*60000){reject('OUTSIDE_ENTRY_SESSION');continue;}
    if(seen.has(s.id))continue;seen.add(s.id);
    if(orders.some(o=>o.status==='UNRESOLVED')){reject('UNRESOLVED_EXPOSURE');continue;}
    if(submitted>=3){reject('DAILY_ORDER_LIMIT');continue;}
    if(orders.some(o=>o.date===date&&o.symbol===s.symbol)){reject('SYMBOL_ALREADY_TRADED');continue;}
    if(!['BUY','SELL'].includes(s.side)||![s.price,s.stop,s.target,s.score,s.at].every(Number.isFinite)||Math.abs(s.score)<70||Math.abs(s.score)>100){reject('INVALID_SIGNAL');continue;}
    const active=orders.filter(o=>o.status==='OPEN');
    const equity=cash+active.reduce((n,o)=>n+(o.mark-o.entry)*o.qty*o.direction-fees(o,o.mark),0);
    if(equity<=dayStart*.98){reject('DAILY_LOSS_LIMIT');continue;}
    const direction=s.side==='BUY'?1:-1,reference=s.price*(1+direction*slip);
    const reserve=orders.filter(o=>['OPEN','PENDING'].includes(o.status)).reduce((n,o)=>n+o.qty*(o.entry??o.price)+(costModel==='legacy'?40:fees({...o,entry:o.entry??o.price},o.stop)),0);
    const qty=costModel!=='legacy'?sizeWithTariff({entry:reference,stop:s.stop,side:s.side,date,riskBudget:equity*.005,cashBudget:equity*.9-reserve,slippageBps}):Math.floor(Math.min(5000/reference,(equity*.9-reserve-40)/reference,Math.max(0,equity*.005-40)/(Math.abs(reference-s.stop)+reference*.001)));
    if(qty<1){reject('INSUFFICIENT_RISK_BUDGET');continue;}
    orders.push({...s,date,qty,direction,status:'PENDING',due:s.at+delaySeconds*1000,riskBudget:equity*.005,cashBudget:equity*.9-reserve});submitted++;
   }
   for(const o of orders.filter(o=>o.date===date&&['PENDING','OPEN'].includes(o.status))){
    const b=byKey.get(o.symbol+':'+t),valid=b&&[b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&b.low>0&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)&&b.volume>0;
    if(o.status==='PENDING'){
     if(t<=o.due)continue;
     // Five-minute resolution rounds eligibility; record it, don't apply quote TTL as if tick data existed.
     if(t>=open+360*60000||t-o.due>300000){o.status='CANCELLED';o.reason='ENTRY_UNOBSERVABLE_OR_CUTOFF';continue;}
     if(!valid){o.status='CANCELLED';o.reason='MISSING_ENTRY_BAR';continue;}
     const price=round(b.open*(1+o.direction*slip));
     if(!(o.direction===1?o.stop<price&&price<o.target:o.target<price&&price<o.stop)){o.status='CANCELLED';o.reason='GAP_INVALIDATED_LEVELS';continue;}
     o.qty=costModel!=='legacy'?sizeWithTariff({entry:price,stop:o.stop,side:o.side,date,riskBudget:o.riskBudget,cashBudget:o.cashBudget,maxQuantity:o.qty,slippageBps}):Math.min(o.qty,Math.floor(Math.min(5000/price,Math.max(0,o.riskBudget-40)/(Math.abs(price-o.stop)+price*.001))));
     if(o.qty<1){o.status='CANCELLED';o.reason='FILL_EXCEEDS_RISK';continue;}
     o.entry=price;o.entryAt=t;o.roundedDelayMs=t-o.at;o.status='OPEN';o.mark=price;
    }
    if(!valid){o.status='UNRESOLVED';o.reason='MISSING_BAR_WITH_OPEN_EXPOSURE';o.gapAt=t;continue;}
    const stop=o.direction===1?b.low<=o.stop:b.high>=o.stop,target=o.direction===1?b.high>=o.target:b.low<=o.target;
    const gap=o.direction===1?b.open<=o.stop||b.open>=o.target:b.open>=o.stop||b.open<=o.target;
    let price=null,reason=null;
    if(t>=open+370*60000){price=b.open;reason='EOD_MODELLED_OPEN';}
    else if(gap){price=b.open;reason='GAP';}
    else if(stop){price=o.stop;reason='STOP';}
    else if(target){price=o.target;reason='TARGET';}
    o.mark=b.close;
    if(price!==null){o.exit=round(price*(1-o.direction*slip));o.exitBarStart=t;o.exitBarEnd=t+300000;o.ambiguous=!!(stop&&target&&!gap);o.reason=reason;o.netPnl=round((o.exit-o.entry)*o.qty*o.direction-fees(o,o.exit));o.fees=fees(o,o.exit);o.status='CLOSED';cash=round(cash+o.netPnl);}
   }
   mark(t+300000);
  }
  for(const o of orders.filter(o=>o.date===date&&['PENDING','OPEN'].includes(o.status))){o.status=o.status==='OPEN'?'UNRESOLVED':'CANCELLED';o.reason='SESSION_ENDED_WITHOUT_OBSERVED_EXIT';}
 }
 const closed=orders.filter(o=>o.status==='CLOSED'),wins=closed.filter(o=>o.netPnl>0),losses=closed.filter(o=>o.netPnl<0),profit=wins.reduce((n,o)=>n+o.netPnl,0),loss=-losses.reduce((n,o)=>n+o.netPnl,0),unresolved=orders.filter(o=>o.status==='UNRESOLVED').length;
 return {model:'FIVE_MINUTE_OHLC_APPROXIMATION',capital,delaySeconds,slippageBps,costModel,orders,rejections,curve,metrics:{signals:signals.length,submitted:orders.length,closed:closed.length,unresolved,wins:wins.length,losses:losses.length,winRatePct:closed.length?round(wins.length/closed.length*100):null,netClosedPnl:round(cash-capital),expectancy:closed.length?round((cash-capital)/closed.length):null,profitFactor:loss?round(profit/loss):null,fullAccountReturnPct:unresolved?null:round((cash/capital-1)*100),observedDrawdown:round(maxDD),fullDrawdownAvailable:!unresolved}};
}
