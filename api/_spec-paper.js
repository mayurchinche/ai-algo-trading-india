import {allowRequest} from '../server/pushBackend.js';
import {specPaperStore} from '../server/specPaperStore.js';
import {createSpecPaperMarket} from '../server/specPaperMarket.js';
import {newPaperState,validatePaperOptions,stopRunState,summarizeRun,runSpecPaperCycle} from '../server/specPaperRunner.js';
import {parseStrategySpec} from '../shared/strategySpec.js';
import {authorizeScheduler,emptySchedulerBody} from '../server/schedulerAuth.js';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const unavailable='Spec paper storage unavailable. Check the spec-paper-runs migration and server connection. Nothing was saved.';

// GET lists runs or pages one run's ledger; POST {action:'create', id, spec, options} or {action:'stop', id}. Paper only.
export function createSpecPaperHandler({store=specPaperStore,now=Date.now}={}){return async(req,res)=>{
 if(!allowRequest(req,res))return;
 if(req.method==='GET'){
  // ?ledger=<run id>&after=<seq>&limit=<n> pages the permanent event ledger of one run.
  const q=req.query??{};
  if(q.ledger!==undefined){
   const after=Number(q.after??0),limit=Number(q.limit??500);
   if(typeof q.ledger!=='string'||!UUID.test(q.ledger)||!Number.isInteger(after)||after<0||!Number.isInteger(limit)||limit<1||limit>1000)return res.status(400).json({error:'ledger (run id), after (>=0) and limit (1-1000) are required'});
   try{const rows=await store().events(q.ledger,after,limit);return res.status(200).json({runId:q.ledger,events:rows,next:rows.length===limit?rows.at(-1).seq:null});}catch{return res.status(503).json({error:unavailable});}
  }
  try{return res.status(200).json({account:'user1',runs:(await store().list()).map(summarizeRun)});}catch{return res.status(503).json({error:unavailable});}
 }
 if(req.method!=='POST')return res.status(405).json({error:'GET or POST required'});
 const b=req.body;
 if(!b||typeof b!=='object'||typeof b.id!=='string'||!UUID.test(b.id))return res.status(400).json({error:'A request id (UUID v4) is required.'});
 if(b.action==='create'){
  if(Object.keys(b).some(k=>!['action','id','spec','options'].includes(k)))return res.status(400).json({error:'Unexpected fields'});
  const parsed=parseStrategySpec(b.spec);if(!parsed.ok)return res.status(400).json({error:'Invalid strategy spec',issues:parsed.issues});
  let options;try{options=validatePaperOptions(b.options);}catch(e){return res.status(400).json({error:e.message});}
  try{const saved=await store().create(b.id,parsed.spec,options,newPaperState(parsed.spec,options,now()));return res.status(201).json({run:summarizeRun(saved)});}catch{return res.status(503).json({error:unavailable});}
 }
 if(b.action==='stop'){
  if(Object.keys(b).some(k=>!['action','id'].includes(k)))return res.status(400).json({error:'Unexpected fields'});
  try{
   const db=store(),run=await db.get(b.id);if(!run)return res.status(404).json({error:'Run not found'});
   if(run.status!=='ACTIVE')return res.status(200).json({run:summarizeRun(run)});
   const {state,events}=stopRunState(run,now()),saved=await db.commit(run.id,run.version,state,'STOPPED',events);
   return saved?res.status(200).json({run:summarizeRun(saved)}):res.status(409).json({error:'The run changed during a cycle. Reload and try again.'});
  }catch{return res.status(503).json({error:unavailable});}
 }
 return res.status(400).json({error:"action must be 'create' or 'stop'"});
};}
export function createSpecPaperCycleHandler({store=specPaperStore,market=createSpecPaperMarket(),now=Date.now,secret=()=>process.env.PAPER_SCHEDULER_SECRET}={}){return async(req,res)=>{
 if(!authorizeScheduler(req,res,secret()))return;
 if(!emptySchedulerBody(req.body))return res.status(400).json({error:'Empty scheduler body required'});
 try{const r=await runSpecPaperCycle({store:store(),market,now});return res.status(r.status==='PARTIAL'||r.status==='MARKET_STATUS_UNAVAILABLE'?503:200).json(r);}
 catch{return res.status(503).json({error:unavailable});}
};}
export default createSpecPaperHandler();
export const cycleHandler=createSpecPaperCycleHandler();
