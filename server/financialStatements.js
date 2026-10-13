import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {createHash} from 'node:crypto';
const list=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const text=v=>typeof v==='string'?v:typeof v?.['#text']==='string'?v['#text']:'';
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const metrics=[['revenue','Revenue from operations','RevenueFromOperations'],['continuingProfit','Profit from continuing operations','ProfitLossForPeriodFromContinuingOperations'],['totalProfit','Profit for period','ProfitLossForPeriod']];
export function parseFinancialDisclosure(body,item,now){
 if(typeof body!=='string'||Buffer.byteLength(body)>1000000||/<!DOCTYPE|<!ENTITY/i.test(body)||XMLValidator.validate(body)!==true)throw Error('Invalid financial XML');
 const root=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,trimValues:true}).parse(body).xbrl;
 if(!root)throw Error('Unsupported financial document');
 const symbol=text(root.Symbol),isin=text(root.ISIN),company=text(root.NameOfTheCompany),scope=text(root.NatureOfReportStandaloneConsolidated);
 if(!/^[A-Z0-9&-]{1,30}$/.test(symbol)||!/^INE[A-Z0-9]{9}$/.test(isin)||!company||!['Standalone','Consolidated'].includes(scope))throw Error('Financial identity or reporting scope unavailable');
 if(!Number.isFinite(Date.parse(item.publishedAt))||Date.parse(item.publishedAt)>now)throw Error('Financial disclosure not available at this time');
 const contexts=list(root.context),units=list(root.unit),identity=contexts.filter(c=>c['@_id']===root.ISIN['@_contextRef']);
 if(identity.length!==1||!text(identity[0].entity?.identifier)||[root.Symbol,root.NameOfTheCompany,root.NatureOfReportStandaloneConsolidated].some(f=>f?.['@_contextRef']!==root.ISIN['@_contextRef']))throw Error('Ambiguous issuer context');
 const issuer=text(identity[0].entity.identifier);
 const auditContext=identity[0],auditPeriod=auditContext.period;
 const auditContextValid=auditContext.scenario===undefined&&auditContext.entity?.segment===undefined&&date(auditPeriod?.startDate)&&date(auditPeriod?.endDate)&&auditPeriod.startDate<=auditPeriod.endDate&&auditPeriod.endDate<=new Date(Date.parse(item.publishedAt)+19800000).toISOString().slice(0,10);
 const auditDisclosure={policy:'issuer-audit-declaration-v1',status:'REQUIRES_SOURCE_REVIEW',contextId:auditContext['@_id'],period:auditContextValid?{start:auditPeriod.startDate,end:auditPeriod.endDate}:null,scope,fields:[
  ['auditStatus','Results audit status','WhetherResultsAreAuditedOrUnaudited'],
  ['opinionDeclaration','Audit-opinion declaration','DeclarationOfUnmodifiedOpinionOrStatementOnImpactOfAuditQualification']
 ].map(([key,label,tag])=>{
  const facts=list(root[tag]),fact=facts[0],value=text(fact);
  let status='ISSUER_REPORTED';
  if(!facts.length)status='NOT_REPORTED';
  else if(facts.length!==1)status='AMBIGUOUS_FACT';
  else if(!auditContextValid||fact?.['@_contextRef']!==auditContext['@_id'])status='UNVERIFIED_CONTEXT';
  else if(!value||value.length>2000||['true','1'].includes(fact?.['@_nil']))status='UNSUPPORTED_VALUE';
  return {key,label,tag,contextId:status==='ISSUER_REPORTED'?auditContext['@_id']:null,value:status==='ISSUER_REPORTED'?value:null,status};
 }),note:'Issuer declarations from this filing only. Not applicable, missing declarations or an unmodified opinion do not establish clean governance. Review the signed auditor report, qualifications, key audit matters and subsequent filings. No governance score or allocation approval is inferred.'};
 const rejectedContexts=[];
 const periods=[];
 for(const context of contexts){
  const id=context['@_id'],start=context.period?.startDate,end=context.period?.endDate;
  const used=metrics.some(([, ,tag])=>list(root[tag]).some(f=>f['@_contextRef']===id));if(!used)continue;
  if(contexts.filter(c=>c['@_id']===id).length!==1||context.scenario!==undefined||context.entity?.segment!==undefined||text(context.entity?.identifier)!==issuer||!date(start)||!date(end)||start>end||end>new Date(Date.parse(item.publishedAt)+19800000).toISOString().slice(0,10)){rejectedContexts.push(id||'UNKNOWN');continue;}
  const values=metrics.map(([key,label,tag])=>{
   const matched=list(root[tag]).filter(f=>f['@_contextRef']===id);
   const missing=reason=>({key,label,value:null,raw:null,currency:null,status:reason,tag,contextId:id});
   if(matched.length!==1)return missing(matched.length?'AMBIGUOUS_FACT':'NOT_REPORTED');
   const f=matched[0],raw=text(f),unit=units.filter(u=>u['@_id']===f['@_unitRef']);
   if(f['@_nil']==='true'||f['@_scale']!==undefined||f['@_sign']!==undefined||!/^[-+]?\d+(?:\.\d+)?$/.test(raw)||!Number.isFinite(Number(raw))||Math.abs(Number(raw))>Number.MAX_SAFE_INTEGER)return missing('UNSUPPORTED_NUMERIC_VALUE');
   if(unit.length!==1||!/^iso4217:[A-Z]{3}$/.test(text(unit[0].measure))||unit[0].divide!==undefined)return missing('UNVERIFIED_CURRENCY');
   // XBRL decimals is reported precision, never a multiplier (e.g. -5 != lakhs).
   return {key,label,value:Number(raw),raw,currency:text(unit[0].measure).split(':')[1],decimals:f['@_decimals']||null,status:'ISSUER_REPORTED',tag,contextId:id};
  });
  const revenue=values.find(v=>v.key==='revenue'),profit=values.find(v=>v.key==='continuingProfit');
  const comparable=Number.isFinite(profit.value/revenue.value*100)&&revenue.value!==null&&profit.value!==null&&revenue.value>0&&revenue.currency===profit.currency;
  periods.push({contextId:id,start,end,scope,metrics:values,ratio:{label:'Continuing-operations profit / revenue from operations',valuePct:comparable?profit.value/revenue.value*100:null,status:comparable?'CALCULATED_FROM_REPORTED_INPUTS':'UNAVAILABLE',formula:'ProfitLossForPeriodFromContinuingOperations / RevenueFromOperations × 100',inputTags:[profit.tag,revenue.tag]}});
 }
 if(!periods.length)throw Error('No supported comparable financial contexts');
 periods.sort((a,b)=>b.end.localeCompare(a.end)||a.start.localeCompare(b.start)||a.contextId.localeCompare(b.contextId));
 return {id:item.id,kind:'FINANCIALS',symbol,instrumentKey:'NSE_EQ|'+isin,company,scope,url:item.url,publishedAt:item.publishedAt,observedAt:new Date(now).toISOString(),documentHash:createHash('sha256').update(body).digest('hex'),status:'EXTRACTED_REQUIRES_REVIEW',reported:[],auditDisclosure,periods,rejectedContexts,note:'Issuer-reported financials and transparent calculations, not audited by this app. No annualisation, growth forecast, valuation score or allocation approval. The ratio is not an operating margin. Revisions reflect this filing, not what was known at the period end.'};
}
