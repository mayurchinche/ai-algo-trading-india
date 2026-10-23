// Research only (25 Oct 2026): replicate Megacellar "WilliamsRReactive" on NSE. The site's rule (descriptions.json):
// predicted price = close × (1 − %R/100), %R the Williams %R of N bars → ranks stocks by how oversold they are
// (a short-term reversal ranker); results are long the most oversold, rebalanced weekly or monthly, vs equal weight.
// Fixed before running: N=14 days, weekly rebalance, top 5 of the 50 most liquid stocks (point in time), equal weight,
// ₹2 L, delivery charges + 10 bps slippage per side on names that change. Variants (4, counted in findings F15):
// net/gross × most-oversold(long)/least-oversold(control). Benchmark: equal weight of the same 50, rebalanced weekly.
import {loadAll} from './lib/panel.mjs';
import {orderCharges} from '../shared/brokerCharges.js';
const {meta,series}=loadAll({minBars:250});
const days=meta.days,D=days.length,N=14,K=Number(process.env.K||5),POOL=Number(process.env.POOL||50),CAP=200000,SLIP=0.001,SIG=process.env.SIG||'wr',REB=process.env.REB||'week';
const dayIdx=new Map(days.map((d,i)=>[d,i]));
const S=series.map(s=>{const pos=new Int32Array(D).fill(-1);s.d.forEach((d,i)=>pos[dayIdx.get(d)]=i);
 const turn=new Float64Array(s.d.length);let sum=0;for(let i=0;i<s.d.length;i++){sum+=s.val[i]??0;if(i>=20)sum-=s.val[i-20]??0;turn[i]=i>=19?sum/20:NaN;}return {s,pos,turn};});
const wr=(s,i)=>{let h=-Infinity,l=Infinity;for(let j=i-N+1;j<=i;j++){h=Math.max(h,s.h[j]);l=Math.min(l,s.l[j]);}return h>l?(s.c[i]-h)/(h-l)*100:NaN;};// −100..0
const week=d=>{const t=new Date(d+'T00:00:00Z'),k=new Date(t);k.setUTCDate(t.getUTCDate()+4-(t.getUTCDay()||7));const y=k.getUTCFullYear();return y+'-'+Math.ceil(((k-Date.UTC(y,0,1))/864e5+1)/7);};
const per=REB==='month'?d=>d.slice(0,7):week;
const reb=[];for(let t=1;t<D;t++)if(per(days[t])!==per(days[t-1]))reb.push(t);
// SIG=mom: 12-1 month momentum (Jegadeesh-Titman), most positive first; the 'oversold' pick then means the top ranked.
const sig=(s,i)=>SIG==='mom'?(i>=253?s.c[i-21]/s.c[i-252]-1:NaN):-wr(s,i);
function run({net,pick}){
 let eq=CAP,held=new Map();const curve=[];
 for(let r=0;r<reb.length-1;r++){
  const t=reb[r],t2=reb[r+1];if(days[t]<'2016-11-01')continue;
  const pool=[];for(const Z of S){const i=Z.pos[t],j=Z.pos[t2];if(i<(SIG==='mom'?254:N+1)||j<0||!(Z.turn[i-1]>=5e7)||!(Z.s.c[i-1]>=50))continue;
   let ok=true;for(let b=i;b<=j;b++)if(Z.s.brk[b]){ok=false;break;}if(!ok)continue;pool.push({Z,i,j,turn:Z.turn[i-1]});}
  pool.sort((a,b)=>b.turn-a.turn);const top=pool.slice(0,POOL).map(p=>({...p,w:-sig(p.Z.s,p.i-1)})).filter(p=>Number.isFinite(p.w));
  if(top.length<POOL/2)continue;
  const ranked=[...top].sort((a,b)=>pick==='oversold'?a.w-b.w:b.w-a.w).slice(0,K),bench=top;
  let cost=0;const next=new Map();
  for(const p of ranked){next.set(p.Z.s.symbol,p);const per=eq/K;if(!held.has(p.Z.s.symbol)&&net)cost+=orderCharges('equity-delivery','BUY',per).total+per*SLIP;}
  for(const k of held.keys())if(!next.has(k)&&net)cost+=orderCharges('equity-delivery','SELL',eq/K).total+eq/K*SLIP;
  const gross=ranked.reduce((a,p)=>a+(p.Z.s.o[p.j]/p.Z.s.o[p.i]-1),0)/K,b=bench.reduce((a,p)=>a+(p.Z.s.o[p.j]/p.Z.s.o[p.i]-1),0)/bench.length;
  eq=eq*(1+gross)-cost;held=next;curve.push({d:days[t],eq,bench:b,ret:gross});
 }
 return curve;
}
const ann=REB==='month'?12:52;
const stat=(c,from,to)=>{const x=c.filter(p=>p.d>=from&&p.d<=to);if(!x.length)return null;const m=new Map();for(let k=0;k<x.length;k++){const mo=x[k].d.slice(0,7),prev=k?x[k-1].eq:CAP;const e=m.get(mo)??{s:prev,e:prev};e.e=x[k].eq;m.set(mo,e);}
 const mr=[...m.values()].map(v=>(v.e/v.s-1)*100),yrs=x.length/ann;let peak=0,dd=0;for(const p of x){peak=Math.max(peak,p.eq);dd=Math.min(dd,p.eq/peak-1);}
 const bench=x.reduce((a,p)=>a*(1+p.bench),1);
 return {weeks:x.length,total:((x.at(-1).eq/CAP-1)*100).toFixed(0)+'%',cagr:(((x.at(-1).eq/(x[0].eq/(1+x[0].ret)))**(1/yrs)-1)*100).toFixed(1)+'%',avgMo:(mr.reduce((a,b)=>a+b,0)/mr.length).toFixed(2),worstMo:Math.min(...mr).toFixed(1),posMo:(mr.filter(v=>v>0).length/mr.length*100).toFixed(0)+'%',maxDD:(dd*100).toFixed(1)+'%',benchCAGR:((bench**(1/yrs)-1)*100).toFixed(1)+'%'};};
for(const [net,pick] of (process.env.SIG==="mom"?[[false,"oversold"],[true,"oversold"]]:[[false,"oversold"],[true,"oversold"],[true,"overbought"],[false,"overbought"]])){
 const c=run({net,pick});console.log(`\n${pick} ${net?'NET of charges':'GROSS (site style)'}`);
 for(const [k,a,b] of [['all','2016-11-01','2026-12-31'],['2016-21','2016-11-01','2021-12-31'],['2022-26','2022-01-01','2026-12-31']])console.log(k.padEnd(8),JSON.stringify(stat(c,a,b)));
}
