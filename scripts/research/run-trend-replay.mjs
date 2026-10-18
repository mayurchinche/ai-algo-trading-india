// Run the pre-declared trend-score replay on a dataset from fetch-trend-dataset.mjs.
// Writes protocol.json exclusively first, so an existing study can never be silently re-run or retuned.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {replayTrendSymbol,summarizeTrendReplay,TREND_REPLAY_PROTOCOL} from '../../research/trendReplay.js';
import {TREND_MODEL} from '../../shared/trendScore.js';
const [dataDir,outputDir]=process.argv.slice(2);
if(!outputDir)throw new Error('Usage: node scripts/research/run-trend-replay.mjs <dataset dir> <new output dir>');
const output=resolve(outputDir);await mkdir(output,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifestRaw=await readFile(resolve(dataDir,'manifest.json')),manifest=JSON.parse(manifestRaw);
const sources=['shared/trendScore.js','shared/indicators.js','research/trendReplay.js'];
const protocol={...TREND_REPLAY_PROTOCOL,trendModel:TREND_MODEL,evaluationLabel:'SINGLE_PRE_DECLARED_PARAMETER_SET',inputManifestSha256:sha(manifestRaw),universeSource:manifest.universeSource,universe:manifest.universe,
 sourceHashes:Object.fromEntries(await Promise.all(sources.map(async p=>[p,sha(await readFile(p))])))};
await writeFile(resolve(output,'protocol.json'),JSON.stringify(protocol,null,2),{flag:'wx'});
const cutoff=new Date(Date.parse(manifest.fetchedAt)+19800000).toISOString().slice(0,10);
const istDate=s=>new Date(s*1000+19800000).toISOString().slice(0,10);
const results=[],diagnostics=[];
for(const record of manifest.results){
 const raw=await readFile(resolve(dataDir,record.file));if(sha(raw)!==record.sha256)throw new Error('Input checksum mismatch: '+record.file);
 const chart=JSON.parse(raw).chart?.result?.[0],q=chart?.indicators?.quote?.[0];
 const counts={received:chart?.timestamp?.length||0,invalid:0,duplicate:0,notCompleted:0};const bars=[];
 for(let i=0;i<(chart?.timestamp?.length||0);i++){
  const b={date:istDate(chart.timestamp[i]),open:q.open[i],high:q.high[i],low:q.low[i],close:q.close[i]};
  if(![b.open,b.high,b.low,b.close].every(Number.isFinite)||b.low<=0||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)){counts.invalid++;continue;}
  if(b.date>=cutoff){counts.notCompleted++;continue;}
  if(bars.length&&b.date<=bars.at(-1).date){counts.duplicate++;continue;}
  bars.push(b);
 }
 diagnostics.push({symbol:record.symbol,...counts,used:bars.length});
 if(bars.length>TREND_MODEL.zlemaLength+TREND_MODEL.slopeBars+protocol.forwardSessions)results.push(replayTrendSymbol(record.symbol,bars));
}
const summary=summarizeTrendReplay(results);
await writeFile(resolve(output,'results.json'),JSON.stringify({protocol,summary,diagnostics,results},null,2));
const pct=v=>v===null?'n/a':(v*100).toFixed(2)+'%',t=summary.trades;
const report=`# Trend score replay — ${protocol.id}

Model: \`${TREND_MODEL.id}\`. ${TREND_MODEL.formula}. ${TREND_MODEL.signals}.
Dataset: ${manifest.universe.length} symbols, fetched ${manifest.fetchedAt} (range ${manifest.range}), manifest SHA-256 \`${protocol.inputManifestSha256}\`.
Execution: ${protocol.execution} Cost: ${protocol.costModel}

**Status: ${summary.status}**

| Check | Result |
|---|---|
| Closed trades ≥ ${protocol.criteria.minClosedTrades} | ${t.closed} — ${summary.checks.enoughTrades?'pass':'fail'} |
| Mean net trade return > 0 with t ≥ ${protocol.criteria.minMeanNetTradeT} | ${pct(t.meanNet)}, t = ${t.meanNetT?.toFixed(2)??'n/a'} — ${summary.checks.positiveNetEdge?'pass':'fail'} |
| ${protocol.forwardSessions}-session return after BUY exceeds all-session average in both halves | ${summary.forwardStudy.map(h=>`${h.half}: ${pct(h.excess)} (${h.events} events)`).join('; ')} — ${summary.checks.forwardExcessBothHalves?'pass':'fail'} |

Trades: win rate ${pct(t.winRate)}, mean gross ${pct(t.meanGross)}, median net ${pct(t.medianNet)}, mean holding ${t.meanSessionsHeld?.toFixed(1)??'n/a'} sessions, ${t.open} still open.
Versus buy-and-hold: ${summary.strategyVersusBuyAndHold.beatBuyAndHold}/${summary.strategyVersusBuyAndHold.symbols} symbols beat it; median difference ${pct(summary.strategyVersusBuyAndHold.medianDifference)}. Median time in market ${pct(summary.medianExposure)}; median max drawdown ${pct(summary.medianMaxDrawdown.strategy)} for the strategy versus ${pct(summary.medianMaxDrawdown.buyAndHold)} for buy-and-hold.

Limitations:
${summary.limitations.map(l=>'- '+l).join('\n')}
`;
await writeFile(resolve(output,'REPORT.md'),report);
console.log(report);
