// Today's board: one ranked list of everything that could become a trade now, each with its status (traded
// by which book, waiting for what, or why not), plus the books' results and smart-money context.
// Pure: the API handler supplies the stored inputs.
import {STRATEGIES} from '../shared/strategyLibrary.js';
import {SEGMENTS} from '../shared/tradingHorizon.js';
import {validUntilOf,runIdFor} from './signalEngine.js';
import {bookSummary,SETUPS} from './aggressiveBook.js';
const r2=v=>Math.round(v*100)/100;
const TIER={VALIDATED:0,AGGRESSIVE_OPEN:1,ENTERED:1,OVERNIGHT:1,WATCHING:2,NEAR_TRIGGER:3,WAITING:3,BLOCKED:4,SKIPPED:4,DISCOVER:5};
export function buildToday({now,signals=[],board=null,verdicts=[],book=null,discoveries=[],deals=[],automation=null}){
 const items=[],seen=new Set(),add=x=>{const k=x.symbol+'|'+x.kind+'|'+(x.ruleId??x.setup??'');if(seen.has(k))return;seen.add(k);items.push(x);};
 // 1. Validated signals still actionable: the validated book paper-trades these automatically.
 for(const r of signals){const s=r.signal,until=validUntilOf(s);if(now>until)continue;
  add({kind:'VALIDATED',symbol:s.symbol,side:s.direction==='SHORT'||s.direction==='BEARISH'?'SELL':'BUY',segment:s.segment,ruleId:s.strategyId,title:s.strategyName,why:s.rule,status:'Paper-traded by the validated book',until:new Date(until).toISOString(),paperRunId:runIdFor(s.id),price:s.close});}
 // 2. Aggressive book: open positions, then this minute's decisions on its candidates.
 const summary=book?bookSummary(book,now):null;
 for(const p of summary?.open??[])add({kind:'AGGRESSIVE_OPEN',symbol:p.symbol,side:p.side,setup:p.setup,title:SETUPS[p.setup]?.label??p.setup,why:p.why,status:`In the aggressive book: ${p.side} ${p.qty} at ₹${p.entryPrice}`,pnl:p.openPnl,pnlPct:p.openPct,stop:p.stop,target:p.target,price:p.mark});
 // Tomorrow's gap: stocks qualifying for the overnight setup before the close.
 for(const r of summary?.overnight?.rows??[])if(r.qualifies)add({kind:'OVERNIGHT',symbol:r.symbol,side:'BUY',setup:'overnight-gap',title:'Overnight gap · expected gap up tomorrow',why:`${r.rule}: ${r.retPct>0?'+':''}${r.retPct}% on ${r.volumeRatio}× volume`,status:'Qualifies now; the aggressive book buys one lot of the future 15:15–15:25 and sells at the next open',price:r.price});
 for(const d of summary?.lastCycle?.decisions??[])if(d.status!=='ENTERED'&&d.setup!=='overnight-gap')add({kind:d.status,symbol:d.symbol,side:d.side,setup:d.setup,title:SETUPS[d.setup]?.label??d.setup,why:d.why,status:d.reason,score:d.score});
 // 3. Validated rules within reach of their trigger (daily close needed for a validated signal).
  // One row per stock; several rules near the same level are named together.
 const near=new Map();for(const b of board?.rows??[])if(b.state==='NEAR_TRIGGER'){const n=near.get(b.symbol);if(!n||b.trigger.distancePct<n.trigger.distancePct)near.set(b.symbol,{...b,names:[...(n?.names??[]),b.strategyName]});else n.names.push(b.strategyName);}
 for(const b of near.values())add({kind:'NEAR_TRIGGER',symbol:b.symbol,side:'BUY',segment:b.segment,ruleId:b.strategyId,title:b.names.join(' · '),why:b.trigger?.condition,status:`${r2(b.trigger?.distancePct)}% below the trigger ₹${r2(b.trigger?.level)}`,distancePct:b.trigger?.distancePct,price:b.close});
 // 4. Discover sightings today and why the aggressive book passed on them.
 const rejected=new Map((summary?.lastCycle?.rejected??[]).map(r=>[r.symbol,r.reason]));
 for(const o of discoveries)add({kind:'DISCOVER',symbol:o.symbol,side:o.side,setup:'discover-momentum',title:`Discover ${o.side.toLowerCase()} · max score ${o.max_score}`,why:(o.details?.reasons??[]).slice(0,2).join('; '),status:rejected.get(o.symbol)??(o.details?.eligible===false?'Blocked: '+(o.details.blockedReasons??[]).join('; '):'Recorded for accuracy tracking'),score:o.max_score,firstSeenAt:o.first_seen_at,firstPrice:o.first_price});
 items.sort((a,b)=>TIER[a.kind]-TIER[b.kind]||(a.distancePct??0)-(b.distancePct??0)||Math.abs(b.score??0)-Math.abs(a.score??0));
 // Coverage: validated rules per segment.
 const by=new Map();for(const v of verdicts)if(v.verdict==='VALIDATED'){if(!by.has(v.strategy_id))by.set(v.strategy_id,new Set());by.get(v.strategy_id).add(v.symbol);}
 const coverage=SEGMENTS.map(seg=>{const rules=STRATEGIES.filter(s=>s.segment===seg.id);return {id:seg.id,label:seg.label,rules:rules.length,validated:rules.filter(r=>by.has(r.id)).length,stocks:new Set(rules.flatMap(r=>[...(by.get(r.id)??[])])).size};});
 const dealRows=netDeals(deals);
 const held=(board?.rows??[]).filter(b=>b.state==='IN_POSITION');
 return {computedAt:new Date(now).toISOString(),items:items.slice(0,80),coverage,book:summary,held,deals:{date:deals[0]?.trade_date??null,rows:dealRows.rows,roundTrips:dealRows.roundTrips},automation};
}
// Smart money: each client's bulk and block deals in a stock netted for the session. A client that bought and
// sold nearly the same amount (net under 20% of what it traded) was trading through the day, typically a
// market maker, and shows no position change, so it is counted but not listed.
export function netDeals(deals,{limit=15,minNetShare=0.2}={}){
 const by=new Map();
 for(const d of deals){const k=d.symbol+'|'+d.client,v=d.quantity*d.price,x=by.get(k)??{symbol:d.symbol,client:d.client,kinds:new Set(),buyQty:0,sellQty:0,buyValue:0,sellValue:0};
  x.kinds.add(d.kind);if(d.side==='BUY'){x.buyQty+=d.quantity;x.buyValue+=v;}else{x.sellQty+=d.quantity;x.sellValue+=v;}by.set(k,x);}
 const all=[...by.values()].map(x=>{const net=x.buyValue-x.sellValue,gross=x.buyValue+x.sellValue,qty=x.buyQty-x.sellQty;
  return {symbol:x.symbol,client:x.client,kind:[...x.kinds].join('+'),side:net>=0?'BUY':'SELL',quantity:Math.abs(qty),price:qty?r2(Math.abs(net/qty)):null,value:r2(Math.abs(net)),gross:r2(gross),roundTrip:Math.abs(net)<gross*minNetShare};});
 return {rows:all.filter(x=>!x.roundTrip).sort((a,b)=>b.value-a.value).slice(0,limit),roundTrips:all.filter(x=>x.roundTrip).length};
}
