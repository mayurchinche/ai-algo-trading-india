// Live results next to the backtests that justified them. Pure: the API handler supplies the stored inputs.
// Per-trade returns are net of charges, in % of the entry value, the same definition the validations use
// (shared/strategyValidation.js). A live mean is "in line" while it is within two standard errors of the
// backtest mean; under 20 closed trades no verdict is given, because a few trades cannot tell them apart.
import {STRATEGIES} from '../shared/strategyLibrary.js';
import {SETUPS} from './aggressiveBook.js';
export const ACCURACY_VERSION='accuracy-v1';
export const MIN_TRADES=20;
const r2=v=>v===null||v===undefined||!Number.isFinite(v)?null:Math.round(v*100)/100;
// Expected net % per trade for each aggressive setup, from the studies that chose it (null: no study).
export const SETUP_EXPECTATIONS=Object.freeze({
 'overnight-gap':{netPct:0.15,winRatePct:58,source:'10-year study: +0.15% after futures charges on NIFTY 50 stocks, +0.37% on other futures stocks (docs/OVERNIGHT_GAP_STUDY.md); compared with the lower figure'},
 'discover-momentum':{netPct:-0.34,winRatePct:null,source:'10-year Discover replay: next-day intraday trading on scores 60–69 lost 0.34% after charges'},
 'breakout-early':{netPct:null,winRatePct:null,source:'Not backtested: entering before the close confirms a validated breakout'},
});
// Live statistics of per-trade returns (%), and the verdict against an expected mean.
export function compare(returns,expectedPct){
 const n=returns.length,mean=n?returns.reduce((a,b)=>a+b,0)/n:null;
 const sd=n>1?Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)):null,wins=returns.filter(x=>x>0),losses=returns.filter(x=>x<0);
 const lossSum=-losses.reduce((a,b)=>a+b,0),pf=lossSum>0?wins.reduce((a,b)=>a+b,0)/lossSum:null;
 let verdict='TOO_FEW_TRADES',z=null;
 if(expectedPct===null||expectedPct===undefined)verdict=n>=MIN_TRADES?'NO_BACKTEST':'TOO_FEW_TRADES';
 else if(n>=MIN_TRADES&&sd>0){z=(mean-expectedPct)/(sd/Math.sqrt(n));verdict=z<-2?'BELOW_BACKTEST':z>2?'ABOVE_BACKTEST':'IN_LINE';}
 return {trades:n,winRatePct:n?r2(wins.length/n*100):null,avgPct:r2(mean),profitFactor:r2(pf),standardErrorPct:sd&&n?r2(sd/Math.sqrt(n)):null,z:r2(z),verdict};
}
// A signal paper run's closed trade: net P&L over the entry value of its legs.
export const tradeReturnPct=e=>{const v=(e.legs??[]).reduce((a,l)=>a+(l.entryPrice??0)*(l.units??0),0);return v>0&&Number.isFinite(e.pnl)?e.pnl/v*100:null;};
export function buildAccuracy({validations=[],runs=[],book=null,now}){
 // 1. Validated rules: the pooled backtest of each rule against the closed trades of its signal paper runs.
 const pooled=new Map(),validatedSymbols=new Map();
 // validations: {strategy_id, verdict, computed_at, pooled} rows, pooled being the rule's pooled backtest stats.
 for(const v of validations){if(!pooled.has(v.strategy_id)&&v.pooled)pooled.set(v.strategy_id,{stats:v.pooled,computedAt:v.computed_at});
  if(v.verdict==='VALIDATED')validatedSymbols.set(v.strategy_id,(validatedSymbols.get(v.strategy_id)??0)+1);}
 const byRule=new Map();
 for(const r of runs){const sid=r.options?.signalId;if(!sid)continue;const id=sid.split(':')[0],x=byRule.get(id)??{returns:[],joinedReturns:[],open:0,joinedOpen:0,expired:0,rejected:0,trades:[]},joined=!!r.options?.joined;
  const closed=(r.entries??r.state?.entries??[]).filter(e=>e.pnl!==null&&e.pnl!==undefined);
  for(const e of closed){const p=tradeReturnPct(e);if(p!==null){(joined?x.joinedReturns:x.returns).push(p);x.trades.push({symbol:sid.split(':')[1],joined,exitTime:e.exitTime??null,reason:e.reason??null,netPct:r2(p),net:r2(e.pnl)});}}
  const outcome=(r.paper??r.state?.paper)?.lastOutcome;if(r.status==='ACTIVE'){if(joined)x.joinedOpen++;else x.open++;}else if(outcome==='SIGNAL_EXPIRED')x.expired++;else if(outcome==='ENTRY_REJECTED')x.rejected++;
  byRule.set(id,x);}
 const rules=STRATEGIES.filter(s=>validatedSymbols.has(s.id)||byRule.has(s.id)).map(s=>{const p=pooled.get(s.id),x=byRule.get(s.id)??{returns:[],joinedReturns:[],open:0,joinedOpen:0,expired:0,rejected:0,trades:[]};
  const b=p?.stats;return {id:s.id,name:s.name,segment:s.segment,validatedSymbols:validatedSymbols.get(s.id)??0,
   backtest:b?{trades:b.trades,winRatePct:r2(b.winRate*100),avgPct:r2(b.expectancyPct),profitFactor:r2(b.profitFactor),computedAt:p.computedAt}:null,
   live:compare(x.returns,b?.expectancyPct??null),
   // Bought into a position the rule already held: a different entry from the backtest's, so shown, not judged.
   joined:{...compare(x.joinedReturns,null),open:x.joinedOpen},open:x.open,expiredBeforeEntry:x.expired,entryRejected:x.rejected,recent:x.trades.slice(-5).reverse()};});
 // 2. Aggressive book: each setup's closed trades against the study that chose it, split by policy.
 const closed=book?.closed??[],setups=Object.keys(SETUPS).map(id=>{const t=closed.filter(c=>c.setup===id),e=SETUP_EXPECTATIONS[id]??{netPct:null,winRatePct:null,source:''};
  const policies=[...new Set(t.map(c=>c.policy??'before aggressive-v3'))];
  return {id,label:SETUPS[id].label,expected:e,live:compare(t.map(c=>c.netPct).filter(Number.isFinite),e.netPct),policies,net:r2(t.reduce((a,c)=>a+(c.net??0),0)),open:(book?.positions??[]).filter(p=>p.setup===id).length};});
 return {version:ACCURACY_VERSION,computedAt:new Date(now).toISOString(),minTrades:MIN_TRADES,rules,setups,bookStartedAt:book?.createdAt??null};
}
