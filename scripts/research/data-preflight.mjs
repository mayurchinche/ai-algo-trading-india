import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fetchKiteHistory} from '../../research/kiteHistory.js';
const [output,manifestPath]=process.argv.slice(2);
if(!output)throw new Error('Usage: node [--env-file=.env.kite] scripts/research/data-preflight.mjs <report.json> [verified-instrument-manifest.json]');
const apiKey=process.env.KITE_API_KEY,accessToken=process.env.KITE_ACCESS_TOKEN;
const manifest=manifestPath?JSON.parse(await readFile(manifestPath,'utf8')):null;
const kinds=['equity-a','equity-b','index','futures','expired-option'],results=[];
for(const kind of kinds){
 const sample=manifest?.samples?.find(s=>s.kind===kind);
 if(!apiKey||!accessToken){results.push({kind,status:'CREDENTIALS_MISSING'});continue;}
 if(!sample?.instrumentToken||!sample.symbol||!sample.referenceSource||!sample.referenceAsOf){results.push({kind,status:'VERIFIED_INSTRUMENT_REFERENCE_REQUIRED'});continue;}
 const r=await fetchKiteHistory({apiKey,accessToken,instrumentToken:sample.instrumentToken,symbol:sample.symbol,from:'2026-09-07',to:'2026-09-07',interval:'minute'});
 const {bars,...summary}=r;
 results.push({kind,symbol:sample.symbol,referenceSource:sample.referenceSource,referenceAsOf:sample.referenceAsOf,...summary,...(bars?{barCount:bars.length,first:bars[0].start,last:bars.at(-1).start,sha256:createHash('sha256').update(JSON.stringify(bars)).digest('hex')}:{} )});
 // Stay below normal historical endpoint request rates; no retries on auth failure.
 if(r.status==='AUTH_OR_ENTITLEMENT_FAILED')break;
 await new Promise(resolve=>setTimeout(resolve,400));
}
for(const kind of kinds)if(!results.some(r=>r.kind===kind))results.push({kind,status:'NOT_PROBED_AFTER_AUTH_FAILURE'});
await writeFile(output,JSON.stringify({at:new Date().toISOString(),provider:'Kite',scope:'One-session sample only; not a complete dataset or independently authenticated historical contract mapping',results},null,2));
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.status!=='SAMPLE_RECEIVED_NOT_FULL_COVERAGE'))process.exitCode=2;
