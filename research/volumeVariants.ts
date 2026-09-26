import {validateBars, type ResearchBar} from './asOfMarket';
import {istDate} from '../src/services/tradingTime';
import {scoreStrategies} from '../src/services/discoveryScoring';
import type {DiscoveredStock} from '../src/services/stockDiscovery';
export {createAsOfMarket} from './asOfMarket';

// Research only. Daily liquidity remains independent of this intraday denominator.
export function createSameTimeVolume(input: ResearchBar[]) {
 validateBars(input);
 const bars = input.filter(b=>b.interval==='5minute').map(b=>({...b}));
 return (symbol: string, now: number) => {
  if(!Number.isFinite(now))throw new Error('Invalid clock');
  const today=istDate(now), open=Date.parse(today+'T09:15:00+05:30');
  const cutoff=Math.floor((now-open)/300000)*300000;
  if(cutoff<300000||cutoff>22500000)return {status:'OUTSIDE_SESSION' as const};
  const groups=new Map<string,ResearchBar[]>();
  for(const b of bars){
   const date=istDate(b.start),sessionOpen=Date.parse(date+'T09:15:00+05:30');
   if(b.symbol!==symbol||date>today||b.end>now||b.availableAt>now||b.start<sessionOpen||b.end>sessionOpen+cutoff)continue;
   const group=groups.get(date)??[];group.push(b);groups.set(date,group);
  }
  const complete=(date:string,rows:ResearchBar[])=>rows.length===cutoff/300000&&rows.every((b,i)=>b.start===Date.parse(date+'T09:15:00+05:30')+i*300000);
  const current=groups.get(today)??[];
  if(!complete(today,current))return {status:'INCOMPLETE_CURRENT_PREFIX' as const};
  const previous=[...groups].filter(([date,rows])=>date<today&&complete(date,rows)).sort(([a],[b])=>b.localeCompare(a)).slice(0,20);
  if(previous.length<20)return {status:'INSUFFICIENT_PRIOR_PREFIXES' as const,count:previous.length};
  const volumes=previous.map(([,rows])=>rows.reduce((n,b)=>n+b.volume,0)).sort((a,b)=>a-b);
  const median=(volumes[9]+volumes[10])/2;
  if(median<=0)return {status:'ZERO_BASELINE' as const};
  const volume=current.reduce((n,b)=>n+b.volume,0);
  return {status:'READY' as const,ratio:volume/median,median,volume,dates:previous.map(([date])=>date)};
 };
}
export const variantNames=['same-time-composite','trend-momentum','mean-reversion'] as const;
export function researchDecision(stock:DiscoveredStock,ratio:number,variant:typeof variantNames[number]){
 if(!Number.isFinite(ratio)||ratio<0)throw new Error('Invalid volume ratio');
 const volumeScores=scoreStrategies(stock.ltp,50,stock.macd,stock.sma20,stock.sma50,stock.sma200,ratio,.5,stock.weekHigh52,stock.weekLow52,0);
 const scores={...stock.scores,breakout:volumeScores.breakout,smartMoney:volumeScores.smartMoney};
 let score=0,qualifies=false;
 if(variant==='same-time-composite'){
  score=Math.round(scores.momentum*.25+scores.meanReversion*.15+scores.breakout*.25+scores.trendFollowing*.2+scores.smartMoney*.15);
  qualifies=Math.abs(score)>=70;
 }else if(variant==='trend-momentum'){
  score=Math.round((scores.momentum+scores.trendFollowing)/2);
  qualifies=Math.abs(score)>=70&&scores.momentum*scores.trendFollowing>0&&ratio>=1.5;
 }else if(variant==='mean-reversion'){
  score=scores.meanReversion;
  qualifies=Math.abs(score)>=80&&Math.abs(scores.trendFollowing)<=40&&ratio>=1;
 }else throw new Error('Unknown research variant');
 const direction=score>=0?1:-1,atr=Math.abs(stock.ltp-stock.foAnalysis.suggestedStopLoss)/2;
 return {score,admitted:stock.eligible&&qualifies&&atr>0,side:direction===1?'BUY':'SELL',stop:stock.ltp-direction*2*atr,target:stock.ltp+direction*3*atr};
}
