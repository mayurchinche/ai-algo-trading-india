// Aggressive paper book: an experimental, separately tracked book that trades high-potential setups that have
// NOT passed strategy validation, with small fixed sizing and hard limits, so their live record shows which
// ones deserve promotion. It never places broker orders and never mixes with the validated book.
// Every parameter below was fixed on 2026-10-21 before any trade; changing one starts a new policy id.
import {orderCharges} from '../shared/brokerCharges.js';
import {isNseTradingDay,nextNseTradingDay} from '../shared/nseCalendar.js';
export const AGGRESSIVE_POLICY=Object.freeze({
 id:'aggressive-v1',capitalPerTrade:25000,maxOpen:5,dailyLossStop:10000,slippageBps:5,
 // Intraday setups (MIS): squared off at 15:15.
 intraday:Object.freeze({minScore:60,minPrice:10,minTurnover:2e7,maxMovePct:12,stopPct:1.5,targetPct:3,from:560,until:870,squareOff:915}),
 // Early breakout of a validated daily rule (CNC): bought when the live price crosses the rule's trigger level.
 swing:Object.freeze({stopPct:5,targetPct:10,maxSessions:10,from:570,until:915}),
});
export const SETUPS=Object.freeze({
 'gap-and-go':{label:'Gap-and-go',product:'equity-intraday',rule:'An opening gap of 1–5% that breaks its 09:15–09:20 range in the gap direction (opening-gap watch).'},
 'breakout-early':{label:'Early breakout',product:'equity-delivery',rule:'The live price crosses the trigger level of a validated daily breakout rule before the close confirms it.'},
 'discover-momentum':{label:'Discover momentum',product:'equity-intraday',rule:'Discover score of 60 or more (either direction) with a matching signal, on a liquid stock without a circuit-sized move.'},
});
const BREAKOUT_RULES=new Set(['short-term-donchian','futures-breakout-long','long-term-52w-high']);
const DAY=86400000,r2=v=>Math.round(v*100)/100;
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);
const istClock=ms=>new Date(ms+19800000).toISOString().slice(11,16)+' IST';
const istMinute=ms=>{const d=new Date(ms+19800000);return d.getUTCHours()*60+d.getUTCMinutes();};
export const sessionOpen=now=>isNseTradingDay(istDate(now))&&istMinute(now)>=555&&istMinute(now)<930;
export function newBook(now){return {version:'aggressive-book-v1',policy:AGGRESSIVE_POLICY.id,createdAt:new Date(now).toISOString(),sequence:0,positions:[],closed:[],days:{},bySetup:{},events:[],lastCycle:null};}
// The session `n` trading days after `date` (date itself is day 0).
function sessionsAfter(date,n){let d=date;for(let i=0;i<n;i++)d=nextNseTradingDay(new Date(Date.parse(d+'T00:00:00Z')+DAY).toISOString().slice(0,10));return d;}

// Candidate setups from this minute's observations. Returns {candidates, rejected}, each with a reason, so the
// board can say why a visible idea was or was not traded.
export function aggressiveCandidates({discoveries=[],gapWatch=null,board=null,now}){
 const p=AGGRESSIVE_POLICY.intraday,m=istMinute(now),candidates=[],rejected=[];
 const reject=(setup,symbol,reason,extra={})=>rejected.push({setup,symbol,reason,...extra});
 for(const g of gapWatch?.rows??[]){
  if(g.status!=='BREAKOUT_OBSERVED'){continue;}
  candidates.push({setup:'gap-and-go',symbol:g.symbol,side:g.direction==='DOWN'?'SELL':'BUY',product:'equity-intraday',why:`Gap ${r2(g.gapPct)}% broke its opening range${g.confirmationTime?' at '+istClock(Date.parse(g.confirmationTime)):''}`,score:null});
 }
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
// One minute of the book. quotes: Map instrumentKey → {price,bid,ask}; keyOf: symbol → NSE_EQ instrument key or null.
export function stepBook(previous,{now,candidates=[],quotes=new Map(),keyOf=()=>null,marketOpen=sessionOpen(now)}){
 const state=structuredClone(previous),P=AGGRESSIVE_POLICY,m=istMinute(now),today=istDate(now),events=[],decisions=[];
 state.days[today]??={realized:0,trades:0,wins:0,stopped:false};
 let missing=0;
 // 1. Marks and exits.
 for(const pos of [...state.positions]){
  const q=quotes.get(pos.key);if(!q){missing++;continue;}
  pos.mark=q.price;pos.markAt=new Date(now).toISOString();
  if(!marketOpen)continue;
  const long=pos.side==='BUY',px=long?q.bid:q.ask;
  const reason=long?(px<=pos.stop?'STOP':px>=pos.target?'TARGET':null):(px>=pos.stop?'STOP':px<=pos.target?'TARGET':null);
  if(reason)close(state,pos,q,now,reason,events);
  else if(pos.product==='equity-intraday'&&m>=P.intraday.squareOff)close(state,pos,q,now,'SQUARE_OFF_1515',events);
  else if(pos.exitBy&&today>=pos.exitBy&&m>=P.intraday.squareOff)close(state,pos,q,now,'HOLDING_LIMIT',events);
 }
 // 2. Daily loss stop on realized plus open (marked) results.
 const day=state.days[today],open=state.positions.reduce((a,p)=>a+(p.mark!=null?(p.mark-p.entryPrice)*p.qty*(p.side==='BUY'?1:-1)-p.entryCharges:0),0);
 if(!day.stopped&&day.realized+open<=-P.dailyLossStop){day.stopped=true;events.push({kind:'DAILY_LOSS_STOP',at:new Date(now).toISOString(),pnl:r2(day.realized+open)});}
 // 3. Entries, highest priority first: gaps, early breakouts, then Discover by score.
 const order={'gap-and-go':0,'breakout-early':1,'discover-momentum':2};
 const traded=new Set([...state.positions.map(p=>p.symbol),...state.closed.filter(c=>istDate(Date.parse(c.entryAt))===today).map(c=>c.symbol)]);
 for(const c of [...candidates].sort((a,b)=>order[a.setup]-order[b.setup]||Math.abs(b.score??0)-Math.abs(a.score??0))){
  const decide=(status,reason)=>decisions.push({setup:c.setup,symbol:c.symbol,side:c.side,why:c.why,score:c.score,status,reason});
  const win=c.product==='equity-intraday'?P.intraday:P.swing,key=keyOf(c.symbol),q=key&&quotes.get(key);
  if(c.blocked){decide('WAITING',c.blocked);continue;}
  if(!marketOpen||m<win.from||m>=win.until){decide('WAITING','Outside this setup’s entry window');continue;}
  if(day.stopped){decide('BLOCKED','Daily loss stop reached');continue;}
  if(traded.has(c.symbol)){decide('SKIPPED','Already traded this stock today or holding it');continue;}
  if(state.positions.length>=P.maxOpen){decide('BLOCKED',`Book full (${P.maxOpen} open positions)`);continue;}
  if(!q){decide('SKIPPED','No fresh quote with a two-sided book');continue;}
  if(c.setup==='breakout-early'&&!(q.price>=c.trigger)){decide('WATCHING',`Price ₹${r2(q.price)} below trigger ₹${r2(c.trigger)}`);continue;}
  const price=fillPrice(q,c.side),qty=Math.floor(P.capitalPerTrade/price);
  if(qty<1){decide('SKIPPED','Price above the per-trade capital');continue;}
  const dir=c.side==='BUY'?1:-1,lv=c.product==='equity-intraday'?P.intraday:P.swing;
  const pos={id:`${today}:${c.symbol}:${c.setup}`,setup:c.setup,symbol:c.symbol,key,side:c.side,product:c.product,qty,entryPrice:price,entryAt:new Date(now).toISOString(),
   stop:r2(price*(1-dir*lv.stopPct/100)),target:r2(price*(1+dir*lv.targetPct/100)),entryCharges:r2(charges(c.product,c.side,price*qty)),mark:q.price,markAt:new Date(now).toISOString(),why:c.why,
   exitBy:c.product==='equity-delivery'?sessionsAfter(today,P.swing.maxSessions):null};
  state.positions.push(pos);traded.add(c.symbol);decide('ENTERED',`${c.side} ${qty} at ₹${price}`);
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
  allTimeNet:r2(total),startedAt:state.createdAt,lastCycle:state.lastCycle,events:state.events.slice(0,30)};
}

// Runs one minute of the book: candidates from this minute's scan (if the scan ran), live Upstox quotes for
// candidates and open positions, then a compare-and-set save so overlapping ticks cannot overwrite each other.
export async function runAggressiveCycle({store,market,master,observation=null,board=null,now}){
 const at=now(),row=await store.read();
 const state=row?.data?.version==='aggressive-book-v1'?row.data:newBook(at);
 const marketOpen=observation?.marketOpen??sessionOpen(at);
 if(!marketOpen&&!state.positions.length&&row)return {status:'MARKET_CLOSED',open:0};
 const {candidates,rejected}=observation&&marketOpen?aggressiveCandidates({discoveries:observation.discoveries,gapWatch:observation.gapWatch,board,now:at}):{candidates:[],rejected:[]};
 let keyOf=()=>null,quotes=new Map();
 if(state.positions.length||candidates.length){
  const keys=new Map((await master()).filter(r=>r.segment==='NSE_EQ'&&r.instrument_type==='EQ').map(r=>[r.trading_symbol,r.instrument_key]));
  keyOf=s=>keys.get(s)??null;
  const wanted=[...new Set([...state.positions.map(p=>p.key),...candidates.map(c=>keyOf(c.symbol)).filter(Boolean)])].slice(0,200);
  quotes=await market.quotes(wanted,at);
 }
 const {state:next,events}=stepBook(state,{now:at,candidates,quotes,keyOf,marketOpen});
 Object.assign(next.lastCycle,{scanObserved:!!observation,rejected:rejected.slice(0,40)});
 const saved=row?await store.save(next,row.updated_at):await store.create(next);
 return {status:saved==='conflict'?'CONFLICT':'SAVED',open:next.positions.length,candidates:candidates.length,entries:events.filter(e=>e.kind==='ENTRY').length,exits:events.filter(e=>e.kind==='EXIT').length};
}
