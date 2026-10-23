// Research team gatekeeper. AGENTS MUST NOT EDIT THIS FILE (loop.mjs refuses to run, and QA fails a round, if its hash
// changes). It owns everything an optimiser could game: the data windows, the acceptance limits, the variant ledger
// (every evaluation is counted automatically), the deflated significance bar, the causality (no look-ahead) audit and the
// one-look-per-strategy holdout budget.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {report,ACCEPT} from '../lib/portfolioSim.mjs';
export const HERE=dirname(fileURLToPath(import.meta.url));
export const STATE=join(HERE,'state');
export const LEDGER=join(STATE,'ledger.json');
// Windows: agents see data to DEV_END only. The holdout is read once per strategy, by QA, through evaluate.mjs --holdout.
export const WINDOWS=Object.freeze({devStart:'2016-11-01',trainEnd:'2021-12-31',devEnd:'2024-06-30',holdStart:'2024-07-01'});
export const GOAL=Object.freeze({avgMonthPct:3});            // the stretch target the loop works toward
export const LIMITS=Object.freeze({...ACCEPT,minAvgMonthPct:0});// worst month ≥ −4%, max DD ≥ −10%, ≥70% positive months, avg > 0
export const MAX_HOLDOUT_LOOKS=3,PRIOR_VARIANTS=33;           // variants tried before this team existed (docs/STRATEGY_REVAMP_STUDY.md)
export const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
export const readLedger=()=>existsSync(LEDGER)?JSON.parse(readFileSync(LEDGER,'utf8')):{priorVariants:PRIOR_VARIANTS,variants:[],holdoutLooks:[],rounds:[]};
export function writeLedger(l){mkdirSync(STATE,{recursive:true});writeFileSync(LEDGER,JSON.stringify(l,null,1));}
export const variantCount=l=>l.priorVariants+l.variants.length;
// Expected best t-statistic among N null strategies is about sqrt(2 ln N); a candidate must clear that with margin.
export const requiredT=n=>Math.sqrt(2*Math.log(Math.max(n,1)*20));
const COLS=['d','o','h','l','c','v','val','trades','brk','lastBreak'];
const cutSeries=(s,n)=>{const c={...s};for(const k of COLS)c[k]=s[k].slice(0,n);return c;};
// Same data, nothing after `end`: what a live system would have had.
export function truncate(data,end){
 const days=data.meta.days.filter(d=>d<=end);
 return {meta:{...data.meta,days},series:data.series.map(s=>{let n=0;while(n<s.d.length&&s.d[n]<=end)n++;return n===s.d.length?s:cutSeries(s,n);}).filter(s=>s.d.length>=250)};
}
const num=(a,b)=>typeof a==='number'&&typeof b==='number'&&(Math.abs(a-b)<1e-9||(Number.isNaN(a)&&Number.isNaN(b)));
const same=(a,b)=>Object.keys({...a,...b}).every(k=>num(a[k],b[k])||a[k]===b[k]);
// Look-ahead audit: every signal at bar ≤ cut must be identical whether or not later bars exist. Fails closed.
export function causalityAudit(strategy,data,{symbols=60,cuts=[0.4,0.6,0.8]}={}){
 const step=Math.max(1,Math.floor(data.series.length/symbols)),pick=data.series.filter((s,i)=>i%step===0&&s.d.length>800).slice(0,symbols);
 for(const s of pick)for(const f of cuts){
  const c=Math.floor(s.d.length*f),cut=cutSeries(s,c+1),xf=strategy.prepare(s),xc=strategy.prepare(cut);
  for(let i=strategy.warmup;i<=c;i++){const a=strategy.signal(s,xf,i),b=strategy.signal(cut,xc,i);
   if(!!a!==!!b||(a&&!same(a,b)))return {ok:false,symbol:s.symbol,date:s.d[i],note:'signal changes when later data is removed (look-ahead)'};
   if(strategy.exitCondition&&!!strategy.exitCondition(s,xf,i)!==!!strategy.exitCondition(cut,xc,i))return {ok:false,symbol:s.symbol,date:s.d[i],note:'exit changes when later data is removed (look-ahead)'};}
 }
 return {ok:true,symbolsChecked:pick.length};
}
export const tStat=r=>{const m=r.monthly.map(x=>x.ret),n=m.length,mean=m.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(m.reduce((a,b)=>a+(b-mean)**2,0)/(n-1));return sd>0?mean/(sd/Math.sqrt(n)):0;};
export const meetsLimits=r=>!!r&&r.worstMonthPct>=LIMITS.worstMonthPct&&r.maxDrawdownPct>=LIMITS.maxDrawdownPct&&r.positiveMonthsPct>=LIMITS.positiveMonthsPct&&r.avgMonthPct>LIMITS.minAvgMonthPct;
const brief=r=>r&&{months:r.months,avgMonthPct:+r.avgMonthPct.toFixed(2),medianMonthPct:+r.medianMonthPct.toFixed(2),worstMonthPct:+r.worstMonthPct.toFixed(2),positiveMonthsPct:+r.positiveMonthsPct.toFixed(0),monthsAtLeast3Pct:+r.monthsAtLeast3Pct.toFixed(0),maxDrawdownPct:+r.maxDrawdownPct.toFixed(1),cagrPct:+r.cagrPct.toFixed(1),trades:r.trades,winRatePct:r.winRatePct&&+r.winRatePct.toFixed(0),avgTradePct:r.avgTradePct&&+r.avgTradePct.toFixed(2)};
// Development verdict: both dev halves positive, validate half inside the risk limits, whole-dev t-stat above the deflated bar.
export function devVerdict(run,nVariants){
 const train=report(run,WINDOWS.devStart,WINDOWS.trainEnd),valid=report(run,'2022-01-01',WINDOWS.devEnd),all=report(run,WINDOWS.devStart,WINDOWS.devEnd);
 const t=tStat(all),need=requiredT(nVariants),reasons=[];
 if(!(train?.avgMonthPct>0))reasons.push('train half not positive');
 if(!meetsLimits(valid))reasons.push('validate half breaks the risk limits (worst month ≥ −4%, max DD ≥ −10%, ≥70% positive months, avg > 0)');
 if(!(t>=need))reasons.push(`monthly t-stat ${t.toFixed(2)} below the ${need.toFixed(2)} needed after ${nVariants} variants`);
 return {pass:!reasons.length,reasons,t:+t.toFixed(2),requiredT:+need.toFixed(2),train:brief(train),validate:brief(valid),all:brief(all)};
}
export function holdVerdict(run){
 const r=report(run,WINDOWS.holdStart),accepted=meetsLimits(r);
 return {accepted,goal:accepted&&r.avgMonthPct>=GOAL.avgMonthPct,holdout:brief(r)};
}
