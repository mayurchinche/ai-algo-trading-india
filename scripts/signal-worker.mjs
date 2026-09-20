// Run on an always-on backend, never in the phone's WebView. No live orders are placed.
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { backend, check } from '../server/pushBackend.js';
import { equityAlert } from '../server/alertPolicy.js';
import { dispatchAlerts } from '../server/dispatchAlerts.js';
const origin = process.env.MARKET_API_ORIGIN;
if (!origin || !origin.startsWith('https://')) throw new Error('Set MARKET_API_ORIGIN to your HTTPS app backend');
await mkdir('.worker-build',{recursive:true});
await build({entryPoints:['src/services/stockDiscovery.ts'],outfile:'.worker-build/discovery.mjs',bundle:true,format:'esm',platform:'node',define:{'import.meta.env':JSON.stringify({DEV:false})}});
const { discoverStocks }=await import('../.worker-build/discovery.mjs');
const nativeFetch=globalThis.fetch;
globalThis.fetch=(url,opts={})=>nativeFetch(new URL(url,origin),{...opts,signal:opts.signal||AbortSignal.timeout(15000)});
const db=backend();
let stopping=false, lastCleanup=0;
process.on('SIGTERM',()=>{stopping=true}); process.on('SIGINT',()=>{stopping=true});
async function scan() {
 const status=await fetch('/api/market?provider=nse&path=%2Fapi%2FmarketStatus');
 if (!status.ok) throw new Error('Market status unavailable');
 const market=(await status.json()).marketState?.find(m=>m.market==='Capital Market'||m.market==='CM');
 if (market?.marketStatus?.toLowerCase()!=='open') return;
 const stocks=await discoverStocks(); let queued=0;
 for(const stock of stocks){ const alert=equityAlert(stock); if(alert) queued+=check(await db.rpc('enqueue_mobile_alert',{signal:alert}))||0; }
 console.log(JSON.stringify({event:'scan_complete',at:new Date().toISOString(),queued}));
}
let nextScan=0;
while(!stopping){
 const started=Date.now();
 try {
  if(started>=nextScan){await scan();nextScan=Date.now()+60000;}
  const statuses=await dispatchAlerts(db);
  if(statuses.length) console.log(JSON.stringify({event:'dispatch',at:new Date().toISOString(),statuses}));
  if(started-lastCleanup>86400000){check(await db.rpc('cleanup_mobile_alerts'));lastCleanup=started;}
 } catch { console.error(JSON.stringify({event:'worker_cycle_failed',at:new Date().toISOString(),note:'Check provider and backend configuration; no successful delivery assumed'}));nextScan=Date.now()+60000; }
 if(!stopping) await new Promise(resolve=>setTimeout(resolve,15000));
}
