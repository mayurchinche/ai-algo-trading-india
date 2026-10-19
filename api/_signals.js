import {allowRequest} from '../server/pushBackend.js';
import {signalStore} from '../server/signalStore.js';
import {specPaperStore} from '../server/specPaperStore.js';
import {createSpecPaperMarket} from '../server/specPaperMarket.js';
import {scanSignals,runValidation,captureMarketDay,summarizeSignals,paperRunFor,validUntilOf} from '../server/signalEngine.js';
import {newPaperState,summarizeRun} from '../server/specPaperRunner.js';
import {authorizeScheduler,emptySchedulerBody} from '../server/schedulerAuth.js';
import {automationStatus} from './_automation.js';
const unavailable='Signal storage unavailable. Check the trading-signals migration and server connection.';
const JOBS=['validate','scan','market-day'];
// GET: recent signals and per-strategy validation. POST ?job=…: scheduler jobs (Bearer secret).
// POST {action:'paper', signalId, capital}: starts a single-trade paper run for one signal.
export function createSignalsHandler({automation=automationStatus,store=signalStore,paperStore=specPaperStore,market=createSpecPaperMarket(),now=Date.now,secret=()=>process.env.PAPER_SCHEDULER_SECRET,fetcher=fetch,env=process.env}={}){return async(req,res)=>{
 const q=req.query??{};
 if(req.method==='POST'&&q.job!==undefined){
  if(!authorizeScheduler(req,res,secret()))return;
  if(!JOBS.includes(q.job)||Object.keys(q).length!==1||!emptySchedulerBody(req.body))return res.status(400).json({error:'job must be one of '+JOBS.join(', ')+' with an empty body'});
  try{
   const r=q.job==='validate'?await runValidation({market,store:store(),now}):q.job==='scan'?await scanSignals({market,store:store(),paperStore:paperStore(),now,autoPaper:env.SIGNAL_AUTO_PAPER!=='false',capital:Number(env.SIGNAL_PAPER_CAPITAL)||100000}):await captureMarketDay({store:store(),fetcher});
   return res.status(r.status==='PARTIAL'?207:200).json(r);
  }catch{return res.status(503).json({error:unavailable});}
 }
 if(!allowRequest(req,res))return;
 if(req.method==='GET'){
  if(Object.keys(q).length)return res.status(400).json({error:'No query parameters are accepted'});
  try{const db=store(),[rows,validations,auto]=await Promise.all([db.signals(200),db.validations(),automation.read().catch(()=>null)]);return res.status(200).json({computedAt:new Date(now()).toISOString(),autoPaper:env.SIGNAL_AUTO_PAPER!=='false',automation:auto,...summarizeSignals(rows,validations,now())});}
  catch{return res.status(503).json({error:unavailable});}
 }
 if(req.method!=='POST')return res.status(405).json({error:'GET or POST required'});
 const b=req.body;
 if(!b||b.action!=='paper'||typeof b.signalId!=='string'||Object.keys(b).some(k=>!['action','signalId','capital'].includes(k))||!(typeof b.capital==='number'&&b.capital>=1000&&b.capital<=1e8))return res.status(400).json({error:"Send {action:'paper', signalId, capital (₹1,000 to ₹10 crore)}"});
 try{
  const row=await store().signal(b.signalId);if(!row)return res.status(404).json({error:'Signal not found'});
  if(now()>validUntilOf(row.signal))return res.status(409).json({error:'This signal has expired: its setup was for an earlier session.'});
  const r=paperRunFor(row.signal,b.capital),saved=await paperStore().create(r.id,r.spec,r.options,newPaperState(r.spec,r.options,now()));
  return res.status(201).json({run:summarizeRun(saved)});
 }catch(e){return res.status(503).json({error:e instanceof Error&&/limit/.test(e.message)?'Active paper run limit reached (100).':unavailable});}
};}
export default createSignalsHandler();
