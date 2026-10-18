import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFinancialDisclosure} from '../server/financialStatements.js';
import {createDisclosureHandler} from '../api/_company-disclosures.js';
const now=Date.parse('2026-10-04T06:30:00Z');
const item={id:'a'.repeat(64),url:'https://nsearchives.nseindia.com/corporate/xbrl/test.xml',publishedAt:'2026-10-01T14:45:12Z'};
const context='<context id="P"><entity><identifier>123</identifier></entity><period><startDate>2026-04-01</startDate><endDate>2026-06-30</endDate></period></context>';
const fact=(tag:string,value:string,attrs='')=>`<${tag} contextRef="P" unitRef="INR" decimals="-5" ${attrs}>${value}</${tag}>`;
const xml=(revenue='1000',profit='100')=>`<xbrl>${context}<unit id="INR"><measure>iso4217:INR</measure></unit><Symbol contextRef="P">TEST</Symbol><ISIN contextRef="P">INE000A01010</ISIN><NameOfTheCompany contextRef="P">Fixture Company</NameOfTheCompany><NatureOfReportStandaloneConsolidated contextRef="P">Consolidated</NatureOfReportStandaloneConsolidated>${fact('RevenueFromOperations',revenue)}${fact('ProfitLossForPeriodFromContinuingOperations',profit)}</xbrl>`;
const parse=(s:string)=>parseFinancialDisclosure(s,item,now);
test('reported precision is not a multiplier and publication is distinct from period end',()=>{
 const r=parse(xml());assert.equal(r.periods[0].metrics[0].value,1000);assert.equal(r.periods[0].ratio.valuePct,10);assert.equal(r.periods[0].end,'2026-06-30');assert.equal(r.publishedAt,item.publishedAt);assert.equal(r.status,'EXTRACTED_REQUIRES_REVIEW');assert.equal(r.periods[0].metrics[2].value,null);
});
test('zero and loss remain reported values while zero revenue prevents division',()=>{assert.equal(parse(xml('1000','0')).periods[0].ratio.valuePct,0);assert.equal(parse(xml('1000','-100')).periods[0].ratio.valuePct,-10);assert.equal(parse(xml('0')).periods[0].ratio.valuePct,null);});
test('missing, duplicate, nil or scaled facts never produce a ratio',()=>{
 for(const body of [xml().replace(fact('RevenueFromOperations','1000'),''),xml().replace('</xbrl>',fact('RevenueFromOperations','999')+'</xbrl>'),xml().replace('decimals="-5"','nil="true"'),xml().replace('decimals="-5"','scale="5"')])assert.equal(parse(body).periods[0].ratio.valuePct,null);
});
test('unknown units, divided units and mixed currencies prevent ratios',()=>{
 for(const body of [xml().replace('iso4217:INR','unknown'),xml().replace('</unit>','<divide/></unit>'),xml().replace('</unit>','</unit><unit id="USD"><measure>iso4217:USD</measure></unit>').replace('ProfitLossForPeriodFromContinuingOperations contextRef="P" unitRef="INR"','ProfitLossForPeriodFromContinuingOperations contextRef="P" unitRef="USD"')])assert.equal(parse(body).periods[0].ratio.valuePct,null);
});
test('segmented, duplicate and future reporting contexts are rejected',()=>{
 for(const body of [xml().replace('</context>','<scenario>Segment</scenario></context>'),xml().replace(context,context+context),xml().replace('2026-06-30','2026-12-31')])assert.throws(()=>parse(body));
 assert.throws(()=>parseFinancialDisclosure(xml(),{...item,publishedAt:'2026-10-05T00:00:00Z'},now));
});
test('facts from a different period cannot supply missing inputs',()=>{const body=xml().replace('ProfitLossForPeriodFromContinuingOperations contextRef="P"','ProfitLossForPeriodFromContinuingOperations contextRef="Q"').replace('</xbrl>',context.replace('id="P"','id="Q"').replace('2026-04-01','2026-01-01').replace('2026-06-30','2026-03-31')+'</xbrl>');assert(parse(body).periods.every((p:any)=>p.ratio.valuePct===null));});
test('financial API routes to fixed reader and rejects unknown feed',async()=>{
 const handler=createDisclosureHandler({feed:async()=>{throw Error('wrong reader');}},{feed:async()=>({kind:'financials'})});
 const response=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;}});
 const good=response();await handler({method:'GET',headers:{host:'test'},query:{kind:'financials'}},good);assert.equal(good.code,200);assert.equal(good.body.feed.kind,'financials');
 const bad=response();await handler({method:'GET',headers:{host:'test'},query:{kind:'external'}},bad);assert.equal(bad.code,400);
});

import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AuditDisclosure} from '../src/components/AuditDisclosure';
const auditTag='WhetherResultsAreAuditedOrUnaudited';
const opinionTag='DeclarationOfUnmodifiedOpinionOrStatementOnImpactOfAuditQualification';
test('audit declarations preserve exact issuer wording and source context without clearance',()=>{
 const r=parse(xml().replace('</xbrl>',`<${auditTag} contextRef="P">Unaudited</${auditTag}><${opinionTag} contextRef="P">Not applicable</${opinionTag}></xbrl>`));
 assert.equal(r.auditDisclosure.fields[0].value,'Unaudited');assert.equal(r.auditDisclosure.fields[1].value,'Not applicable');
 assert.equal(r.auditDisclosure.contextId,'P');assert.equal(r.auditDisclosure.period.end,'2026-06-30');assert.equal(r.auditDisclosure.status,'REQUIRES_SOURCE_REVIEW');
 const html=renderToStaticMarkup(createElement(AuditDisclosure,{evidence:r.auditDisclosure}));assert.match(html,/Not applicable/);assert.match(html,/do not establish clean governance/);
});
test('missing and duplicate audit declarations remain explicitly unavailable',()=>{
 assert.equal(parse(xml()).auditDisclosure.fields[0].status,'NOT_REPORTED');
 const a=`<${auditTag} contextRef="P">Audited</${auditTag}>`;
 const r=parse(xml().replace('</xbrl>',a+a+'</xbrl>'));assert.equal(r.auditDisclosure.fields[0].status,'AMBIGUOUS_FACT');assert.equal(r.auditDisclosure.fields[0].value,null);
});
test('audit statements require the issuer context and reject nil and oversized content',()=>{
 for(const [attrs,value,status] of [['contextRef="Q"','Audited','UNVERIFIED_CONTEXT'],['contextRef="P" nil="true"','Audited','UNSUPPORTED_VALUE'],['contextRef="P" nil="1"','Audited','UNSUPPORTED_VALUE'],['contextRef="P"','x'.repeat(2001),'UNSUPPORTED_VALUE']]){
  const r=parse(xml().replace('</xbrl>',`<${auditTag} ${attrs}>${value}</${auditTag}></xbrl>`));assert.equal(r.auditDisclosure.fields[0].status,status);assert.equal(r.auditDisclosure.fields[0].value,null);
 }
});
test('old observations never imply a clean audit and source text is HTML escaped',()=>{
 assert.match(renderToStaticMarkup(createElement(AuditDisclosure)),/not captured/);
 const r=parse(xml().replace('</xbrl>',`<${auditTag} contextRef="P">&lt;script&gt;test&lt;/script&gt;</${auditTag}></xbrl>`));
 const html=renderToStaticMarkup(createElement(AuditDisclosure,{evidence:r.auditDisclosure}));assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});

// Shape of live NSE integrated filings: scope and audit status repeat per reported period,
// balance-sheet facts use instant contexts and EPS uses a currency-per-share unit.
const integrated=(extra='')=>`<xbrl><context id="OneD"><entity><identifier>9</identifier></entity><period><startDate>2026-07-01</startDate><endDate>2026-09-30</endDate></period></context><context id="FourD"><entity><identifier>9</identifier></entity><period><startDate>2026-04-01</startDate><endDate>2026-09-30</endDate></period></context><context id="OneI"><entity><identifier>9</identifier></entity><period><instant>2026-09-30</instant></period></context><context id="SegI"><entity><identifier>9</identifier><segment>x</segment></entity><period><instant>2026-09-30</instant></period></context>
<unit id="INR"><measure>iso4217:INR</measure></unit><unit id="EPS"><divide><unitNumerator><measure>iso4217:INR</measure></unitNumerator><unitDenominator><measure>xbrli:shares</measure></unitDenominator></divide></unit>
<Symbol contextRef="OneD">TEST</Symbol><ISIN contextRef="OneD">INE000A01010</ISIN><NameOfTheCompany contextRef="OneD">Fixture</NameOfTheCompany>
<NatureOfReportStandaloneConsolidated contextRef="OneD">Standalone</NatureOfReportStandaloneConsolidated><NatureOfReportStandaloneConsolidated contextRef="FourD">Standalone</NatureOfReportStandaloneConsolidated>
<WhetherResultsAreAuditedOrUnaudited contextRef="OneD">Unaudited</WhetherResultsAreAuditedOrUnaudited><WhetherResultsAreAuditedOrUnaudited contextRef="FourD">Unaudited</WhetherResultsAreAuditedOrUnaudited>
<RevenueFromOperations contextRef="OneD" unitRef="INR" decimals="-5">500</RevenueFromOperations><RevenueFromOperations contextRef="FourD" unitRef="INR" decimals="-5">900</RevenueFromOperations>
<BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations contextRef="OneD" unitRef="EPS" decimals="2">1.25</BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations>
<FinanceCosts contextRef="OneD" unitRef="EPS" decimals="-5">10</FinanceCosts>
<Assets contextRef="OneI" unitRef="INR" decimals="-5">2000</Assets><Equity contextRef="OneI" unitRef="INR" decimals="-5">1000</Equity><Assets contextRef="SegI" unitRef="INR" decimals="-5">7</Assets>${extra}</xbrl>`;
const integratedItem={...item,publishedAt:'2026-10-17T03:33:01Z'};
test('integrated filings with repeated scope, instant balance sheet and per-share EPS parse',()=>{
 const r=parseFinancialDisclosure(integrated(),integratedItem,Date.parse('2026-10-17T04:00:00Z'));
 assert.equal(r.scope,'Standalone');assert.deepEqual(r.periods.map((p:any)=>p.contextId),['FourD','OneD']);
 const q=r.periods.find((p:any)=>p.contextId==='OneD'),m=(k:string)=>q.metrics.find((x:any)=>x.key===k);
 assert.equal(m('basicEps').value,1.25);assert.equal(m('basicEps').unit,'perShare');assert.equal(m('basicEps').currency,'INR');
 assert.equal(m('financeCosts').status,'UNVERIFIED_CURRENCY','money facts never accept a per-share unit');
 assert.deepEqual(r.balanceSheet.map((b:any)=>[b.instant,b.metrics.find((x:any)=>x.key==='totalAssets').value,b.metrics.find((x:any)=>x.key==='borrowingsCurrent').status]),[['2026-09-30',2000,'NOT_REPORTED']]);
 assert.deepEqual(r.rejectedContexts,['SegI']);assert.equal(r.auditDisclosure.fields[0].value,'Unaudited');assert.equal(r.auditDisclosure.fields[0].contextId,'OneD');
});
test('disagreeing scopes are rejected and banking-format filings are classified as unsupported',()=>{
 assert.throws(()=>parseFinancialDisclosure(integrated().replace('contextRef="FourD">Standalone','contextRef="FourD">Consolidated'),integratedItem,Date.parse('2026-10-17T04:00:00Z')),/reporting scope/);
 const bank=integrated().replace(/<RevenueFromOperations[^]*?<\/RevenueFromOperations>/g,'').replace(/<BasicEarnings[^]*?<\/BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations>/,'').replace(/<FinanceCosts[^]*?<\/FinanceCosts>/,'').replace(/NameOfTheCompany/g,'NameOfBank');
 assert.throws(()=>parseFinancialDisclosure(bank,integratedItem,Date.parse('2026-10-17T04:00:00Z')),(e:any)=>e.code==='UNSUPPORTED_FINANCIAL_FORMAT');
});
test('a context whose dates contradict the declared reporting period is never used',()=>{
 const declared=`<DateOfStartOfReportingPeriod contextRef="OneD">2026-07-01</DateOfStartOfReportingPeriod><DateOfEndOfReportingPeriod contextRef="OneD">2026-09-30</DateOfEndOfReportingPeriod><DateOfStartOfReportingPeriod contextRef="FourD">2025-10-01</DateOfStartOfReportingPeriod><DateOfEndOfReportingPeriod contextRef="FourD">2026-09-30</DateOfEndOfReportingPeriod>`;
 const r=parseFinancialDisclosure(integrated(declared),integratedItem,Date.parse('2026-10-17T04:00:00Z'));
 assert.deepEqual(r.periods.map((p:any)=>p.contextId),['OneD']);assert(r.rejectedContexts.includes('FourD'));
});
