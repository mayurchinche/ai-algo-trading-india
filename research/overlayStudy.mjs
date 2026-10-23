// Research only: node --max-old-space-size=6000 research/overlayStudy.mjs
// Risk overlays for the gap-down fill (F12), pre-registered 24 Oct 2026 before running. Chosen on Nov 2016–2021
// ONLY; the chosen one is then reported once on 2022–2026. Hypothesis: a stock-specific gap-down tends to fill, a
// market-wide gap (news) does not; fewer simultaneous positions reduce correlated losses.
//   O0 none | O1 no entries when NIFTY opens ≥1% below its previous close | O2 only when NIFTY's previous close
//   is above its 200-day average | O3 at most 3 positions | O4 = O1 + O3
// Round 2 (SIZING=1): R1 0.25% risk × 8 positions, R2 0.5% × 4, both with a 2% monthly entry stop.
// Selection: among overlays meeting the limits on 2016–21, the highest average month; if none meets them, the
// highest average month divided by the absolute worst month.
import {loadAll} from './lib/panel.mjs';
import {simulate,report,accepted} from './lib/portfolioSim.mjs';
import {indexBars} from './lib/indexData.mjs';
import {STRATEGIES} from './strategies/shortTerm.mjs';
const nifty=await indexBars('^NSEI'),dates=[...nifty.keys()].sort(),prev=new Map(),sma200=new Map();
for(let i=1;i<dates.length;i++){prev.set(dates[i],nifty.get(dates[i-1]));if(i>=200){let s=0;for(let j=i-200;j<i;j++)s+=nifty.get(dates[j]).c;sma200.set(dates[i],s/200);}}
const gapOk=d=>{const b=nifty.get(d),p=prev.get(d);return !(b&&p)||b.o/p.c-1>-0.01;};
const bull=d=>{const p=prev.get(d),s=sma200.get(d);return !!(p&&s)&&p.c>s;};
const OVERLAYS=process.env.SIZING?{
 // Round 2 (derived from the user's −4% worst month, not from data): monthly stop + the largest possible loss of
 // one day (positions × risk per trade) ≤ 4%.
 R1:{riskPct:0.25,maxPositions:8,monthStopPct:2},R2:{riskPct:0.5,maxPositions:4,monthStopPct:2}}
 :{O0:{},O1:{allowDay:gapOk},O2:{allowDay:bull},O3:{maxPositions:3},O4:{allowDay:gapOk,maxPositions:3}};
const data=loadAll({minBars:250}),f=x=>x==null?'—':x.toFixed(2),rows={};
for(const [k,o] of Object.entries(OVERLAYS)){const run=simulate(STRATEGIES['gapdown-fill-intraday'],data,o);rows[k]={train:report(run,'2016-11-01','2021-12-31'),test:report(run,'2022-01-01','2026-12-31')};}
const line=(k,r)=>console.log(k.padEnd(4),f(r.avgMonthPct).padStart(7),f(r.medianMonthPct).padStart(7),f(r.worstMonthPct).padStart(7),f(r.positiveMonthsPct).padStart(7),f(r.monthsAtLeast3Pct).padStart(6),f(r.maxDrawdownPct).padStart(7),String(r.trades).padStart(6),accepted(r)?'meets limits':'');
console.log('TRAIN Nov 2016–2021      avg  median   worst    pos%   ≥3%   maxDD trades');for(const k in rows)line(k,rows[k].train);
const ok=Object.keys(rows).filter(k=>accepted(rows[k].train)),pick=(ok.length?ok:Object.keys(rows)).sort((a,b)=>ok.length?rows[b].train.avgMonthPct-rows[a].train.avgMonthPct:rows[b].train.avgMonthPct/Math.abs(rows[b].train.worstMonthPct)-rows[a].train.avgMonthPct/Math.abs(rows[a].train.worstMonthPct))[0];
console.log(`\nChosen on training only: ${pick}${ok.length?'':' (none met the limits on training; best return per unit of worst month)'}`);
console.log('TEST 2022–2026 (once)    avg  median   worst    pos%   ≥3%   maxDD trades');line(pick,rows[pick].test);
if(process.env.ALL){console.log('\n(all overlays on test, for the record only — not used for the choice)');for(const k in rows)line(k,rows[k].test);}
