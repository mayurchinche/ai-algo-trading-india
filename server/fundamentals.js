// Fundamentals from stored NSE XBRL filings. One owner for the stored filing shape
// (toFundamentalFiling) and for every derived value (deriveFundamentals).
export const FILING_POLICY='fundamental-filing-v1';
export const PARSER_VERSION='nse-xbrl-financials-v3';
export const RATIO_VERSION='fundamental-ratios-v2';
export const PRICE_MAX_AGE_DAYS=10;
// Share counts come from the latest reported period; older counts may predate splits, bonuses or buybacks.
export const SHARES_MAX_AGE_DAYS=200;
const SCOPES=['Consolidated','Standalone'];
const GROWTH_KEYS=['revenue','continuingProfit','totalProfit'];
const GROWTH_YEARS=[1,3,5];
const DAY=86400000;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const shiftYears=(s,n)=>{const shifted=String(Number(s.slice(0,4))+n).padStart(4,'0')+s.slice(4);return validDate(shifted)?shifted:null;};
const dayBefore=s=>new Date(Date.parse(s)-DAY).toISOString().slice(0,10);
const annual=(start,end)=>{const days=(Date.parse(end)-Date.parse(start))/DAY+1;return days===365||days===366;};
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);
const split=facts=>({facts:facts.filter(m=>m.status==='ISSUER_REPORTED').map(({key,value,raw,currency,unit,decimals,tag})=>({key,value,raw,currency,...(unit?{unit}:{}),decimals,tag})),unavailable:facts.filter(m=>m.status!=='ISSUER_REPORTED').map(({key,status,tag})=>({key,status,tag}))});

// Keeps only issuer-reported numeric facts as values; every other parser status is retained by key.
export function toFundamentalFiling(doc){
 if(doc?.kind!=='FINANCIALS'||!Array.isArray(doc.periods)||!doc.periods.length)throw Error('Unsupported financial document');
 return {policy:FILING_POLICY,parser:PARSER_VERSION,status:'EXTRACTED_REQUIRES_REVIEW',id:doc.id,documentHash:doc.documentHash,symbol:doc.symbol,instrumentKey:doc.instrumentKey,company:doc.company,scope:doc.scope,url:doc.url,publishedAt:doc.publishedAt,observedAt:doc.observedAt,
  periods:doc.periods.map(p=>({contextId:p.contextId,start:p.start,end:p.end,...split(p.metrics)})),
  positions:(doc.balanceSheet||[]).map(b=>({contextId:b.contextId,instant:b.instant,...split(b.metrics)})),
  rejectedContexts:doc.rejectedContexts||[]};
}

// A dated close is an input like any filed fact: it must belong to the instrument and be no later than asOf.
function priceInput(price,instrumentKey,asOf){
 if(!price)return {status:'PRICE_NOT_REQUESTED'};
 if(price.status!=='OBSERVED')return {status:'PRICE_UNAVAILABLE',reason:price.reason||null};
 if(price.instrumentKey!==instrumentKey||!validDate(price.date)||!Number.isFinite(price.value)||price.value<=0||!/^[A-Z]{3}$/.test(price.currency||''))return {status:'PRICE_INVALID'};
 if(price.date>istDate(asOf))return {status:'PRICE_AFTER_AS_OF'};
 if(Date.parse(istDate(asOf))-Date.parse(price.date)>PRICE_MAX_AGE_DAYS*DAY)return {status:'PRICE_STALE',date:price.date};
 return {status:'OBSERVED',value:price.value,currency:price.currency,date:price.date,source:price.source};
}
// Inputs filed under different symbols usually span a rename, merger or demerger; values are not adjusted for it.
const symbolWarnings=inputs=>new Set(inputs.map(i=>i.source?.symbol).filter(Boolean)).size>1?['FILED_SYMBOL_CHANGED']:[];
const AVAILABLE=new Set(['ISSUER_REPORTED','OBSERVED','CALCULATED_REQUIRES_REVIEW']);
function ratio(key,label,formula,named,compute){
 const inputs=named.map(([name,r])=>({name,...r}));
 const base={key,label,formula,formulaVersion:RATIO_VERSION,value:null,inputs,missingInputs:[],warnings:symbolWarnings(inputs)};
 const ambiguous=inputs.filter(i=>i.status==='AMBIGUOUS_REVISION').map(i=>i.name);
 if(ambiguous.length)return {...base,status:'AMBIGUOUS_REVISION',missingInputs:ambiguous};
 const missing=inputs.filter(i=>!AVAILABLE.has(i.status)).map(i=>i.name);
 if(missing.length)return {...base,status:'INPUT_UNAVAILABLE',missingInputs:missing};
 if(new Set(inputs.filter(i=>i.currency).map(i=>i.currency)).size>1)return {...base,status:'CURRENCY_MISMATCH'};
 const result=compute(Object.fromEntries(inputs.map(i=>[i.name,i.value])));
 if(typeof result==='string')return {...base,status:result};
 if(!Number.isFinite(result))return {...base,status:'UNSUPPORTED_NUMERIC_RESULT'};
 return {...base,status:'CALCULATED_REQUIRES_REVIEW',value:result};
}

export function deriveFundamentals(filings,{instrumentKey,asOf,truncated=false,price=null}){
 const usable=[],excluded={invalid:0,otherInstrument:0,publishedAfterAsOf:0};
 for(const f of filings){
  if(f?.policy!==FILING_POLICY||!SCOPES.includes(f.scope)||!Array.isArray(f.periods)||!Number.isFinite(Date.parse(f.publishedAt))){excluded.invalid++;continue;}
  if(f.instrumentKey!==instrumentKey){excluded.otherInstrument++;continue;}
  if(Date.parse(f.publishedAt)>asOf){excluded.publishedAfterAsOf++;continue;}
  usable.push(f);
 }
 // Durations are keyed start..end and balance-sheet positions @date, both per reporting scope.
 const versions=new Map(),annualPeriods=new Map(),durations=new Map();
 const add=(f,pk,period,contextId,facts)=>{for(const x of facts||[]){
  if(!Number.isFinite(x.value))continue;
  const k=[f.scope,pk,x.key].join('|');if(!versions.has(k))versions.set(k,[]);
  versions.get(k).push({value:x.value,currency:x.currency,tag:x.tag,period,source:{filingId:f.id,documentHash:f.documentHash,url:f.url,publishedAt:f.publishedAt,contextId,symbol:f.symbol}});
 }};
 for(const f of usable){
  for(const p of f.periods){
   if(!validDate(p.start)||!validDate(p.end)||p.start>p.end)continue;
   if(annual(p.start,p.end))annualPeriods.set(f.scope+'|'+p.start+'..'+p.end,{scope:f.scope,start:p.start,end:p.end});
   durations.set(f.scope+'|'+p.start+'..'+p.end,{scope:f.scope,start:p.start,end:p.end});
   add(f,p.start+'..'+p.end,{start:p.start,end:p.end},p.contextId,p.facts);
  }
  for(const p of f.positions||[])if(validDate(p.instant))add(f,'@'+p.instant,{instant:p.instant},p.contextId,p.facts);
 }
 // Restatements are separate filings: use the latest revision published by asOf; equal-time conflicts stay ambiguous.
 const resolve=(scope,pk,key)=>{
  const all=versions.get([scope,pk,key].join('|'));if(!all)return {status:'NOT_REPORTED'};
  const latest=Math.max(...all.map(v=>Date.parse(v.source.publishedAt)));
  const top=all.filter(v=>Date.parse(v.source.publishedAt)===latest).sort((a,b)=>a.source.filingId.localeCompare(b.source.filingId));
  const distinct=list=>new Set(list.map(v=>v.value+'|'+v.currency)).size;
  if(distinct(top)>1)return {status:'AMBIGUOUS_REVISION'};
  return {status:'ISSUER_REPORTED',value:top[0].value,currency:top[0].currency,tag:top[0].tag,period:top[0].period,source:top[0].source,priorDistinctValues:distinct(all)-1};
 };
 const growthOf=(scope,latest,key,years)=>{
  const base={key,years,method:years===1?'PERCENT_CHANGE':'CAGR',valuePct:null,current:null,base:null};
  if(!latest)return {...base,status:'NO_ANNUAL_PERIOD'};
  const current=resolve(scope,latest.start+'..'+latest.end,key),start=shiftYears(latest.start,-years),end=shiftYears(latest.end,-years);
  const prior=start&&end?resolve(scope,start+'..'+end,key):{status:'NOT_REPORTED'};
  let status='CALCULATED_REQUIRES_REVIEW';
  if(current.status==='AMBIGUOUS_REVISION'||prior.status==='AMBIGUOUS_REVISION')status='AMBIGUOUS_REVISION';
  else if(current.status!=='ISSUER_REPORTED')status='CURRENT_VALUE_UNAVAILABLE';
  else if(prior.status!=='ISSUER_REPORTED')status='BASE_PERIOD_MISSING';
  else if(!/^[A-Z]{3}$/.test(current.currency||'')||current.currency!==prior.currency)status='CURRENCY_MISMATCH';
  else if(prior.value<=0)status='NON_POSITIVE_BASE';
  else if(years>1&&current.value<=0)status='NON_POSITIVE_CURRENT';
  let valuePct=null;
  if(status==='CALCULATED_REQUIRES_REVIEW'){valuePct=years===1?(current.value/prior.value-1)*100:(Math.pow(current.value/prior.value,1/years)-1)*100;if(!Number.isFinite(valuePct)){status='UNSUPPORTED_NUMERIC_RESULT';valuePct=null;}}
  return {...base,status,valuePct,current:current.status==='ISSUER_REPORTED'?current:null,base:prior.status==='ISSUER_REPORTED'?prior:null,warnings:symbolWarnings([current,prior])};
 };
 const priced=priceInput(price,instrumentKey,asOf);
 const ratiosFor=(scope,latest,growth)=>{
  if(!latest)return ['roce','roe','debtToEquity','pe','peg'].map(key=>({key,formulaVersion:RATIO_VERSION,value:null,inputs:[],missingInputs:[],warnings:[],status:'NO_ANNUAL_PERIOD'}));
  const year=latest.start+'..'+latest.end,close='@'+latest.end,open='@'+dayBefore(latest.start);
  const r=(pk,key)=>resolve(scope,pk,key);
  const roce=ratio('roce','ROCE','(profit before tax + finance costs) / (total assets − current liabilities) at year end × 100',
   [['profitBeforeTax',r(year,'profitBeforeTax')],['financeCosts',r(year,'financeCosts')],['totalAssets',r(close,'totalAssets')],['currentLiabilities',r(close,'currentLiabilities')]],
   v=>v.totalAssets-v.currentLiabilities<=0?'NON_POSITIVE_DENOMINATOR':(v.profitBeforeTax+v.financeCosts)/(v.totalAssets-v.currentLiabilities)*100);
  const roe=ratio('roe','ROE','profit for period / average of opening and closing total equity × 100',
   [['totalProfit',r(year,'totalProfit')],['openingEquity',r(open,'equity')],['closingEquity',r(close,'equity')]],
   v=>v.openingEquity<=0||v.closingEquity<=0?'NON_POSITIVE_EQUITY':v.totalProfit/((v.openingEquity+v.closingEquity)/2)*100);
  const debtToEquity=ratio('debtToEquity','Debt / equity','(non-current + current borrowings) / total equity at year end',
   [['borrowingsNoncurrent',r(close,'borrowingsNoncurrent')],['borrowingsCurrent',r(close,'borrowingsCurrent')],['equity',r(close,'equity')]],
   v=>v.equity<=0?'NON_POSITIVE_EQUITY':(v.borrowingsNoncurrent+v.borrowingsCurrent)/v.equity);
  const pe=ratio('pe','P/E','previous close / latest annual basic EPS',[['price',priced],['basicEps',r(year,'basicEps')]],
   v=>v.basicEps<=0?'NON_POSITIVE_EPS':v.price/v.basicEps);
  const cagr=growth.find(g=>g.key==='totalProfit'&&g.years===3);
  const peg=ratio('peg','PEG','P/E / 3-year profit-for-period CAGR (%)',[['pe',{status:pe.status,value:pe.value}],['profitCagr3y',{status:cagr.status,value:cagr.valuePct}]],
   v=>v.profitCagr3y<=0?'NON_POSITIVE_GROWTH':v.pe/v.profitCagr3y);
  peg.warnings=[...new Set([...pe.warnings,...cagr.warnings])];
  return [roce,roe,debtToEquity,pe,peg];
 };
 // Market cap = latest completed close × (paid-up equity capital ÷ face value), both from one reported period.
 const marketCapFor=scope=>{
  const formula='previous close × paid-up equity share capital ÷ face value per share';
  const base={formula,formulaVersion:RATIO_VERSION,value:null,shares:null,inputs:[]};
  const candidates=[...durations.values()].filter(p=>p.scope===scope).sort((a,b)=>b.end.localeCompare(a.end)||b.start.localeCompare(a.start));
  const period=candidates.find(p=>['paidUpEquityCapital','faceValue'].every(k=>resolve(scope,p.start+'..'+p.end,k).status==='ISSUER_REPORTED'));
  if(!period)return {...base,status:'INPUT_UNAVAILABLE',missingInputs:['paidUpEquityCapital','faceValue']};
  const paid=resolve(scope,period.start+'..'+period.end,'paidUpEquityCapital'),face=resolve(scope,period.start+'..'+period.end,'faceValue');
  const inputs=[{name:'price',...priced},{name:'paidUpEquityCapital',...paid},{name:'faceValue',...face}];
  if(Date.parse(istDate(asOf))-Date.parse(period.end)>SHARES_MAX_AGE_DAYS*DAY)return {...base,inputs,status:'SHARES_STALE',sharesAsOf:period.end};
  if(paid.value<=0||face.value<=0)return {...base,inputs,status:'NON_POSITIVE_INPUT'};
  if(paid.currency!==face.currency)return {...base,inputs,status:'CURRENCY_MISMATCH'};
  const shares=paid.value/face.value;
  if(priced.status!=='OBSERVED')return {...base,inputs,shares,sharesAsOf:period.end,status:'INPUT_UNAVAILABLE',missingInputs:['price']};
  if(priced.currency!==paid.currency)return {...base,inputs,shares,sharesAsOf:period.end,status:'CURRENCY_MISMATCH'};
  return {...base,inputs,shares,sharesAsOf:period.end,currency:paid.currency,value:priced.value*shares,status:'CALCULATED_REQUIRES_REVIEW',warnings:symbolWarnings([paid,face])};
 };
 const scopes={};
 for(const scope of SCOPES){
  if(!usable.some(f=>f.scope===scope))continue;
  const periods=[...annualPeriods.values()].filter(p=>p.scope===scope).sort((a,b)=>a.end.localeCompare(b.end)||a.start.localeCompare(b.start));
  const latest=periods.at(-1)||null;
  const growth=GROWTH_KEYS.flatMap(key=>GROWTH_YEARS.map(years=>growthOf(scope,latest,key,years)));
  scopes[scope]={latestAnnualPeriod:latest&&{start:latest.start,end:latest.end},annualPeriods:periods.length,growth,ratios:ratiosFor(scope,latest,growth),marketCap:marketCapFor(scope)};
 }
 return {policy:'fundamentals-v2',instrumentKey,asOf:new Date(asOf).toISOString(),status:usable.length?'DERIVED_REQUIRES_REVIEW':'NO_FILINGS',coverage:{filings:filings.length,used:usable.length,...excluded,truncated},price:priced,scopes,
  note:'Issuer-reported values from stored NSE XBRL filings (Ind AS format), using the latest revision published by asOf. Growth and ratios use the latest exact annual period (365 or 366 days); quarters and half-years are never annualised and missing history is not zero. Balance-sheet inputs come from year-end positions. Market cap uses paid-up equity capital ÷ face value from the latest reported period (up to 200 days old), which is rounded to the filing’s reported precision, may be net of treasury shares in consolidated filings, and may predate later splits, bonuses or buybacks. P/E uses the latest annual basic EPS, not trailing twelve months, and the previous trading day’s close, which may not be adjusted for splits or bonuses after that year. Banking-format filings are not supported, and older balance-sheet layouts without an Ind AS equity total are not mapped. Mergers, demergers and renames are not adjusted; FILED_SYMBOL_CHANGED marks inputs filed under different symbols. No valuation score or allocation approval.'};
}
