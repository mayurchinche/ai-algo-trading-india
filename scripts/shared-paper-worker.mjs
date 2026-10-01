// Always-on shared user1 paper simulation. No broker orders or notifications.
import {sharedStore} from '../server/sharedPaper.js';
import {runSharedPaperCycle} from '../server/sharedPaperCycle.js';
import {observeSharedPaper} from '../server/sharedPaperObservation.bundle.mjs';
if(process.env.SHARED_PAPER_ENABLED!=='true')throw new Error('Shared paper backend must be explicitly enabled');
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Server database configuration missing');
const once=process.argv.includes('--once');let stopped=false;
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
do{
 try{const result=await runSharedPaperCycle({db:sharedStore('intraday'),observe:observeSharedPaper,source:'worker'});console.log(JSON.stringify({at:new Date().toISOString(),...result}));}
 catch{console.error(JSON.stringify({at:new Date().toISOString(),status:'CYCLE_FAILED',note:'No replacement quotes or fills generated'}));if(once)process.exitCode=1;}
 if(!stopped&&!once)await new Promise(resolve=>setTimeout(resolve,15000));
}while(!stopped&&!once);
