// Research only: node --max-old-space-size=6000 research/phase3Run.mjs [strategy ids...]
// Runs Phase 3 candidates through the ₹2 lakh portfolio simulator on the survivorship-free NSE dataset.
// Train Nov 2016–2021 (indicators need ~210 bars from Jan 2016; nothing is tuned), test 2022–2026 (acceptance).
// STRESS=bps adds adverse entry cost (fills after the open).
import {loadAll} from './lib/panel.mjs';
import {simulate,report,accepted,ACCEPT} from './lib/portfolioSim.mjs';
import {STRATEGIES} from './strategies/shortTerm.mjs';
import {writeFileSync} from 'node:fs';
const ids=process.argv.slice(2).length?process.argv.slice(2):Object.keys(STRATEGIES);
const data=loadAll({minBars:250});
const f=x=>x===null||x===undefined?'—':x.toFixed(2);
const out={};
const stress=Number(process.env.STRESS||0);
for(const id of ids){const t=Date.now(),run=simulate(STRATEGIES[id],data,{entryDelayBps:stress});
 const all=report(run,'2016-11-01'),train=report(run,'2016-11-01','2021-12-31'),test=report(run,'2022-01-01','2026-12-31');out[id]={all,train,test,accepted:accepted(test)};
 console.log(`\n${id}${stress?` [+${stress} bps entry]`:''}  (${((Date.now()-t)/1000).toFixed(1)}s)  out-of-sample ${accepted(test)?'PASSES':'fails'} the limits (worst month ≥ ${ACCEPT.worstMonthPct}%, DD ≥ ${ACCEPT.maxDrawdownPct}%, ≥${ACCEPT.positiveMonthsPct}% positive months)`);
 console.log('period'.padEnd(10),'avg/mo'.padStart(7),'median'.padStart(7),'worst'.padStart(7),'best'.padStart(7),'pos%'.padStart(6),'≥3%'.padStart(6),'maxDD'.padStart(7),'CAGR'.padStart(7),'trades'.padStart(7),'win%'.padStart(6),'avg tr%'.padStart(8));
 for(const [k,r] of [['all',all],['2016-21',train],['2022-26',test]])console.log(k.padEnd(10),f(r.avgMonthPct).padStart(7),f(r.medianMonthPct).padStart(7),f(r.worstMonthPct).padStart(7),f(r.bestMonthPct).padStart(7),f(r.positiveMonthsPct).padStart(6),f(r.monthsAtLeast3Pct).padStart(6),f(r.maxDrawdownPct).padStart(7),f(r.cagrPct).padStart(7),String(r.trades).padStart(7),f(r.winRatePct).padStart(6),f(r.avgTradePct).padStart(8));
}
if(process.env.YEARS)for(const id of ids){const r=out[id].all,y={};for(const m of r.monthly){const k=m.m.slice(0,4);(y[k]??=[]).push(m.ret);}
 console.log(id,'by year (sum of monthly %, worst month):',Object.entries(y).map(([k,v])=>`${k} ${v.reduce((a,b)=>a+b,0).toFixed(1)} (${Math.min(...v).toFixed(1)})`).join(' | '));}
writeFileSync('/tmp/phase3-results.json',JSON.stringify(out));
