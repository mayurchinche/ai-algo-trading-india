// Trend score: our own transparent 0–10 model on completed daily bars, built from a zero-lag EMA
// and Wilder ATR. It describes trend state; it is not a forecast or an order instruction.
import {zlema,atr} from './indicators.js';

export const TREND_MODEL=Object.freeze({
 id:'trend-score-v1',zlemaLength:21,atrLength:14,slopeBars:5,bandAtr:2,bullish:7,bearish:4,recentSessions:5,
 formula:'score = 5 + 2.5 × clamp((close − ZLEMA21) / (2 × ATR14), −1, 1) + 2.5 × clamp((ZLEMA21 − ZLEMA21[5 bars ago]) / ATR14, −1, 1)',
 signals:'BUY when the score crosses from below 7 to 7 or more while not in a trend; SELL when the score falls to 4 or less during a trend',
});
const clamp=v=>Math.max(-1,Math.min(1,v));
// 0 to <4 bearish, 4 to <7 neutral, 7 to 10 bullish.
export function trendZone(score,model=TREND_MODEL){
 if(score===null||!Number.isFinite(score))return null;
 return score>=model.bullish?'BULLISH':score<model.bearish?'BEARISH':'NEUTRAL';
}

export function computeTrendScore({dates,close,high,low},model=TREND_MODEL){
 if(!Array.isArray(dates)||![close,high,low].every(s=>Array.isArray(s)&&s.length===dates.length))throw new TypeError('dates, close, high and low must be arrays of equal length');
 for(let i=0;i<dates.length;i++){
  if(typeof dates[i]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dates[i])||(i&&dates[i]<=dates[i-1]))throw new TypeError(`dates[${i}] must be an increasing YYYY-MM-DD date`);
  if(!(low[i]>0&&low[i]<=close[i]&&close[i]<=high[i]))throw new TypeError(`bar ${i} must satisfy 0 < low <= close <= high`);
 }
 const z=zlema(close,model.zlemaLength),a=atr(high,low,close,model.atrLength);
 const score=close.map((c,i)=>{
  if(i<model.slopeBars||![z[i],z[i-model.slopeBars],a[i]].every(Number.isFinite)||a[i]<=0)return null;
  return 5+2.5*clamp((c-z[i])/(model.bandAtr*a[i]))+2.5*clamp((z[i]-z[i-model.slopeBars])/a[i]);
 });
 const signals=[];let inTrend=false,prior=null;
 for(let i=0;i<score.length;i++){
  const s=score[i];if(s===null)continue;
  if(!inTrend&&prior!==null&&prior<model.bullish&&s>=model.bullish){inTrend=true;signals.push({index:i,date:dates[i],type:'BUY',score:s});}
  else if(inTrend&&s<=model.bearish){inTrend=false;signals.push({index:i,date:dates[i],type:'SELL',score:s});}
  prior=s;
 }
 const last=dates.length-1,lastSignal=signals.at(-1)||null,latestScore=last>=0?score[last]:null;
 const sessionsSinceSignal=lastSignal?last-lastSignal.index:null;
 const recent=lastSignal&&sessionsSinceSignal<model.recentSessions;
 return {model,dates,close,zlema:z.map(v=>Number.isFinite(v)?v:null),atr:a.map(v=>Number.isFinite(v)?v:null),score,zone:score.map(s=>trendZone(s,model)),signals,
  latest:latestScore===null?{status:'INSUFFICIENT_HISTORY',date:dates[last]??null}:{status:'SCORED',index:last,date:dates[last],close:close[last],score:latestScore,zone:trendZone(latestScore,model),inTrend,lastSignal,sessionsSinceSignal,
   category:recent?(lastSignal.type==='BUY'?'TREND_START':'TREND_END'):null}};
}
