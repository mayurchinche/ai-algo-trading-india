// Validates every library strategy on a stored dataset (Yahoo daily 10y + 15-minute 60d per NIFTY 50 symbol,
// and index daily) with the same gate the app uses. Usage:
// node scripts/research/validate-library.mjs <daily dataset dir> <15m dir> [out.json]
import {readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {STRATEGIES,INDEX_UNDERLYINGS,buildStrategySpec,strategyById} from '../../shared/strategyLibrary.js';
import {backtestSymbol,poolResults,symbolVerdict} from '../../shared/strategyValidation.js';
const [daily,intra,out]=process.argv.slice(2);if(!daily||!intra)throw new Error('Usage: validate-library.mjs <daily dir> <15m dir> [out.json]');
const manifest=JSON.parse(await readFile(resolve(daily,'manifest.json'),'utf8'));
function bars(json){const r=JSON.parse(json).chart?.result?.[0];if(!r)return [];const q=r.indicators.quote[0];
 return r.timestamp.map((t,i)=>({time:t*1000,open:q.open[i],high:q.high[i],low:q.low[i],close:q.close[i],volume:q.volume[i]??0})).filter(b=>[b.open,b.high,b.low,b.close].every(v=>v>0)&&b.high>=b.low);}
// Yahoo daily stamps are 09:15 IST; specs expect a daily bar at IST midnight.
const toDaily=bs=>bs.map(b=>({...b,time:Date.parse(new Date(b.time+19800000).toISOString().slice(0,10)+'T00:00:00+05:30')}));
const load=async(dir,file)=>{try{return bars(await readFile(resolve(dir,file),'utf8'));}catch{return [];}};
const IDX={NIFTY:'idx_%5ENSEI.json',BANKNIFTY:'idx_%5ENSEBANK.json'},LOT={NIFTY:65,BANKNIFTY:30};
// Stock futures: research lot = about ₹1 lakh notional, so per-trade returns compare across symbols.
const lotFor=b=>{const c=b.map(x=>x.close).sort((x,y)=>x-y);return c.length?Math.max(1,Math.round(1e5/c[Math.floor(c.length/2)])):1;};
const report=[];
for(const s of STRATEGIES){
 const proxy=s.validationProxy?strategyById(s.validationProxy):s;
 const symbols=s.universe==='fno'?[...manifest.universe,...INDEX_UNDERLYINGS]:manifest.universe;
 const results=[];
 for(const sym of symbols){
  const b=IDX[sym]?toDaily(await load(daily,IDX[sym])):s.timeframe==='1d'?toDaily(await load(daily,sym.replace(/[^A-Z0-9-]/g,'_')+'.1d.json')):await load(intra,sym+'.15m.json');
  results.push({sym,r:backtestSymbol(buildStrategySpec(proxy,{symbol:sym,units:1,lots:1}),b,{lotSize:LOT[sym]??lotFor(b)})});
 }
 const pool=poolResults(results.map(x=>x.r)),v=results.map(x=>({symbol:x.sym,...symbolVerdict(x.r,pool),stats:x.r.stats??null}));
 report.push({id:s.id,segment:s.segment,proxy:proxy.id,pool,validated:v.filter(x=>x.verdict==='VALIDATED').map(x=>x.symbol)});
 const p=pool.stats;console.log(`${s.id.padEnd(36)} trades ${String(p.trades).padStart(5)} win ${(p.winRate*100).toFixed(1).padStart(5)}% avg ${p.expectancyPct?.toFixed(3).padStart(7)}% PF ${p.profitFactor?.toFixed(2)} halves ${pool.halves.first.expectancyPct?.toFixed(3)}/${pool.halves.second.expectancyPct?.toFixed(3)} ${pool.passed?'PASS':'FAIL'} validated symbols ${v.filter(x=>x.verdict==='VALIDATED').length}`);
}
if(out)await writeFile(out,JSON.stringify({manifest:{fetchedAt:manifest.fetchedAt,range:manifest.range},report},null,1));
