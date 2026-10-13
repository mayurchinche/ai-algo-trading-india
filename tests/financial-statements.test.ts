import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFinancialDisclosure} from '../server/financialStatements.js';
import {createDisclosureHandler} from '../api/company-disclosures.js';
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
