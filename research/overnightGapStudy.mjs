// Research only (not used by the app): node research/overnightGapStudy.mjs. Yahoo daily bars cached in /tmp/ycache.
// Does today's close predict tomorrow's opening gap? 10y Yahoo daily, NIFTY 50. Buy at today's close, sell at tomorrow's open.
import {orderCharges} from '../shared/brokerCharges.js';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
async function bars(sym){const f=`/tmp/ycache/${sym}.json`;if(existsSync(f))return JSON.parse(readFileSync(f));
 const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10y&interval=1d`,{headers:{'User-Agent':'Mozilla/5.0'}});const d=(await r.json()).chart.result[0],q=d.indicators.quote[0];
 const out=d.timestamp.map((t,i)=>({t,o:q.open[i],h:q.high[i],l:q.low[i],c:q.close[i],v:q.volume[i]})).filter(b=>b.o>0&&b.h>0&&b.l>0&&b.c>0);writeFileSync(f,JSON.stringify(out));return out;}
const nifty=await bars('^NSEI'),nByT=new Map(nifty.map((b,i)=>[b.t,i]));
const cost=(p,notional)=>(orderCharges(p,'BUY',notional).total+orderCharges(p,'SELL',notional).total)/notional*100+0.1; // + 5 bps slippage each side
const CD=cost('equity-delivery',25000),CF=cost('futures',500000);
console.log('round-trip cost %: delivery ₹25k',CD.toFixed(3),'| futures ₹5L',CF.toFixed(3));
const rows=[];
for(const m of NIFTY50_UNIVERSE.members){const b=await bars(m.symbol+'.NS');
 for(let i=60;i<b.length-1;i++){const x=b[i],n=b[i+1],rng=x.h-x.l;if(!(rng>0))continue;
  const vol20=b.slice(i-20,i).reduce((a,y)=>a+y.v,0)/20,hi20=Math.max(...b.slice(i-20,i).map(y=>y.h)),sma50=b.slice(i-50,i).reduce((a,y)=>a+y.c,0)/50;
  const ni=nByT.get(x.t),nRet=ni>0?(nifty[ni].c/nifty[ni-1].c-1)*100:null;
  rows.push({clv:(x.c-x.l)/rng,ret:(x.c/b[i-1].c-1)*100,vr:vol20>0?x.v/vol20:0,newHigh:x.c>hi20,up50:x.c>sma50,nRet,gap:(n.o/x.c-1)*100,toClose:(n.c/x.c-1)*100,
   year:new Date(x.t*1000).getUTCFullYear()});}}
const stat=(label,f)=>{const s=rows.filter(f),g=s.map(r=>r.gap),avg=a=>a.reduce((x,y)=>x+y,0)/a.length;if(!s.length)return;
 const halves=[s.filter(r=>r.year<2021),s.filter(r=>r.year>=2021)].map(h=>avg(h.map(r=>r.gap)));
 console.log(label.padEnd(58),String(s.length).padStart(7),'gap avg',avg(g).toFixed(3).padStart(7),'| gap>0',(g.filter(x=>x>0).length/g.length*100).toFixed(1),'% | net delivery',(avg(g)-CD).toFixed(3),'| net futures',(avg(g)-CF).toFixed(3),'| halves',halves.map(h=>h.toFixed(3)).join('/'),'| hold to next close',avg(s.map(r=>r.toClose)).toFixed(3));};
stat('all stock-days',()=>true);
stat('close in top 10% of range',r=>r.clv>=0.9);
stat('top 10% + up >2% + volume 1.5x',r=>r.clv>=0.9&&r.ret>2&&r.vr>=1.5);
stat('top 10% + new 20d high + volume 1.5x',r=>r.clv>=0.9&&r.newHigh&&r.vr>=1.5);
stat('top 10% + new 20d high + vol 2x + NIFTY up',r=>r.clv>=0.9&&r.newHigh&&r.vr>=2&&r.nRet>0);
stat('top 10% + above SMA50 + NIFTY up >0.5%',r=>r.clv>=0.9&&r.up50&&r.nRet>0.5);
stat('up >3% + volume 2x',r=>r.ret>3&&r.vr>=2);
stat('close in bottom 10% (gap down expected)',r=>r.clv<=0.1);
stat('bottom 10% + down >2%: gap (for a short)',r=>r.clv<=0.1&&r.ret<-2);
