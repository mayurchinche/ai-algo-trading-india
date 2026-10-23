// Research only: Phase 3 candidate strategies for research/lib/portfolioSim.mjs, in their published forms.
// Parameters are fixed here before any simulation (24 Oct 2026) and are not tuned on results; every variant run
// is listed in .planning findings (multiple-testing count).
import {rsi,sma,atr} from '../../shared/indicators.js';
const atrStop=(s,x,i,mult)=>s.c[i]-mult*x.atr[i];
const base=s=>({sma200:sma(s.c,200),sma50:sma(s.c,50),sma5:sma(s.c,5),atr:atr(s.h,s.l,s.c,14)});
export const STRATEGIES={
 // Larry Connors & Cesar Alvarez, "Short Term Trading Strategies That Work" (2008): RSI(2) below 10 while above
 // the 200-day average; exit on a close above the 5-day average. A 3×ATR disaster stop (Connors uses none; a
 // stop is needed for risk sizing) and a 10-session limit.
 'rsi2-connors':{id:'rsi2-connors',product:'equity-delivery',warmup:210,
  prepare:s=>({...base(s),rsi2:rsi(s.c,2)}),
  signal:(s,x,i)=>x.rsi2[i]<10&&s.c[i]>x.sma200[i]?{score:-x.rsi2[i],stop:atrStop(s,x,i,3),maxDays:10}:null,
  exitCondition:(s,x,i)=>s.c[i]>x.sma5[i]},
 // Internal bar strength (close in the bottom 20% of the day's range) in an uptrend; exit on a close above the
 // previous day's high (common published IBS form). 3×ATR stop, 5 sessions.
 'ibs-uptrend':{id:'ibs-uptrend',product:'equity-delivery',warmup:210,
  prepare:s=>base(s),
  signal:(s,x,i)=>{const r=s.h[i]-s.l[i],ibs=r>0?(s.c[i]-s.l[i])/r:NaN;return ibs<0.2&&s.c[i]>x.sma200[i]?{score:-ibs,stop:atrStop(s,x,i,3),maxDays:5}:null;},
  exitCondition:(s,x,i)=>s.c[i]>s.h[i-1]},
 // From the user's notes and docs/CANDLESTICK_STUDY.md: RSI14 below 30 while above the 200-day average, held 5
 // sessions. 3×ATR stop.
 'rsi14-oversold-uptrend':{id:'rsi14-oversold-uptrend',product:'equity-delivery',warmup:210,
  prepare:s=>({...base(s),rsi14:rsi(s.c,14)}),
  signal:(s,x,i)=>x.rsi14[i]<30&&s.c[i]>x.sma200[i]?{score:-x.rsi14[i],stop:atrStop(s,x,i,3),maxDays:5}:null},
 // The app's validated 20-day breakout (Turtle System 1): close above the prior 20-day high while above the
 // 50-day average; exit on a close below the prior 10-day low; 8% stop; 60 sessions.
 'donchian20':{id:'donchian20',product:'equity-delivery',warmup:210,
  prepare:s=>{const hi=new Float64Array(s.c.length).fill(NaN),lo=new Float64Array(s.c.length).fill(NaN);
   for(let i=20;i<s.c.length;i++){let h=-Infinity,l=Infinity;for(let j=i-20;j<i;j++){h=Math.max(h,s.h[j]);if(j>=i-10)l=Math.min(l,s.l[j]);}hi[i]=h;lo[i]=l;}
   return {...base(s),hi20:hi,lo10:lo};},
  signal:(s,x,i)=>s.c[i]>x.hi20[i]&&s.c[i-1]<=x.hi20[i-1]&&s.c[i]>x.sma50[i]?{score:s.c[i]/x.hi20[i],stop:s.c[i]*0.92,maxDays:60}:null,
  exitCondition:(s,x,i)=>s.c[i]<x.lo10[i]},
 // Intraday (MIS): a gap down of 2–6% at the open in a stock above its 200-day average is bought at the open
 // and sold at the close (opening-gap fill); 1.5% stop. Decided at the open of bar i from data up to i−1.
 'gapdown-fill-intraday':{id:'gapdown-fill-intraday',product:'equity-intraday',warmup:210,
  prepare:s=>base(s),
  signal:(s,x,i)=>{const g=(s.o[i]/s.c[i-1]-1)*100;return g<=-2&&g>=-6&&s.c[i-1]>x.sma200[i-1]?{score:-g,stop:s.o[i]*0.985,maxDays:1}:null;}},
};
