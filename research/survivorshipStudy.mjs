// Research only (25 Oct 2026): how much of the app's validation edge is survivorship? Runs the same strategy in the
// same ₹2 L simulator on (a) the full point-in-time universe and (b) today's 100 most liquid survivors only, which is
// how a rule validated on the current NIFTY 50 / F&O list sees history. Variants: 2 universes × donchian20 and the
// gap-down fill are already in F12 for (a); this adds (b) and a late-listing-free control (c) = survivors ∩ top 100 at the time.
import {loadAll} from './lib/panel.mjs';
import {simulate,report} from './lib/portfolioSim.mjs';
import {STRATEGIES} from './strategies/shortTerm.mjs';
const full=loadAll({minBars:250});
const liq=s=>{const n=Math.min(250,s.c.length);let t=0;for(let i=s.c.length-n;i<s.c.length;i++)t+=s.val[i]??0;return t/n;};
const alive=full.series.filter(s=>s.d.at(-1)>='2026-10-20');
const top=new Set(alive.map(s=>[s,liq(s)]).sort((a,b)=>b[1]-a[1]).slice(0,100).map(x=>x[0].symbol));
const surv={meta:full.meta,series:full.series.filter(s=>top.has(s.symbol))};
console.log('universe: all',full.series.length,'| today\'s top-100 survivors',surv.series.length);
const f=x=>x.toFixed(2);
for(const id of process.argv.slice(2).length?process.argv.slice(2):['donchian20','gapdown-fill-intraday']){
 for(const [name,data] of [['all stocks (no survivorship)',full],['survivors only (like our validation)',surv]]){
  const run=simulate(STRATEGIES[id],data),a=report(run,'2016-11-01'),t=report(run,'2022-01-01');
  console.log(id.padEnd(24),name.padEnd(38),`all avg/mo ${f(a.avgMonthPct)} DD ${f(a.maxDrawdownPct)} worst ${f(a.worstMonthPct)} pos ${f(a.positiveMonthsPct)}% trades ${a.trades} avgTrade ${f(a.avgTradePct)}% | OOS avg/mo ${f(t.avgMonthPct)} DD ${f(t.maxDrawdownPct)}`);
 }
}
