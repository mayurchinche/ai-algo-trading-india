// Research only (not used by the app): node research/intradayLevelStudy.mjs. Yahoo hourly bars cached in /tmp/ycache.
// Intraday entries at levels known before the session: previous-day high/low breakouts, NR7, gap direction.
// 2y Yahoo 1h bars (09:15..15:15 IST), NIFTY 50. Stop-entry at the level; 1% stop, 2% target, exit 15:15 bar close.
import {orderCharges} from '../shared/brokerCharges.js';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
async function get(sym,iv,range){const f=`/tmp/ycache/${sym}.${iv}.json`;if(existsSync(f))return JSON.parse(readFileSync(f));
 const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${iv}`,{headers:{'User-Agent':'Mozilla/5.0'}});const d=(await r.json()).chart.result[0],q=d.indicators.quote[0];
 const out=d.timestamp.map((t,i)=>({t,o:q.open[i],h:q.high[i],l:q.low[i],c:q.close[i]})).filter(b=>b.o>0&&b.h>0&&b.l>0&&b.c>0);writeFileSync(f,JSON.stringify(out));return out;}
const day=t=>new Date(t*1000+19800000).toISOString().slice(0,10);
const C=(p,n)=>(orderCharges(p,'BUY',n).total+orderCharges(p,'SELL',n).total)/n*100+0.1;
const MIS=C('equity-intraday',25000),FUT=C('futures',500000);console.log('intraday cost %: MIS ₹25k',MIS.toFixed(3),'| futures ₹5L',FUT.toFixed(3));
const res={};const push=(k,r,yr)=>{(res[k]??=[]).push({r,yr});};
for(const m of NIFTY50_UNIVERSE.members){const h=await get(m.symbol+'.NS','1h','730d');const days=new Map();for(const b of h){const d=day(b.t);if(!days.has(d))days.set(d,[]);days.get(d).push(b);}
 const list=[...days.entries()].filter(([,b])=>b.length>=6);
 for(let i=7;i<list.length;i++){const bars=list[i][1],prev=list[i-1][1],pH=Math.max(...prev.map(b=>b.h)),pL=Math.min(...prev.map(b=>b.l)),pC=prev.at(-1).c,o=bars[0].o,yr=list[i][0]<'2025-10'?1:2;
  const ranges=list.slice(i-7,i).map(([,b])=>Math.max(...b.map(x=>x.h))-Math.min(...b.map(x=>x.l)));const nr7=ranges.at(-1)<=Math.min(...ranges);
  const sim=(side,level,stopPct=1,tgtPct=2)=>{const dir=side==='BUY'?1:-1;let entry=null;
   for(const b of bars){if(entry===null){const hit=dir>0?b.h>=level:b.l<=level;if(!hit)continue;entry=dir>0?Math.max(b.o,level):Math.min(b.o,level);
     const stop=entry*(1-dir*stopPct/100);if(dir>0?b.l<=stop:b.h>=stop)return -stopPct;continue;}
    const stop=entry*(1-dir*stopPct/100),tgt=entry*(1+dir*tgtPct/100);
    if(dir>0?b.l<=stop:b.h>=stop)return -stopPct;if(dir>0?b.h>=tgt:b.l<=tgt)return tgtPct;}
   return entry===null?null:(bars.at(-1).c/entry-1)*100*dir;};
  const gap=(o/pC-1)*100;
  const t=(k,v)=>{if(v!==null)push(k,v,yr);};
  t('prev-day high breakout (long)',sim('BUY',pH));t('prev-day low breakdown (short)',sim('SELL',pL));
  if(nr7){t('NR7: prev-day high breakout',sim('BUY',pH));t('NR7: prev-day low breakdown',sim('SELL',pL));}
  if(gap>=0.5&&gap<=3)t('gap up 0.5-3%: break of prev-day high',sim('BUY',Math.max(pH,o*1.001)));
  if(gap>=0.5&&gap<=3)t('gap up 0.5-3%: first-hour high break',sim('BUY',bars[0].h+0.0001));
  if(gap<=-0.5&&gap>=-3)t('gap down 0.5-3%: fill to prev close (long at open)',(()=>{const e=o;for(const b of bars){if(b.l<=e*0.99)return -1;if(b.h>=pC)return (pC/e-1)*100;}return (bars.at(-1).c/e-1)*100;})());
 }}
for(const [k,v] of Object.entries(res)){const a=v.map(x=>x.r),avg=x=>x.reduce((p,q)=>p+q,0)/x.length,h=[1,2].map(y=>avg(v.filter(x=>x.yr===y).map(x=>x.r)));
 console.log(k.padEnd(52),String(a.length).padStart(6),'gross',avg(a).toFixed(3).padStart(7),'win',(a.filter(x=>x>0).length/a.length*100).toFixed(1),'% net MIS',(avg(a)-MIS).toFixed(3),'net fut',(avg(a)-FUT).toFixed(3),'halves',h.map(x=>x.toFixed(3)).join('/'));}
