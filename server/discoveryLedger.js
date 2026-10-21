// Discover observation ledger: the first time each stock reaches the recorded score level in a session, and
// its outcome afterwards, so the score's accuracy is measured from the moment a signal was visible.
import {backend,check,readAll} from './pushBackend.js';
import {MarketDataError} from './upstoxReadOnly.js';
export const LEDGER_VERSION='discovery-ledger-v1';
export const RECORD_MIN_SCORE=50;
export const WATCH_ALERT_SCORE=60;
export const OUTCOME_SESSIONS=10;
const DAY=86400000;
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);
const r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
// stocks: DiscoveredStock objects from one scan (market open). Returns rows for record_discovery_observations.
export function observationRows(stocks,now,min=RECORD_MIN_SCORE){
 return (stocks??[]).filter(s=>Number.isFinite(s?.overallScore)&&Math.abs(s.overallScore)>=min&&s.ltp>0&&/^[A-Z0-9&-]{1,30}$/.test(s.symbol)).map(s=>{
  const side=s.overallScore>0?'BUY':'SELL',day=istDate(now);
  return {id:`${day}:${s.symbol}:${side}`,sessionDate:day,symbol:s.symbol,side,seenAt:new Date(now).toISOString(),score:Math.round(s.overallScore),price:s.ltp,quoteTime:s.quoteTime??'',
   details:{version:LEDGER_VERSION,name:s.name,signal:s.signal,scores:s.scores,reasons:s.reasons,strategies:s.strategies,trend:s.trend,rsi:s.rsi,changePct:r2(s.changePct),volumeRatio:s.volumeRatio,
    prevClose:s.prevClose,stop:s.foAnalysis?.suggestedStopLoss??null,target:s.foAnalysis?.suggestedTarget??null,riskReward:s.foAnalysis?.riskReward??null,eligible:s.eligible,blockedReasons:s.blockedReasons??[]}};
 });
}
// Outcome from completed daily bars (oldest first, time = IST midnight of the session) after the first sighting.
// Returns are in the signal's direction from the first-seen price. Target/stop use the sessions after the
// first one (the order of prices within the first session after the sighting is unknown).
export function computeOutcome(row,bars,now){
 const dir=row.side==='BUY'?1:-1,price=Number(row.first_price),day=row.session_date,d=row.details??{};
 const idx=bars.findIndex(b=>istDate(b.time)===day);
 if(idx<0)return {complete:false,status:bars.some(b=>istDate(b.time)>day)?'SESSION_MISSING':'PENDING'};
 const ret=k=>bars[idx+k]?r2((bars[idx+k].close/price-1)*100*dir):null,after=bars.slice(idx+1,idx+1+OUTCOME_SESSIONS);
 let levels={result:'OPEN',at:null,retPct:null};
 if(d.stop>0&&d.target>0)for(const b of after){
  const stop=dir===1?b.low<=d.stop:b.high>=d.stop,tgt=dir===1?b.high>=d.target:b.low<=d.target;
  if(stop){levels={result:'STOP',at:istDate(b.time),retPct:r2((d.stop/price-1)*100*dir)};break;}
  if(tgt){levels={result:'TARGET',at:istDate(b.time),retPct:r2((d.target/price-1)*100*dir)};break;}
 }
 const s=bars[idx];
 return {complete:after.length>=OUTCOME_SESSIONS,sessions:after.length,sessionClose:ret(0),sessionHighPct:r2(((dir===1?s.high:s.low)/price-1)*100*dir),d1:ret(1),d5:ret(5),d10:ret(10),levels,computedAt:new Date(now).toISOString()};
}
export function discoveryStore(db=backend()){return {
 record:async rows=>rows.length?check(await db.rpc('record_discovery_observations',{p_rows:rows})):0,
 day:async date=>check(await db.from('discovery_observations').select('id,session_date,symbol,side,first_seen_at,first_score,first_price,first_quote_time,details,max_score,max_score_at,last_seen_at,seen_count,outcome').eq('session_date',date).order('first_seen_at',{ascending:true}).limit(500)),
 since:date=>readAll(()=>db.from('discovery_observations').select('symbol,side,session_date,first_score,max_score,outcome').gte('session_date',date).order('id')),
 pending:async(before,limit=300)=>check(await db.from('discovery_observations').select('id,session_date,symbol,side,first_price,details,outcome').lt('session_date',before).or('outcome.is.null,outcome->>complete.neq.true').order('session_date',{ascending:true}).limit(limit)),
 setOutcomes:async rows=>rows.length?check(await db.rpc('set_discovery_outcomes',{p_rows:rows})):0,
};}
// Updates outcomes of earlier sessions from Upstox daily bars (one read per symbol).
export async function updateDiscoveryOutcomes({store,market,master,now,limit=300}){
 const at=now(),pending=await store.pending(istDate(at),limit);if(!pending.length)return {status:'UP_TO_DATE',updated:0};
 const keys=new Map((await master()).filter(r=>r.segment==='NSE_EQ'&&r.instrument_type==='EQ').map(r=>[r.trading_symbol,r.instrument_key]));
 const bySymbol=new Map();for(const p of pending){if(!bySymbol.has(p.symbol))bySymbol.set(p.symbol,[]);bySymbol.get(p.symbol).push(p);}
 const out=[],failures=[];let next=0;const list=[...bySymbol];
 await Promise.all(Array.from({length:Math.min(3,list.length)},async()=>{while(next<list.length){const [symbol,rows]=list[next++],key=keys.get(symbol);
  if(!key){failures.push({symbol,reason:'INSTRUMENT_NOT_FOUND'});continue;}
  const from=Date.parse(rows[0].session_date+'T00:00:00+05:30')-3*DAY;
  try{const bars=await market.history(key,'1d',from,at);for(const r of rows)out.push({id:r.id,outcome:computeOutcome(r,bars,at)});}
  catch(e){failures.push({symbol,reason:e instanceof MarketDataError?e.code:'HISTORY_FAILED'});}
 }}));
 const updated=await store.setOutcomes(out.filter(o=>o.outcome.status!=='PENDING'));
 return {status:failures.length?'PARTIAL':'COMPLETED',pending:pending.length,updated,failures:failures.length,failureReason:failures[0]?.reason??null};
}
// Accuracy by side and first-seen score band, from completed or partial outcomes.
export function accuracySummary(rows){
 const bands=[['50–59',s=>s>=50&&s<60],['60–69',s=>s>=60&&s<70],['70+',s=>s>=70]],avg=a=>a.length?r2(a.reduce((x,y)=>x+y,0)/a.length):null;
 return ['BUY','SELL'].flatMap(side=>bands.map(([band,f])=>{
  const list=rows.filter(r=>r.side===side&&f(Math.abs(r.first_score))),o=list.map(r=>r.outcome).filter(Boolean),lv=o.filter(x=>x.levels?.result&&x.levels.result!=='OPEN');
  const pick=k=>o.map(x=>x[k]).filter(v=>Number.isFinite(v));
  return {side,band,signals:list.length,withOutcome:o.length,sessionClose:avg(pick('sessionClose')),d1:avg(pick('d1')),d5:avg(pick('d5')),d10:avg(pick('d10')),
   resolved:lv.length,targetFirst:lv.length?r2(lv.filter(x=>x.levels.result==='TARGET').length/lv.length*100):null,winD5:pick('d5').length?r2(pick('d5').filter(v=>v>0).length/pick('d5').length*100):null};
 }));
}
