// Automation tick: the one pg_cron job (`shared-paper-minute`, every minute 09:15–15:35 IST on weekdays)
// calls /api/scheduled-paper, which runs this. Each tick runs the paper-trading cycle, then at most one
// background job chosen by IST minute, and records a heartbeat so the app can show what ran and when.
//   every minute       paper runs: resting stops/targets, square-off, decisions and fills
//   09:16 and 09:31    market day (bulk/block deals, FII/DII) and the daily-strategy signal scan
//   every 30 minutes   daily-strategy scan again at :14 and :44 (safety net; signals are recorded once)
//   every 15 minutes   intraday-strategy signal scan
//   every 5 minutes    strategy validation, when a strategy is missing or older than six days (a pass
//                      triggers an immediate signal scan)
//   every 30 minutes   new NSE financial filings
export const AUTOMATION_VERSION='automation-tick-v1';
export const STATUS_ROW='scheduler_status';
const istDay=iso=>new Date(Date.parse(iso)+19800000).toISOString().slice(0,10);
const istMinute=ms=>{const d=new Date(ms+19800000);return d.getUTCHours()*60+d.getUTCMinutes();};
export function inAutomationWindow(now){const d=new Date(now+19800000),m=istMinute(now);return d.getUTCDay()>0&&d.getUTCDay()<6&&m>=555&&m<=935;}
// Background job for this IST minute (at most one per tick, so each fits the function time limit).
export function backgroundJob(now){
 const m=istMinute(now);
 if(m===556||m===571)return 'daily';
 if(m%15===1)return 'intraday-scan';
 if(m%30===14)return 'daily-scan';
 if(m%5===3)return 'validate';
 if(m%30===7)return 'fundamentals';
 return null;
}
const failure=e=>({status:'FAILED',reason:e?.code??(e instanceof Error?e.message.slice(0,120):'UNEXPECTED_ERROR')});
async function attempt(fn){try{return await fn();}catch(e){return failure(e);}}

export async function runAutomationTick({now=Date.now,paper,validate,scan,marketDay,fundamentals,status}){
 const started=now(),job=backgroundJob(started),out={version:AUTOMATION_VERSION,at:new Date(started).toISOString(),job};
 out.paper=await attempt(()=>paper(25000));
 if(job==='daily-scan')out.dailyScan=await attempt(()=>scan(['1d']));
 else if(job==='daily'){out.marketDay=await attempt(marketDay);out.dailyScan=await attempt(()=>scan(['1d','15m']));}
 else if(job==='intraday-scan')out.scan=await attempt(()=>scan(['15m']));
 else if(job==='validate'){
  out.validate=await attempt(validate);
  // A newly passed strategy is scanned at once, so its current signals are not held until the next morning.
  if(out.validate?.passed&&out.validate.validated?.length)out.dailyScan=await attempt(()=>scan(['1d','15m']));
 }
 else if(job==='fundamentals')out.fundamentals=await attempt(fundamentals);
 out.durationMs=now()-started;
 await attempt(()=>status(out));
 return out;
}
// Compact per-job summary kept in app_data so the UI can show the latest run of each job.
export function mergeStatus(previous,tick){
 const jobs={...(previous?.jobs??{})},summary=r=>r&&{status:r.status,...Object.fromEntries(Object.entries(r).filter(([k,v])=>k!=='status'&&(typeof v!=='object'||v===null)).slice(0,8)),
  ...(Array.isArray(r.runs)?{runs:r.runs.length,outcomes:r.runs.reduce((m,x)=>(m[x.outcome]=(m[x.outcome]||0)+1,m),{})}:{}),...(Array.isArray(r.signals)?{signals:r.signals.length}:{}),...(Array.isArray(r.failures)?{failures:r.failures.length}:{})};
 for(const k of ['paper','marketDay','dailyScan','scan','validate','fundamentals'])if(tick[k])jobs[k]={at:tick.at,...summary(tick[k])};
 return {version:AUTOMATION_VERSION,lastTickAt:tick.at,lastJob:tick.job,lastDurationMs:tick.durationMs,ticksToday:previous?.day===istDay(tick.at)?(previous.ticksToday??0)+1:1,day:istDay(tick.at),jobs};
}
