// Strategy validation: decides, from history, whether a library strategy may emit actionable signals.
// Each strategy runs with its published fixed parameters (nothing is fitted), next-bar execution, slippage and
// the itemised broker tariff. A strategy must be profitable after charges across the whole universe (pooled,
// so one lucky symbol cannot qualify it), in both halves of the history, and on the symbol itself.
// A pass is evidence from the past, not a forecast; the gate exists to stop unproven rules from signalling.
import {runSpecBacktest} from './specBacktest.js';
export const VALIDATION_VERSION='strategy-validation-v1';
export const CRITERIA=Object.freeze({
 pooledMinTrades:100,pooledMinProfitFactor:1.2,pooledMinExpectancyPct:0.05,halvesPositive:true,
 symbolMinTrades:8,symbolMinProfitFactor:1.1,symbolMinExpectancyPct:0,
 notionalPerTrade:100000,slippageBps:5,
});
const sum=a=>a.reduce((x,y)=>x+y,0);
// Statistics on per-trade net returns in percent of entry notional.
export function returnStats(rets){
 const wins=rets.filter(r=>r>0),losses=rets.filter(r=>r<=0),gl=-sum(losses);
 let eq=1,peak=1,dd=0;for(const r of rets){eq*=1+r/100;peak=Math.max(peak,eq);dd=Math.max(dd,1-eq/peak);}
 return {trades:rets.length,winRate:rets.length?wins.length/rets.length:null,expectancyPct:rets.length?sum(rets)/rets.length:null,
  avgWinPct:wins.length?sum(wins)/wins.length:null,avgLossPct:losses.length?sum(losses)/losses.length:null,
  profitFactor:gl>0?sum(wins)/gl:wins.length?Infinity:null,compoundedReturnPct:(eq-1)*100,maxDrawdownPct:dd*100};
}
// Backtests one symbol. Returns per-trade results tagged with the half of the history they fall in.
export function backtestSymbol(spec,bars,{lotSize=null}={}){
 if(bars.length<50)return {status:'INSUFFICIENT_BARS',bars:bars.length};
 const closes=bars.map(b=>b.close).sort((a,b)=>a-b),median=closes[Math.floor(closes.length/2)];
 const units=Math.max(1,Math.round(CRITERIA.notionalPerTrade/median));
 const sized={...spec,legs:spec.legs.map(l=>l.quantity.units!==undefined?{...l,quantity:{units}}:l)};
 const bt=runSpecBacktest(sized,bars,{capital:CRITERIA.notionalPerTrade*10,costModel:'broker-tariff',slippageBps:CRITERIA.slippageBps,lotSize,mcPaths:0});
 if(bt.status!=='OK')return {status:bt.status};
 const mid=bars[0].time+(bars.at(-1).time-bars[0].time)/2;
 const trades=bt.trades.map(t=>{const notional=sum(t.legs.map(l=>l.entryPrice*l.units));return {entryTime:t.entryTime,exitTime:t.exitTime,reason:t.reason,net:t.pnl,charges:t.charges,retPct:notional>0?t.pnl/notional*100:0,half:t.entryTime<mid?1:2};});
 const inMarket=sum(bt.trades.map(t=>t.exitTime-t.entryTime))/(bars.at(-1).time-bars[0].time);
 return {status:'OK',period:{from:bars[0].time,to:bars.at(-1).time,bars:bars.length},units,trades,
  buyHoldPct:(bars.at(-1).close/bars[0].close-1)*100,timeInMarket:Math.min(1,inMarket),stats:returnStats(trades.map(t=>t.retPct))};
}
// Pools every symbol's trades for one strategy and applies the strategy-level gate.
export function poolResults(results){
 const ok=results.filter(r=>r.status==='OK'),all=ok.flatMap(r=>r.trades),by=h=>returnStats(all.filter(t=>t.half===h).map(t=>t.retPct));
 const stats=returnStats(all.map(t=>t.retPct)),first=by(1),second=by(2),c=CRITERIA,reasons=[];
 if(stats.trades<c.pooledMinTrades)reasons.push(`${stats.trades} trades across the universe; at least ${c.pooledMinTrades} required`);
 if(!(stats.profitFactor>=c.pooledMinProfitFactor))reasons.push(`profit factor ${fmt(stats.profitFactor)} after charges; at least ${c.pooledMinProfitFactor} required`);
 if(!(stats.expectancyPct>=c.pooledMinExpectancyPct))reasons.push(`average trade ${fmt(stats.expectancyPct)}% after charges; at least ${c.pooledMinExpectancyPct}% required`);
 if(c.halvesPositive&&!(first.expectancyPct>0&&second.expectancyPct>0))reasons.push(`not profitable in both halves of the history (first ${fmt(first.expectancyPct)}%, second ${fmt(second.expectancyPct)}% per trade)`);
 // Too few trades is missing evidence, not evidence of a loss: such a strategy stays unproven rather than rejected.
 const insufficient=reasons.length===1&&stats.trades<c.pooledMinTrades;
 return {symbols:ok.length,unavailable:results.length-ok.length,stats,halves:{first,second},passed:!reasons.length,insufficient,reasons};
}
// Symbol verdict inside a strategy that passed (or failed) its pooled gate.
export function symbolVerdict(result,pool){
 const c=CRITERIA,reasons=[];
 if(pool.insufficient)return {verdict:'UNPROVEN',reasons:['not enough trades across the universe to judge the strategy',...pool.reasons]};
 if(!pool.passed)return {verdict:'REJECTED',reasons:['the strategy is not profitable after charges across the universe',...pool.reasons]};
 if(result.status!=='OK')return {verdict:'UNPROVEN',reasons:['no usable history: '+result.status]};
 const s=result.stats;
 if(s.trades<c.symbolMinTrades)return {verdict:'UNPROVEN',reasons:[`${s.trades} trades on this symbol; at least ${c.symbolMinTrades} required`]};
 if(!(s.profitFactor>=c.symbolMinProfitFactor))reasons.push(`profit factor ${fmt(s.profitFactor)} on this symbol; at least ${c.symbolMinProfitFactor} required`);
 if(!(s.expectancyPct>c.symbolMinExpectancyPct))reasons.push(`average trade ${fmt(s.expectancyPct)}% on this symbol after charges`);
 return reasons.length?{verdict:'REJECTED',reasons}:{verdict:'VALIDATED',reasons:[]};
}
const fmt=v=>v===null||v===undefined?'n/a':v===Infinity?'∞':v.toFixed(2);
// Compact, serialisable validation record for storage and display (no per-trade arrays).
export function validationRecord(strategy,symbol,result,pool,{computedAt,dataSource,validatedWith=null}){
 const v=symbolVerdict(result,pool);
 return {version:VALIDATION_VERSION,strategyId:strategy.id,segment:strategy.segment,symbol,verdict:v.verdict,reasons:v.reasons,computedAt,dataSource,validatedWith,criteria:CRITERIA,
  onSymbol:result.status==='OK'?{period:result.period,stats:result.stats,buyHoldPct:result.buyHoldPct,timeInMarket:result.timeInMarket,halves:{first:returnStats(result.trades.filter(t=>t.half===1).map(t=>t.retPct)),second:returnStats(result.trades.filter(t=>t.half===2).map(t=>t.retPct))}}:{status:result.status},
  pooled:{symbols:pool.symbols,stats:pool.stats,halves:pool.halves,passed:pool.passed,insufficient:pool.insufficient,reasons:pool.reasons}};
}
