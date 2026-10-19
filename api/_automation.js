import {authorizeScheduler,emptySchedulerBody} from '../server/schedulerAuth.js';
import {backend,check} from '../server/pushBackend.js';
import {runAutomationTick,inAutomationWindow,mergeStatus,STATUS_ROW} from '../server/automation.js';
import {runSpecPaperCycle} from '../server/specPaperRunner.js';
import {specPaperStore} from '../server/specPaperStore.js';
import {createSpecPaperMarket} from '../server/specPaperMarket.js';
import {signalStore} from '../server/signalStore.js';
import {scanSignals,runValidation,captureMarketDay} from '../server/signalEngine.js';
import {ingestFundamentalFilings} from '../server/fundamentalsIngest.js';
import {fundamentalsStore} from '../server/fundamentalsStore.js';
export const automationStatus={
 read:async(db=backend())=>check(await db.from('app_data').select('data,updated_at').eq('id',STATUS_ROW).maybeSingle())?.data??null,
 write:async(data,db=backend())=>check(await db.from('app_data').upsert({id:STATUS_ROW,data,updated_at:new Date().toISOString()})),
};
export function createAutomationHandler({now=Date.now,secret=()=>process.env.PAPER_SCHEDULER_SECRET,env=process.env,market=createSpecPaperMarket(),status=automationStatus,jobs}={}){
 return async(req,res)=>{
  if(!authorizeScheduler(req,res,secret(),'Scheduler is not configured'))return;
  if(!emptySchedulerBody(req.body))return res.status(400).json({error:'Scheduler payload must be empty'});
  if(env.AUTOMATION_ENABLED==='false')return res.status(200).json({status:'AUTOMATION_DISABLED'});
  if(!inAutomationWindow(now()))return res.status(200).json({status:'OUTSIDE_AUTOMATION_WINDOW'});
  const j=jobs??{
   paper:budgetMs=>runSpecPaperCycle({store:specPaperStore(),market,now,budgetMs}),
   validate:()=>runValidation({market,store:signalStore(),now}),
   scan:timeframes=>scanSignals({market,store:signalStore(),paperStore:specPaperStore(),now,timeframes,autoPaper:env.SIGNAL_AUTO_PAPER!=='false',capital:Number(env.SIGNAL_PAPER_CAPITAL)||100000}),
   marketDay:()=>captureMarketDay({store:signalStore()}),
   fundamentals:()=>ingestFundamentalFilings({store:fundamentalsStore(),clock:now}),
  };
  const tick=await runAutomationTick({now,...j,status:async t=>status.write(mergeStatus(await status.read().catch(()=>null),t))});
  const failed=['paper','marketDay','dailyScan','scan','validate','fundamentals'].some(k=>tick[k]?.status==='FAILED');
  return res.status(failed?207:200).json(tick);
 };
}
