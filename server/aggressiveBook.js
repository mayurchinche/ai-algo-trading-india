// Aggressive paper book: an experimental, separately tracked book that trades setups which have NOT passed
// strategy validation, with small fixed sizing and hard limits, so their live record shows which ones deserve
// promotion. It never places broker orders and never mixes with the validated book.
// Parameters are fixed before trading; changing one starts a new policy id (docs/OVERNIGHT_GAP_STUDY.md).
//   aggressive-v1 (21–22 Oct 2026, no trades): gap-and-go, early breakout, Discover momentum.
//   aggressive-v2: gap-and-go removed (measured losing; its opening-candle feed was unavailable on the server);
//                  overnight gap added (futures, entered 15:15–15:25, exited at the next open).
//   aggressive-v3: the overnight scan covers every stock with futures (about 210, was the NIFTY 50) with 20-day
//                  average turnover of ₹50 crore or more; the rule itself is unchanged. Tested out of sample on the
//                  163 futures stocks outside the NIFTY 50: +0.54% average gap, positive excess in 10 of 10 years.
import {orderCharges} from '../shared/brokerCharges.js';
import {isNseTradingDay,nextNseTradingDay} from '../shared/nseCalendar.js';
export const AGGRESSIVE_POLICY=Object.freeze({
 id:'aggressive-v3',capitalPerTrade:25000,maxOpen:5,dailyLossStop:10000,slippageBps:5,
 // Intraday setups (MIS): squared off at 15:15.
 intraday:Object.freeze({minScore:60,minPrice:10,minTurnover:2e7,maxMovePct:12,stopPct:1.5,targetPct:3,from:560,until:870,squareOff:915}),
 // Early breakout of a validated daily rule (CNC): bought when the live price crosses the rule's trigger level.
 swing:Object.freeze({stopPct:5,targetPct:10,maxSessions:10,from:570,until:915}),
 // Overnight gap (stock futures, one lot): a strong close predicts a small gap up next morning. The edge measured
 // over 10 years (+0.32% average gap on the NIFTY 50, +0.54% on other futures stocks) is above futures charges
 // (0.17%); with delivery charges (0.38%) the NIFTY 50 edge is gone. Stocks need ₹50 crore 20-day average turnover.
 overnight:Object.freeze({from:915,until:925,maxPositions:3,maxNotional:1500000,disasterStopPct:5,minDayRetPct:3,minVolumeRatio:2,minCloseLocation:0.9,minTurnover20:5e8,watchFrom:600}),
});
export const SETUPS=Object.freeze({
 'overnight-gap':{label:'Overnight gap',product:'futures',rule:'Before the close, buy one lot of the stock future when the stock is up more than 3% on at least twice its 20-day average volume, or closes in the top 10% of its range at a new 20-day high on twice the volume with NIFTY up; sell at the next session’s open. Scans every stock with futures and ₹50 crore average daily turnover. Measured over 10 years: average gap +0.32% on the NIFTY 50 and +0.54% on the other futures stocks (out of sample), about 0.15% and 0.37% after futures charges.'},
 'breakout-early':{label:'Early breakout',product:'equity-delivery',rule:'The live price crosses the trigger level of a validated daily breakout rule before the close confirms it.'},
 'discover-momentum':{label:'Discover momentum',product:'equity-intraday',rule:'Discover score of 60 or more (either direction) with a matching signal, on a liquid stock without a circuit-sized move. The 10-year Discover study found next-day intraday trading on the score lost after charges; this setup measures live behaviour.'},
});
const BREAKOUT_RULES=new Set(['short-term-donchian','futures-breakout-long','long-term-52w-high']);
const DAY=86400000,r2=v=>Math.round(v*100)/100;
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);
const istMinute=ms=>{const d=new Date(ms+19800000);return d.getUTCHours()*60+d.getUTCMinutes();};
export const sessionOpen=now=>isNseTradingDay(istDate(now))&&istMinute(now)>=555&&istMinute(now)<930;
export function newBook(now){return {version:'aggressive-book-v1',policy:AGGRESSIVE_POLICY.id,createdAt:new Date(now).toISOString(),sequence:0,positions:[],closed:[],days:{},bySetup:{},events:[],lastCycle:null,levels:null,overnight:null};}
const dayAfter=d=>nextNseTradingDay(new Date(Date.parse(d+'T00:00:00Z')+DAY).toISOString().slice(0,10));
function sessionsAfter(date,n){let d=date;for(let i=0;i<n;i++)d=dayAfter(d);return d;}

// Overnight-gap scan of the stocks with futures on live quotes. levels: per symbol {prevClose, avgVolume20,
// avgTurnover20, high20}; stocks below the turnover floor are left out;
// quotes: Map instrumentKey → quote with open/dayHigh/dayLow/volume. Returns every stock with its measures,
// whether it qualifies and, if not, what it still needs.
export function overnightScan({levels,quotes,niftyPrice,now}){
 const o=AGGRESSIVE_POLICY.overnight,niftyUp=Number.isFinite(niftyPrice)&&levels?.niftyPrevClose>0?niftyPrice>levels.niftyPrevClose:null;
 const rows=[];
 for(const [symbol,l] of Object.entries(levels?.rows??{})){
  const q=quotes.get(l.key);if(!q||!(l.prevClose>0)||!(l.avgVolume20>0)||!(l.avgTurnover20>=o.minTurnover20))continue;
  const ret=(q.price/l.prevClose-1)*100,volumeRatio=Number.isFinite(q.volume)?q.volume/l.avgVolume20:null;
  const range=q.dayHigh-q.dayLow,closeLocation=range>0?(q.price-q.dayLow)/range:null,newHigh=q.price>l.high20;
  const a=ret>o.minDayRetPct&&volumeRatio>=o.minVolumeRatio;
  const b=closeLocation>=o.minCloseLocation&&newHigh&&volumeRatio>=o.minVolumeRatio&&niftyUp===true;
  const needs=a||b?[]:[ret>o.minDayRetPct||closeLocation>=o.minCloseLocation&&newHigh?null:`up ${o.minDayRetPct}%+ or a top-of-range close at a new 20-day high`,volumeRatio>=o.minVolumeRatio?null:`volume ${o.minVolumeRatio}× (now ${volumeRatio===null?'?':r2(volumeRatio)}×)`].filter(Boolean);
  rows.push({symbol,key:l.key,price:q.price,retPct:r2(ret),volumeRatio:volumeRatio===null?null:r2(volumeRatio),closeLocation:closeLocation===null?null:r2(closeLocation),newHigh,qualifies:a||b,rule:a?'up 3%+ on 2× volume':b?'top-of-range close at a new 20-day high on 2× volume, NIFTY up':null,needs});
 }
 // Qualifying first, then the closest: largest move on the most volume.
 rows.sort((x,y)=>Number(y.qualifies)-Number(x.qualifies)||(y.retPct*Math.min(y.volumeRatio??0,3))-(x.retPct*Math.min(x.volumeRatio??0,3)));
 return {date:istDate(now),at:new Date(now).toISOString(),niftyUp,entryWindow:'15:15–15:25 IST',rows:rows.slice(0,20),qualifying:rows.filter(r=>r.qualifies).length,scanned:rows.length};
}

// Candidate setups from this minute's observations. Returns {candidates, rejected}, each with a reason, so the
// board can say why a visible idea was or was not traded.
export function aggressiveCandidates({discoveries=[],board=null,overnight=null,now}){
 const p=AGGRESSIVE_POLICY.intraday,m=istMinute(now),candidates=[],rejected=[];
 const reject=(setup,symbol,reason,extra={})=>rejected.push({setup,symbol,reason,...extra});
 for(const r of overnight?.rows??[])if(r.qualifies)candidates.push({setup:'overnight-gap',symbol:r.symbol,side:'BUY',product:'futures',why:`${r.rule}: ${r.retPct>0?'+':''}${r.retPct}% on ${r.volumeRatio}× volume`,score:null});
 for(const b of board?.rows??[]){
  if(b.state!=='NEAR_TRIGGER'||!BREAKOUT_RULES.has(b.strategyId)||!b.trigger||['NIFTY','BANKNIFTY'].includes(b.symbol))continue;
  candidates.push({setup:'breakout-early',symbol:b.symbol,side:'BUY',product:'equity-delivery',trigger:b.trigger.level,why:`${b.strategyName}: ${b.trigger.condition} (₹${r2(b.trigger.level)})`,score:null});
 }
 for(const s of discoveries){
  const score=s.overallScore;if(!Number.isFinite(score)||Math.abs(score)<50)continue;
  const side=score>0?'BUY':'SELL',want=side==='BUY'?['BUY','STRONG_BUY']:['SELL','STRONG_SELL'],turnover=(s.avgVolume||0)*s.ltp;
  const age=now-Date.parse(s.quoteTime??'');
  const reason=Math.abs(score)<p.minScore?`Score ${Math.round(score)} below ${p.minScore}`:!want.includes(s.signal)?'Signal does not match the score direction'
   :!(s.ltp>=p.minPrice)?`Price below ₹${p.minPrice}`:!(turnover>=p.minTurnover)?'Average daily turnover below ₹2 crore'
   :Math.abs(s.changePct)>p.maxMovePct?`Already moved ${r2(s.changePct)}% today (circuit risk)`:!(age>=0&&age<=120000)?'Quote older than 2 minutes':null;
  if(reason){reject('discover-momentum',s.symbol,reason,{score:Math.round(score)});continue;}
  candidates.push({setup:'discover-momentum',symbol:s.symbol,side,product:'equity-intraday',why:`Discover score ${Math.round(score)} (${s.signal.replace('_',' ').toLowerCase()})`,score:Math.round(score)});
 }
 if(m<p.from)for(const c of candidates.filter(c=>c.product==='equity-intraday'))c.blocked='Intraday entries open at 09:20';
 return {candidates,rejected};
}

const fillPrice=(q,side)=>r2((side==='BUY'?q.ask:q.bid)*(1+(side==='BUY'?1:-1)*AGGRESSIVE_POLICY.slippageBps/10000));
const exitSide=s=>s==='BUY'?'SELL':'BUY';
const charges=(product,side,value)=>orderCharges(product,side,value).total;
function close(state,pos,q,now,reason,events){
 const price=fillPrice(q,exitSide(pos.side)),dir=pos.side==='BUY'?1:-1,gross=(price-pos.entryPrice)*pos.qty*dir;
 const exitCharges=charges(pos.product,exitSide(pos.side),price*pos.qty),net=gross-pos.entryCharges-exitCharges;
 const done={...pos,exitPrice:price,exitAt:new Date(now).toISOString(),exitReason:reason,gross:r2(gross),charges:r2(pos.entryCharges+exitCharges),net:r2(net),netPct:r2(net/(pos.entryPrice*pos.qty)*100)};
 state.positions=state.positions.filter(x=>x.id!==pos.id);state.closed=[done,...state.closed].slice(0,300);
 const day=state.days[istDate(now)]??={realized:0,trades:0,wins:0,stopped:false};day.realized=r2(day.realized+net);day.trades++;if(net>0)day.wins++;
 const s=state.bySetup[pos.setup]??={trades:0,wins:0,net:0,grossWin:0,grossLoss:0};s.trades++;if(net>0){s.wins++;s.grossWin=r2(s.grossWin+net);}else s.grossLoss=r2(s.grossLoss-net);s.net=r2(s.net+net);
 events.push({kind:'EXIT',at:done.exitAt,symbol:pos.symbol,setup:pos.setup,reason,price,net:done.net});
}
// One minute of the book. quotes: Map instrumentKey → {price,bid,ask}; keyOf: symbol → NSE_EQ key or null;
// contractOf: symbol → {key,lotSize,description} of the futures contract to trade overnight, or null.
export function stepBook(previous,{now,candidates=[],quotes=new Map(),keyOf=()=>null,contractOf=()=>null,marketOpen=sessionOpen(now)}){
 const state=structuredClone(previous),P=AGGRESSIVE_POLICY,m=istMinute(now),today=istDate(now),events=[],decisions=[];
 state.policy=P.id;state.days[today]??={realized:0,trades:0,wins:0,stopped:false};
 let missing=0;
 // 1. Marks and exits.
 for(const pos of [...state.positions]){
  const q=quotes.get(pos.key);if(!q){missing++;continue;}
  pos.mark=q.price;pos.markAt=new Date(now).toISOString();
  if(!marketOpen)continue;
  const long=pos.side==='BUY',px=long?q.bid:q.ask;
  if(pos.exitAtNextOpen&&today>istDate(Date.parse(pos.entryAt))){close(state,pos,q,now,'NEXT_OPEN',events);continue;}
  const reason=long?(px<=pos.stop?'STOP':pos.target!=null&&px>=pos.target?'TARGET':null):(px>=pos.stop?'STOP':pos.target!=null&&px<=pos.target?'TARGET':null);
  if(reason)close(state,pos,q,now,reason,events);
  else if(pos.product==='equity-intraday'&&m>=P.intraday.squareOff)close(state,pos,q,now,'SQUARE_OFF_1515',events);
  else if(pos.exitBy&&today>=pos.exitBy&&m>=P.intraday.squareOff)close(state,pos,q,now,'HOLDING_LIMIT',events);
 }
 // 2. Daily loss stop on realized plus open (marked) results.
 const day=state.days[today],open=state.positions.reduce((a,p)=>a+(p.mark!=null?(p.mark-p.entryPrice)*p.qty*(p.side==='BUY'?1:-1)-p.entryCharges:0),0);
 if(!day.stopped&&day.realized+open<=-P.dailyLossStop){day.stopped=true;events.push({kind:'DAILY_LOSS_STOP',at:new Date(now).toISOString(),pnl:r2(day.realized+open)});}
 // 3. Entries, in priority order: overnight gaps (only near the close), early breakouts, then Discover by score.
 const order={'overnight-gap':0,'breakout-early':1,'discover-momentum':2};
 const traded=new Set([...state.positions.map(p=>p.symbol+'|'+p.setup),...state.closed.filter(c=>istDate(Date.parse(c.entryAt))===today).map(c=>c.symbol+'|'+c.setup)]);
 const held=new Set(state.positions.map(p=>p.symbol));
 for(const c of [...candidates].sort((a,b)=>order[a.setup]-order[b.setup]||Math.abs(b.score??0)-Math.abs(a.score??0))){
  const decide=(status,reason)=>decisions.push({setup:c.setup,symbol:c.symbol,side:c.side,why:c.why,score:c.score,status,reason});
  const overnight=c.setup==='overnight-gap',win=overnight?P.overnight:c.product==='equity-intraday'?P.intraday:P.swing;
  const contract=overnight?contractOf(c.symbol):null,key=overnight?contract?.key:keyOf(c.symbol),q=key&&quotes.get(key);
  if(c.blocked){decide('WAITING',c.blocked);continue;}
  if(!marketOpen||m<win.from||m>=win.until){decide('WAITING',overnight?'Entry window 15:15–15:25':'Outside this setup’s entry window');continue;}
  if(day.stopped){decide('BLOCKED','Daily loss stop reached');continue;}
  if(traded.has(c.symbol+'|'+c.setup)||held.has(c.symbol)){decide('SKIPPED','Already traded with this setup today or holding the stock');continue;}
  if(state.positions.length>=P.maxOpen){decide('BLOCKED',`Book full (${P.maxOpen} open positions)`);continue;}
  if(overnight&&state.positions.filter(p=>p.setup==='overnight-gap').length>=P.overnight.maxPositions){decide('BLOCKED',`${P.overnight.maxPositions} overnight positions already held`);continue;}
  if(overnight&&!contract){decide('SKIPPED','No stock future found for this symbol');continue;}
  if(!q){decide('SKIPPED','No fresh quote with a two-sided book');continue;}
  if(c.setup==='breakout-early'&&!(q.price>=c.trigger)){decide('WATCHING',`Price ₹${r2(q.price)} below trigger ₹${r2(c.trigger)}`);continue;}
  const price=fillPrice(q,c.side),qty=overnight?contract.lotSize:Math.floor(P.capitalPerTrade/price);
  if(overnight&&price*qty>P.overnight.maxNotional){decide('SKIPPED',`One lot is ₹${Math.round(price*qty/1e4)/10} lakh, above the ₹${P.overnight.maxNotional/1e5} lakh cap`);continue;}
  if(qty<1){decide('SKIPPED','Price above the per-trade capital');continue;}
  const dir=c.side==='BUY'?1:-1;
  const pos={id:`${today}:${c.symbol}:${c.setup}`,policy:P.id,setup:c.setup,symbol:c.symbol,key,side:c.side,product:c.product,qty,entryPrice:price,entryAt:new Date(now).toISOString(),
   stop:r2(price*(1-dir*(overnight?P.overnight.disasterStopPct:win.stopPct)/100)),target:overnight?null:r2(price*(1+dir*win.targetPct/100)),entryCharges:r2(charges(c.product,c.side,price*qty)),mark:q.price,markAt:new Date(now).toISOString(),why:c.why,
   exitBy:c.product==='equity-delivery'?sessionsAfter(today,P.swing.maxSessions):null,...(overnight?{exitAtNextOpen:true,contract:contract.description,exitOn:dayAfter(today)}:{})};
  state.positions.push(pos);traded.add(c.symbol+'|'+c.setup);held.add(c.symbol);decide('ENTERED',`${c.side} ${qty} at ₹${price}`);
  events.push({kind:'ENTRY',at:pos.entryAt,symbol:c.symbol,setup:c.setup,side:c.side,qty,price,stop:pos.stop,target:pos.target});
 }
 for(const e of events)e.id=++state.sequence;
 state.events=[...events.reverse(),...state.events].slice(0,200);
 state.lastCycle={at:new Date(now).toISOString(),marketOpen,quotesMissing:missing,decisions:decisions.slice(0,40)};
 return {state,events};
}
// Today's figures for display: realized, open (marked) and the setup scoreboard.
export function bookSummary(state,now){
 const today=istDate(now),day=state.days?.[today]??{realized:0,trades:0,wins:0,stopped:false};
 const open=state.positions.map(p=>{const pnl=p.mark!=null?(p.mark-p.entryPrice)*p.qty*(p.side==='BUY'?1:-1)-p.entryCharges:null;return {...p,openPnl:pnl==null?null:r2(pnl),openPct:pnl==null?null:r2(pnl/(p.entryPrice*p.qty)*100)};});
 const openPnl=r2(open.reduce((a,p)=>a+(p.openPnl??0),0)),total=Object.values(state.bySetup??{}).reduce((a,s)=>a+s.net,0);
 return {policy:AGGRESSIVE_POLICY,setups:SETUPS,today:{...day,openPnl,pnl:r2(day.realized+openPnl)},open,closedToday:state.closed.filter(c=>istDate(Date.parse(c.exitAt))===today),
  recentClosed:state.closed.slice(0,30),bySetup:Object.entries(state.bySetup??{}).map(([id,s])=>({id,label:SETUPS[id]?.label??id,...s,winRate:s.trades?r2(s.wins/s.trades*100):null,profitFactor:s.grossLoss>0?r2(s.grossWin/s.grossLoss):null})),
  allTimeNet:r2(total),startedAt:state.createdAt,lastCycle:state.lastCycle,events:state.events.slice(0,30),overnight:state.overnight?.date===today?state.overnight:null};
}

// Daily reference levels for the overnight scan, read once per session from completed daily bars (up to the
// previous session). Reads are budgeted; a partial set is completed on later minutes.
export async function loadLevels(previous,{symbols,market,keyOf,now,budgetMs=15000,limit=6}){
 const today=istDate(now),lv=previous?.date===today?structuredClone(previous):{date:today,rows:{},niftyPrevClose:null,failed:{}};
 const want=symbols.filter(s=>!lv.rows[s]&&(lv.failed[s]??0)<3),start=Date.now();
 const read=async key=>(await market.history(key,'1d',now-45*DAY,now)).slice(-20);
 if(lv.niftyPrevClose===null)try{lv.niftyPrevClose=(await read('NSE_INDEX|Nifty 50')).at(-1)?.close??null;}catch{/* retried next minute */}
 let next=0;
 await Promise.all(Array.from({length:limit},async()=>{while(next<want.length&&Date.now()-start<budgetMs){const s=want[next++],key=keyOf(s);if(!key){lv.failed[s]=3;continue;}
  try{const b=await read(key);if(b.length<20)throw new Error('short');lv.rows[s]={key,prevClose:b.at(-1).close,avgVolume20:b.reduce((a,x)=>a+x.volume,0)/b.length,avgTurnover20:b.reduce((a,x)=>a+x.volume*x.close,0)/b.length,high20:Math.max(...b.map(x=>x.high))};}
  catch{lv.failed[s]=(lv.failed[s]??0)+1;}}}));
 lv.complete=Object.keys(lv.rows).length+Object.values(lv.failed).filter(n=>n>=3).length>=symbols.length&&lv.niftyPrevClose!==null;
 return lv;
}

// Runs one minute of the book: daily levels (once a session), the overnight scan on live quotes, candidates from
// this minute's Discover scan, then a compare-and-set save so overlapping ticks cannot overwrite each other.
export async function runAggressiveCycle({store,market,master,observation=null,board=null,now}){
 const at=now(),row=await store.read(),m=istMinute(at);
 const state=row?.data?.version==='aggressive-book-v1'?row.data:newBook(at);
 const marketOpen=observation?.marketOpen??sessionOpen(at);
 if(!marketOpen&&!state.positions.length&&row)return {status:'MARKET_CLOSED',open:0};
 const instruments=await master();
 const eq=new Map(instruments.filter(r=>r.segment==='NSE_EQ'&&r.instrument_type==='EQ').map(r=>[r.trading_symbol,r.instrument_key])),keyOf=s=>eq.get(s)??null;
 // Overnight scan of every stock with futures. Daily levels load from the open in short budgeted batches, so the
 // ~210 history reads are spread over the first minutes; from 10:00 one quote request covers the liquid ones and NIFTY.
 const futuresStocks=[...new Set(instruments.filter(r=>r.segment==='NSE_FO'&&r.instrument_type==='FUT'&&r.underlying_type==='EQUITY').map(r=>r.underlying_symbol))].filter(s=>eq.has(s)).sort();
 let overnight=null,quotes=new Map(),niftyPrice=null;
 if(marketOpen&&(!state.levels?.complete||state.levels.date!==istDate(at)))state.levels=await loadLevels(state.levels,{symbols:futuresStocks,market,keyOf,now:at,budgetMs:m>=AGGRESSIVE_POLICY.overnight.watchFrom?15000:8000});
 if(marketOpen&&m>=AGGRESSIVE_POLICY.overnight.watchFrom&&state.levels){
  const keys=Object.values(state.levels.rows).filter(r=>r.avgTurnover20>=AGGRESSIVE_POLICY.overnight.minTurnover20).map(r=>r.key);
  [quotes,niftyPrice]=await Promise.all([keys.length?market.quotes(keys,at):new Map(),market.indexPrice?market.indexPrice('NSE_INDEX|Nifty 50',at).catch(()=>null):null]);
  overnight=overnightScan({levels:state.levels,quotes,niftyPrice,now:at});state.overnight=overnight;
 }
 const {candidates,rejected}=marketOpen?aggressiveCandidates({discoveries:observation?.discoveries??[],board,overnight,now:at}):{candidates:[],rejected:[]};
 // Futures contracts that do not expire before the exit session, resolved only in the entry window.
 const contracts=new Map();
 if(m>=AGGRESSIVE_POLICY.overnight.from&&m<AGGRESSIVE_POLICY.overnight.until)for(const c of candidates.filter(c=>c.setup==='overnight-gap')){
  const k=keyOf(c.symbol);if(!k)continue;
  try{const f=await market.nextFuture(k,dayAfter(istDate(at)));contracts.set(c.symbol,{key:f.instrumentKey,lotSize:f.lotSize,description:f.description});}catch{/* recorded as no future */}
 }
 const wanted=[...new Set([...state.positions.map(p=>p.key),...candidates.filter(c=>c.setup!=='overnight-gap').map(c=>keyOf(c.symbol)),...[...contracts.values()].map(c=>c.key)].filter(k=>k&&!quotes.has(k)))].slice(0,200);
 if(wanted.length)for(const [k,q] of await market.quotes(wanted,at))quotes.set(k,q);
 const {state:next,events}=stepBook(state,{now:at,candidates,quotes,keyOf,contractOf:s=>contracts.get(s)??null,marketOpen});
 // Why ideas were passed on, counted per session.
 const day=next.days[istDate(at)];day.rejections??={};for(const r of [...rejected,...next.lastCycle.decisions.filter(d=>d.status!=='ENTERED')])day.rejections[r.reason.replace(/\d+(\.\d+)?/g,'N')]=(day.rejections[r.reason.replace(/\d+(\.\d+)?/g,'N')]??0)+1;
 Object.assign(next.lastCycle,{scanObserved:!!observation,rejected:rejected.slice(0,40)});
 const saved=row?await store.save(next,row.updated_at):await store.create(next);
 return {status:saved==='conflict'?'CONFLICT':'SAVED',open:next.positions.length,candidates:candidates.length,entries:events.filter(e=>e.kind==='ENTRY').length,exits:events.filter(e=>e.kind==='EXIT').length,overnightQualifying:overnight?.qualifying??null};
}
