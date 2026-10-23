// Round 3 (fixed before running): momentum family with regime/risk filters; evidence base = Jegadeesh-Titman 1993, Daniel-Moreira 2016
// (momentum crashes after market stress), Barroso-Santa-Clara 2015 (volatility scaling). Friday decision, 20-bar hold, 12% stop.
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadAll} from '../lib/panel.mjs';
import {simulate} from '../lib/portfolioSim.mjs';
import {FILTERS,setContext} from '../strategies/megacellar164.mjs';
import {WINDOWS,STATE,readLedger,writeLedger,variantCount,truncate,causalityAudit,devVerdict} from './gates.mjs';
const dow=d=>new Date(d+'T00:00:00Z').getUTCDay();
const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/(a.length-1));};
const mk=(id,{lb=252,skip=21,volAdj=false,filter=null}={})=>({id,product:'equity-delivery',warmup:260,prepare:()=>null,
 signal(s,_x,k){if(dow(s.d[k])!==5||!(s.val[k]>=5e7)||(filter&&!filter(s,k)))return null;
  const m=s.c[k-skip]/s.c[k-lb]-1;if(!(m>.15))return null;
  let sc=m;if(volAdj){const r=[];for(let i=k-59;i<=k;i++)r.push(s.c[i]/s.c[i-1]-1);sc=m/sd(r);}
  return {score:sc,stop:s.c[k]*.88,maxDays:20};}});
const specs=[mk('mom12-1'),mk('mom12-1-mktUp',{filter:FILTERS.mktUp}),mk('mom12-1-volAdj',{volAdj:true}),mk('mom12-1-volAdj-mktUp',{volAdj:true,filter:FILTERS.mktUp}),
 mk('mom6-1-volAdj-mktUp',{lb:126,volAdj:true,filter:FILTERS.mktUp}),mk('mom12-1-volAdj-both',{volAdj:true,filter:FILTERS.both})];
const dev=truncate(loadAll({minBars:250}),WINDOWS.devEnd);setContext(dev);const l=readLedger(),out=[];
for(const st of specs){
 const au=causalityAudit(st,dev,{symbols:15,cuts:[.5]});if(!au.ok){console.log(st.id,'LOOKAHEAD');continue;}
 const n=variantCount(l)+1,run=simulate(st,dev),v=devVerdict(run,n);l.variants.push({id:st.id,at:new Date().toISOString(),round:3,pass:v.pass,t:v.t,validate:v.validate});
 out.push({id:st.id,...v});console.log(st.id.padEnd(24),'pass',v.pass,'| train',v.train?.avgMonthPct,'dd',v.train?.maxDrawdownPct,'| valid avg',v.validate?.avgMonthPct,'worst',v.validate?.worstMonthPct,'pos',v.validate?.positiveMonthsPct,'dd',v.validate?.maxDrawdownPct,'| t',v.t,'/',v.requiredT,'trades',v.all?.trades);
}
writeLedger(l);writeFileSync(join(STATE,'round3.json'),JSON.stringify(out,null,1));
