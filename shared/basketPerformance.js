// Basket performance: equal-weight buy-and-hold of the members' closes from a start date, compared with a
// benchmark index and a fixed-deposit line. Pure function over completed daily closes.
const DAY=86400000;
// closes: Map symbol → {dates:string[], closes:number[]} (ascending, completed sessions only).
export function basketPerformance({members,closes,benchmark,startDate,fdRatePct}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate))throw new TypeError('startDate must be YYYY-MM-DD');
 if(!(fdRatePct>=0&&fdRatePct<=20))throw new TypeError('fdRatePct must be from 0 to 20');
 const firstOnOrAfter=(h,date)=>h?h.dates.findIndex(d=>d>=date):-1;
 const bIdx=firstOnOrAfter(benchmark,startDate);
 if(bIdx<0)return {status:'NO_BENCHMARK_DATA',members:[],series:[]};
 const baseDate=benchmark.dates[bIdx],dates=benchmark.dates.slice(bIdx);
 // A member enters only if it has a close on the benchmark's first session; otherwise it is excluded, not back-filled.
 const included=[],excluded=[];
 for(const symbol of members){
  const h=closes.get(symbol),i=h?h.dates.indexOf(baseDate):-1;
  if(i<0){excluded.push({symbol,reason:h?'NO_CLOSE_ON_START_DATE':'NO_PRICE_HISTORY'});continue;}
  included.push({symbol,h,base:h.closes[i],byDate:new Map(h.dates.map((d,k)=>[d,h.closes[k]]))});
 }
 if(!included.length)return {status:'NO_MEMBER_DATA',baseDate,members:[],excluded,series:[]};
 const last=new Map(included.map(m=>[m.symbol,m.base])),stale=new Map(included.map(m=>[m.symbol,0]));
 const series=dates.map((date,k)=>{
  for(const m of included){const c=m.byDate.get(date);if(c!==undefined){last.set(m.symbol,c);}else stale.set(m.symbol,stale.get(m.symbol)+1);}
  const basket=included.reduce((a,m)=>a+last.get(m.symbol)/m.base,0)/included.length*100;
  const days=(Date.parse(date)-Date.parse(baseDate))/DAY;
  return {date,basket,benchmark:benchmark.closes[bIdx+k]/benchmark.closes[bIdx]*100,fd:100*Math.pow(1+fdRatePct/100,days/365)};
 });
 const end=series.at(-1),ret=v=>v-100;
 let peak=0,maxDrawdown=0;for(const p of series){peak=Math.max(peak,p.basket);maxDrawdown=Math.max(maxDrawdown,(1-p.basket/peak)*100);}
 return {status:series.length>1?'MEASURED':'STARTED_TODAY',baseDate,endDate:end.date,sessions:series.length,
  members:included.map(m=>({symbol:m.symbol,returnPct:(last.get(m.symbol)/m.base-1)*100,carriedForwardSessions:stale.get(m.symbol)})),excluded,series,
  summary:{basketPct:ret(end.basket),benchmarkPct:ret(end.benchmark),fdPct:ret(end.fd),excessVsBenchmarkPct:end.basket-end.benchmark,maxDrawdownPct:maxDrawdown},
  method:'Equal weight at the first session on or after the start date, then held without rebalancing. Price returns from closes; dividends excluded. A missing later close carries the previous close forward and is counted.'};
}
