import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {createHash} from 'node:crypto';
const list=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const text=v=>typeof v==='string'?v:typeof v?.['#text']==='string'?v['#text']:'';
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
// [key,label,tag,unit]: unit 'money' needs one ISO currency; 'perShare' needs currency per xbrli:shares.
const metrics=[['revenue','Revenue from operations','RevenueFromOperations'],['continuingProfit','Profit from continuing operations','ProfitLossForPeriodFromContinuingOperations'],['totalProfit','Profit for period','ProfitLossForPeriod'],['profitBeforeTax','Profit before tax','ProfitBeforeTax'],['financeCosts','Finance costs','FinanceCosts'],['basicEps','Basic EPS per share (continuing and discontinued operations)','BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations','perShare'],['paidUpEquityCapital','Paid-up equity share capital','PaidUpValueOfEquityShareCapital'],['faceValue','Face value per equity share','FaceValueOfEquityShareCapital','perShare']];
const SHARE_CAPITAL_KEYS=['paidUpEquityCapital','faceValue'];
// Ind AS statement of assets and liabilities, reported at a single date (instant contexts).
const positions=[['totalAssets','Total assets','Assets'],['currentLiabilities','Current liabilities','CurrentLiabilities'],['equity','Total equity','Equity'],['borrowingsNoncurrent','Non-current borrowings','BorrowingsNoncurrent'],['borrowingsCurrent','Current borrowings','BorrowingsCurrent']];
const unitCurrency=(unit,kind)=>{
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
 const isinFact=single(root.ISIN),nameFact=single(root.NameOfTheCompany)??single(root.NameOfBank),identityId=isinFact?.['@_contextRef'],scopeFacts=list(root.NatureOfReportStandaloneConsolidated),scopes=new Set(scopeFacts.map(text));
 const symbol=text(single(root.Symbol)),isin=text(isinFact),company=text(nameFact),scope=scopes.size===1?[...scopes][0]:'';
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
  if(used(positions)&&instant!==undefined){
   if(!usable(context,id)||!date(instant)||instant>latestDate){rejectedContexts.push(id||'UNKNOWN');continue;}
   balanceSheet.push({contextId:id,instant,scope,metrics:factsIn(positions,id)});continue;
  }
  // Share-capital facts appear in every format (including banking); a period needs an Ind AS income-statement fact.
  if(!used(metrics.filter(([key])=>!SHARE_CAPITAL_KEYS.includes(key))))continue;
  if(!usable(context,id)||!date(start)||!date(end)||start>end||end>latestDate){rejectedContexts.push(id||'UNKNOWN');continue;}
  // The filing also declares each period's dates as facts. Older NSE files label full-year facts with
  // quarter contexts, so a context whose dates disagree with its declaration is never used.
  const declared=tag=>list(root[tag]).filter(f=>f?.['@_contextRef']===id).map(text);
  if(declared('DateOfStartOfReportingPeriod').some(v=>v!==start)||declared('DateOfEndOfReportingPeriod').some(v=>v!==end)){rejectedContexts.push(id);continue;}
  const values=factsIn(metrics,id);
  const revenue=values.find(v=>v.key==='revenue'),profit=values.find(v=>v.key==='continuingProfit');
  const comparable=Number.isFinite(profit.value/revenue.value*100)&&revenue.value!==null&&profit.value!==null&&revenue.value>0&&revenue.currency===profit.currency;
  periods.push({contextId:id,start,end,scope,metrics:values,ratio:{label:'Continuing-operations profit / revenue from operations',valuePct:comparable?profit.value/revenue.value*100:null,status:comparable?'CALCULATED_FROM_REPORTED_INPUTS':'UNAVAILABLE',formula:'ProfitLossForPeriodFromContinuingOperations / RevenueFromOperations × 100',inputTags:[profit.tag,revenue.tag]}});
 }
 // Banking and NBFC formats use different tags; they are reported as unsupported rather than as empty results.
 if(!periods.length)throw Object.assign(Error('No supported comparable financial contexts'),{code:'UNSUPPORTED_FINANCIAL_FORMAT'});
 periods.sort((a,b)=>b.end.localeCompare(a.end)||a.start.localeCompare(b.start)||a.contextId.localeCompare(b.contextId));
 balanceSheet.sort((a,b)=>b.instant.localeCompare(a.instant)||a.contextId.localeCompare(b.contextId));
 return {id:item.id,kind:'FINANCIALS',symbol,instrumentKey:'NSE_EQ|'+isin,company,scope,url:item.url,publishedAt:item.publishedAt,observedAt:new Date(now).toISOString(),documentHash:createHash('sha256').update(body).digest('hex'),status:'EXTRACTED_REQUIRES_REVIEW',reported:[],auditDisclosure,periods,balanceSheet,rejectedContexts,note:'Issuer-reported financials and transparent calculations, not audited by this app. No annualisation, growth forecast, valuation score or allocation approval. The ratio is not an operating margin. Revisions reflect this filing, not what was known at the period end.'};
}
