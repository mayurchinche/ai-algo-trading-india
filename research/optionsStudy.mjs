// Research only (25 Oct 2026): defined-risk NIFTY option selling on official NSE F&O bhavcopy settlement prices
// (end-of-day; the intraday path is NOT modelled, so stops trigger on the day's settlement and losses can exceed the
// stop). Data: node research/data/buildIndexOptions.mjs. Fixed before running (no tuning), 4 variants counted in F15:
//   monthly iron condor  : enter at the first close with 25–35 days to a liquid expiry; short strikes at ±1.0× the ATM
//                          straddle from spot (rounded to 50), long wings 200 points further; stop when the loss reaches
//                          2× the credit; take profit at 50% of the credit; otherwise hold to expiry settlement.
//   weekly iron condor   : same, 5–8 days, wings 100 points (weekly expiries exist from 2019).
//   monthly / weekly put credit spread: the put side only.
// Costs: Zerodha option tariff per order, 1 point slippage per leg per side. One lot, no compounding, ₹2 L capital.
// LOT is the NIFTY contract size assumed (changed several times; results scale linearly with it): LOT env, default 65.
import {readdirSync,readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {orderCharges} from '../shared/brokerCharges.js';
const FO=join(homedir(),'.cache','ai-algo-trading','fo'),LOT=Number(process.env.LOT||65),CAP=200000;
const days=readdirSync(FO).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,10)).sort();
const book=new Map();
for(const d of days){const m=new Map();for(const r of JSON.parse(readFileSync(join(FO,d+'.json'),'utf8')))if(r[1]==='NIFTY'&&r[0]!=='F')m.set(r[0]+'|'+r[2]+'|'+r[3],{settle:r[8],close:r[7],oi:r[9],vol:r[10]});if(m.size)book.set(d,m);}
const trading=[...book.keys()],dte=(d,e)=>(Date.parse(e)-Date.parse(d))/864e5;
const expiriesOn=d=>{const s=new Set();for(const k of book.get(d).keys())s.add(k.split('|')[1]);return [...s].filter(e=>e>=d).sort();};
const px=(d,kind,e,k)=>book.get(d)?.get(kind+'|'+e+'|'+k)??null;
// Spot from put-call parity at the strike where call and put settle closest.
function spotOf(d,e){let best=null;for(const [key,c] of book.get(d)){const [kind,ex,k]=key.split('|');if(kind!=='C'||ex!==e||!(c.settle>0))continue;const p=px(d,'P',e,+k);if(!p||!(p.settle>0))continue;const gap=Math.abs(c.settle-p.settle);if(!best||gap<best.gap)best={gap,k:+k,c:c.settle,p:p.settle,spot:+k+c.settle-p.settle};}return best;}
const r50=v=>Math.round(v/50)*50;
function trade(d0,e,{condor,wing}){
 const a=spotOf(d0,e);if(!a)return null;const straddle=a.c+a.p,sp=r50(a.spot-straddle),sc=r50(a.spot+straddle);
 const legs=[{kind:'P',k:sp,side:-1},{kind:'P',k:sp-wing,side:1}];if(condor)legs.push({kind:'C',k:sc,side:-1},{kind:'C',k:sc+wing,side:1});
 for(const l of legs){const p=px(d0,l.kind,e,l.k);if(!p||!(p.settle>0)||!(p.vol>0))return null;l.entry=p.settle;l.last=p.settle;}
 const credit=legs.reduce((s,l)=>s-l.side*l.entry,0)-legs.length*1;// points, after 1 point slippage per leg
 if(!(credit>0))return null;
 const width=wing,maxLoss=(width-credit)*LOT,entryCh=legs.reduce((s,l)=>s+orderCharges('options',l.side<0?'SELL':'BUY',l.entry*LOT).total,0);
 let exitD=null,exitVal=null,reason='EXPIRY';
 for(const d of trading){if(d<=d0)continue;if(d>e)break;
  for(const l of legs){const p=px(d,l.kind,e,l.k);if(p&&p.settle>=0)l.last=p.settle;}
  const sp_=spotOf(d,e)?.spot;
  const cost=legs.reduce((s,l)=>s-l.side*(d===e&&sp_?(l.kind==='P'?Math.max(l.k-sp_,0):Math.max(sp_-l.k,0)):l.last),0);// buy back shorts (+), sell longs (−)
  const pnlPts=credit-cost;
  if(d===e){exitD=d;exitVal=cost;reason='EXPIRY';break;}
  if(-pnlPts>=2*credit){exitD=d;exitVal=cost+legs.length*1;reason='STOP';break;}
  if(pnlPts>=0.5*credit){exitD=d;exitVal=cost+legs.length*1;reason='TARGET';break;}
 }
 if(exitD===null)return null;
 const gross=(credit-exitVal)*LOT,exitCh=reason==='EXPIRY'?0:legs.reduce((s,l)=>s+orderCharges('options',l.side<0?'BUY':'SELL',Math.max(l.last,0.05)*LOT).total,0);
 return {entry:d0,exit:exitD,expiry:e,reason,net:gross-entryCh-exitCh,maxLoss,credit};
}
function run(cfg){
 const out=[];let free='0000';
 for(const d of trading){if(d<free||d<cfg.from)continue;
  const ex=expiriesOn(d).filter(e=>dte(d,e)>=cfg.lo&&dte(d,e)<=cfg.hi);if(!ex.length)continue;
  // a liquid expiry: its ATM straddle must exist and the first of the window is used
  const e=ex[0],t=trade(d,e,cfg);if(!t)continue;out.push(t);free=t.exit;}
 return out;
}
function report(trades,name){
 const byMonth=new Map();for(const t of trades){const m=t.exit.slice(0,7);byMonth.set(m,(byMonth.get(m)??0)+t.net);}
 const mr=[...byMonth.values()].map(v=>v/CAP*100);
 let eq=0,peak=0,dd=0;for(const t of trades){eq+=t.net;peak=Math.max(peak,eq);dd=Math.min(dd,eq-peak);}
 const w=trades.filter(t=>t.net>0),f=x=>x.toFixed(2);
 const stops=trades.filter(t=>t.reason==='STOP').length;
 const half=y=>trades.filter(t=>y(t.exit.slice(0,4)));
 const avg=a=>a.length?a.reduce((s,t)=>s+t.net,0)/a.length:0;
 console.log(name.padEnd(28),`trades ${trades.length} win ${f(w.length/trades.length*100)}% stops ${stops} | avg/trade ₹${avg(trades).toFixed(0)} | months ${mr.length} avg ${f(mr.reduce((a,b)=>a+b,0)/mr.length)}% worst ${f(Math.min(...mr))}% pos ${f(mr.filter(v=>v>0).length/mr.length*100)}% | max DD ₹${dd.toFixed(0)} (${f(dd/CAP*100)}%) | worst trade ₹${Math.min(...trades.map(t=>t.net)).toFixed(0)} | 2016-21 avg ₹${avg(half(y=>y<='2021')).toFixed(0)} 2022-26 avg ₹${avg(half(y=>y>='2022')).toFixed(0)}`);
}
console.log('NIFTY days',trading.length,'lot',LOT);
for(const [name,cfg] of [['monthly iron condor',{condor:true,wing:200,lo:25,hi:35,from:'2016-02-01'}],['weekly iron condor',{condor:true,wing:100,lo:5,hi:8,from:'2019-03-01'}],['monthly put credit spread',{condor:false,wing:200,lo:25,hi:35,from:'2016-02-01'}],['weekly put credit spread',{condor:false,wing:100,lo:5,hi:8,from:'2019-03-01'}]])report(run(cfg),name);
