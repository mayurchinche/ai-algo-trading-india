// Research only: can the claims of the "164 Trading Strategy Browser" (megacellar-browser.onrender.com) be
// reproduced, and do its strategies survive costs on NIFTY 50? Strategies are re-implemented from the site's
// published one-line descriptions (its code is not on the site); the harness is our hypothesis of how a
// next-price predictor becomes a portfolio. Yahoo daily bars, cached in /tmp/ycache.
// node research/megacellarReplication.mjs [us|nifty]
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';
const market=process.argv[2]??'us';
async function closes(sym,range){const f=`/tmp/ycache/${sym}.d.${range}.json`;if(existsSync(f))return JSON.parse(readFileSync(f));
 const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?${range==='us2000'?'period1=946684800&period2=1735776000':'range='+range}&interval=1d`,{headers:{'User-Agent':'Mozilla/5.0'}});const d=(await r.json()).chart.result[0];
 const adj=d.indicators.adjclose?.[0]?.adjclose??d.indicators.quote[0].close,out=d.timestamp.map((t,i)=>[new Date(t*1000).toISOString().slice(0,10),adj[i]]).filter(x=>x[1]>0);writeFileSync(f,JSON.stringify(out));return out;}
const US=['CL','KO','PG','PEP','MMM','TGT','JNJ','LOW','MDT','MCD'];
let syms=market==='us'?US:NIFTY50_UNIVERSE.members.map(m=>m.symbol+'.NS'),range=market==='us'?'us2000':'10y';
const all=await Promise.all(syms.map(s=>closes(s,range)));
// NIFTY 50: keep members with nearly the full 10 years (recent listings would shorten the common history).
const keep=all.map(s=>s.length>=all.reduce((m,x)=>Math.max(m,x.length),0)*0.97),series=all.filter((_,i)=>keep[i]);
if(keep.includes(false))console.log('left out (short history):',syms.filter((_,i)=>!keep[i]).join(' '));
syms.splice(0,syms.length,...syms.filter((_,i)=>keep[i]));
// Common trading dates; US from 2000 as on the site.
let dates=series.map(s=>new Set(s.map(x=>x[0]))).reduce((a,b)=>new Set([...a].filter(x=>b.has(x))));
dates=[...dates].sort().filter(d=>market!=='us'||(d>='2000-01-01'&&d<='2024-12-31'));
const P=series.map(s=>{const m=new Map(s);return dates.map(d=>m.get(d));});
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
// Predictors re-implemented from the site's descriptions: (window of closes) → predicted next close.
const PRED={
 RollingWindowLInfinityNorm:w=>Math.max(...w.map(Math.abs)),
 RollingWindowSmoothedMax:w=>{const k=3,mx=[];for(let i=k;i<=w.length;i++)mx.push(Math.max(...w.slice(i-k,i)));return mean(mx);},
 ATRApproxFromCloses:w=>{const c=w.at(-1),atr=mean(w.slice(1).map((x,i)=>Math.abs(x-w[i]))),a=Math.min(1,atr/c*10);return c*(1-a)+mean(w)*a;},
 TroughCountReversion:w=>{let t=0;for(let i=1;i<w.length-1;i++)if(w[i]<w[i-1]&&w[i]<w[i+1])t++;const d=w.at(-1)-w.at(-2);return w.at(-1)+(t>=w.length/4?-d:d);},
 SimpleMeanReversion:w=>mean(w),
 SimpleMomentum:w=>w.at(-1)+(w.at(-1)-w[0])/w.length,
};
// Harness: each day, every stock's predicted return; hold the stocks with a positive prediction, weighted by it.
function run(pred,win,{rebalance=1,costPct=0}){
 let eq=1,bh=1,w=new Array(syms.length).fill(0),turnover=0,days=0;
 for(let t=win;t<dates.length-1;t++){
  if((t-win)%rebalance===0){const r=P.map(p=>{const x=pred(p.slice(t-win+1,t+1));return Math.max(0,x/p[t]-1);}),s=r.reduce((a,b)=>a+b,0);
   const nw=s>0?r.map(x=>x/s):new Array(syms.length).fill(0);turnover+=nw.reduce((a,x,i)=>a+Math.abs(x-w[i]),0);eq*=1-costPct/100*nw.reduce((a,x,i)=>a+Math.abs(x-w[i]),0);w=nw;}
  const ret=P.map(p=>p[t+1]/p[t]-1);eq*=1+w.reduce((a,x,i)=>a+x*ret[i],0);bh*=1+mean(ret);days++;
  // weights drift with prices between rebalances
  const g=w.map((x,i)=>x*(1+ret[i])),gs=g.reduce((a,b)=>a+b,0);if(gs>0)w=g.map(x=>x/gs);
 }
 const yrs=days/252;return {total:(eq-1)*100,cagr:(eq**(1/yrs)-1)*100,bench:(bh-1)*100,turnoverPerYear:turnover/yrs};
}
// Round-trip cost per unit of turnover: US ~0.05% (spread only); India delivery ~0.38% at Rs 25k (STT both sides).
const cost=market==='us'?0.05:0.19;
console.log(`${market.toUpperCase()} ${syms.length} stocks, ${dates[0]} → ${dates.at(-1)}, ${dates.length} days; cost per unit turnover ${cost}% each way`);
for(const [name,f] of Object.entries(PRED))for(const win of [7,30]){
 const a=run(f,win,{}),b=run(f,win,{costPct:cost}),c=run(f,win,{rebalance:5,costPct:cost});
 console.log(`${name.padEnd(28)} win ${String(win).padStart(2)} | no costs ${a.total.toFixed(0).padStart(7)}% (CAGR ${a.cagr.toFixed(1)}) bench ${a.bench.toFixed(0)}% | turnover ${a.turnoverPerYear.toFixed(0)}x/yr | daily+costs CAGR ${b.cagr.toFixed(1)} | weekly+costs CAGR ${c.cagr.toFixed(1)}`);
}
