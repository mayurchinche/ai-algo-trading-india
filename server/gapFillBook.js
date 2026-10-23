// Gap-down fill test book (experimental paper book, strategy plan Phase 3 / F12). The backtest of the intraday
// gap-down fill made +1.9% a month out of sample only when bought at the official open (the pre-open call
// auction, 09:00–09:08); bought a little later its edge disappeared. This book measures exactly that, live:
//   - at the first minute from 09:15 it reads NSE's pre-open data (the auction price of every stock) and picks
//     stocks opening 2–6% below the previous close, above their 200-day average, with ₹10 crore average daily
//     traded value and a price of ₹50 or more; days with a split/bonus/rights/demerger are skipped;
//   - each pick is recorded twice: the AUCTION ledger buys at the auction price (what a pre-open order receives,
//     the backtested strategy) and the LIVE ledger at the ask of that first minute (an order placed after the
//     open); both have a 1.5% stop from their own entry and sell at 15:15 at the bid;
//   - sizing as the backtest (research/lib/portfolioSim.mjs): 0.5% of auction-ledger equity at risk per trade,
//     at most 25% of equity per position, no leverage, at most 8 positions, intraday (MIS) charges, 5/10 bps
//     slippage by liquidity; no new entries the day after a 1.5% losing day or after a 4% losing month.
// Parameters are fixed (policy gapfill-v1); it never places broker orders and never mixes with other books.
import {orderCharges} from '../shared/brokerCharges.js';
import {nseText,nseDate} from './marketIntel.js';
import {sessionOpen} from './aggressiveBook.js';
export const GAPFILL_VERSION='gapfill-book-v1';
export const GAPFILL_ROW='gapfill_book';
export const PREOPEN_URL='https://www.nseindia.com/api/market-data-pre-open?key=ALL';
export const GAPFILL_POLICY=Object.freeze({id:'gapfill-v1',capital:200000,riskPct:0.5,maxPosPct:25,maxPositions:8,minGapPct:2,maxGapPct:6,stopPct:1.5,
 minTurnover:1e8,minPrice:50,dailyStopPct:1.5,monthStopPct:4,decideFrom:555,decideUntil:560,exitAt:915,
 // Out-of-sample backtest (2022–2026, auction fills): per trade after charges, and per month.
 backtest:{avgTradePct:0.20,winRatePct:36.4,avgMonthPct:1.91,worstMonthPct:-5.05,maxDrawdownPct:-14.7,source:'research/phase3Run.mjs gapdown-fill-intraday, survivorship-free NSE bhavcopy 2022–2026'}});
const DAY=86400000,r2=v=>Math.round(v*100)/100;
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);
const istMinute=ms=>{const d=new Date(ms+19800000);return d.getUTCHours()*60+d.getUTCMinutes();};
const slip=turn=>turn>=5e8?0.0005:0.001;
const charges=(side,value)=>orderCharges('equity-intraday',side,value).total;
export function newGapBook(now){const c=GAPFILL_POLICY.capital;return {version:GAPFILL_VERSION,policy:GAPFILL_POLICY.id,createdAt:new Date(now).toISOString(),
 ledgers:{auction:{equity:c,realized:0},live:{equity:c,realized:0}},positions:[],closed:[],days:{},months:{}};}
// NSE pre-open rows → {symbol, prevClose, open (auction price), purpose, updated (YYYY-MM-DD)}; unmatched auctions dropped.
export function parsePreOpen(body){
 const p=JSON.parse(body);if(!Array.isArray(p?.data))throw Object.assign(new Error('format'),{code:'PREOPEN_FORMAT_CHANGED'});
 return p.data.flatMap(r=>{const m=r.metadata??{},d=r.detail?.preOpenMarket??{},open=Number(d.finalPrice),prev=Number(m.previousClose),qty=Number(d.finalQuantity);
  if(m.series!=='EQ'||!/^[A-Z0-9&-]{1,30}$/.test(m.symbol??'')||!(open>0)||!(prev>0)||!(qty>0))return [];
  return [{symbol:m.symbol,prevClose:prev,open,purpose:m.purpose??null,updated:nseDate(String(d.lastUpdateTime??'').slice(0,11))}];});
}
const CORPORATE=/split|sub-?division|bonus|rights|demerger|scheme|consolidation/i;
// Pre-open rows that gap down 2–6% (before the daily-level checks).
export function gapCandidates(rows,today){const p=GAPFILL_POLICY;
 return rows.filter(r=>r.updated===today&&!CORPORATE.test(r.purpose??'')&&r.prevClose>=p.minPrice).map(r=>({...r,gapPct:(r.open/r.prevClose-1)*100}))
  .filter(r=>r.gapPct<=-p.minGapPct&&r.gapPct>=-p.maxGapPct).sort((a,b)=>a.gapPct-b.gapPct);}
// Daily levels from completed daily bars (oldest first): 200-day average and 20-day average traded value.
export function levelsFrom(bars){if(bars.length<200)return null;const c=bars.map(b=>b.close),last=bars.slice(-20);
 return {prevClose:c.at(-1),sma200:c.slice(-200).reduce((a,b)=>a+b,0)/200,turnover20:last.reduce((a,b)=>a+b.close*b.volume,0)/last.length};}
const monthOf=d=>d.slice(0,7);
// Entries allowed today? (the day after a 1.5% losing day, or a 4% losing month, there are none)
export function entriesBlocked(state,today){const p=GAPFILL_POLICY,days=Object.keys(state.days).filter(d=>d<today).sort(),prev=days.at(-1),m=state.months[monthOf(today)];
 if(prev&&state.days[prev].startEquity>0&&state.days[prev].auctionNet/state.days[prev].startEquity*100<=-p.dailyStopPct)return 'Daily loss stop (previous session lost 1.5% or more)';
 if(m&&m.startEquity>0&&m.auctionNet/m.startEquity*100<=-p.monthStopPct)return 'Monthly loss stop (4% lost this month)';
 return null;}
// Picks and sizes entries. cands: gap candidates with levels; quotes: Map key → live quote (ask) for the live ledger.
export function decideEntries(state,{cands,quotes,now}){
 const p=GAPFILL_POLICY,eq=state.ledgers.auction.equity,today=istDate(now),out={entered:[],rejected:[]};let cash=eq;
 for(const c of cands){
  const why=!c.levels?'Under 200 sessions of history':!(c.levels.prevClose>c.levels.sma200)?'Below its 200-day average':!(c.levels.turnover20>=p.minTurnover)?'Average daily traded value under ₹10 crore':out.entered.length>=p.maxPositions?'Eight positions already':null;
  if(why){out.rejected.push({symbol:c.symbol,gapPct:r2(c.gapPct),reason:why});continue;}
  const s=slip(c.levels.turnover20),px=c.open*(1+s),stop=c.open*(1-p.stopPct/100);
  let qty=Math.min(Math.floor(eq*p.riskPct/100/(px-stop)),Math.floor(eq*p.maxPosPct/100/px));
  while(qty>0&&qty*px+charges('BUY',qty*px)>cash)qty--;
  if(qty<1){out.rejected.push({symbol:c.symbol,gapPct:r2(c.gapPct),reason:'No cash left for another position'});continue;}
  const aCost=qty*px+charges('BUY',qty*px);cash-=aCost;
  const q=quotes.get(c.key),lpx=q?.ask>0?q.ask*(1+s):null;
  out.entered.push({id:`${today}:${c.symbol}`,date:today,symbol:c.symbol,key:c.key,gapPct:r2(c.gapPct),prevClose:c.prevClose,qty,slip:s,
   auction:{entry:r2(px),stop:r2(stop),cost:aCost,open:true},
   live:lpx?{entry:r2(lpx),stop:r2(lpx*(1-p.stopPct/100)),cost:qty*lpx+charges('BUY',qty*lpx),open:true,quoteAt:q.timestamp??null,lateByPct:r2((lpx/px-1)*100)}:{open:false,missing:'No live quote at the decision minute'}});
 }
 return out;}
// One ledger leg of a position closes: proceeds after charges, net against its cost.
function closeLeg(leg,qty,price,reason,at){const v=qty*price,net=v-charges('SELL',v)-leg.cost;Object.assign(leg,{open:false,exit:r2(price),exitAt:new Date(at).toISOString(),reason,net:r2(net),netPct:r2(net/leg.cost*100)});return net;}
// Stops (the day's low reached the stop: filled at the stop less slippage) and the 15:15 exit at the bid.
export function managePositions(state,{quotes,now}){
 const p=GAPFILL_POLICY,m=istMinute(now),events=[];
 for(const pos of state.positions){const q=quotes.get(pos.key);if(!q)continue;
  for(const name of ['auction','live']){const leg=pos[name];if(!leg.open)continue;
   if(Number.isFinite(q.dayLow)&&q.dayLow<=leg.stop){events.push({name,symbol:pos.symbol,net:closeLeg(leg,pos.qty,leg.stop*(1-pos.slip),'STOP',now)});continue;}
   if(m>=p.exitAt&&q.bid>0)events.push({name,symbol:pos.symbol,net:closeLeg(leg,pos.qty,q.bid*(1-pos.slip),'EXIT_1515',now)});}}
 return events;}
function book(state,events,today){
 const day=state.days[today],month=state.months[monthOf(today)];
 for(const e of events){const L=state.ledgers[e.name];L.realized=r2(L.realized+e.net);L.equity=r2(L.equity+e.net);if(e.name==='auction'){day.auctionNet=r2(day.auctionNet+e.net);month.auctionNet=r2(month.auctionNet+e.net);}else{day.liveNet=r2(day.liveNet+e.net);month.liveNet=r2(month.liveNet+e.net);}}
 const done=state.positions.filter(x=>!x.auction.open&&!x.live.open);state.positions=state.positions.filter(x=>x.auction.open||x.live.open);state.closed=[...done,...state.closed].slice(0,500);
}
// One scheduler minute. market: specPaperMarket (history, quotes); master: instrument list.
export async function runGapFillCycle({store,market,master,now,fetcher=fetch}){
 const at=now(),today=istDate(at),m=istMinute(at),p=GAPFILL_POLICY;
 const row=await store.read(),state=row?.data?.version===GAPFILL_VERSION?row.data:newGapBook(at);
 if(!sessionOpen(at))return {status:'MARKET_CLOSED',open:state.positions.length};
 const eq=state.ledgers.auction.equity;
 state.months[monthOf(today)]??={startEquity:eq,auctionNet:0,liveNet:0};
 const day=state.days[today]??={startEquity:eq,auctionNet:0,liveNet:0,decision:null};
 let decided=false;
 if(!day.decision&&m>=p.decideFrom&&m<=p.decideUntil){
  const blocked=entriesBlocked(state,today);
  if(blocked)day.decision={status:'BLOCKED',reason:blocked,at:new Date(at).toISOString()};
  else{
   let rows=null;try{rows=parsePreOpen(await nseText(fetcher,PREOPEN_URL,8e6));}catch(e){if(m>=p.decideUntil)day.decision={status:'PREOPEN_UNAVAILABLE',reason:e?.code??'UNAVAILABLE',at:new Date(at).toISOString()};}
   if(rows){
    // Company shares only (ISIN INE…), as in the backtest: ETFs such as SILVERBEES also trade in series EQ.
    const eqKeys=new Map((await master()).filter(r=>r.segment==='NSE_EQ'&&r.instrument_type==='EQ'&&/^NSE_EQ\|INE/.test(r.instrument_key??'')).map(r=>[r.trading_symbol,r.instrument_key]));
    const cands=gapCandidates(rows,today).map(c=>({...c,key:eqKeys.get(c.symbol)??null})).filter(c=>c.key);
    if(!rows.some(r=>r.updated===today))day.decision={status:'PREOPEN_STALE',at:new Date(at).toISOString(),rows:rows.length};
    else{
     let next=0;const start=Date.now();
     await Promise.all(Array.from({length:6},async()=>{while(next<cands.length&&Date.now()-start<20000){const c=cands[next++];try{c.levels=levelsFrom(await market.history(c.key,'1d',at-330*DAY,at));}catch{c.levels=null;c.levelsFailed=true;}}}));
     const ready=cands.filter(c=>'levels' in c);
     const keys=ready.filter(c=>c.levels).map(c=>c.key),quotes=keys.length?await market.quotes(keys,at):new Map();
     const d=decideEntries(state,{cands:ready,quotes,now:at});
     state.positions.push(...d.entered);decided=true;
     day.decision={status:'DECIDED',at:new Date(at).toISOString(),candidates:cands.length,checked:ready.length,entered:d.entered.map(e=>e.symbol),rejected:d.rejected.slice(0,40),unchecked:cands.length-ready.length};
    }
   }
  }
 }
 let events=[];
 if(state.positions.length){const keys=state.positions.map(x=>x.key),quotes=await market.quotes(keys,at);events=managePositions(state,{quotes,now:at});book(state,events,today);}
 state.lastCycle={at:new Date(at).toISOString(),open:state.positions.length};
 const saved=row?await store.save(state,row.updated_at):await store.create(state);
 return {status:saved==='conflict'?'CONFLICT':'SAVED',decided,open:state.positions.length,exits:events.length};
}
// Summary for the Today and Accuracy pages: both ledgers' closed trades against the backtest.
export function gapFillSummary(state,now){
 if(!state)return null;const today=istDate(now),stats=name=>{const t=state.closed.map(x=>x[name]).filter(l=>l&&!l.open&&Number.isFinite(l.netPct)),w=t.filter(l=>l.net>0);
  return {trades:t.length,winRatePct:t.length?r2(w.length/t.length*100):null,avgTradePct:t.length?r2(t.reduce((a,l)=>a+l.netPct,0)/t.length):null,net:r2(t.reduce((a,l)=>a+l.net,0)),equity:state.ledgers[name].equity};};
 const lates=state.closed.concat(state.positions).map(x=>x.live?.lateByPct).filter(Number.isFinite);
 return {policy:GAPFILL_POLICY,startedAt:state.createdAt,auction:stats('auction'),live:stats('live'),avgLateByPct:lates.length?r2(lates.reduce((a,b)=>a+b,0)/lates.length):null,
  today:state.days[today]??null,month:state.months[today.slice(0,7)]??null,open:state.positions,recent:state.closed.slice(0,20)};
}
