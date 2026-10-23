// Research only: daily-bar portfolio simulator for the strategy plan (₹2 lakh, intraday + short term).
// Turns a strategy's per-stock signals into one account's equity curve and monthly return distribution, under:
//   - point-in-time universe: 20-day average traded value ≥ minTurnover and close ≥ minPrice on the signal day,
//     at least `warmup` bars since the series began or its last break (research/lib/panel.mjs);
//   - risk-based sizing: quantity so that a stop-out loses riskPct of current equity, capped at maxPosPct of
//     equity and by cash (no leverage); at most maxPositions open and one position per stock;
//   - realistic fills: entries at the next session's open (or that open for intraday), slippage by liquidity, a
//     stop or target touched intrabar fills at that level (at the open when the open is already beyond it), the
//     stop is assumed first when one bar touches both, condition exits fill at the next open;
//   - Indian charges from shared/brokerCharges.js (delivery or intraday MIS);
//   - account limits: no new entries the day after equity fell dailyStopPct in a day, nor for the rest of a
//     month once it is monthStopPct down for the month;
//   - breaks: a position is closed at the last comparable close before a break.
// Strategy interface: {id, product:'equity-delivery'|'equity-intraday', warmup, prepare(s)→per-series arrays,
//   signal(s,x,i)→null|{score,stop,target?,maxDays,exit?} decided on bar i's close (intraday: on bar i's open,
//   entry at that open), exitCondition?(s,x,i)→bool decided on bar i's close}. Parameters are fixed by the
//   strategy before simulation; the simulator has no tunable knobs that see results.
import {orderCharges} from '../../shared/brokerCharges.js';
// entryDelayBps: extra adverse cost on entries, standing in for a fill some minutes after the open (stress test).
export const DEFAULTS=Object.freeze({entryDelayBps:0,capital:200000,riskPct:0.5,maxPosPct:25,maxPositions:8,minTurnover:1e8,minPrice:50,dailyStopPct:1.5,monthStopPct:4});
const slipBps=turn=>turn>=5e8?5:10;
export function simulate(strategy,{meta,series},opts={}){
 const o={...DEFAULTS,...opts},days=meta.days,D=days.length,dayIdx=new Map(days.map((d,i)=>[d,i]));
 const intraday=strategy.product==='equity-intraday';
 // Per series: global day → bar index, turnover, prepared strategy arrays.
 const S=series.map(s=>{const pos=new Int32Array(D).fill(-1);s.d.forEach((d,i)=>pos[dayIdx.get(d)]=i);
  const val=s.val,turn=new Float64Array(s.d.length);let sum=0;for(let i=0;i<s.d.length;i++){sum+=val[i]??0;if(i>=20)sum-=val[i-20]??0;turn[i]=i>=19?sum/20:NaN;}
  return {s,pos,turn,x:strategy.prepare(s)};});
 let cash=o.capital,open=[],equityPrev=o.capital,blockedDay=false,monthStart=o.capital,month=null,monthBlocked=false;
 const trades=[],equity=new Float64Array(D);
 const close=(p,price,reason,day)=>{const value=price*p.qty,ch=orderCharges(strategy.product,'SELL',value).total;cash+=value-ch;
  const net=value-ch-p.cost;trades.push({sym:p.S.s.symbol,entryDay:p.entryDay,exitDay:day,entry:p.entry,exit:price,qty:p.qty,net,retPct:net/p.cost*100,reason,days:p.bars});};
 for(let t=0;t<D;t++){
  const m=days[t].slice(0,7);if(m!==month){month=m;monthStart=equityPrev;monthBlocked=false;}
  const canEnter=!blockedDay&&!monthBlocked;
  // 1. Entries decided at the previous close (delivery) or this open (intraday).
  const want=[];
  if(canEnter)for(const Z of S){const i=Z.pos[t];if(i<1)continue;const k=intraday?i:i-1;// decision bar
   if(intraday?Z.pos[t]<0:Z.pos[t-1]!==k)continue;// delivery: decided on the previous global day
   if(k<strategy.warmup||k-Math.max(0,Z.s.lastBreak[k])<strategy.warmup||Z.s.brk[i])continue;
   const e=intraday?i-1:k;// liquidity and price known before the decision
   if(!(Z.turn[e]>=o.minTurnover)||!(Z.s.c[e]>=o.minPrice))continue;
   if(open.some(p=>p.S===Z))continue;
   const sig=strategy.signal(Z.s,Z.x,k,intraday?i:undefined);if(sig)want.push({Z,i,sig});}
  want.sort((a,b)=>b.sig.score-a.sig.score);
  for(const w of want){if(open.length>=o.maxPositions)break;
   const {Z,i,sig}=w,s=Z.s,slip=slipBps(Z.turn[i-1]??Z.turn[i])/1e4,px=s.o[i]*(1+slip+o.entryDelayBps/1e4);
   if(!(sig.stop<px))continue;if(s.o[i]<=sig.stop)continue;// gapped through the stop: no trade
   const eq=equityPrev,riskQty=Math.floor(eq*o.riskPct/100/(px-sig.stop)),capQty=Math.floor(eq*o.maxPosPct/100/px);
   let qty=Math.min(riskQty,capQty);const cost=q=>q*px+orderCharges(strategy.product,'BUY',q*px).total;
   while(qty>0&&cost(qty)>cash)qty--;if(qty<1)continue;
   const c=cost(qty);cash-=c;open.push({S:Z,qty,entry:px,cost:c,stop:sig.stop,target:sig.target??null,maxDays:sig.maxDays,entryDay:days[t],bars:0,exitNext:false,slip});
  }
  // 2. Manage open positions on today's bar.
  const still=[];
  for(const p of open){const s=p.S.s,i=p.S.pos[t];if(i<0){still.push(p);continue;}// no trade today
   p.bars++;const sl=p.slip;
   if(s.brk[i]){close(p,s.c[i-1]*(1-sl),'BREAK',days[t]);continue;}
   if(p.exitNext){close(p,s.o[i]*(1-sl),'EXIT_RULE',days[t]);continue;}
   if(s.l[i]<=p.stop){close(p,Math.min(s.o[i],p.stop)*(1-sl),'STOP',days[t]);continue;}
   if(p.target!==null&&s.h[i]>=p.target){close(p,Math.max(s.o[i],p.target)*(1-sl),'TARGET',days[t]);continue;}
   if(intraday||p.bars>=p.maxDays){close(p,s.c[i]*(1-sl),intraday?'CLOSE':'TIME',days[t]);continue;}
   if(strategy.exitCondition?.(s,p.S.x,i))p.exitNext=true;
   still.push(p);}
  open=still;
  // 3. Mark to close; account limits for tomorrow.
  let eq=cash;for(const p of open){const s=p.S.s,j=lastBar(p.S.pos,t);eq+=p.qty*s.c[j];}
  equity[t]=eq;blockedDay=(eq/equityPrev-1)*100<=-o.dailyStopPct;if((eq/monthStart-1)*100<=-o.monthStopPct)monthBlocked=true;equityPrev=eq;
 }
 return {strategy:strategy.id,opts:o,days,equity,trades};
}
const lastBar=(pos,t)=>{for(let u=t;u>=0;u--)if(pos[u]>=0)return pos[u];return 0;};
// Monthly returns and risk statistics over [from, to] (YYYY-MM-DD, inclusive).
export function report(run,from='0000',to='9999'){
 const {days,equity,trades}=run,idx=days.map((d,i)=>i).filter(i=>days[i]>=from&&days[i]<=to);if(!idx.length)return null;
 const months=[];let start=equity[idx[0]-1]??run.opts.capital,cur=days[idx[0]].slice(0,7),last=start;
 for(const i of idx){const m=days[i].slice(0,7);if(m!==cur){months.push({m:cur,ret:(last/start-1)*100});start=last;cur=m;}last=equity[i];}
 months.push({m:cur,ret:(last/start-1)*100});
 let peak=equity[idx[0]-1]??run.opts.capital,dd=0;for(const i of idx){peak=Math.max(peak,equity[i]);dd=Math.min(dd,(equity[i]/peak-1)*100);}
 const r=months.map(x=>x.ret),sorted=[...r].sort((a,b)=>a-b),avg=r.reduce((a,b)=>a+b,0)/r.length;
 const tr=trades.filter(t=>t.exitDay>=from&&t.exitDay<=to),wins=tr.filter(t=>t.net>0);
 const startEq=equity[idx[0]-1]??run.opts.capital,endEq=equity[idx.at(-1)],years=idx.length/248;
 return {from:days[idx[0]],to:days[idx.at(-1)],months:r.length,avgMonthPct:avg,medianMonthPct:sorted[sorted.length>>1],worstMonthPct:sorted[0],bestMonthPct:sorted.at(-1),
  positiveMonthsPct:r.filter(x=>x>0).length/r.length*100,monthsAtLeast3Pct:r.filter(x=>x>=3).length/r.length*100,maxDrawdownPct:dd,cagrPct:((endEq/startEq)**(1/years)-1)*100,
  trades:tr.length,winRatePct:tr.length?wins.length/tr.length*100:null,avgTradePct:tr.length?tr.reduce((a,t)=>a+t.retPct,0)/tr.length:null,
  exposureNote:'returns on the whole account equity, not on deployed capital',monthly:months};
}
// The user's acceptance thresholds (Phase 1): applied to the out-of-sample period.
export const ACCEPT=Object.freeze({worstMonthPct:-4,maxDrawdownPct:-10,positiveMonthsPct:70});
export const accepted=r=>!!r&&r.worstMonthPct>=ACCEPT.worstMonthPct&&r.maxDrawdownPct>=ACCEPT.maxDrawdownPct&&r.positiveMonthsPct>=ACCEPT.positiveMonthsPct&&r.avgMonthPct>0;
