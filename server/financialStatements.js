import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {createHash} from 'node:crypto';
const list=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const text=v=>typeof v==='string'?v:typeof v?.['#text']==='string'?v['#text']:'';
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
// [key,label,tag,unit]: unit 'money' needs one ISO currency; 'perShare' needs currency per xbrli:shares.
const metrics=[['revenue','Revenue from operations','RevenueFromOperations'],['continuingProfit','Profit from continuing operations','ProfitLossForPeriodFromContinuingOperations'],['totalProfit','Profit for period','ProfitLossForPeriod'],['profitBeforeTax','Profit before tax','ProfitBeforeTax'],['financeCosts','Finance costs','FinanceCosts'],['basicEps','Basic EPS per share (continuing and discontinued operations)','BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations','perShare'],['paidUpEquityCapital','Paid-up equity share capital','PaidUpValueOfEquityShareCapital'],['faceValue','Face value per equity share','FaceValueOfEquityShareCapital','perShare']];
// Banking-format results (Schedule III for banks): income, profit, EPS and share capital share the keys above so
// growth, P/E and market cap work unchanged; bank-specific lines and regulatory ratios have their own keys.
const bankMetrics=[['revenue','Total income','Income'],['continuingProfit','Profit from ordinary activities after tax','ProfitLossFromOrdinaryActivitiesAfterTax'],['totalProfit','Profit for period','ProfitLossForThePeriod'],
 ['interestEarned','Interest earned','InterestEarned'],['interestExpended','Interest expended','InterestExpended'],['operatingExpenses','Operating expenses','OperatingExpenses'],['operatingProfit','Operating profit before provisions','OperatingProfitBeforeProvisionAndContingencies'],['provisions','Provisions (other than tax) and contingencies','ProvisionsOtherThanTaxAndContingencies'],
 ['basicEps','Basic EPS per share','BasicEarningsPerShareAfterExtraordinaryItems','perShare'],['paidUpEquityCapital','Paid-up equity share capital','PaidUpValueOfEquityShareCapital'],['faceValue','Face value per equity share','FaceValueOfEquityShareCapital','perShare'],
 ['grossNpa','Gross non-performing assets','GrossNonPerformingAssets'],['netNpa','Net non-performing assets','NonPerformingAssets'],['grossNpaPct','Gross NPA ratio','PercentageOfGrossNpa','pure'],['netNpaPct','Net NPA ratio','PercentageOfNpa','pure'],['cet1Ratio','CET1 capital ratio','CET1Ratio','pure'],['returnOnAssets','Return on assets (reported)','ReturnOnAssets','pure']];
const bankPositions=[['totalAssets','Total assets','Assets'],['advances','Advances','Advances'],['deposits','Deposits','Deposits'],['shareCapital','Share capital','Capital'],['reserves','Reserves and surplus','ReservesAndSurplus'],['bankBorrowings','Borrowings','Borrowings']];
const SHARE_CAPITAL_KEYS=['paidUpEquityCapital','faceValue'];
// Ind AS statement of assets and liabilities, reported at a single date (instant contexts).
const positions=[['totalAssets','Total assets','Assets'],['currentLiabilities','Current liabilities','CurrentLiabilities'],['equity','Total equity','Equity'],['borrowingsNoncurrent','Non-current borrowings','BorrowingsNoncurrent'],['borrowingsCurrent','Current borrowings','BorrowingsCurrent']];
const unitCurrency=(unit,kind)=>{
 if(kind==='pure')return text(unit.measure)==='xbrli:pure'&&unit.divide===undefined?'PURE':null;
 if(kind==='perShare'){const d=unit.divide;return unit.measure===undefined&&d&&!Array.isArray(d)&&/^iso4217:[A-Z]{3}$/.test(text(d.unitNumerator?.measure))&&text(d.unitDenominator?.measure)==='xbrli:shares'?text(d.unitNumerator.measure).split(':')[1]:null;}
 return /^iso4217:[A-Z]{3}$/.test(text(unit.measure))&&unit.divide===undefined?text(unit.measure).split(':')[1]:null;
};
// Annual filings include related-party schedules; NIFTY 50 filings reach about 10 MB. 16 MB bounds parser memory
// (a 9.8 MB filing parses in about 0.3 s with 60 MB heap).
export const MAX_DOCUMENT_BYTES=16_000_000;
export function parseFinancialDisclosure(body,item,now){
 if(typeof body!=='string'||Buffer.byteLength(body)>MAX_DOCUMENT_BYTES||/<!DOCTYPE|<!ENTITY/i.test(body)||XMLValidator.validate(body)!==true)throw Error('Invalid financial XML');
 const root=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,trimValues:true}).parse(body).xbrl;
 if(!root)throw Error('Unsupported financial document');
 // Identity facts appear once; the reporting scope is repeated for every reported period and must agree.
 const single=v=>{const l=list(v);return l.length===1?l[0]:undefined;};
 // Pre-2024 annual results have no ISIN fact. They are accepted only when the caller names the expected
 // company and the filed symbol equals it; the identity basis is recorded on the document.
 const isinFact=single(root.ISIN),symbolFact=single(root.Symbol),nameFact=single(root.NameOfTheCompany)??single(root.NameOfBank),expected=item.expected;
 const legacy=!isinFact&&expected&&/^INE[A-Z0-9]{9}$/.test(expected.isin)&&text(symbolFact)===expected.symbol;
 const identityId=(isinFact??(legacy?symbolFact:undefined))?.['@_contextRef'],scopeFacts=list(root.NatureOfReportStandaloneConsolidated),scopes=new Set(scopeFacts.map(text));
 const symbol=text(symbolFact),isin=isinFact?text(isinFact):legacy?expected.isin:'',company=text(nameFact),scope=scopes.size===1?[...scopes][0]:'';
 if(!/^[A-Z0-9&-]{1,30}$/.test(symbol)||!/^INE[A-Z0-9]{9}$/.test(isin)||!company||!['Standalone','Consolidated'].includes(scope))throw Error('Financial identity or reporting scope unavailable');
 if(!Number.isFinite(Date.parse(item.publishedAt))||Date.parse(item.publishedAt)>now)throw Error('Financial disclosure not available at this time');
 const contexts=list(root.context),units=list(root.unit),identity=contexts.filter(c=>c['@_id']===identityId);
 if(identity.length!==1||!text(identity[0].entity?.identifier)||[single(root.Symbol),nameFact].some(f=>f?.['@_contextRef']!==identityId)||!scopeFacts.some(f=>f?.['@_contextRef']===identityId))throw Error('Ambiguous issuer context');
 const issuer=text(identity[0].entity.identifier);
 const auditContext=identity[0],auditPeriod=auditContext.period;
 const auditContextValid=auditContext.scenario===undefined&&auditContext.entity?.segment===undefined&&date(auditPeriod?.startDate)&&date(auditPeriod?.endDate)&&auditPeriod.startDate<=auditPeriod.endDate&&auditPeriod.endDate<=new Date(Date.parse(item.publishedAt)+19800000).toISOString().slice(0,10);
 const auditDisclosure={policy:'issuer-audit-declaration-v1',status:'REQUIRES_SOURCE_REVIEW',contextId:auditContext['@_id'],period:auditContextValid?{start:auditPeriod.startDate,end:auditPeriod.endDate}:null,scope,fields:[
  ['auditStatus','Results audit status','WhetherResultsAreAuditedOrUnaudited'],
  ['opinionDeclaration','Audit-opinion declaration','DeclarationOfUnmodifiedOpinionOrStatementOnImpactOfAuditQualification']
 ].map(([key,label,tag])=>{
  // Declarations repeat for each reported period; only the issuer context's declaration is read.
  const facts=list(root[tag]),inContext=facts.filter(f=>f?.['@_contextRef']===auditContext['@_id']),fact=inContext[0],value=text(fact);
  let status='ISSUER_REPORTED';
  if(!facts.length)status='NOT_REPORTED';
  else if(inContext.length>1)status='AMBIGUOUS_FACT';
  else if(!auditContextValid||inContext.length!==1)status='UNVERIFIED_CONTEXT';
  else if(!value||value.length>2000||['true','1'].includes(fact?.['@_nil']))status='UNSUPPORTED_VALUE';
  return {key,label,tag,contextId:status==='ISSUER_REPORTED'?auditContext['@_id']:null,value:status==='ISSUER_REPORTED'?value:null,status};
 }),note:'Issuer declarations from this filing only. Not applicable, missing declarations or an unmodified opinion do not establish clean governance. Review the signed auditor report, qualifications, key audit matters and subsequent filings. No governance score or allocation approval is inferred.'};
 // Banking-format filings (Schedule III for banks) report interest expended; Ind AS companies, including NBFCs that
 // also report interest earned, report finance costs instead. Only the banking line selects the banking definitions.
 const banking=list(root.InterestExpended).length>0,metricDefs=banking?bankMetrics:metrics,positionDefs=banking?bankPositions:positions;
 const rejectedContexts=[];
 const periods=[],balanceSheet=[];
 const latestDate=new Date(Date.parse(item.publishedAt)+19800000).toISOString().slice(0,10);
 const usable=(context,id)=>contexts.filter(c=>c['@_id']===id).length===1&&context.scenario===undefined&&context.entity?.segment===undefined&&text(context.entity?.identifier)===issuer;
 const factsIn=(definitions,id)=>definitions.map(([key,label,tag,kind='money'])=>{
  const matched=list(root[tag]).filter(f=>f['@_contextRef']===id);
  const missing=reason=>({key,label,value:null,raw:null,currency:null,status:reason,tag,contextId:id});
  if(matched.length!==1)return missing(matched.length?'AMBIGUOUS_FACT':'NOT_REPORTED');
  const f=matched[0],raw=text(f),unit=units.filter(u=>u['@_id']===f['@_unitRef']);
  if(f['@_nil']==='true'||f['@_scale']!==undefined||f['@_sign']!==undefined||!/^[-+]?\d+(?:\.\d+)?$/.test(raw)||!Number.isFinite(Number(raw))||Math.abs(Number(raw))>Number.MAX_SAFE_INTEGER)return missing('UNSUPPORTED_NUMERIC_VALUE');
  const currency=unit.length===1?unitCurrency(unit[0],kind):null;
  if(!currency)return missing('UNVERIFIED_CURRENCY');
  // XBRL decimals is reported precision, never a multiplier (e.g. -5 != lakhs).
  return {key,label,value:Number(raw),raw,currency,...(kind==='perShare'?{unit:'perShare'}:{}),decimals:f['@_decimals']||null,status:'ISSUER_REPORTED',tag,contextId:id};
 });
 for(const context of contexts){
  const id=context['@_id'],start=context.period?.startDate,end=context.period?.endDate,instant=context.period?.instant;
  const used=defs=>defs.some(([, ,tag])=>list(root[tag]).some(f=>f['@_contextRef']===id));
  if(used(positionDefs)&&instant!==undefined){
   if(!usable(context,id)||!date(instant)||instant>latestDate){rejectedContexts.push(id||'UNKNOWN');continue;}
   balanceSheet.push({contextId:id,instant,scope,metrics:factsIn(positionDefs,id)});continue;
  }
  // Share-capital facts appear in every format (including banking); a period needs an Ind AS income-statement fact.
  if(!used(metricDefs.filter(([key])=>!SHARE_CAPITAL_KEYS.includes(key))))continue;
  if(!usable(context,id)||!date(start)||!date(end)||start>end||end>latestDate){rejectedContexts.push(id||'UNKNOWN');continue;}
  // The filing also declares each period's dates as facts. Older NSE files label full-year facts with
  // quarter contexts, so a context whose dates disagree with its declaration is never used.
  const declared=tag=>list(root[tag]).filter(f=>f?.['@_contextRef']===id).map(text);
  let periodStart=start,periodEnd=end,periodBasis='CONTEXT_DATES';
  if(declared('DateOfStartOfReportingPeriod').some(v=>v!==start)||declared('DateOfEndOfReportingPeriod').some(v=>v!==end)){
   // Pre-integrated annual results (legacy identity only) label the full-year column with the quarter's
   // dates. The declared period is used when it is a single April–March year ending on the context end.
   const ds=declared('DateOfStartOfReportingPeriod'),de=declared('DateOfEndOfReportingPeriod');
   const fullYear=ds.length===1&&de.length===1&&date(ds[0])&&date(de[0])&&de[0]===end&&ds[0].endsWith('-04-01')&&Number(ds[0].slice(0,4))+1===Number(de[0].slice(0,4))&&de[0].endsWith('-03-31');
   if(!legacy||!fullYear){rejectedContexts.push(id);continue;}
   periodStart=ds[0];periodEnd=de[0];periodBasis='DECLARED_FACTS_LEGACY';
  }
  const values=factsIn(metricDefs,id);
  const revenue=values.find(v=>v.key==='revenue'),profit=values.find(v=>v.key==='continuingProfit');
  const comparable=Number.isFinite(profit.value/revenue.value*100)&&revenue.value!==null&&profit.value!==null&&revenue.value>0&&revenue.currency===profit.currency;
  periods.push({contextId:id,start:periodStart,end:periodEnd,periodBasis,scope,metrics:values,ratio:{label:'Continuing-operations profit / revenue from operations',valuePct:comparable?profit.value/revenue.value*100:null,status:comparable?'CALCULATED_FROM_REPORTED_INPUTS':'UNAVAILABLE',formula:`${profit.tag} / ${revenue.tag} × 100`,inputTags:[profit.tag,revenue.tag]}});
 }
 // Legacy declared-period years must be consistent with the filing's own quarter: the year's revenue is at
 // least 2.5× any quarter's revenue reported for the same year end; otherwise the year is dropped.
 for(const p of periods.filter(p=>p.periodBasis==='DECLARED_FACTS_LEGACY')){
  const rev=x=>x.metrics.find(m=>m.key==='revenue')?.value,q=periods.filter(o=>o.periodBasis==='CONTEXT_DATES'&&o.end===p.end&&Date.parse(o.end)-Date.parse(o.start)<100*86400000);
  if(!(rev(p)>0)||q.some(o=>!(rev(o)>0)||rev(p)<2.5*rev(o))){periods.splice(periods.indexOf(p),1);rejectedContexts.push(p.contextId);}
 }
 // Banking and NBFC formats use different tags; they are reported as unsupported rather than as empty results.
 if(!periods.length)throw Object.assign(Error('No supported comparable financial contexts'),{code:'UNSUPPORTED_FINANCIAL_FORMAT'});
 periods.sort((a,b)=>b.end.localeCompare(a.end)||a.start.localeCompare(b.start)||a.contextId.localeCompare(b.contextId));
 balanceSheet.sort((a,b)=>b.instant.localeCompare(a.instant)||a.contextId.localeCompare(b.contextId));
 return {id:item.id,kind:'FINANCIALS',format:banking?'BANKING':'INDAS',identityBasis:isinFact?'ISIN_FACT':'SYMBOL_MATCHED_EXPECTED_ISIN',symbol,instrumentKey:'NSE_EQ|'+isin,company,scope,url:item.url,publishedAt:item.publishedAt,observedAt:new Date(now).toISOString(),documentHash:createHash('sha256').update(body).digest('hex'),status:'EXTRACTED_REQUIRES_REVIEW',reported:[],auditDisclosure,periods,balanceSheet,rejectedContexts,note:'Issuer-reported financials and transparent calculations, not audited by this app. No annualisation, growth forecast, valuation score or allocation approval. The ratio is not an operating margin. Revisions reflect this filing, not what was known at the period end.'};
}
