// Backtest metrics, Monte-Carlo bootstrap and an A–F grade with overfitting flags. Our own documented rules
// (inspired by publicly described grading, not a copy): start at 100 and deduct for drawdown, profit
// concentration in one month, low win rate with low payoff, and weak risk-adjusted return.
export const METRICS_VERSION='backtest-metrics-v1';
const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
const sd=v=>{const m=mean(v);return Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/(v.length-1));};
const pctile=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.round(p/100*(sorted.length-1))))];
// Deterministic PRNG (mulberry32) so the same inputs give the same Monte-Carlo result.
function rng(seed){let a=seed>>>0;return ()=>{a=a+0x6d2b79f5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const maxDrawdown=values=>{let peak=-Infinity,dd=0;for(const v of values){peak=Math.max(peak,v);if(peak>0)dd=Math.max(dd,1-v/peak);}return dd;};

// curve: [{time, equity}] at bar closes; trades: [{pnl, grossPnl, mae, mfe, exitTime}]; capital: starting equity.
export function computeMetrics({curve,trades,capital,costs,paramCount=0,mcPaths=2000,seed=1}){
 if(!curve.length)return {status:'NO_DATA'};
 const daily=new Map();for(const p of curve)daily.set(new Date(p.time+19800000).toISOString().slice(0,10),p.equity);
 const days=[...daily.values()],rets=days.slice(1).map((v,i)=>v/days[i]-1);
 const final=curve.at(-1).equity,years=(curve.at(-1).time-curve[0].time)/(365.25*86400000);
 const totalReturn=final/capital-1,cagr=years>0&&final>0?Math.pow(final/capital,1/years)-1:null;
 const dd=maxDrawdown([capital,...curve.map(p=>p.equity)]);
 const sharpe=rets.length>2&&sd(rets)>0?mean(rets)/sd(rets)*Math.sqrt(252):null;
 const downside=rets.filter(r=>r<0),sortino=rets.length>2&&downside.length>1?mean(rets)/Math.sqrt(downside.reduce((a,r)=>a+r*r,0)/downside.length)*Math.sqrt(252):null;
 const pnls=trades.map(t=>t.pnl),wins=pnls.filter(p=>p>0),losses=pnls.filter(p=>p<0);
 const grossProfit=wins.reduce((a,b)=>a+b,0),grossLoss=-losses.reduce((a,b)=>a+b,0);
 const months=new Map();for(const t of trades){const m=new Date(t.exitTime+19800000).toISOString().slice(0,7);months.set(m,(months.get(m)||0)+t.pnl);}
 const positiveMonths=[...months.values()].filter(v=>v>0),bestMonthShare=grossProfit>0&&positiveMonths.length?Math.max(...positiveMonths)/positiveMonths.reduce((a,b)=>a+b,0):null;
 const grossTotal=trades.reduce((a,t)=>a+t.grossPnl,0);
 // Monte-Carlo: resample trade P&Ls with replacement; percentiles of final return and max drawdown.
 let monteCarlo=null;
 if(pnls.length>=10){
  const r=rng(seed),finals=[],dds=[];
  for(let k=0;k<mcPaths;k++){let eq=capital;const path=[capital];for(let j=0;j<pnls.length;j++){eq+=pnls[Math.floor(r()*pnls.length)];path.push(eq);}finals.push(eq/capital-1);dds.push(maxDrawdown(path));}
  finals.sort((a,b)=>a-b);dds.sort((a,b)=>a-b);
  monteCarlo={paths:mcPaths,seed,finalReturn:{p5:pctile(finals,5),p50:pctile(finals,50),p95:pctile(finals,95)},maxDrawdown:{p50:pctile(dds,50),p95:pctile(dds,95)},probabilityOfLoss:finals.filter(f=>f<0).length/mcPaths};
 }
 // Out-of-sample style check: first 70% of trades versus the last 30%.
 const cut=Math.floor(trades.length*0.7),early=pnls.slice(0,cut),late=pnls.slice(cut);
 const split=early.length>=5&&late.length>=3?{earlyMean:mean(early),lateMean:mean(late),signFlip:Math.sign(mean(early))!==Math.sign(mean(late))}:null;
 const flags=[];
 if(trades.length<30)flags.push({id:'FEW_TRADES',detail:`${trades.length} closed trades; results are not statistically reliable`});
 if(bestMonthShare!==null&&bestMonthShare>0.35)flags.push({id:'PROFIT_CONCENTRATION',detail:`${(bestMonthShare*100).toFixed(0)}% of profit came from one month`});
 if(grossTotal>0&&costs>0.5*grossTotal)flags.push({id:'COST_SENSITIVE',detail:'costs consume more than half of gross profit'});
 if(paramCount>0&&trades.length<paramCount*10)flags.push({id:'MANY_PARAMETERS',detail:`${paramCount} tuned parameters for ${trades.length} trades`});
 if(split?.signFlip)flags.push({id:'UNSTABLE_OVER_TIME',detail:'average trade changes sign between the first 70% and last 30% of trades'});
 if(monteCarlo&&monteCarlo.probabilityOfLoss>0.3)flags.push({id:'HIGH_LOSS_PROBABILITY',detail:`${(monteCarlo.probabilityOfLoss*100).toFixed(0)}% of resampled paths lose money`});
 let score=100;const deductions=[];
 const deduct=(points,reason)=>{if(points>0){score-=points;deductions.push({points,reason});}};
 deduct(Math.min(40,Math.max(0,(dd-0.1)*100)),`max drawdown ${(dd*100).toFixed(1)}% (1 point per % above 10%)`);
 if(bestMonthShare!==null)deduct(Math.min(20,Math.max(0,(bestMonthShare-0.35)*100)),'profit concentration above 35% in one month');
 const winRate=pnls.length?wins.length/pnls.length:null,payoff=losses.length&&wins.length?mean(wins)/-mean(losses):null;
 if(winRate!==null&&winRate<0.4&&(payoff===null||payoff<1.5))deduct(10,'win rate below 40% without a payoff ratio of at least 1.5');
 if(sharpe===null||sharpe<0.5)deduct(20,'net Sharpe below 0.5');else if(sharpe<1)deduct(10,'net Sharpe below 1');
 if(totalReturn<=0)deduct(30,'not profitable after costs');
 deduct(Math.min(20,flags.length*5),`${flags.length} overfitting or reliability flags`);
 score=Math.max(0,score);
 const grade=trades.length<10?'N/A':score>=85?'A':score>=70?'B':score>=55?'C':score>=40?'D':score>=25?'E':'F';
 return {status:'OK',version:METRICS_VERSION,totalReturn,cagr,maxDrawdown:dd,sharpe,sortino,calmar:cagr!==null&&dd>0?cagr/dd:null,
  trades:{count:trades.length,winRate,profitFactor:grossLoss>0?grossProfit/grossLoss:null,expectancy:pnls.length?mean(pnls):null,averageWin:wins.length?mean(wins):null,averageLoss:losses.length?mean(losses):null,payoffRatio:payoff,
   averageMae:trades.length?mean(trades.map(t=>t.mae)):null,averageMfe:trades.length?mean(trades.map(t=>t.mfe)):null},
  gross:{pnl:grossTotal,costs,net:pnls.reduce((a,b)=>a+b,0)},bestMonthShare,months:[...months].map(([month,pnl])=>({month,pnl})).sort((a,b)=>a.month.localeCompare(b.month)),
  monteCarlo,split,flags,grade:{grade,score,deductions,note:trades.length<10?'Fewer than 10 trades: no grade.':'Own rules; a grade is not a forecast.'}};
}
