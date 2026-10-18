// Replay of trend-score-v1 signals on completed daily bars. Signals are known at a bar's close and
// filled at the next bar's open, so no bar contributes to a decision before it is complete.
import {computeTrendScore,TREND_MODEL} from '../shared/trendScore.js';

export const TREND_REPLAY_PROTOCOL=Object.freeze({
 id:'trend-score-v1-replay-v1',model:TREND_MODEL.id,
 execution:'Enter at the next session open after a BUY close; exit at the next session open after a SELL close. A trade still open at the end is marked at the last close and reported separately.',
 costBpsRoundTrip:25,costModel:'Assumed 25 bps per delivery round trip (STT, stamp, exchange, GST, DP). Not a dated broker tariff.',
 forwardSessions:20,
 // Fixed before the first run; parameters and thresholds are not tuned on the results.
 criteria:{minClosedTrades:100,minMeanNetTradeT:2,forwardExcessPositiveInBothHalves:true},
});
const mean=v=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
const median=v=>{if(!v.length)return null;const s=[...v].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const tStat=v=>{if(v.length<2)return null;const m=mean(v),sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/(v.length-1));return sd>0?m/(sd/Math.sqrt(v.length)):null;};

export function replayTrendSymbol(symbol,bars,protocol=TREND_REPLAY_PROTOCOL){
 const trend=computeTrendScore({dates:bars.map(b=>b.date),close:bars.map(b=>b.close),high:bars.map(b=>b.high),low:bars.map(b=>b.low)});
 const cost=protocol.costBpsRoundTrip/1e4,n=bars.length,trades=[];let open=null;
 for(const s of trend.signals){
  if(s.index+1>=n)continue;// no next open to fill at
  if(s.type==='BUY'&&!open)open={entryDate:bars[s.index+1].date,entryIndex:s.index+1,entry:bars[s.index+1].open,signalDate:s.date};
  else if(s.type==='SELL'&&open){const exit=bars[s.index+1].open,gross=exit/open.entry-1;trades.push({...open,exitDate:bars[s.index+1].date,exitIndex:s.index+1,exit,gross,net:gross-cost,status:'CLOSED'});open=null;}
 }
 const openTrade=open?{...open,exitDate:bars[n-1].date,exit:bars[n-1].close,gross:bars[n-1].close/open.entry-1,status:'OPEN_MARKED_AT_LAST_CLOSE'}:null;
 // Equity: in a trade, value follows closes from the entry open; outside a trade it is flat.
 const first=trend.score.findIndex(s=>s!==null);
 let equity=1,peak=1,maxDrawdown=0,inMarket=0,sessions=0;
 const entries=new Map([...trades,...(openTrade?[openTrade]:[])].map(t=>[t.entryIndex,t])),exits=new Map(trades.map(t=>[t.exitIndex,t]));
 let holding=null,mark=null;
 for(let i=Math.max(first+1,1);first>=0&&i<n;i++){
  sessions++;
  if(holding&&exits.get(i)===holding){equity*=holding.exit/mark*(1-cost);holding=null;}
  if(!holding&&entries.has(i)){holding=entries.get(i);mark=holding.entry;}
  if(holding){equity*=bars[i].close/mark;mark=bars[i].close;inMarket++;}
  peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,1-equity/peak);
 }
 // Event study: forward close-to-close return after BUY closes versus every scored session.
 const h=protocol.forwardSessions,forward=i=>i+h<n?bars[i+h].close/bars[i].close-1:null;
 const half=first>=0?bars[Math.floor((first+n)/2)].date:null;
 const events={first:[],second:[]},baseline={first:[],second:[]};
 for(let i=Math.max(first,0);first>=0&&i<n;i++){const f=forward(i);if(f===null)continue;const k=bars[i].date<half?'first':'second';baseline[k].push(f);}
 for(const s of trend.signals.filter(s=>s.type==='BUY')){const f=forward(s.index);if(f!==null)events[s.date<half?'first':'second'].push(f);}
 const startIndex=first>=0?Math.min(first+1,n-1):null;
 let holdPeak=0,holdDrawdown=0;for(let i=startIndex??n;i<n;i++){holdPeak=Math.max(holdPeak,bars[i].close);holdDrawdown=Math.max(holdDrawdown,1-bars[i].close/holdPeak);}
 return {symbol,bars:n,firstScoredDate:first>=0?bars[first].date:null,lastDate:bars[n-1]?.date??null,splitDate:half,
  signals:trend.signals.length,trades,openTrade,
  strategy:{netReturn:equity-1,maxDrawdown,exposure:sessions?inMarket/sessions:null},
  buyAndHold:startIndex===null?null:{return:bars[n-1].close/bars[startIndex].open-1,maxDrawdown:holdDrawdown,from:bars[startIndex].date},
  forward:{events,baseline}};
}

export function summarizeTrendReplay(results,protocol=TREND_REPLAY_PROTOCOL){
 const closed=results.flatMap(r=>r.trades),net=closed.map(t=>t.net),gross=closed.map(t=>t.gross);
 const halves=['first','second'].map(k=>{
  const ev=results.flatMap(r=>r.forward.events[k]),base=results.flatMap(r=>r.forward.baseline[k]);
  return {half:k,events:ev.length,meanForwardAfterBuy:mean(ev),meanForwardAll:mean(base),excess:ev.length&&base.length?mean(ev)-mean(base):null};
 });
 const vsHold=results.filter(r=>r.buyAndHold).map(r=>r.strategy.netReturn-r.buyAndHold.return);
 const trades={closed:closed.length,open:results.filter(r=>r.openTrade).length,winRate:closed.length?closed.filter(t=>t.net>0).length/closed.length:null,meanGross:mean(gross),meanNet:mean(net),medianNet:median(net),meanNetT:tStat(net),meanSessionsHeld:mean(closed.map(t=>t.exitIndex-t.entryIndex))};
 const c=protocol.criteria,checks={
  enoughTrades:trades.closed>=c.minClosedTrades,
  positiveNetEdge:trades.meanNet!==null&&trades.meanNet>0&&trades.meanNetT!==null&&trades.meanNetT>=c.minMeanNetTradeT,
  forwardExcessBothHalves:halves.every(h=>h.excess!==null&&h.excess>0),
 };
 return {protocol:protocol.id,symbols:results.length,trades,forwardStudy:halves,
  strategyVersusBuyAndHold:{symbols:vsHold.length,beatBuyAndHold:vsHold.filter(d=>d>0).length,medianDifference:median(vsHold)},
  medianExposure:median(results.map(r=>r.strategy.exposure).filter(v=>v!==null)),medianMaxDrawdown:{strategy:median(results.map(r=>r.strategy.maxDrawdown)),buyAndHold:median(results.filter(r=>r.buyAndHold).map(r=>r.buyAndHold.maxDrawdown))},
  checks,status:Object.values(checks).every(Boolean)?'PASSED_PRE_DECLARED_CRITERIA':'NOT_VALIDATED',
  limitations:['Current index constituents applied to past years (survivorship bias).','Split-adjusted Yahoo prices without dividends; buy-and-hold excludes dividend income.','Overlapping forward windows and correlated stocks make t-statistics optimistic.','Assumed flat round-trip cost; no slippage, gaps beyond the next open, or liquidity limits.']};
}
