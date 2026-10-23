// Research only (not used by the app): node research/candlestickStudy.mjs
// Do daily bullish candlestick patterns (the Chartink scans in the user's notes) and RSI < 30 lead to profitable
// short-term long trades on NSE stocks after Indian delivery charges?
// Data: Yahoo daily bars cached in /tmp/ycache by research/overnightGapStudy.mjs (NIFTY 50 + today's F&O stocks,
// 2016–2026; today's lists, so delisted stocks are missing: survivorship flatters every row equally).
// Trade: signal on the day's close, buy at the next open. Plan A (the user's sheet): 2% stop, 6% target, exit at
// the 10th session's close; when one day touches both, the stop is assumed first. Plan B: hold 5 sessions.
// Cost: delivery round trip on ₹20,000 (10% of ₹2 lakh) from the broker tariff, plus 5 bps slippage each side.
// Every condition and parameter below was fixed before running; none was tuned on the results.
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {rsi,sma} from '../shared/indicators.js';
import {orderCharges} from '../shared/brokerCharges.js';
const NOTIONAL=20000,COST=(orderCharges('equity-delivery','BUY',NOTIONAL).total+orderCharges('equity-delivery','SELL',NOTIONAL).total)/NOTIONAL*100+0.1;
if(!existsSync('/tmp/ycache'))throw new Error('Run research/overnightGapStudy.mjs (and with fno) first to cache bars');
const files=readdirSync('/tmp/ycache').filter(f=>f.endsWith('.NS.json'));
// +DI/-DI (Wilder) for the marubozu scan.
function di(h,l,c,n=14){const len=c.length,p=new Array(len).fill(NaN),m=new Array(len).fill(NaN);let tr=0,pd=0,md=0;
 for(let i=1;i<len;i++){const up=h[i]-h[i-1],dn=l[i-1]-l[i],t=Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])),u=up>dn&&up>0?up:0,d=dn>up&&dn>0?dn:0;
  if(i<=n){tr+=t;pd+=u;md+=d;if(i===n){p[i]=100*pd/tr;m[i]=100*md/tr;}}else{tr=tr-tr/n+t;pd=pd-pd/n+u;md=md-md/n+d;p[i]=100*pd/tr;m[i]=100*md/tr;}}
 return {p,m};}
// The Chartink conditions, as published (piercing also in its textbook form, which the scan intended).
const PATTERNS={
 'positive hammer':(b,i)=>b.l[i]<=b.o[i]*0.95&&b.c[i]>b.o[i],
 'hammer':(b,i)=>b.o[i]<b.c[i]&&b.h[i]>b.o[i]&&(b.o[i]-b.l[i])/(b.h[i]-b.o[i])>=2,
 'bullish marubozu':(b,i)=>b.c[i]-b.o[i]>1&&b.v20[i]>75000&&b.o[i]-b.l[i]<(b.c[i]-b.o[i])/5&&b.h[i]-b.c[i]<(b.c[i]-b.o[i])/5&&b.r[i]>60&&b.dp[i]>b.dm[i],
 'piercing (as scanned)':(b,i)=>b.o[i-1]>b.c[i-1]&&b.c[i]>b.o[i]&&b.o[i]<b.c[i-1]&&b.c[i]<b.o[i-1],
 'piercing (textbook)':(b,i)=>b.o[i-1]>b.c[i-1]&&b.c[i]>b.o[i]&&b.o[i]<b.c[i-1]&&b.c[i]<b.o[i-1]&&b.c[i]>(b.o[i-1]+b.c[i-1])/2,
 'inside day in uptrend (harami scan)':(b,i)=>b.h[i]<b.h[i-1]&&b.l[i]>b.l[i-1]&&b.s20[i]>b.s50[i]&&b.c[i]>=b.s10[i],
 'bullish engulfing':(b,i)=>b.c[i-1]<b.o[i-1]&&b.c[i]>b.o[i]&&b.o[i]<b.c[i-1]&&b.c[i]>b.o[i-1]&&b.h[i]>b.h[i-1]&&b.l[i]<b.l[i-1],
 'morning star (scan)':(b,i)=>i>=3&&b.o[i]<b.c[i]&&b.o[i]>b.c[i-1]&&b.o[i-1]<b.c[i-1]&&b.c[i-1]<b.c[i-2]&&b.o[i-2]>b.c[i-2]&&b.c[i-2]<b.c[i-3]&&b.o[i-3]>b.c[i-3],
 'RSI14 < 30':(b,i)=>b.r[i]<30,
 'any day (baseline)':()=>true,
};
const FILTERS={'':()=>true,' + RSI<30':(b,i)=>b.r[i]<30,' + above SMA200':(b,i)=>b.c[i]>b.s200[i]};
function trade(b,i,plan){ // entry at the next open
 const e=i+1;if(e>=b.c.length)return null;const px=b.o[e];
 if(plan==='hold5'){const x=e+4;return x<b.c.length?{ret:(b.c[x]/px-1)*100,hit:null}:null;}
 const stop=px*0.98,target=px*1.06;
 for(let k=e;k<Math.min(e+10,b.c.length);k++){if(b.l[k]<=stop)return {ret:(Math.min(b.o[k],stop)/px-1)*100,hit:'STOP'};if(b.h[k]>=target)return {ret:(Math.max(b.o[k],target)/px-1)*100,hit:'TARGET'};}
 const x=Math.min(e+9,b.c.length-1);return e+9<b.c.length?{ret:(b.c[x]/px-1)*100,hit:'TIME'}:null;
}
const res={};
for(const f of files){const raw=JSON.parse(readFileSync('/tmp/ycache/'+f));if(raw.length<260)continue;
 const b={o:raw.map(x=>x.o),h:raw.map(x=>x.h),l:raw.map(x=>x.l),c:raw.map(x=>x.c),v:raw.map(x=>x.v??0),t:raw.map(x=>x.t)};
 b.r=rsi(b.c,14);b.s10=sma(b.c,10);b.s20=sma(b.c,20);b.s50=sma(b.c,50);b.s200=sma(b.c,200);b.v20=sma(b.v,10);const d=di(b.h,b.l,b.c);b.dp=d.p;b.dm=d.m;
 const turn=sma(b.c.map((c,i)=>c*b.v[i]),20);
 for(let i=200;i<b.c.length-1;i++){
  if(!(turn[i]>=1e8))continue;// ₹10 crore average daily turnover: tradable without moving the price
  // Yahoo split/bonus artefacts: skip days around a >25% overnight jump.
  if(Math.abs(b.o[i+1]/b.c[i]-1)>0.25||Math.abs(b.c[i]/b.c[i-1]-1)>0.25)continue;
  const half=new Date(b.t[i]*1000).getUTCFullYear()<2021?0:1;
  for(const [pn,pf] of Object.entries(PATTERNS)){if(!pf(b,i))continue;
   for(const [fn,ff] of Object.entries(FILTERS)){if(!ff(b,i))continue;
    for(const plan of ['2/6','hold5']){const t=trade(b,i,plan);if(!t)continue;const k=pn+fn+'|'+plan;const x=res[k]??={n:0,win:0,target:0,sum:0,halves:[[0,0],[0,0]]};
     x.n++;x.sum+=t.ret;if(t.ret-COST>0)x.win++;if(t.hit==='TARGET')x.target++;x.halves[half][0]+=t.ret-COST;x.halves[half][1]++;}}}}
}
console.log(`Delivery round trip on ₹${NOTIONAL}: ${COST.toFixed(3)}% incl. slippage. ${files.length} stocks. Net = after cost.`);
for(const plan of ['2/6','hold5']){
 console.log(`\nPlan ${plan==='2/6'?'A: 2% stop / 6% target / 10 sessions':'B: hold 5 sessions'}`);
 console.log('signal'.padEnd(52),'trades'.padStart(7),'win%'.padStart(6),plan==='2/6'?'target%'.padStart(8):'','gross%'.padStart(7),'net%'.padStart(7),'  net% 2016-20 / 2021-26');
 for(const [k,x] of Object.entries(res).filter(([k])=>k.endsWith('|'+plan)).sort((a,b)=>b[1].sum/b[1].n-a[1].sum/a[1].n)){if(x.n<50)continue;
  const g=x.sum/x.n;console.log(k.split('|')[0].padEnd(52),String(x.n).padStart(7),(x.win/x.n*100).toFixed(1).padStart(6),plan==='2/6'?(x.target/x.n*100).toFixed(1).padStart(8):'',g.toFixed(3).padStart(7),(g-COST).toFixed(3).padStart(7),'  ',x.halves.map(([s,n])=>n?(s/n).toFixed(3):'—').join(' / '));}
}
