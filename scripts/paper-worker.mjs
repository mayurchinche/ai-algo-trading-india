// Always-on process, NOT a Vercel request/cron. No real orders or push notifications.
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { backend,check } from '../server/pushBackend.js';
import { advancePaper } from '../server/paperEngine.js';
const origin=process.env.MARKET_API_ORIGIN;
if(!origin || new URL(origin).protocol!=='https:') throw new Error('MARKET_API_ORIGIN must be your HTTPS backend');
await mkdir('.worker-build',{recursive:true});
await build({stdin:{contents:`export {discoverStocks,fetchQuotes} from './src/services/stockDiscovery'; export {strongSignalRejection,strongSignalId} from './src/services/strongSignalPolicy';`,resolveDir:process.cwd()},outfile:'.worker-build/paper-market.mjs',bundle:true,format:'esm',platform:'node',define:{'import.meta.env':JSON.stringify({DEV:false,VITE_API_BASE_URL:origin})}});
const {discoverStocks,fetchQuotes,strongSignalRejection,strongSignalId}=await import('../.worker-build/paper-market.mjs');
const db=backend();let stopped=false,candidates=[],scanning=false,lastScan=0;
process.on('SIGTERM',()=>{stopped=true});process.on('SIGINT',()=>{stopped=true});
async function discover() {
 if(scanning)return;scanning=true;
 try { const stocks=await discoverStocks();const now=Date.now();candidates=stocks.filter(s=>!strongSignalRejection(s,now)).map(s=>({symbol:s.symbol,signalId:strongSignalId(s,now),signalTime:s.generatedAt,side:s.overallScore>0?'BUY':'SELL',score:s.overallScore,stop:s.foAnalysis.suggestedStopLoss,target:s.foAnalysis.suggestedTarget}));lastScan=now; }
 catch {candidates=[];console.error('Paper discovery unavailable; entries paused');}
 finally {scanning=false;}
}
async function accounts() {
 const rows=[];for(let offset=0;;offset+=500) {const page=check(await db.from('paper_accounts').select('*').order('user_id').range(offset,offset+499));rows.push(...page);if(page.length<500)return rows;}
}
async function cycle() {
 const response=await fetch(`${origin}/api/market?provider=nse&path=%2Fapi%2FmarketStatus`,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Market status unavailable');
 const market=(await response.json()).marketState?.find(m=>['Capital Market','CM'].includes(m.market));
 if(!market||typeof market.marketStatus!=='string')throw new Error('Market state missing');
 const marketOpen=market.marketStatus.trim().toLowerCase()==='open';
 if(marketOpen&&Date.now()-lastScan>60000)void discover();
 const rows=await accounts();
 const symbols=[...new Set([...candidates.map(s=>s.symbol),...rows.flatMap(a=>a.state.orders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status)).map(o=>o.symbol))])];
 const fetched=await fetchQuotes(symbols),quotes=[...fetched].map(([symbol,q])=>({symbol,...q}));
 for(const account of rows) {
  const {state,events}=advancePaper(account.state,{now:Date.now(),quotes,candidates,marketOpen,acceptEntries:account.enabled});
  state.feedMode='PUBLIC_QUOTE_SNAPSHOTS';state.marketOpen=marketOpen;state.missingQuotes=[...new Set(state.orders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status)).map(o=>o.symbol))].filter(s=>!fetched.has(s));
  const saved=check(await db.rpc('commit_paper_cycle',{p_user:account.user_id,p_revision:account.revision,p_state:state,p_events:events}));
  if(!saved)console.warn('Paper account changed concurrently; stale cycle discarded');
 }
}
while(!stopped) {
 try {await cycle();}catch {console.error(JSON.stringify({event:'paper_cycle_failed',at:new Date().toISOString(),note:'No replacement quotes or fills generated. Check provider/database.'}));}
 if(!stopped)await new Promise(resolve=>setTimeout(resolve,5000));
}
