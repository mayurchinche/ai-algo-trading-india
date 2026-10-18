// Spec backtester: runs a parsed strategy spec on completed underlying bars through the shared engine.
// Equity legs trade the bars directly; future legs are approximated by the underlying (no basis or roll).
// Option legs need historical option prices, which are not available, so they are rejected explicitly.
import {createEngineState,stepEngine,markToMarket,computeStrategySeries} from './specEngine.js';
import {computeMetrics} from './backtestMetrics.js';
export const BACKTEST_VERSION='spec-backtest-v1';
const paramCount=spec=>spec.indicators.reduce((a,i)=>a+Object.keys(i.params??{}).length,0)+spec.legs.reduce((a,l)=>a+(l.stopLoss?1:0)+(l.target?1:0)+(l.trailingStop?2:0),0);

export function runSpecBacktest(spec,bars,{capital=100000,costModel='flat',costBps=10,costPerOrder=20,slippageBps=5,lotSize=null,maxUnitsPerOrder=null,mcPaths=2000,seed=1}={}){
 const options=spec.legs.filter(l=>l.instrument.type==='option').map(l=>l.id);
 if(options.length)return {status:'UNSUPPORTED_OPTION_LEGS',legs:options,reason:'Historical option prices for expired contracts are not available to this app.'};
 if(spec.legs.some(l=>l.instrument.type==='future')&&!lotSize)return {status:'LOT_SIZE_REQUIRED'};
 if(bars.length<2)return {status:'INSUFFICIENT_BARS'};
 const series=computeStrategySeries(spec,bars),state=createEngineState(spec,{capital,costModel,costBps,costPerOrder,slippageBps,lotSize,maxUnitsPerOrder});
 const curve=[];
 for(let i=0;i<bars.length;i++){
  const b=bars[i],q={open:b.open,high:b.high,low:b.low,close:b.close,instrument:{type:'underlying'}};
  stepEngine(spec,state,series,i,Object.fromEntries(spec.legs.map(l=>[l.id,q])));
  curve.push({time:b.time,equity:capital+markToMarket(state)});
 }
 // Closed trades carry their own gross P&L and charges from the engine's trade record.
 const trades=state.entries.filter(e=>e.pnl!==null).map(e=>({entryTime:e.time,exitTime:e.exitTime,reason:e.reason,pnl:e.pnl,grossPnl:e.gross,charges:e.charges,mae:e.mae,mfe:e.mfe,legs:e.legs}));
 const open=state.entries.find(e=>e.pnl===null)??null;
 return {status:'OK',version:BACKTEST_VERSION,spec:{name:spec.name,timeframe:spec.timeframe},period:{from:bars[0].time,to:bars.at(-1).time,bars:bars.length},
  options:{capital,costModel,costBps,costPerOrder,slippageBps,lotSize,maxUnitsPerOrder},curve,trades,openTrade:open&&{entryTime:open.time},orders:state.orders,ambiguousBars:state.ambiguousBars,
  metrics:computeMetrics({curve,trades,capital,costs:state.costs,paramCount:paramCount(spec),mcPaths,seed}),
  limitations:['Decisions use completed bars and fill at the next bar open with fixed slippage; no order book or liquidity limit.','When a stop and a target are both touched in one bar, the stop is assumed first.','Future legs use the underlying price: no basis, roll or expiry.',costModel==='broker-tariff'?'Charges use the current published Zerodha tariff for every trade, including past years when rates differed.':'Costs are a per-side percentage plus a flat amount per order, not a broker tariff.','Prices are split-adjusted closes from the data source; dividends are excluded.']};
}
