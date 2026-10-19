import {allowRequest} from '../server/pushBackend.js';
import {discoveryStore,accuracySummary,RECORD_MIN_SCORE,WATCH_ALERT_SCORE,OUTCOME_SESSIONS} from '../server/discoveryLedger.js';
// 10-year replay of the unchanged Discover score on 475 NIFTY 500 stocks (docs/DISCOVERY_SCORE_STUDY.md).
export const REPLAY_STUDY=Object.freeze({period:'2016–2026 daily bars',stocks:475,stockDays:869351,baseline10dPct:0.65,
 bands:[{band:'BUY 40–49',n:17135,d10:1.11,nextDayIntradayNet:-0.26,targetFirst:21.4},{band:'BUY 50–59',n:14602,d10:0.94,nextDayIntradayNet:-0.27,targetFirst:21.8},{band:'BUY 60–69',n:8152,d10:0.98,nextDayIntradayNet:-0.34,targetFirst:24.6},{band:'BUY 70+',n:34,d10:1.75,nextDayIntradayNet:-0.39,targetFirst:14.7},{band:'SELL 50–59',n:1323,d10:-1.15,nextDayIntradayNet:-0.34,targetFirst:13.0}],
 finding:'Scores of 40 and above add about +0.3% over 10 days compared with an average stock-day (+0.65%); 60–69 is no better than 50–59, a score of 70 occurred 34 times in 10 years, next-day intraday trading loses after charges in every band, and SELL scores were followed by rises.'});
const DATE=/^\d{4}-\d{2}-\d{2}$/;
// GET ?date=YYYY-MM-DD (default today, IST): first sightings of that session, live accuracy over 120 days and the replay study.
export function createDiscoveryHandler({store=discoveryStore,now=Date.now}={}){return async(req,res)=>{
 if(!allowRequest(req,res))return;
 if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 const q=req.query??{},today=new Date(now()+19800000).toISOString().slice(0,10),date=q.date??today;
 if(Object.keys(q).some(k=>k!=='date')||typeof date!=='string'||!DATE.test(date))return res.status(400).json({error:'date must be YYYY-MM-DD'});
 try{
  const db=store(),[rows,recent]=await Promise.all([db.day(date),db.since(new Date(now()-120*86400000+19800000).toISOString().slice(0,10))]);
  return res.status(200).json({date,recordMinScore:RECORD_MIN_SCORE,watchAlertScore:WATCH_ALERT_SCORE,outcomeSessions:OUTCOME_SESSIONS,observations:rows,accuracy:accuracySummary(recent),trackedSignals:recent.length,study:REPLAY_STUDY});
 }catch{return res.status(503).json({error:'Discovery ledger unavailable. Apply the discovery-observations migration.',study:REPLAY_STUDY});}
};}
export default createDiscoveryHandler();
