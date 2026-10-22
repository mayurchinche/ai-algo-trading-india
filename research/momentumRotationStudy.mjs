// Research only: low-turnover momentum rotation on NIFTY 50 (members with ~10 years of history), monthly
// rebalancing, delivery charges on turnover, vs equal-weight holding. Uses the Yahoo cache written by
// megacellarReplication.mjs (/tmp/ycache/*.d.10y.json). Current members only: survivorship bias inflates every
// line, including the benchmark, so compare lines with each other rather than with absolute returns.
import {readFileSync,existsSync} from 'node:fs';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';
const load=s=>{const f=`/tmp/ycache/${s}.NS.d.10y.json`;return existsSync(f)?JSON.parse(readFileSync(f)):[];};
const all=NIFTY50_UNIVERSE.members.map(m=>[m.symbol,load(m.symbol)]),maxLen=Math.max(...all.map(([,s])=>s.length));
const kept=all.filter(([,s])=>s.length>=maxLen*0.97);
let dates=kept.map(([,s])=>new Set(s.map(x=>x[0]))).reduce((a,b)=>new Set([...a].filter(x=>b.has(x))));dates=[...dates].sort();
const P=kept.map(([,s])=>{const m=new Map(s);return dates.map(d=>m.get(d));}),N=P.length,COST=0.19; // % per unit turnover each way (Rs 25k delivery incl. slippage)
function run({look,skip=0,top,every=21,costPct=COST,filter=null}){
 let eq=1,w=new Array(N).fill(0),turn=0,days=0,peak=1,dd=0;const start=252;
 for(let t=start;t<dates.length-1;t++){
  if((t-start)%every===0){
   const score=P.map(p=>p[t-skip]/p[t-look]-1);const order=score.map((s,i)=>[s,i]).filter(([,i])=>!filter||filter(i,t)).sort((a,b)=>b[0]-a[0]).slice(0,top).map(x=>x[1]);
   const nw=new Array(N).fill(0);for(const i of order)nw[i]=1/order.length;const tv=nw.reduce((a,x,i)=>a+Math.abs(x-w[i]),0);turn+=tv;eq*=1-costPct/100*tv;w=nw;}
  const r=P.map(p=>p[t+1]/p[t]-1);eq*=1+w.reduce((a,x,i)=>a+x*r[i],0);days++;peak=Math.max(peak,eq);dd=Math.max(dd,1-eq/peak);
  const g=w.map((x,i)=>x*(1+r[i])),gs=g.reduce((a,b)=>a+b,0);if(gs>0)w=g.map(x=>x/gs);
 }
 const yrs=days/252;return {cagr:(eq**(1/yrs)-1)*100,dd:dd*100,turn:turn/yrs};
}
const sma=(p,t,n)=>{let s=0;for(let k=t-n+1;k<=t;k++)s+=p[k];return s/n;};
const fmt=(l,r)=>console.log(l.padEnd(56),'CAGR',r.cagr.toFixed(1).padStart(5)+'%','| max drawdown',r.dd.toFixed(1).padStart(5)+'%','| turnover',r.turn.toFixed(1)+'x/yr');
console.log(`${N} stocks, ${dates[252]} → ${dates.at(-1)}; delivery cost ${COST}% each way on turnover`);
fmt('Equal weight, all stocks, rebalanced yearly',run({look:1,top:N,every:252}));
for(const [look,skip,label] of [[126,0,'6-month'],[252,21,'12-1 month'],[63,0,'3-month']])for(const top of [5,10])fmt(`Top ${top} by ${label} return, monthly`,run({look,skip,top}));
fmt('Top 10 by 12-1 month return, above 200-day average, monthly',run({look:252,skip:21,top:10,filter:(i,t)=>P[i][t]>sma(P[i],t,200)}));
fmt('Top 10 by 12-1 month, quarterly',run({look:252,skip:21,top:10,every:63}));
// Robustness: the same rule in each half of the period.
const half=Math.floor(dates.length/2),D=dates,PP=P.map(p=>p.slice());
for(const [name,from,to] of [['first half',0,half+252],['second half',half-252,D.length]]){dates=D.slice(from,to);for(let i=0;i<N;i++)P[i]=PP[i].slice(from,to);
 fmt(`  ${name} (${dates[252]} → ${dates.at(-1)}): equal weight`,run({look:1,top:N,every:252}));fmt(`  ${name}: top 10 by 12-1 month, monthly`,run({look:252,skip:21,top:10}));}
