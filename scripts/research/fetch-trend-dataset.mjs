// Fetch a fixed daily dataset for the trend replay: NSE's published NIFTY 50 constituent list and
// Yahoo daily charts for each symbol. Every raw file is stored with its SHA-256 in manifest.json.
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [outputDir,range='10y']=process.argv.slice(2);
if(!outputDir)throw new Error('Usage: node scripts/research/fetch-trend-dataset.mjs <new dataset dir> [range=10y]');
if(!/^\d{1,2}y$/.test(range))throw new Error('range must look like 10y');
const output=resolve(outputDir);await mkdir(output);// fails if it already exists
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const sha=b=>createHash('sha256').update(b).digest('hex');
// NSE archives need a browser user agent; Yahoo rate-limits it and accepts the short form used by api/market.js.
async function get(url){const r=await fetch(url,{headers:{'User-Agent':new URL(url).hostname.endsWith('yahoo.com')?'Mozilla/5.0':UA,Accept:'*/*'},redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());}
const listUrl='https://nsearchives.nseindia.com/content/indices/ind_nifty50list.csv',list=await get(listUrl);
await writeFile(resolve(output,'ind_nifty50list.csv'),list,{flag:'wx'});
const [header,...rows]=list.toString('utf8').trim().split(/\r?\n/).map(l=>l.split(',').map(c=>c.trim()));
const symbolColumn=header.indexOf('Symbol'),isinColumn=header.indexOf('ISIN Code');
if(symbolColumn<0||isinColumn<0)throw new Error('Unexpected constituent list header: '+header.join(','));
const universe=rows.map(r=>({symbol:r[symbolColumn],isin:r[isinColumn]})).filter(r=>/^[A-Z0-9&-]{1,30}$/.test(r.symbol));
const results=[],failures=[];
for(const {symbol,isin} of universe){
 const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol+'.NS')}?interval=1d&range=${range}`;
 try{const body=await get(url),file=`${symbol.replace(/[^A-Z0-9-]/g,'_')}.1d.json`;await writeFile(resolve(output,file),body,{flag:'wx'});results.push({symbol,isin,url,file,sha256:sha(body)});}
 catch(e){failures.push({symbol,url,error:String(e.message)});}
 await new Promise(r=>setTimeout(r,300));
}
const manifest={dataset:'trend-replay-daily',fetchedAt:new Date().toISOString(),range,universeSource:{url:listUrl,file:'ind_nifty50list.csv',sha256:sha(list),note:'Constituents on the fetch date, applied to all past years.'},universe:results.map(r=>r.symbol),results,failures};
await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
console.log(`Saved ${results.length}/${universe.length} symbols to ${output}${failures.length?`; failed: ${failures.map(f=>f.symbol).join(', ')}`:''}`);
