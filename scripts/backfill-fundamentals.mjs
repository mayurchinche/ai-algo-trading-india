// Operator-run backfill of annual fundamentals into Supabase, or a dry run with an in-memory store.
//   node --env-file=.env.worker scripts/backfill-fundamentals.mjs --nifty50
//   node scripts/backfill-fundamentals.mjs --dry-run INFY:INE009A01021 TCS   (SYMBOL or SYMBOL:ISIN)
import {writeFile} from 'node:fs/promises';
import {backfillFundamentalFilings} from '../server/fundamentalsBackfill.js';
import {fundamentalsStore} from '../server/fundamentalsStore.js';
import {deriveFundamentals} from '../server/fundamentals.js';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';
const args=process.argv.slice(2),flag=f=>args.includes(f),out=args.find(a=>a.startsWith('--report='))?.slice(9);
const targets=flag('--nifty50')?NIFTY50_UNIVERSE.members.map(m=>({...m})):args.filter(a=>!a.startsWith('--')).map(a=>{const [symbol,isin]=a.split(':');return isin?{symbol,isin}:{symbol};});
if(!targets.length)throw new Error('Usage: backfill-fundamentals.mjs [--dry-run] [--report=path.json] (--nifty50 | SYMBOL[:ISIN]...)');
const memory=new Map();
const store=flag('--dry-run')?{known:async ids=>ids.filter(id=>memory.has(id)).map(id=>({id})),save:async f=>{if(!memory.has(f.id))memory.set(f.id,f);return memory.get(f.id);},forInstrument:async key=>[...memory.values()].filter(f=>f.instrumentKey===key).map(filing=>({filing}))}:fundamentalsStore();
const report=await backfillFundamentalFilings({targets,store});
if(out)await writeFile(out,JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify(report.coverage));
for(const r of report.symbols){
 const counts=Object.entries(r.outcomes.reduce((m,o)=>(m[o.status]=(m[o.status]||0)+1,m),{})).map(([k,v])=>k+':'+v).join(' ');
 let line=`${r.symbol.padEnd(11)} ${r.status.padEnd(17)} ${counts}`;
 if(flag('--dry-run')){
  const key=r.isin?'NSE_EQ|'+r.isin:[...memory.values()].find(f=>f.symbol===r.symbol)?.instrumentKey;
  if(key&&[...memory.values()].some(f=>f.instrumentKey===key)){const d=deriveFundamentals((await store.forInstrument(key)).map(x=>x.filing),{instrumentKey:key,asOf:Date.now()});const c=d.scopes.Consolidated||d.scopes.Standalone;
   line+=` | ${c.latestAnnualPeriod?.end??'no annual period'} ${c.ratios.map(x=>x.key+'='+(x.value===null?x.status:x.value.toFixed(2))).join(' ')} rev1y=${c.growth.find(g=>g.key==='revenue'&&g.years===1).valuePct?.toFixed(1)??'n/a'}`;}
 }
 console.log(line);
}
