// Investor-style scorecards: our own transparent rules inspired by publicly described investing approaches,
// not endorsed by or affiliated with their authors. Each criterion is a percentile among a dated peer set
// (companies whose latest annual period ends on the same date), never a universal cutoff.
export const SCORECARD_VERSION='style-scorecards-v1';
export const MIN_PEERS=10;
export const MIN_COVERAGE=2/3;
export const MIN_STYLES_FOR_COMPOSITE=3;

// [key, label, direction]. Ratio and growth keys refer to deriveFundamentals output; price keys to priceFacts.
const METRICS={
 roce:['ROCE','higher'],roe:['ROE','higher'],debtToEquity:['Debt / equity','lower'],pe:['P/E','lower'],peg:['PEG','lower'],
 revenueGrowth1y:['Revenue growth, 1 year','higher'],revenueGrowth3y:['Revenue CAGR, 3 years','higher'],revenueGrowth5y:['Revenue CAGR, 5 years','higher'],
 profitGrowth1y:['Profit growth, 1 year','higher'],profitGrowth3y:['Profit CAGR, 3 years','higher'],profitGrowth5y:['Profit CAGR, 5 years','higher'],
 return12m:['12-month price return','higher'],belowHigh:['Distance below 52-week high','lower'],
};
export const STYLES=Object.freeze([
 {id:'value',label:'Value',inspiration:'Quality businesses at a reasonable price (Buffett / Graham style)',criteria:[['roe',25],['roce',25],['debtToEquity',20],['pe',20],['profitGrowth5y',10]]},
 {id:'garp',label:'GARP',inspiration:'Growth at a reasonable price (Lynch style)',criteria:[['peg',40],['profitGrowth3y',25],['revenueGrowth3y',15],['debtToEquity',20]]},
 {id:'growth',label:'Growth',inspiration:'Sustained revenue and profit growth with good returns (Indian growth investing)',criteria:[['revenueGrowth1y',20],['revenueGrowth3y',20],['profitGrowth1y',20],['profitGrowth3y',20],['roe',20]]},
 {id:'compounder',label:'Compounder',inspiration:'High returns on capital compounded over many years (100-bagger style)',criteria:[['roce',30],['revenueGrowth5y',25],['profitGrowth5y',25],['debtToEquity',20]]},
 {id:'momentum',label:'Earnings and price momentum',inspiration:'Growing earnings with price strength (CAN SLIM style; quarterly and ownership factors not included)',criteria:[['profitGrowth1y',25],['revenueGrowth1y',25],['return12m',25],['belowHigh',25]]},
].map(s=>Object.freeze({...s,criteria:Object.freeze(s.criteria.map(([metric,weight])=>Object.freeze({metric,weight,label:METRICS[metric][0],direction:METRICS[metric][1]})))})));
export const DISCLAIMER='Research scores, not recommendations. Rules are our own, inspired by publicly described approaches and not endorsed by their authors. Percentiles rank companies only against each other in this list for the same financial year; they are not sector-adjusted.';

// Pick one reporting basis per company: consolidated when it has an annual period, else standalone.
function basisOf(fundamentals){
 for(const scope of ['Consolidated','Standalone']){const s=fundamentals?.scopes?.[scope];if(s?.latestAnnualPeriod)return {scope,...s};}
 return null;
}
// Every metric becomes {value,status}; only CALCULATED/OBSERVED values are ever ranked.
export function companyMetrics(fundamentals,price){
 const basis=basisOf(fundamentals),m={};
 const growth=(key,years)=>basis?.growth.find(g=>g.key===key&&g.years===years);
 for(const key of Object.keys(METRICS))m[key]={value:null,status:'NO_ANNUAL_PERIOD'};
 // Bank ratios measure different things (deposits are not debt; ROCE does not apply), so banks are not ranked
 // against industrial companies; their fundamentals are shown on the stock page instead.
 if(basis?.format==='BANKING'){for(const key of Object.keys(METRICS))m[key]={value:null,status:'BANKING_FORMAT_NOT_RANKED'};}
 else if(basis){
  for(const r of basis.ratios)m[r.key]={value:r.value,status:r.status,warnings:r.warnings||[]};
  for(const [key,source] of [['revenueGrowth','revenue'],['profitGrowth','totalProfit']])for(const y of [1,3,5]){const g=growth(source,y);m[key+y+'y']={value:g.valuePct,status:g.status,warnings:g.warnings||[]};}
 }
 const p=price?.status==='OBSERVED';
 m.return12m=p?{value:price.return12mPct,status:'OBSERVED'}:{value:null,status:price?.status??'PRICE_NOT_REQUESTED'};
 m.belowHigh=p?{value:price.belowHighPct,status:'OBSERVED'}:{value:null,status:price?.status??'PRICE_NOT_REQUESTED'};
 // Display only: close and market cap are not scored criteria.
 const mc=basis?.marketCap;
 m.marketCap=mc?{value:mc.value,status:mc.status,sharesAsOf:mc.sharesAsOf??null,warnings:mc.warnings||[]}:{value:null,status:'NO_ANNUAL_PERIOD'};
 m.close=p?{value:price.close,status:'OBSERVED',date:price.to}:{value:null,status:price?.status??'PRICE_NOT_REQUESTED'};
 const sources=new Map();
 for(const r of basis?.ratios||[])for(const i of r.inputs||[])if(i.source?.url)sources.set(i.source.url,{url:i.source.url,publishedAt:i.source.publishedAt,symbol:i.source.symbol});
 return {basis:basis?{scope:basis.scope,period:basis.latestAnnualPeriod}:null,metrics:m,sources:[...sources.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))};
}
const usable=m=>m&&['CALCULATED_REQUIRES_REVIEW','OBSERVED'].includes(m.status)&&Number.isFinite(m.value);
// Mid-rank percentile, 0–100, oriented so higher is better; ties share the same percentile.
function percentile(value,peers,direction){
 const below=peers.filter(v=>v<value).length,equal=peers.filter(v=>v===value).length;
 const p=(below+(equal-1)/2)/(peers.length-1)*100;
 return direction==='higher'?p:100-p;
}

// companies: [{symbol, isin, instrumentKey, fundamentals, price}] for one universe at one asOf.
export function scoreUniverse(companies){
 const rows=companies.map(c=>({...c,...companyMetrics(c.fundamentals,c.price)}));
 const groups=new Map();
 for(const r of rows){const k=r.basis?.period.end??null;if(!k)continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
 const results=rows.map(r=>{
  const peers=r.basis?groups.get(r.basis.period.end):[];
  const styles=STYLES.map(style=>{
   const criteria=style.criteria.map(c=>{
    const own=r.metrics[c.metric],values=peers.filter(p=>usable(p.metrics[c.metric])).map(p=>p.metrics[c.metric].value);
    const base={metric:c.metric,label:c.label,weight:c.weight,direction:c.direction,value:own.value,inputStatus:own.status,warnings:own.warnings||[],peers:values.length,percentile:null};
    if(!usable(own))return {...base,status:'INPUT_UNAVAILABLE'};
    if(values.length<MIN_PEERS)return {...base,status:'TOO_FEW_PEERS'};
    return {...base,status:'RANKED',percentile:percentile(own.value,values,c.direction)};
   });
   const total=criteria.reduce((a,c)=>a+c.weight,0),ranked=criteria.filter(c=>c.status==='RANKED'),covered=ranked.reduce((a,c)=>a+c.weight,0);
   const coverage=covered/total,score=ranked.length?ranked.reduce((a,c)=>a+c.percentile*c.weight,0)/covered:null;
   return {id:style.id,label:style.label,coverage,status:coverage>=MIN_COVERAGE?'SCORED':'INSUFFICIENT_INPUTS',score:coverage>=MIN_COVERAGE?score:null,partialScore:coverage<MIN_COVERAGE?score:null,missing:criteria.filter(c=>c.status!=='RANKED').map(c=>c.metric),warnings:[...new Set(ranked.flatMap(c=>c.warnings))],criteria};
  });
  const scored=styles.filter(s=>s.status==='SCORED');
  return {symbol:r.symbol,isin:r.isin,instrumentKey:r.instrumentKey,basis:r.basis,peerGroup:r.basis?{periodEnd:r.basis.period.end,size:peers.length}:null,
   metrics:r.metrics,sources:r.sources,styles,
   composite:scored.length>=MIN_STYLES_FOR_COMPOSITE?{status:'SCORED',score:scored.reduce((a,s)=>a+s.score,0)/scored.length,styles:scored.map(s=>s.id)}:{status:'INSUFFICIENT_STYLES',score:null,styles:scored.map(s=>s.id)}};
 });
 return {version:SCORECARD_VERSION,styles:STYLES,rules:{minPeers:MIN_PEERS,minCoverage:MIN_COVERAGE,minStylesForComposite:MIN_STYLES_FOR_COMPOSITE,percentile:'mid-rank among peers with a usable value, oriented so higher is better',peerGroup:'companies in this universe whose latest annual period ends on the same date',composite:'mean of scored styles'},
  peerGroups:[...groups].map(([periodEnd,members])=>({periodEnd,size:members.length})).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)),
  companies:results,disclaimer:DISCLAIMER};
}
