// Research only: NIFTY 50 and India VIX daily bars from Yahoo, cached in ~/.cache/ai-algo-trading/index.
// Returns Map date(YYYY-MM-DD, IST) → {o,h,l,c}. Refetched when the cache is older than a day.
import {existsSync,readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
const DIR=join(homedir(),'.cache','ai-algo-trading','index');
export async function indexBars(symbol){
 mkdirSync(DIR,{recursive:true});const f=join(DIR,symbol.replace(/[^A-Z0-9]/gi,'_')+'.json');
 if(!existsSync(f)||Date.now()-statSync(f).mtimeMs>86400000){
  const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=11y&interval=1d`,{headers:{'User-Agent':'Mozilla/5.0'}});
  const d=(await r.json()).chart.result[0],q=d.indicators.quote[0];
  writeFileSync(f,JSON.stringify(d.timestamp.map((t,i)=>({d:new Date(t*1000+19800000).toISOString().slice(0,10),o:q.open[i],h:q.high[i],l:q.low[i],c:q.close[i]})).filter(b=>b.o>0&&b.c>0)));
 }
 return new Map(JSON.parse(readFileSync(f,'utf8')).map(b=>[b.d,b]));
}
