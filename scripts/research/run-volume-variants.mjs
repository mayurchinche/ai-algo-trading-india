import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {simulateFiveMinute} from '../../research/fiveMinuteExecution.js';
const [dataDir,calendarPath,outputDir]=process.argv.slice(2);
if(!outputDir)throw new Error('Usage: node scripts/research/run-volume-variants.mjs <dataset dir> <calendar.json> <new output dir>');
const output=resolve(outputDir);await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(resolve(dataDir,'manifest.json'),'utf8')),calendar=JSON.parse(await readFile(calendarPath,'utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex');
const paths=['research/volumeVariants.ts','research/asOfMarket.ts','research/fiveMinuteExecution.js','research/zerodhaCosts.js','src/services/discoveryScoring.ts','src/services/strongSignalPolicy.ts','src/services/tradingTime.ts','server/paperCosts.js'];
const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,sha(await readFile(p))])));
const protocol={id:'same-time-volume-diagnostic-v1',evaluationLabel:'IN_SAMPLE_DIAGNOSTIC_NOT_VALIDATION',variants:['baseline','same-time-composite','trend-momentum','mean-reversion'],rules:{volume:'Most recent 20 complete same-time prior prefixes; missing unavailable; observed source sessions, not independent warmup calendar',composite:'Existing weights and 70 threshold, replace only volume components',trend:'Mean of momentum and trend >=70 absolute; same sign; volume ratio >=1.5',reversion:'Mean reversion >=80 absolute; abs trend <=40; ratio >=1',risk:'Existing rounded stop distance, target 1.5R; existing liquidity guards'},window:['2026-09-07','2026-09-25'],sessions:calendar.sessions,calendarSource:calendar.source,universe:manifest.universe,policy:'strong-equity-observed-v3',capitalScenarios:[10000,20000],delaySeconds:[0,30,60],publicationLagMs:1000,slippageBps:5,costModel:'paper-costs-v1 approximation, not date-effective broker tariff',universeModel:'Eight previously selected surviving instruments, not historical screener membership',executionModel:'Next five-minute open strictly after eligibility; stop-first ambiguous bars; missing exposure remains unresolved and blocks entries',sourceHashes,inputManifestSha256:sha(await readFile(resolve(dataDir,'manifest.json')))};
// Exclusive creation ensures prior experiment outputs cannot be silently retuned/overwritten.
await writeFile(resolve(output,'protocol.json'),JSON.stringify(protocol,null,2),{flag:'wx'});
await build({entryPoints:['research/volumeVariants.ts'],outfile:resolve(output,'scorer.mjs'),bundle:true,platform:'node',format:'esm'});
const {createAsOfMarket,createSameTimeVolume,researchDecision,variantNames}=await import(pathToFileURL(resolve(output,'scorer.mjs')).href);
const signalsByVariant=Object.fromEntries(protocol.variants.map(v=>[v,[]]));
const signals=signalsByVariant.baseline,diagnostics=[],executionBars=[],seen=new Set();
const day=t=>new Date(t+19800000).toISOString().slice(0,10);
for(const symbol of manifest.universe){
 const normalized=[],invalid={daily:0,fiveMinute:0};
 for(const interval of ['1d','5m']){
  const record=manifest.results.find(r=>r.symbol===symbol&&r.interval===interval),raw=await readFile(resolve(dataDir,record.file));
  if(sha(raw)!==record.sha256)throw new Error('Input checksum mismatch');
  const d=JSON.parse(raw).chart.result[0],q=d.indicators.quote[0];
  for(let i=0;i<d.timestamp.length;i++){
   const start=d.timestamp[i]*1000,b={symbol,interval:interval==='1d'?'day':'5minute',start,end:interval==='1d'?Date.parse(day(start)+'T15:30:00+05:30'):start+300000,open:q.open[i],high:q.high[i],low:q.low[i],close:q.close[i],volume:q.volume[i]};
   b.availableAt=b.end+1000;
   if(interval==='5m'&&calendar.sessions.includes(day(start)))executionBars.push(b);
   if(![start,b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.low<=0||b.volume<0||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)){invalid[interval==='1d'?'daily':'fiveMinute']++;continue;}
   normalized.push(b);
  }
 }
 const market=createAsOfMarket(normalized,'5minute'),volume=createSameTimeVolume(normalized),counts={};let scored=0,strongObservations=0,maxAbsoluteScore=null;
 for(const date of calendar.sessions){
  const open=Date.parse(date+'T09:15:00+05:30');
  for(let end=open+300000;end<open+360*60000;end+=300000){
   const at=end+1000,r=market.snapshot(symbol,at);counts[r.status]=(counts[r.status]||0)+1;
   if(r.status!=='SCORED')continue;scored++;maxAbsoluteScore=Math.max(maxAbsoluteScore??0,Math.abs(r.stock.overallScore));
   const v=volume(symbol,at);counts['VOLUME_'+v.status]=(counts['VOLUME_'+v.status]||0)+1;
   if(v.status==='READY')for(const variant of variantNames){
    const decision=researchDecision(r.stock,v.ratio,variant);
    if(!decision.admitted)continue;
    const id=variant+':'+symbol+':'+date+':'+decision.side;
    if(seen.has(id))continue;seen.add(id);
    signalsByVariant[variant].push({id,symbol,at,price:r.stock.ltp,score:decision.score,side:decision.side,stop:decision.stop,target:decision.target,volumeRatio:v.ratio,volumeBaselineDates:v.dates});
   }
   const key=r.rejection||'ADMITTED';counts[key]=(counts[key]||0)+1;
   if(r.rejection)continue;strongObservations++;
   if(seen.has(r.signalId))continue;seen.add(r.signalId);
   const s=r.stock;signals.push({id:r.signalId,symbol,at,price:s.ltp,score:s.overallScore,side:s.overallScore>0?'BUY':'SELL',stop:s.foAnalysis.suggestedStopLoss,target:s.foAnalysis.suggestedTarget});
  }
 }
 diagnostics.push({symbol,invalid,scored,strongObservations,maxAbsoluteScore,counts});
}
const runs=protocol.variants.flatMap(variant=>protocol.capitalScenarios.flatMap(capital=>protocol.delaySeconds.map(delaySeconds=>({variant,...simulateFiveMinute({sessions:calendar.sessions,bars:executionBars,signals:signalsByVariant[variant],capital,delaySeconds})}))));
const report={protocol,diagnostics,signalsByVariant,runs,otherSections:[{segment:'short-term',status:'POLICY_NOT_READY'},{segment:'long-term',status:'POLICY_NOT_READY'},{segment:'options',status:'CONTRACT_DATA_AND_POLICY_NOT_READY'},{segment:'futures',status:'CONTRACT_DATA_AND_POLICY_NOT_READY'}],limitations:['Not exact live universe or tick execution','Missing data and corporate-action checks limit interpretation','Approximate fees and fixed slippage; no observed bid/ask or liquidity model','No profitability inference from zero or few completed trades']};
await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2));
const text=['# Same-time volume research: diagnostic results','',`Window: ${protocol.window.join(' to ')}. ${calendar.sessions.length} sessions; eight surviving instruments.`, '', 'Costs use the existing simulator approximation. This is not an exact production-strategy backtest.','', '| Variant | Capital | Delay | Signals | Closed | Unresolved | Win rate | Closed P&L |','|---|---|---|---|---|---|---|---|',...runs.map(r=>`| ${r.variant} | ${r.capital} | ${r.delaySeconds}s | ${r.metrics.signals} | ${r.metrics.closed} | ${r.metrics.unresolved} | ${r.metrics.winRatePct??'Unavailable'} | ${r.metrics.netClosedPnl} |`),'','## Signal coverage',...diagnostics.map(d=>`- ${d.symbol}: ${d.scored} scored observations; ${d.strongObservations} admissible strong observations; max absolute score ${d.maxAbsoluteScore}.`),'','Unscored observations and rejections are retained in results.json. Missing data is never interpolated. The other four sections remain explicitly untested; see their readiness states in results.json.'];
await writeFile(resolve(output,'REPORT.md'),text.join('\n')+'\n');console.log(JSON.stringify(runs.map(r=>({variant:r.variant,capital:r.capital,delay:r.delaySeconds,...r.metrics})),null,2));
