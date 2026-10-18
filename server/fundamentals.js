// Fundamentals from stored NSE XBRL filings. One owner for the stored filing shape
// (toFundamentalFiling) and for every derived value (deriveFundamentals).
export const FILING_POLICY='fundamental-filing-v1';
export const RATIO_VERSION='fundamental-ratios-v1';
const SCOPES=['Consolidated','Standalone'];
const GROWTH_KEYS=['revenue','continuingProfit','totalProfit'];
const GROWTH_YEARS=[1,3,5];
const DAY=86400000;
// Required inputs name facts the parser does not extract today; they stay unavailable rather than estimated.
const RATIOS=[
 ['roce','ROCE','EBIT / (total assets − current liabilities) × 100',['profitBeforeTax','financeCosts','totalAssets','currentLiabilities']],
 ['roe','ROE','Profit for period / average shareholders’ equity × 100',['totalProfit','equity']],
 ['debtToEquity','Debt / equity','Total borrowings / shareholders’ equity',['borrowings','equity']],
 ['pe','P/E','Price / trailing annual basic EPS',['price','eps']],
 ['peg','PEG','P/E / 3-year profit-for-period CAGR (%)',['pe','totalProfitCagr3y']],
];
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const shiftYears=(s,n)=>{const shifted=String(Number(s.slice(0,4))+n).padStart(4,'0')+s.slice(4);return validDate(shifted)?shifted:null;};
const annual=(start,end)=>{const days=(Date.parse(end)-Date.parse(start))/DAY+1;return days===365||days===366;};

// Keeps only issuer-reported numeric facts as values; every other parser status is retained by key.
export function toFundamentalFiling(doc){
 if(doc?.kind!=='FINANCIALS'||!Array.isArray(doc.periods)||!doc.periods.length)throw Error('Unsupported financial document');
 return {policy:FILING_POLICY,parser:'nse-xbrl-financials-v1',status:'EXTRACTED_REQUIRES_REVIEW',id:doc.id,documentHash:doc.documentHash,symbol:doc.symbol,instrumentKey:doc.instrumentKey,company:doc.company,scope:doc.scope,url:doc.url,publishedAt:doc.publishedAt,observedAt:doc.observedAt,
  periods:doc.periods.map(p=>({contextId:p.contextId,start:p.start,end:p.end,
   facts:p.metrics.filter(m=>m.status==='ISSUER_REPORTED').map(({key,value,raw,currency,decimals,tag})=>({key,value,raw,currency,decimals,tag})),
   unavailable:p.metrics.filter(m=>m.status!=='ISSUER_REPORTED').map(({key,status,tag})=>({key,status,tag}))})),
  rejectedContexts:doc.rejectedContexts||[]};
}

export function deriveFundamentals(filings,{instrumentKey,asOf,truncated=false}){
 const usable=[],excluded={invalid:0,otherInstrument:0,publishedAfterAsOf:0};
 for(const f of filings){
  if(f?.policy!==FILING_POLICY||!SCOPES.includes(f.scope)||!Array.isArray(f.periods)||!Number.isFinite(Date.parse(f.publishedAt))){excluded.invalid++;continue;}
  if(f.instrumentKey!==instrumentKey){excluded.otherInstrument++;continue;}
  if(Date.parse(f.publishedAt)>asOf){excluded.publishedAfterAsOf++;continue;}
  usable.push(f);
 }
 const versions=new Map(),annualPeriods=new Map();
 for(const f of usable)for(const p of f.periods){
  if(!validDate(p.start)||!validDate(p.end)||p.start>p.end)continue;
  if(annual(p.start,p.end))annualPeriods.set([f.scope,p.start,p.end].join('|'),{scope:f.scope,start:p.start,end:p.end});
  for(const x of p.facts||[]){
   if(!Number.isFinite(x.value))continue;
   const k=[f.scope,p.start,p.end,x.key].join('|');if(!versions.has(k))versions.set(k,[]);
   versions.get(k).push({value:x.value,currency:x.currency,tag:x.tag,source:{filingId:f.id,documentHash:f.documentHash,url:f.url,publishedAt:f.publishedAt,contextId:p.contextId}});
  }
 }
 // Restatements are separate filings: use the latest revision published by asOf; equal-time conflicts stay ambiguous.
 const resolve=(scope,start,end,key)=>{
  const all=versions.get([scope,start,end,key].join('|'));if(!all)return {status:'NOT_REPORTED'};
  const latest=Math.max(...all.map(v=>Date.parse(v.source.publishedAt)));
  const top=all.filter(v=>Date.parse(v.source.publishedAt)===latest).sort((a,b)=>a.source.filingId.localeCompare(b.source.filingId));
  const distinct=list=>new Set(list.map(v=>v.value+'|'+v.currency)).size;
  if(distinct(top)>1)return {status:'AMBIGUOUS_REVISION'};
  return {status:'ISSUER_REPORTED',value:top[0].value,currency:top[0].currency,tag:top[0].tag,period:{start,end},source:top[0].source,priorDistinctValues:distinct(all)-1};
 };
 const growthOf=(scope,latest,key,years)=>{
  const base={key,years,method:years===1?'PERCENT_CHANGE':'CAGR',valuePct:null,current:null,base:null};
  if(!latest)return {...base,status:'NO_ANNUAL_PERIOD'};
  const current=resolve(scope,latest.start,latest.end,key),start=shiftYears(latest.start,-years),end=shiftYears(latest.end,-years);
  const prior=start&&end?resolve(scope,start,end,key):{status:'NOT_REPORTED'};
  let status='CALCULATED_REQUIRES_REVIEW';
  if(current.status==='AMBIGUOUS_REVISION'||prior.status==='AMBIGUOUS_REVISION')status='AMBIGUOUS_REVISION';
  else if(current.status!=='ISSUER_REPORTED')status='CURRENT_VALUE_UNAVAILABLE';
  else if(prior.status!=='ISSUER_REPORTED')status='BASE_PERIOD_MISSING';
  else if(!/^[A-Z]{3}$/.test(current.currency||'')||current.currency!==prior.currency)status='CURRENCY_MISMATCH';
  else if(prior.value<=0)status='NON_POSITIVE_BASE';
  else if(years>1&&current.value<=0)status='NON_POSITIVE_CURRENT';
  let valuePct=null;
  if(status==='CALCULATED_REQUIRES_REVIEW'){valuePct=years===1?(current.value/prior.value-1)*100:(Math.pow(current.value/prior.value,1/years)-1)*100;if(!Number.isFinite(valuePct)){status='UNSUPPORTED_NUMERIC_RESULT';valuePct=null;}}
  return {...base,status,valuePct,current:current.status==='ISSUER_REPORTED'?current:null,base:prior.status==='ISSUER_REPORTED'?prior:null};
 };
 const scopes={};
 for(const scope of SCOPES){
  if(!usable.some(f=>f.scope===scope))continue;
  const periods=[...annualPeriods.values()].filter(p=>p.scope===scope).sort((a,b)=>a.end.localeCompare(b.end)||a.start.localeCompare(b.start));
  const latest=periods.at(-1)||null;
  const growth=GROWTH_KEYS.flatMap(key=>GROWTH_YEARS.map(years=>growthOf(scope,latest,key,years)));
  const available=new Set(latest?[...versions.keys()].filter(k=>k.startsWith([scope,latest.start,latest.end,''].join('|'))).map(k=>k.split('|')[3]).filter(key=>resolve(scope,latest.start,latest.end,key).status==='ISSUER_REPORTED'):[]);
  if(growth.some(g=>g.key==='totalProfit'&&g.years===3&&g.status==='CALCULATED_REQUIRES_REVIEW'))available.add('totalProfitCagr3y');
  const ratios=RATIOS.map(([key,label,formula,inputs])=>{const missingInputs=inputs.filter(i=>!available.has(i));return {key,label,formula,formulaVersion:RATIO_VERSION,requiredInputs:inputs,missingInputs,value:null,status:missingInputs.length?'INPUT_NOT_EXTRACTED':'NOT_IMPLEMENTED'};});
  scopes[scope]={latestAnnualPeriod:latest&&{start:latest.start,end:latest.end},annualPeriods:periods.length,growth,ratios};
 }
 return {policy:'fundamentals-v1',instrumentKey,asOf:new Date(asOf).toISOString(),status:usable.length?'DERIVED_REQUIRES_REVIEW':'NO_FILINGS',coverage:{filings:filings.length,used:usable.length,...excluded,truncated},scopes,
  note:'Issuer-reported values from stored NSE XBRL filings, using the latest revision published by asOf. Growth compares exact annual periods (365 or 366 days); quarterly figures are never annualised and missing history is not zero growth. ROCE, ROE, debt/equity, P/E and PEG stay unavailable until balance-sheet, EPS and price inputs are extracted. No valuation score or allocation approval.'};
}
