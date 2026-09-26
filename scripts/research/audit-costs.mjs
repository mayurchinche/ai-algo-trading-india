import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {simulateFiveMinute} from '../../research/fiveMinuteExecution.js';
import {zerodhaIntradayCosts,costModelId,tariffSources} from '../../research/zerodhaCosts.js';
const [priorPath,dataset,output]=process.argv.slice(2);
if(!output)throw new Error('Usage: audit-costs.mjs <prior results> <dataset> <new output>');
const sha=x=>createHash('sha256').update(x).digest('hex');
const priorRaw=await readFile(priorPath),prior=JSON.parse(priorRaw),manifest=JSON.parse(await readFile(resolve(dataset,'manifest.json')));
await mkdir(output,{recursive:true});
const sourceHashes=Object.fromEntries(await Promise.all(['research/fiveMinuteExecution.js','research/zerodhaCosts.js'].map(async p=>[p,sha(await readFile(p))])));
await writeFile(resolve(output,'protocol.json'),JSON.stringify({costModelId,tariffSources,sourceHashes,priorSha256:sha(priorRaw),inputManifestSha256:sha(await readFile(resolve(dataset,'manifest.json'))),purpose:'Frozen signals; cost-only closed-trade repricing and separate risk-resized replay. Diagnostic, not forward validation.',exitRepair:'None; missing exposure remains unresolved'},null,2),{flag:'wx'});
const bars=[];
for(const rec of manifest.results.filter(r=>r.interval==='5m')){
 const raw=await readFile(resolve(dataset,rec.file));if(sha(raw)!==rec.sha256)throw new Error('Input checksum mismatch');
 const d=JSON.parse(raw).chart.result[0],q=d.indicators.quote[0];
 for(let i=0;i<d.timestamp.length;i++)bars.push({symbol:rec.symbol,start:d.timestamp[i]*1000,open:q.open[i],high:q.high[i],low:q.low[i],close:q.close[i],volume:q.volume[i]});
}
const repriced=prior.runs.filter(r=>r.delaySeconds===60).map(r=>({variant:r.variant,capital:r.capital,unresolved:r.metrics.unresolved,trades:r.orders.filter(o=>o.status==='CLOSED').map(o=>{
 const charges=zerodhaIntradayCosts({entry:o.entry,exit:o.exit,quantity:o.qty,side:o.side,date:o.date});
 return {id:o.id,symbol:o.symbol,date:o.date,quantity:o.qty,oldFees:o.fees,charges,netPnl:Math.round(((o.exit-o.entry)*o.qty*o.direction-charges.total)*100)/100};
})}));
const runs=Object.entries(prior.signalsByVariant).flatMap(([variant,signals])=>[10000,20000].map(capital=>({variant,...simulateFiveMinute({sessions:prior.protocol.sessions,bars,signals,capital,delaySeconds:60,costModel:costModelId})})));
await writeFile(resolve(output,'results.json'),JSON.stringify({repriced,runs,forwardTestingReady:false,blockers:['Missing exit bars','Tariff estimates not reconciled to contract notes','Historical universe and corporate actions unverified']},null,2));
console.log(JSON.stringify(runs.map(r=>({variant:r.variant,capital:r.capital,...r.metrics})),null,2));
