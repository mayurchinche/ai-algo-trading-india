import {runSegmentPaperCycle} from './segmentPaperCycle.js';
import {authorizeScheduler,emptySchedulerBody} from './schedulerAuth.js';
import {sharedStore} from './sharedPaper.js';
import {runSharedPaperCycle} from './sharedPaperCycle.js';
export function scheduledPaperWindow(now){
 const ist=new Date(now+19800000),minute=ist.getUTCHours()*60+ist.getUTCMinutes();
 return ist.getUTCDay()>0&&ist.getUTCDay()<6&&minute>=555&&minute<=935;
}
// Dedicated scheduler credential; never accept the public client's tick body or prices.
export function createScheduledPaperHandler({observe,store=sharedStore,run=runSharedPaperCycle,now=Date.now,secret=()=>process.env.PAPER_SCHEDULER_SECRET,enabled=()=>process.env.SHARED_PAPER_ENABLED==='true',multiEnabled=()=>process.env.MULTI_MODE_PAPER_ENABLED==='true',runSegment=runSegmentPaperCycle}={}){
 return async(req,res)=>{
  if(!authorizeScheduler(req,res,secret(),'Paper scheduler is not configured'))return;
  if(!enabled())return res.status(503).json({error:'Shared paper execution is disabled'});
  if(!emptySchedulerBody(req.body))return res.status(400).json({error:'Scheduler payload must be empty'});
  if(!scheduledPaperWindow(now()))return res.status(200).json({status:'OUTSIDE_MONITORING_WINDOW'});
  try{
   if(multiEnabled()){
    const segments=['intraday','short-term','long-term','options','futures'];
    const outcomes=await Promise.allSettled(segments.map(segment=>segment==='intraday'?run({db:store(segment),observe,now,source:'scheduler'}):runSegment({db:store(segment),segment,now,source:'scheduler'})));
    const results=Object.fromEntries(outcomes.map((outcome,i)=>[segments[i],outcome.status==='fulfilled'?outcome.value:{status:'CYCLE_FAILED'}]));
    const unhealthy=Object.values(results).some(r=>r.status==='CYCLE_FAILED'||['SCAN_FAILED','OBSERVATION_FAILED'].includes(r.scan?.status));
    return res.status(unhealthy?503:200).json({status:unhealthy?'PARTIAL_FAILURE':'COMPLETED',segments:results});
   }
   const result=await run({db:store('intraday'),observe,now,source:'scheduler'});
   const unhealthy=['SCAN_FAILED','OBSERVATION_FAILED'].includes(result.scan?.status);
   return res.status(unhealthy?503:200).json(result);
  }catch{return res.status(503).json({error:'Paper cycle failed; inspect shared scan diagnostics. No replacement fills generated.'});}
 };
}
