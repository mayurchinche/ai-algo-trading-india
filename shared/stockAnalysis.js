// Stock analysis built from observed facts only. Every derived statement (technical state, SWOT item,
// segment view) cites the fact ids it rests on; missing inputs stay missing instead of becoming neutral.
import {sma,ema,rsi,macd,atr,bollinger,supertrend,donchian,technicalRating} from './indicators.js';
import {computeTrendScore} from './trendScore.js';
export const ANALYSIS_VERSION='stock-analysis-v1';
const last=a=>{for(let i=a.length-1;i>=0;i--)if(Number.isFinite(a[i]))return a[i];return null;};
const at=(a,k)=>Number.isFinite(a[a.length-1-k])?a[a.length-1-k]:null;
const pctChange=(c,k)=>c.length>k&&c[c.length-1-k]>0?(c.at(-1)/c[c.length-1-k]-1)*100:null;
const sd=v=>{const m=v.reduce((a,b)=>a+b,0)/v.length;return Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/(v.length-1));};
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);

export const ratingBand=x=>x>0.5?'Strong buy':x>0.1?'Buy':x>=-0.1?'Neutral':x>=-0.5?'Sell':'Strong sell';
// bars: completed daily bars, oldest first.
export function technicalProfile(bars){
 if(bars.length<30)return {status:'INSUFFICIENT_HISTORY',bars:bars.length};
 const c=bars.map(b=>b.close),h=bars.map(b=>b.high),l=bars.map(b=>b.low),v=bars.map(b=>b.volume??0),close=c.at(-1);
 const s20=sma(c,20),s50=sma(c,50),s200=sma(c,200),e20=ema(c,20),r=rsi(c,14),m=macd(c),a=atr(h,l,c,14),bb=bollinger(c,20,2),st=supertrend(h,l,c,10,3),d20=donchian(h,l,20),d55=donchian(h,l,55);
 const year=bars.slice(-250),hi52=Math.max(...year.map(b=>b.high)),lo52=Math.min(...year.map(b=>b.low));
 const rets=c.slice(1).map((x,i)=>Math.log(x/c[i])),vol20=rets.length>=20?sd(rets.slice(-20))*Math.sqrt(252)*100:null;
 const rolling=[];for(let i=20;i<=Math.min(rets.length,250);i++)rolling.push(sd(rets.slice(rets.length-i,rets.length-i+20))*Math.sqrt(252)*100);
 const volPercentile=vol20!==null&&rolling.length>=60?rolling.filter(x=>x<vol20).length/rolling.length*100:null;
 const avgVol20=v.slice(-21,-1).reduce((x,y)=>x+y,0)/Math.max(1,v.slice(-21,-1).length);
 const gaps=bars.slice(-61).slice(1).map((b,i)=>Math.abs(b.open/bars.slice(-61)[i].close-1)*100),ranges=bars.slice(-20).map(b=>(b.high-b.low)/b.close*100);
 const lb=bars.at(-1),P=(lb.high+lb.low+lb.close)/3;
 // Technical rating on the last bar (TradingView's bands); null without 200 bars or volume.
 let rating=null;try{const tr=technicalRating(h,l,c,v),x=at(tr.rating,0);if(x!==null)rating={value:x,ma:at(tr.maRating,0),oscillators:at(tr.oscRating,0),band:ratingBand(x)};}catch{rating=null;}
 let trend=null;try{trend=computeTrendScore({dates:bars.map(b=>istDate(b.time)),close:c,high:h,low:l}).latest;}catch{trend=null;}
 const s200now=last(s200),s200ago=at(s200,20);
 return {status:'OK',asOf:istDate(lb.time),close,change1dPct:pctChange(c,1),returnsPct:{'1w':pctChange(c,5),'1m':pctChange(c,21),'3m':pctChange(c,63),'6m':pctChange(c,126),'1y':pctChange(c,250)},
  movingAverages:{sma20:last(s20),sma50:last(s50),sma200:s200now,ema20:last(e20),sma200Rising:s200now!==null&&s200ago!==null?s200now>s200ago:null},
  momentum:{rsi14:last(r),macd:last(m.macd),macdSignal:last(m.signal),macdHistogram:last(m.histogram)},
  volatility:{atr14:last(a),atrPct:last(a)!==null?last(a)/close*100:null,annualised20dPct:vol20,percentileOf1y:volPercentile,avgDailyRangePct:ranges.reduce((x,y)=>x+y,0)/ranges.length,avgOpeningGapPct:gaps.length?gaps.reduce((x,y)=>x+y,0)/gaps.length:null},
  bands:{bollingerUpper:last(bb.upper),bollingerLower:last(bb.lower),percentB:last(bb.percentB),supertrend:last(st.line),supertrendDirection:last(st.direction)},
  range:{high52w:hi52,low52w:lo52,belowHighPct:(1-close/hi52)*100,aboveLowPct:(close/lo52-1)*100},
  levels:{pivot:P,r1:2*P-lb.low,s1:2*P-lb.high,resistance20d:at(d20.upper,1),support20d:at(d20.lower,1),resistance55d:at(d55.upper,1),support55d:at(d55.lower,1)},
  volume:{last:v.at(-1),avg20:avgVol20,ratio:avgVol20>0?v.at(-1)/avgVol20:null},
  trendScore:trend,rating};
}
// Option chain summary: put-call ratio of open interest, max pain, ATM IV and the strikes with most OI.
export function optionChainSummary(chain){
 const rows=chain.strikes,oi=(s,t)=>s[t]?.oi??0,ceOi=rows.reduce((a,s)=>a+oi(s,'CE'),0),peOi=rows.reduce((a,s)=>a+oi(s,'PE'),0);
 const pain=rows.map(k=>({strike:k.strike,value:rows.reduce((a,s)=>a+oi(s,'CE')*Math.max(0,k.strike-s.strike)+oi(s,'PE')*Math.max(0,s.strike-k.strike),0)}));
 const atmRow=rows.find(s=>s.strike===chain.atmStrike),top=t=>[...rows].sort((a,b)=>oi(b,t)-oi(a,t)).slice(0,3).map(s=>({strike:s.strike,oi:oi(s,t)}));
 return {expiry:chain.expiry,spot:chain.spot,atmStrike:chain.atmStrike,strikeStep:chain.strikeStep,putCallOiRatio:ceOi>0?peOi/ceOi:null,totalCallOi:ceOi,totalPutOi:peOi,
  maxPain:ceOi+peOi>0?pain.reduce((a,b)=>b.value<a.value?b:a).strike:null,atmIv:{CE:atmRow?.CE?.iv??null,PE:atmRow?.PE?.iv??null},
  callOiWall:top('CE'),putOiWall:top('PE'),observedAt:chain.observedAt,lotSize:atmRow?.CE?.lotSize??atmRow?.PE?.lotSize??null};
}
export function dealsSummary(rows){
 const buys=rows.filter(d=>d.side==='BUY'),sells=rows.filter(d=>d.side==='SELL'),val=a=>a.reduce((x,d)=>x+d.quantity*d.price,0);
 return {count:rows.length,buyValue:val(buys),sellValue:val(sells),netValue:val(buys)-val(sells),largest:[...rows].sort((a,b)=>b.quantity*b.price-a.quantity*a.price).slice(0,10)};
}
export function deliverySummary(days){
 if(!days.length)return null;
 const pct=days.map(d=>d.deliveryPct).filter(Number.isFinite);
 return {latest:days[0],average:pct.length?pct.reduce((a,b)=>a+b,0)/pct.length:null,days:days.length};
}
// Percentile ranks among NIFTY 50 peers from the scorecards (higher is better, already oriented).
export function peerRanks(scorecard){
 if(!scorecard)return [];
 const seen=new Map();for(const s of scorecard.styles)for(const c of s.criteria??[])if(c.status==='RANKED'&&!seen.has(c.metric))seen.set(c.metric,{metric:c.metric,label:c.label,value:c.value,percentile:c.percentile,peers:c.peers});
 return [...seen.values()];
}

// SWOT from facts. Thresholds are relative (peer percentiles, the stock's own history) or descriptive states
// (price above/below its averages), not universal valuation cutoffs.
export function buildSwot({tech,ranks=[],news=null,deals=null,delivery=null,flows=null,signals=[],announcements=[]}){
 const S=[],W=[],O=[],T=[],add=(list,text,basis)=>list.push({text,basis});
 for(const r of ranks){
  if(r.percentile>=70)add(S,`${r.label} ranks in the top ${Math.max(1,Math.round(100-r.percentile))}% of NIFTY 50 peers (${fmt(r.value)})`,['peer:'+r.metric]);
  else if(r.percentile<=30)add(W,`${r.label} ranks in the bottom ${Math.max(1,Math.round(r.percentile))}% of NIFTY 50 peers (${fmt(r.value)})`,['peer:'+r.metric]);
 }
 if(tech?.status==='OK'){
  const ma=tech.movingAverages,cl=tech.close;
  if(ma.sma200!==null&&cl>ma.sma200&&ma.sma200Rising)add(S,'Long-term uptrend: price above a rising 200-day average',['tech:sma200']);
  if(ma.sma200!==null&&cl<ma.sma200&&ma.sma200Rising===false)add(W,'Long-term downtrend: price below a falling 200-day average',['tech:sma200']);
  if(ma.sma50!==null&&ma.sma200!==null&&ma.sma50>ma.sma200&&cl<ma.sma50)add(O,'Pullback inside an uptrend: below the 50-day average while it stays above the 200-day',['tech:sma50','tech:sma200']);
  if(tech.range.belowHighPct<=3)add(O,`Within ${fmt(tech.range.belowHighPct)}% of its 52-week high`,['tech:52w']);
  if(tech.range.aboveLowPct<=5)add(T,`Within ${fmt(tech.range.aboveLowPct)}% of its 52-week low`,['tech:52w']);
  if(tech.volatility.percentileOf1y!==null&&tech.volatility.percentileOf1y>=80)add(T,`Volatility is high for this stock: 20-day volatility is above ${Math.round(tech.volatility.percentileOf1y)}% of the past year`,['tech:volatility']);
  if(tech.volume.ratio!==null&&tech.volume.ratio>=2)add(tech.change1dPct>=0?O:T,`Last session volume was ${fmt(tech.volume.ratio)}× its 20-day average on a ${fmt(tech.change1dPct)}% move`,['tech:volume']);
 }
 if(deals?.count){
  if(deals.netValue>0)add(O,`Bulk/block deals in the period were net buying of ₹${crore(deals.netValue)} crore (${deals.count} deals)`,['deals']);
  else if(deals.netValue<0)add(T,`Bulk/block deals in the period were net selling of ₹${crore(-deals.netValue)} crore (${deals.count} deals)`,['deals']);
 }
 if(delivery?.latest?.deliveryPct!=null&&delivery.average!=null&&delivery.days>=5){
  if(delivery.latest.deliveryPct>=delivery.average*1.3)add(O,`Delivery ${fmt(delivery.latest.deliveryPct)}% of volume, above its ${delivery.days}-day average of ${fmt(delivery.average)}%`,['delivery']);
 }
 if(news?.summary?.status==='available'){const n=news.summary.counts;if(n.negative>n.positive*2&&n.negative>=3)add(T,`Recent headlines lean negative (${n.negative} negative vs ${n.positive} positive, keyword count)`,['news']);else if(n.positive>n.negative*2&&n.positive>=3)add(O,`Recent headlines lean positive (${n.positive} positive vs ${n.negative} negative, keyword count)`,['news']);}
 const flow=flows?.find?.(f=>f.category==='FII/FPI');if(flow&&flow.net<0)add(T,`FII/FPI were net sellers of ₹${fmt(-flow.net)} crore in the cash market on ${flow.date}`,['flows']);else if(flow&&flow.net>0)add(O,`FII/FPI were net buyers of ₹${fmt(flow.net)} crore in the cash market on ${flow.date}`,['flows']);
 for(const s of signals.filter(s=>s.status==='ACTIVE'))add(O,`Validated ${s.strategyName} signal on ${s.symbol} (${s.segment})`,['signal:'+s.id]);
 const events=announcements.filter(a=>/board meeting|results|dividend|bonus|split|buyback|acquisition|merger/i.test(a.subject+' '+a.text)).slice(0,3);
 for(const e of events)add(O,`Recent corporate event: ${e.subject} (${e.date})`,['announcement']);
 return {strengths:S,weaknesses:W,opportunities:O,threats:T,method:'Rules on observed facts: NIFTY 50 peer percentiles (≥70 strength, ≤30 weakness), the stock’s own price and volatility history, recorded deals, delivery, flows, headline keyword counts and validated signals. Not investment advice.'};
}
const fmt=v=>v===null||v===undefined||!Number.isFinite(v)?'n/a':Math.abs(v)>=100?v.toFixed(0):v.toFixed(2);
const crore=v=>(v/1e7).toFixed(2);
