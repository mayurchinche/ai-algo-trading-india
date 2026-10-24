// Causal intraday simulator on Upstox 1-minute bars. node research/intraday/sim.mjs [ids]  (dev window only; holdout is locked)
// Decision at minute m uses bars <= m; fills at open of m+1 +slippage; MIS equity, flat by 15:15. Parameters fixed BEFORE testing.
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {homedir} from 'node:os';
const ROOT=join(homedir(),'.cache','ai-algo-trading','min');
export const CAP=200000,RISK=1000,POS_MAX=50000,MAX_TRADES=3,DAY_STOP=-0.015,MONTH_STOP=-0.04,SLIP=process.env.NOCOST?0:0.0005;
export const WIN={dev:['2022-01-01','2024-06-30'],hold:['2024-07-01','2099-01-01']};
export const cost=(b,s)=>{if(process.env.NOCOST)return 0;const t=b+s,br=Math.min(20,t*0.0003)*2;return br*1.18+s*0.00025+t*0.0000297*1.18+b*0.00003;};
export function loadDays(sym,minMonths=50){
 const dir=join(ROOT,sym);if(!existsSync(dir))return null;const f=readdirSync(dir).filter(x=>x.endsWith('.gz')).sort();if(f.length<minMonths)return null;
 const days=new Map();for(const n of f)for(const r of JSON.parse(gunzipSync(readFileSync(join(dir,n))))){const d=r[0].slice(0,10);if(!days.has(d))days.set(d,[]);days.get(d).push({t:r[0].slice(11),o:r[1],h:r[2],l:r[3],c:r[4],v:r[5]});}
 const out=[];for(const [d,b] of [...days].sort())if(b.length>=360&&b[0].t==='09:15')out.push({d,b});return out;
}
// strategies: fn(ctx)->{side,stop,target}|null, evaluated once per bar; ctx={b,i,prevClose,gap,sma20,up,hi30,lo30,vwap}
export const STRATS={
 orb30:ctx=>{const {b,i,hi30,lo30,gap,up}=ctx;if(i<15||i>120||!up)return null;const c=b[i].c;if(c>hi30&&gap>-0.01){const st=Math.max(lo30,c*0.99);return{side:1,stop:st,target:c+1.5*(c-st)};}return null;},
 orbShort:ctx=>{const {b,i,hi30,lo30,gap,up}=ctx;if(i<15||i>120||up)return null;const c=b[i].c;if(c<lo30&&gap<0.01){const st=Math.min(hi30,c*1.01);return{side:-1,stop:st,target:c-1.5*(st-c)};}return null;},
 vwapRev:ctx=>{const {b,i,vwap,up}=ctx;if(i<30||i>240||!up)return null;const c=b[i].c;return c<vwap*0.985?{side:1,stop:c*0.992,target:vwap}:null;},
 gapDown:ctx=>{const {b,i,gap,up}=ctx;if(i!==0||!up||gap>-0.02||gap<-0.06)return null;return{side:1,stop:b[0].o*0.985,target:Infinity,atOpen:true};},
 pmMom:ctx=>{const {b,i,up}=ctx;if(i!==195||!up)return null;const o=b[0].o,c=b[i].c;if(c/o>1.02&&c>=Math.max(...b.slice(0,i).map(x=>x.h))*0.998)return{side:1,stop:c*0.992,target:c*1.012};return null;},
};
const EXIT='15:15';
function runStrat(id,data,[a,z]){
 const f=STRATS[id],byDay=new Map();
 for(const [sym,days] of data){const hist=[];for(let k=0;k<days.length;k++){const {d,b}=days[k];
  if(k>0&&d>=a&&d<=z&&hist.length>=20){const pc=hist.at(-1),gap=b[0].o/pc-1;
   if(Math.abs(gap)<0.15){const sma20=hist.slice(-20).reduce((s,x)=>s+x,0)/20,up=pc>sma20;let hi=0,lo=1e9;for(let i=0;i<15;i++){hi=Math.max(hi,b[i].h);lo=Math.min(lo,b[i].l);}
    let pv=0,vv=0;
    for(let i=0;i<b.length&&b[i].t<EXIT;i++){const x=b[i];pv+=(x.h+x.l+x.c)/3*x.v;vv+=x.v;const e=b[i+1];if(!e||e.t>=EXIT)break;
     const s=f({b,i,prevClose:pc,gap,sma20,up,hi30:hi,lo30:lo,vwap:pv/Math.max(vv,1)});if(!s)continue;
     const j=s.atOpen?0:i+1,px=s.atOpen?b[0].o:e.o,ent=px*(1+s.side*SLIP),risk=Math.abs(ent-s.stop);if(!(risk>0))break;
     const q=Math.min(Math.floor(RISK/risk),Math.floor(POS_MAX/ent));if(q<1)break;
     let ex=null;for(let m=j;m<b.length;m++){const y=b[m];if(y.t>=EXIT){ex=y.o;break;}
      if(s.side===1){if(y.l<=s.stop){ex=Math.min(s.stop,y.o);break;}if(y.h>=s.target){ex=s.target;break;}}else{if(y.h>=s.stop){ex=Math.max(s.stop,y.o);break;}if(y.l<=s.target){ex=s.target;break;}}}
     if(ex==null)ex=b.at(-1).c;const xs=ex*(1-s.side*SLIP),g=s.side*(xs-ent)*q,bs=s.side===1?[ent*q,xs*q]:[xs*q,ent*q],pnl=g-cost(...bs);
     if(!byDay.has(d))byDay.set(d,[]);byDay.get(d).push({sym,t:b[j].t,pnl});break;}}}
  hist.push(b.at(-1).c);}}
 const mon={},daily=[];let mp=0,cm='';
 for(const d of [...byDay.keys()].sort()){const m=d.slice(0,7);if(m!==cm){cm=m;mp=0;}if(mp/CAP<=MONTH_STOP)continue;
  let dp=0,n=0;for(const t of byDay.get(d).sort((x,y)=>x.t<y.t?-1:1)){if(n>=MAX_TRADES||dp/CAP<=DAY_STOP)break;dp+=t.pnl;n++;}mp+=dp;mon[m]=(mon[m]||0)+dp;daily.push([d,dp,n]);}
 return {mon,daily};
}
export function stats({mon,daily}){const rs=Object.entries(mon).sort().map(([,v])=>v/CAP*100);let eq=0,pk=0,dd=0;for(const [,p] of daily){eq+=p/CAP*100;pk=Math.max(pk,eq);dd=Math.min(dd,eq-pk);}
 const n=rs.length,avg=rs.reduce((s,x)=>s+x,0)/n,sd=Math.sqrt(rs.reduce((s,x)=>s+(x-avg)**2,0)/(n-1||1));
 return{months:n,trades:daily.reduce((s,x)=>s+x[2],0),avg:+avg.toFixed(2),worst:+Math.min(...rs).toFixed(2),dd:+dd.toFixed(1),pos:+(rs.filter(x=>x>0).length/n*100).toFixed(0),t:+(avg/(sd/Math.sqrt(n)||1)).toFixed(2)};}
if(import.meta.url===`file://${process.argv[1]}`){
 const ids=process.argv.slice(2).length?process.argv.slice(2):Object.keys(STRATS),w=WIN.dev;
 const data=readdirSync(ROOT).map(s=>[s,loadDays(s)]).filter(x=>x[1]);console.log('stocks',data.length,'window',w.join('..'));
 for(const id of ids)console.log(id,JSON.stringify(stats(runStrat(id,data,w))));
}
