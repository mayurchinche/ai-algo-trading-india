import {randomUUID} from 'node:crypto';
import {recordOpportunities} from './sharedOpportunities.js';
import {advanceWorkflow} from './paperWorkflow.js';
export function recordScan(state,observation,now,source){
 const at=new Date(now).toISOString(),day=new Date(now+19800000).toISOString().slice(0,10);
 const scan={at,source,status:observation.discoveryError?'SCAN_FAILED':!observation.marketOpen?'MARKET_CLOSED':observation.candidates?.length?'CANDIDATES_FOUND':'NO_ELIGIBLE_SIGNALS',...observation.scanDiagnostics};
 state.lastScan=scan;if(['worker','scheduler'].includes(source))state.lastWorkerAttemptAt=at;
 const history=state.scanDays||{};
 const daily=history[day]||{cycles:0,candidates:0,failures:0,firstAt:at};
 daily.rejections??={};for(const [reason,count] of Object.entries(scan.rejections||{}))daily.rejections[reason]=(daily.rejections[reason]||0)+count;
 daily.scored=(daily.scored||0)+(scan.scored||0);
 daily.cycles++;daily.candidates+=observation.candidates?.length||0;daily.failures+=['SCAN_FAILED','OBSERVATION_FAILED'].includes(scan.status)?1:0;daily.lastAt=at;daily.lastStatus=scan.status;history[day]=daily;
 const cutoff=new Date(now-30*86400000+19800000).toISOString().slice(0,10);
 state.scanDays=Object.fromEntries(Object.entries(history).filter(([date])=>date>=cutoff));
 return scan;
}
// Shared by foreground requests and the always-on worker; one database lease fences both.
export async function runSharedPaperCycle({db,observe,now=Date.now,source='foreground'}){
 const token=randomUUID();if(!await db.lease(token))return {status:'BUSY'};
 try{
  const account=await db.account(),time=now();
  if(account.state.lastCycleAt&&time-Date.parse(account.state.lastCycleAt)<10000)return {status:'THROTTLED'};
  let observation;
  try{observation=await observe(account,now());}
  catch{
   const state=structuredClone(account.state);recordScan(state,{discoveryError:true,scanDiagnostics:{status:'OBSERVATION_FAILED'}},now(),source);
   await db.commit(account,{state,enabled:account.enabled,events:[]});
   throw new Error('Paper observation unavailable');
  }
  const observed=recordOpportunities(account.state,observation.candidates,now(),observation.marketOpen);
  const admitted=new Set(observed.events.map(e=>e.signalId));
  const result=advanceWorkflow(observed.state,{...observation,candidates:(observation.candidates||[]).filter(c=>admitted.has(c.signalId)),now:now(),acceptEntries:account.enabled});
  result.events=[...observed.events,...result.events];result.enabled=account.enabled;
  Object.assign(result.state,{marketOpen:observation.marketOpen,missingQuotes:observation.missingQuotes||[],discoveryError:observation.discoveryError||null});
  if(observation.gapWatch)result.state.gapWatch=observation.gapWatch;
  recordScan(result.state,observation,now(),source);
  const saved=await db.commit(account,result);
  return saved==='conflict'?{status:'CONFLICT'}:{status:'SAVED',scan:result.state.lastScan};
 }finally{await db.release(token);}
}
