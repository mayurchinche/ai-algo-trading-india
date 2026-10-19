// Replays the unchanged Discover score (evaluateDiscoverySnapshot) on stored daily bars and measures what
// happened after each score band. Usage (bundle first, see docs/DISCOVERY_SCORE_STUDY.md):
//   node .research/discovery-score-replay.mjs <dir of Yahoo 10y daily chart JSON files> [out.json]
// Each stock-day is scored on bars up to and including that day, with that day's close as the price and
// its volume as the session volume, like a scan near the close. Outcomes start at the next session's open.
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {evaluateDiscoverySnapshot} from '../../src/services/discoveryScoring';
import {orderCharges} from '../../shared/brokerCharges.js';
const [dir,out]=process.argv.slice(2);if(!dir)throw new Error('Usage: discovery-score-replay <dir> [out.json]');
const WINDOW=260,HOLD=10,NOTIONAL=100000;
const roundTrip=(product:string)=>(orderCharges(product,'BUY',NOTIONAL).total+orderCharges(product,'SELL',NOTIONAL).total)/NOTIONAL*100;
const COST={delivery:roundTrip('equity-delivery'),intraday:roundTrip('equity-intraday')};
type Obs={long10:number;long5:number;score:number;eligible:boolean;blocked:string[];r1:number;r5:number;r10:number;intraday:number;hit:'TARGET'|'STOP'|'NONE';hitRet:number};
const obs:Obs[]=[];let stocks=0;
for(const f of readdirSync(dir).filter(f=>f.endsWith('.json'))){
 let r:any;try{r=JSON.parse(readFileSync(resolve(dir,f),'utf8')).chart.result[0];}catch{continue;}
 const q=r?.indicators?.quote?.[0];if(!q||!r.timestamp)continue;
 const rows=r.timestamp.map((t:number,i:number)=>({t,date:new Date(t*1000+19800000).toISOString().slice(0,10),o:q.open[i],h:q.high[i],l:q.low[i],c:q.close[i],v:q.volume[i]??0})).filter((b:any)=>[b.o,b.h,b.l,b.c].every((x:number)=>x>0)&&b.h>=b.l);
 if(rows.length<WINDOW+HOLD+2)continue;stocks++;
 for(let i=WINDOW;i<rows.length-HOLD-1;i++){
  const w=rows.slice(i-WINDOW+1,i+1),d=rows[i],y=w.slice(-250);
  const hist={dates:w.map((b:any)=>b.date),closes:w.map((b:any)=>b.c),highs:w.map((b:any)=>b.h),lows:w.map((b:any)=>b.l),volumes:w.map((b:any)=>b.v),
   meta:{regularMarketPrice:d.c,regularMarketTime:Date.parse(d.date+'T15:29:00+05:30')/1000,regularMarketVolume:d.v,fiftyTwoWeekHigh:Math.max(...y.map((b:any)=>b.h)),fiftyTwoWeekLow:Math.min(...y.map((b:any)=>b.l)),regularMarketOpen:d.o}};
  const s=evaluateDiscoverySnapshot(f.replace('.json','')+'.NS',hist,Date.parse(d.date+'T15:30:00+05:30'));
  if(!s)continue;
  const dir_=s.overallScore>0?1:-1,entry=rows[i+1].o,ret=(k:number)=>(rows[i+k].c/entry-1)*100*dir_;
  // Target or stop first within HOLD sessions after entry; a session touching both counts as the stop.
  let hit:Obs['hit']='NONE',hitRet=ret(HOLD);
  for(let k=1;k<=HOLD;k++){const b=rows[i+k],stop=dir_===1?b.l<=s.foAnalysis.suggestedStopLoss:b.h>=s.foAnalysis.suggestedStopLoss,tgt=dir_===1?b.h>=s.foAnalysis.suggestedTarget:b.l<=s.foAnalysis.suggestedTarget;
   if(stop){hit='STOP';hitRet=(s.foAnalysis.suggestedStopLoss/entry-1)*100*dir_;break;}if(tgt){hit='TARGET';hitRet=(s.foAnalysis.suggestedTarget/entry-1)*100*dir_;break;}}
  const long=(k:number)=>(rows[i+k].c/entry-1)*100;
  obs.push({long10:long(10),long5:long(5),score:s.overallScore,eligible:!s.blockedReasons.filter(b=>!b.startsWith('Quote older')).length,blocked:s.blockedReasons,r1:ret(1),r5:ret(5),r10:ret(10),intraday:(rows[i+1].c/entry-1)*100*dir_,hit,hitRet});
 }
}
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const bands:[string,(s:number)=>boolean][]=[['ALL stock-days (baseline, long)',()=>true],['BUY 0-39',s=>s>=0&&s<40],['BUY 40-49',s=>s>=40&&s<50],['BUY 50-59',s=>s>=50&&s<60],['BUY 60-69',s=>s>=60&&s<70],['BUY 70+',s=>s>=70],['SELL 40-49',s=>s<=-40&&s>-50],['SELL 50-59',s=>s<=-50&&s>-60],['SELL 60-69',s=>s<=-60&&s>-70],['SELL 70+',s=>s<=-70]];
const summary=(list:Obs[])=>({n:list.length,intradayNet:mean(list.map(o=>o.intraday))-COST.intraday,r1:mean(list.map(o=>o.r1)),r5:mean(list.map(o=>o.r5)),r10:mean(list.map(o=>o.r10)),
 r5Net:mean(list.map(o=>o.r5))-COST.delivery,r10Net:mean(list.map(o=>o.r10))-COST.delivery,targetFirst:list.filter(o=>o.hit==='TARGET').length/list.length,stopFirst:list.filter(o=>o.hit==='STOP').length/list.length,levelsNet:mean(list.map(o=>o.hitRet))-COST.delivery,win5:list.filter(o=>o.r5>COST.delivery).length/list.length});
const table=(filter:(o:Obs)=>boolean)=>bands.map(([name,f])=>({band:name,...summary(obs.filter(o=>filter(o)&&f(o.score)))}));
const baseline={n:obs.length,r5:mean(obs.map(o=>o.long5)),r10:mean(obs.map(o=>o.long10))};
const result={baseline,stocks,observations:obs.length,costs:COST,all:table(()=>true),eligible:table(o=>o.eligible)};
const fmt=(x:number,d=2)=>Number.isFinite(x)?x.toFixed(d):'—';
console.log(`baseline (every stock-day, long): 5d ${fmt(baseline.r5)}% 10d ${fmt(baseline.r10)}% over ${baseline.n} days`);
console.log(`stocks ${stocks} · scored stock-days: ${obs.length} · round-trip cost delivery ${fmt(COST.delivery,3)}% intraday ${fmt(COST.intraday,3)}%`);
for(const [label,rows] of [['ALL',result.all],['ELIGIBLE (price ≥ ₹50, turnover ≥ ₹10 cr, move ≤ 8%)',result.eligible]] as const){
 console.log('\n'+label+'\nband         n       next-day-intraday-net  1d     5d     10d    5d-net  10d-net  target-first stop-first levels-net win5');
 for(const r of rows)console.log(`${r.band.padEnd(11)} ${String(r.n).padStart(7)}  ${fmt(r.intradayNet).padStart(8)}  ${fmt(r.r1).padStart(14)} ${fmt(r.r5).padStart(6)} ${fmt(r.r10).padStart(6)} ${fmt(r.r5Net).padStart(7)} ${fmt(r.r10Net).padStart(8)}  ${fmt(r.targetFirst*100,1).padStart(10)}% ${fmt(r.stopFirst*100,1).padStart(8)}% ${fmt(r.levelsNet).padStart(9)} ${fmt(r.win5*100,1)}%`);
}
if(out)writeFileSync(out,JSON.stringify(result,null,1));
