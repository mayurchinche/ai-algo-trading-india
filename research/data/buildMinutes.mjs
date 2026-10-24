// node --env-file=.env.worker research/data/buildMinutes.mjs [2022-01 2026-10] — 1-minute NSE candles (Upstox historical API,
// available from Jan 2022, one month per call) for the most liquid stocks: top 100 by 2022 turnover ∪ top 100 by last-year turnover
// (so the universe is not only today's winners). Cache: ~/.cache/ai-algo-trading/min/<SYMBOL>/<YYYY-MM>.json.gz  rows [t,o,h,l,c,v]
import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {loadAll} from '../lib/panel.mjs';
const TOKEN=process.env.UPSTOX_ANALYTICS_TOKEN;if(!TOKEN){console.error('UPSTOX_ANALYTICS_TOKEN missing');process.exit(1);}
const [from='2022-01',to=new Date().toISOString().slice(0,7)]=process.argv.slice(2),ROOT=join(homedir(),'.cache','ai-algo-trading','min');
const avg=(s,a,b)=>{let t=0,n=0;s.d.forEach((d,i)=>{if(d>=a&&d<=b){t+=s.val[i]??0;n++;}});return n>150?t/n:0;};
const all=loadAll({minBars:250}).series.filter(s=>s.isin&&s.d.at(-1)>=to+'-01'||s.d[0]<'2022-06-01'&&s.isin);
const top=(a,b)=>all.map(s=>({s,v:avg(s,a,b)})).filter(x=>x.v>0).sort((x,y)=>y.v-x.v).slice(0,100).map(x=>x.s);
const uni=[...new Map([...top('2022-01-01','2022-12-31'),...top('2025-10-01','2026-10-31')].map(s=>[s.symbol,s])).values()];
const months=[];for(let [y,m]=from.split('-').map(Number);`${y}-${String(m).padStart(2,'0')}`<=to;m++>11&&(m=1,y++))months.push(`${y}-${String(m).padStart(2,'0')}`);
const jobs=[];for(const s of uni)for(const m of months)if(!existsSync(join(ROOT,s.symbol,m+'.json.gz')))jobs.push([s,m]);
console.log('symbols',uni.length,'months',months.length,'calls',jobs.length);
const eom=m=>{const [y,mo]=m.split('-').map(Number),e=new Date(Date.UTC(y,mo,0)).toISOString().slice(0,10);return e>new Date().toISOString().slice(0,10)?new Date().toISOString().slice(0,10):e;};
let done=0,fail=0;
async function one([s,m]){
 const url=`https://api.upstox.com/v2/historical-candle/NSE_EQ%7C${s.isin}/1minute/${eom(m)}/${m}-01`;
 for(let a=0;a<8;a++){
  try{const r=await fetch(url,{headers:{Authorization:'Bearer '+TOKEN,Accept:'application/json'}});
   if(r.status===429){await new Promise(z=>setTimeout(z,20000*(a+1)));continue;}
   const j=await r.json();if(j.status!=='success'){fail++;return;}
   const rows=j.data.candles.map(c=>[c[0].slice(0,16),c[1],c[2],c[3],c[4],c[5]]).reverse();
   mkdirSync(join(ROOT,s.symbol),{recursive:true});writeFileSync(join(ROOT,s.symbol,m+'.json.gz'),gzipSync(JSON.stringify(rows)));return;
  }catch{await new Promise(z=>setTimeout(z,1000));}
 }fail++;
}
const q=[...jobs];await Promise.all(Array.from({length:3},async()=>{while(q.length){await one(q.shift());if(++done%200===0)console.log(done,'/',jobs.length,'fail',fail);}}));
console.log('done',done,'fail',fail);
