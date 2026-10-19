import test from 'node:test';import assert from 'node:assert/strict';
import {parseFilingIndex,parseLegacyAnnualIndex,backfillFundamentalFilings,filingIndexUrl} from '../server/fundamentalsBackfill.js';
import {deriveFundamentals} from '../server/fundamentals.js';
import {MAX_DOCUMENT_BYTES} from '../server/financialStatements.js';
const now=Date.parse('2026-10-18T00:00:00Z');
const x=(id:string)=>`https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_${id}_WEB.xml`;
const row=(id:string,qe:string,broadcast='23-Apr-2026 20:47:17',extra:any={})=>({xbrl:x(id),qe_Date:qe,broadcast_Date:broadcast,consolidated:'Consolidated',...extra});
const index=(data:any[],totalCount=data.length)=>JSON.stringify({data,totalCount});
test('index selects Ind AS filings for quarters ending 31 March and counts everything else',()=>{
 const r=parseFilingIndex(index([row('1','31-MAR-2026'),row('2','31-DEC-2025','14-Jan-2026 20:38:27'),{xbrl:'https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_GOVERNANCE_9_WEB.xml',qe_Date:'31-MAR-2026',broadcast_Date:'20-Apr-2026 10:07:19'},{xbrl:'https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_BANKING_8_WEB.xml'},row('3','31-MAR-2026','01-Jan-2099 00:00:00'),row('4','31-MAR-2026','23-Apr-2026 20:47:17',{xbrl:'https://example.com/corporate/xbrl/INTEGRATED_FILING_INDAS_4_WEB.xml'}),row('5','31-MAR-2025','17-Apr-2025 23:36:33',{symbol:'OTHER'})],12),'INFY',now);
 assert.deepEqual(r.items.map((i:any)=>[i.quarterEnd,i.publishedAt]),[['2026-03-31','2026-04-23T15:17:17.000Z']]);
 // The bare banking row is a selectable filing type, rejected for its missing dates; only governance is another type.
 assert.deepEqual(r.coverage,{received:7,otherFilingTypes:1,notFinancialYearEnd:1,rejected:4,selected:1,totalCount:12,truncated:true});
 assert.equal(filingIndexUrl('M&M'),'https://www.nseindia.com/api/integrated-filing-results?index=equities&size=100&symbol=M%26M');
 assert.throws(()=>parseFilingIndex('{"rows":[]}','INFY',now));assert.throws(()=>filingIndexUrl('../x'));
});
// A minimal integrated filing as produced by NSE, with an annual period and its year-end balance sheet.
const filingXml=(symbol:string,isin:string,profit=100)=>`<xbrl><context id="OneD"><entity><identifier>1</identifier></entity><period><startDate>2025-04-01</startDate><endDate>2026-03-31</endDate></period></context><context id="OneI"><entity><identifier>1</identifier></entity><period><instant>2026-03-31</instant></period></context><unit id="INR"><measure>iso4217:INR</measure></unit><Symbol contextRef="OneD">${symbol}</Symbol><ISIN contextRef="OneD">${isin}</ISIN><NameOfTheCompany contextRef="OneD">Fixture</NameOfTheCompany><NatureOfReportStandaloneConsolidated contextRef="OneD">Consolidated</NatureOfReportStandaloneConsolidated><RevenueFromOperations contextRef="OneD" unitRef="INR" decimals="-5">1000</RevenueFromOperations><ProfitLossForPeriod contextRef="OneD" unitRef="INR" decimals="-5">${profit}</ProfitLossForPeriod><Equity contextRef="OneI" unitRef="INR" decimals="-5">500</Equity></xbrl>`;
const memoryStore=(known:string[]=[])=>{const saved:any[]=[];return {saved,known:async(ids:string[])=>ids.filter(id=>known.includes(id)).map(id=>({id})),save:async(f:any)=>{saved.push(f);return {id:f.id};}};};
test('ISIN is the identity: former or mistyped symbols are recorded, other issuers are rejected',async()=>{
 const docs:Record<string,string>={[x('1')]:filingXml('BAJAJAUTO','INE917I01010'),[x('2')]:filingXml('OTHERCO','INE000A01010')};
 const reads:any[]=[];const read=async(url:string,max?:number)=>{reads.push([url,max]);return url.includes('api')?index([row('1','31-MAR-2026'),row('2','31-MAR-2026','23-Apr-2026 20:47:18')]):docs[url];};
 const store=memoryStore();const r=await backfillFundamentalFilings({targets:[{symbol:'BAJAJ-AUTO',isin:'INE917I01010'}],store,read,clock:()=>now,pause:async()=>{}});
 assert.deepEqual(r.symbols[0].outcomes.map((o:any)=>[o.status,o.filedSymbol]),[['RECORDED','BAJAJAUTO'],['IDENTITY_MISMATCH','OTHERCO']]);
 assert.equal(r.symbols[0].status,'PARTIAL');assert.equal(store.saved[0].instrumentKey,'NSE_EQ|INE917I01010');assert.equal(store.saved[0].observedAt,new Date(now).toISOString());
 assert.deepEqual(reads.filter(([u]:any)=>!u.includes('api')).map(([,m]:any)=>m),[MAX_DOCUMENT_BYTES,MAX_DOCUMENT_BYTES]);
 const bySymbol=await backfillFundamentalFilings({targets:[{symbol:'BAJAJ-AUTO'}],store:memoryStore(),read,clock:()=>now,pause:async()=>{}});
 assert(bySymbol.symbols[0].outcomes.every((o:any)=>o.status==='IDENTITY_MISMATCH'),'without an ISIN the filed symbol must match');
 await assert.rejects(backfillFundamentalFilings({targets:[{symbol:'X',isin:'bad'}],store:memoryStore(),read,pause:async()=>{}}));
});
test('stored filings are skipped; index outages, HTML pages and unsupported formats stay explicit',async()=>{
 const items=[row('1','31-MAR-2026'),row('2','31-MAR-2026','23-Apr-2026 20:47:18'),row('3','31-MAR-2026','23-Apr-2026 20:47:19')];
 const ids=parseFilingIndex(index(items),'INFY',now).items.map((i:any)=>i.id);
 const read=async(url:string)=>url.includes('symbol=DOWN')?Promise.reject(Error('blocked')):url.includes('api')?index(items):url===x('2')?'<!DOCTYPE html><html></html>':filingXml('INFY','INE009A01021').replace(/<RevenueFromOperations[^]*?<\/RevenueFromOperations>/,'').replace(/<ProfitLossForPeriod[^]*?<\/ProfitLossForPeriod>/,'');
 const r=await backfillFundamentalFilings({targets:[{symbol:'INFY',isin:'INE009A01021'},{symbol:'DOWN'}],store:memoryStore([ids[0]]),read,clock:()=>now,pause:async()=>{}});
 assert.deepEqual(r.symbols[0].outcomes.map((o:any)=>o.status),['ALREADY_RECORDED','READ_FAILED','UNSUPPORTED_FORMAT']);
 assert.equal(r.symbols[1].status,'INDEX_UNAVAILABLE');assert.equal(r.coverage.indexUnavailable,1);assert.equal(r.coverage.failed,1);assert.equal(r.coverage.unsupportedFormat,1);
});
test('growth and ratios across filings with different symbols carry FILED_SYMBOL_CHANGED',()=>{
 const KEY='NSE_EQ|INE155A01022';
 const filing=(c:string,symbol:string,start:string,end:string,publishedAt:string,facts:any[],positions:any[])=>({policy:'fundamental-filing-v1',status:'EXTRACTED_REQUIRES_REVIEW',id:c.repeat(64),documentHash:c.repeat(64),symbol,instrumentKey:KEY,scope:'Consolidated',url:'u',publishedAt,observedAt:publishedAt,periods:[{contextId:'D',start,end,facts,unavailable:[]}],positions,rejectedContexts:[]});
 const f=(key:string,value:number)=>({key,value,currency:'INR',tag:key});
 const filings=[filing('a','TATAMOTORS','2024-04-01','2025-03-31','2025-05-13T00:00:00Z',[f('revenue',100)],[{contextId:'I',instant:'2025-03-31',facts:[f('equity',50)],unavailable:[]}]),
  filing('b','TMPV','2025-04-01','2026-03-31','2026-05-13T00:00:00Z',[f('revenue',80),f('totalProfit',40)],[{contextId:'I',instant:'2026-03-31',facts:[f('equity',70)],unavailable:[]}])];
 const d=deriveFundamentals(filings,{instrumentKey:KEY,asOf:now}),c=d.scopes.Consolidated;
 const rev=c.growth.find((g:any)=>g.key==='revenue'&&g.years===1);assert(Math.abs(rev.valuePct+20)<1e-9);assert.deepEqual(rev.warnings,['FILED_SYMBOL_CHANGED']);
 const roe=c.ratios.find((r:any)=>r.key==='roe');assert.equal(roe.status,'CALCULATED_REQUIRES_REVIEW');assert.deepEqual(roe.warnings,['FILED_SYMBOL_CHANGED']);
 assert.deepEqual(c.ratios.find((r:any)=>r.key==='roce').warnings,[]);
});
// Banking-format filings: one annual context, year-end and opening instants, a pure-unit ratio unit.
const bankXml=({cet1='0.1971',scope='Standalone'}={})=>{
 const m=(tag:string,v:string|number,ctx='OneD',unit='INR')=>`<${tag} contextRef="${ctx}" unitRef="${unit}" decimals="-5">${v}</${tag}>`;
 return `<xbrl><context id="OneD"><entity><identifier>1</identifier></entity><period><startDate>2025-04-01</startDate><endDate>2026-03-31</endDate></period></context><context id="OneI"><entity><identifier>1</identifier></entity><period><instant>2026-03-31</instant></period></context><context id="ZeroI"><entity><identifier>1</identifier></entity><period><instant>2025-03-31</instant></period></context><unit id="INR"><measure>iso4217:INR</measure></unit><unit id="pure"><measure>xbrli:pure</measure></unit><unit id="EPS"><divide><unitNumerator><measure>iso4217:INR</measure></unitNumerator><unitDenominator><measure>xbrli:shares</measure></unitDenominator></divide></unit><Symbol contextRef="OneD">BANKX</Symbol><ISIN contextRef="OneD">INE000B01010</ISIN><NameOfBank contextRef="OneD">Fixture Bank</NameOfBank><NatureOfReportStandaloneConsolidated contextRef="OneD">${scope}</NatureOfReportStandaloneConsolidated>`
 +m('InterestEarned',900)+m('InterestExpended',500)+m('Income',1000)+m('OperatingExpenses',200)+m('ProfitLossForThePeriod',120)+m('BasicEarningsPerShareAfterExtraordinaryItems',1.2,'OneD','EPS')+m('PaidUpValueOfEquityShareCapital',100)+m('FaceValueOfEquityShareCapital',1,'OneD','EPS')
 +m('PercentageOfGrossNpa','0.0115','OneD','pure')+m('CET1Ratio',cet1,'OneD','pure')
 +m('Capital',100,'OneI')+m('ReservesAndSurplus',900,'OneI')+m('Assets',10000,'OneI')+m('Advances',6000,'OneI')+m('Deposits',7000,'OneI')
 +m('Capital',100,'ZeroI')+m('ReservesAndSurplus',700,'ZeroI')+m('Assets',8000,'ZeroI')+'</xbrl>';
};
const close=(a:number,b:number)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('index selects banking and NBFC Ind AS filings alongside Ind AS ones',()=>{
 const bank=(id:string,kind:string)=>({...row(id,'31-MAR-2026'),xbrl:`https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_${kind}_${id}_WEB.xml`});
 const r=parseFilingIndex(index([bank('1','BANKING'),bank('2','NBFC_INDAS'),bank('3','LI')]),'BANKX',now);
 assert.deepEqual(r.items.map((i:any)=>i.url.split('/').pop()),['INTEGRATED_FILING_BANKING_1_WEB.xml','INTEGRATED_FILING_NBFC_INDAS_2_WEB.xml']);
 assert.equal(r.coverage.otherFilingTypes,1);
});
test('banking filings derive bank ratios; consolidated zero ratios and banks in peer ranks stay unavailable',async()=>{
 const {parseFinancialDisclosure}=await import('../server/financialStatements.js');const {toFundamentalFiling}=await import('../server/fundamentals.js');const {companyMetrics}=await import('../server/scorecards.js');
 const key='NSE_EQ|INE000B01010',item=(c:string)=>({id:c.repeat(64),url:`https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_BANKING_${c}.xml`,publishedAt:'2026-04-20T10:00:00Z'});
 const doc=parseFinancialDisclosure(bankXml(),item('a'),now);
 assert.equal(doc.format,'BANKING');assert.equal(doc.company,'Fixture Bank');
 const f=toFundamentalFiling(doc);assert.equal(f.format,'BANKING');
 const year=f.periods.find((p:any)=>p.start==='2025-04-01');
 assert.deepEqual(['revenue','totalProfit','interestEarned','grossNpaPct'].map(k=>{const x=year.facts.find((v:any)=>v.key===k);return [k,x.value,x.currency];}),[['revenue',1000,'INR'],['totalProfit',120,'INR'],['interestEarned',900,'INR'],['grossNpaPct',0.0115,'PURE']]);
 const price={status:'OBSERVED',instrumentKey:key,value:21.6,currency:'INR',date:'2026-10-16',source:'test'};
 const d=deriveFundamentals([f],{instrumentKey:key,asOf:now,price}),s=d.scopes.Standalone,v=(k:string)=>s.ratios.find((r:any)=>r.key===k);
 assert.equal(s.format,'BANKING');
 assert.deepEqual(s.ratios.map((r:any)=>r.key),['roe','roa','nim','costToIncome','grossNpaPct','netNpaPct','cet1Ratio','pe','pb','peg']);
 close(v('roe').value,120/900*100);close(v('roa').value,120/9000*100);close(v('nim').value,400/9000*100);close(v('costToIncome').value,40);
 close(v('grossNpaPct').value,1.15);close(v('cet1Ratio').value,19.71);close(v('pe').value,18);close(v('pb').value,2.16);
 assert.equal(v('netNpaPct').status,'INPUT_UNAVAILABLE');assert.equal(v('peg').status,'INPUT_UNAVAILABLE');
 const zero=deriveFundamentals([toFundamentalFiling(parseFinancialDisclosure(bankXml({cet1:'0',scope:'Consolidated'}),item('b'),now))],{instrumentKey:key,asOf:now,price});
 assert.equal(zero.scopes.Consolidated.ratios.find((r:any)=>r.key==='cet1Ratio').status,'REPORTED_AS_ZERO_NOT_USED');
 // Fundamental criteria are not ranked against industrial companies; price momentum is format-independent.
 const ranked=companyMetrics(d,{status:'OBSERVED',return12mPct:12,belowHighPct:3,close:21.6,to:'2026-10-16'}).metrics;
 for(const k of ['roe','roce','pe','debtToEquity','revenueGrowth3y','profitGrowth1y'])assert.deepEqual([k,ranked[k].value,ranked[k].status],[k,null,'BANKING_FORMAT_NOT_RANKED']);
 assert.equal(ranked.return12m.value,12);
 // NBFCs report interest earned but finance costs, not interest expended: they keep the Ind AS definitions.
 const nbfc=parseFinancialDisclosure(filingXml('NBFCX','INE000C01010').replace('</xbrl>','<InterestEarned contextRef="OneD" unitRef="INR" decimals="-5">900</InterestEarned></xbrl>'),item('c'),now);
 assert.equal(nbfc.format,'INDAS');
});
// Pre-integrated annual results: no ISIN; the full-year column carries the quarter's context dates and declares
// the April–March year; a quarter column with the same context dates is the consistency reference.
const legacyXml=(symbol:string,{yearRevenue=1000,quarterRevenue=300}={})=>{
 const ctx=(id:string)=>`<context id="${id}"><entity><identifier>1</identifier></entity><period><startDate>2024-01-01</startDate><endDate>2024-03-31</endDate></period></context>`;
 const m=(tag:string,v:string|number,c:string)=>`<${tag} contextRef="${c}" unitRef="INR" decimals="-5">${v}</${tag}>`;
 return `<xbrl>${ctx('Q')}${ctx('Y')}<unit id="INR"><measure>iso4217:INR</measure></unit><Symbol contextRef="Q">${symbol}</Symbol><NameOfTheCompany contextRef="Q">Fixture</NameOfTheCompany><NatureOfReportStandaloneConsolidated contextRef="Q">Standalone</NatureOfReportStandaloneConsolidated><NatureOfReportStandaloneConsolidated contextRef="Y">Standalone</NatureOfReportStandaloneConsolidated>`
 +`<DateOfStartOfReportingPeriod contextRef="Q">2024-01-01</DateOfStartOfReportingPeriod><DateOfEndOfReportingPeriod contextRef="Q">2024-03-31</DateOfEndOfReportingPeriod><DateOfStartOfReportingPeriod contextRef="Y">2023-04-01</DateOfStartOfReportingPeriod><DateOfEndOfReportingPeriod contextRef="Y">2024-03-31</DateOfEndOfReportingPeriod>`
 +m('RevenueFromOperations',quarterRevenue,'Q')+m('ProfitLossForPeriod',30,'Q')+m('RevenueFromOperations',yearRevenue,'Y')+m('ProfitLossForPeriod',100,'Y')+'</xbrl>';
};
const legacyUrl=(id:string)=>`https://nsearchives.nseindia.com/corporate/xbrl/INDAS_${id}_1_2_WEB.xml`;
const legacyRow=(id:string,toDate='31-Mar-2024',extra:any={})=>({xbrl:legacyUrl(id),broadCastDate:'20-May-2024 18:00:00',toDate,period:'Annual',consolidated:'Standalone',...extra});
test('legacy annual index keeps audited April–March years in range',()=>{
 const r=parseLegacyAnnualIndex(JSON.stringify([legacyRow('1'),legacyRow('2','31-Mar-2018'),legacyRow('3','31-Dec-2023'),legacyRow('4','31-Mar-2024',{period:'Quarterly'}),legacyRow('5','31-Mar-2025'),{...legacyRow('6'),xbrl:'https://example.com/corporate/xbrl/INDAS_6_1_2.xml'},legacyRow('1')]),'TEST',now);
 assert.deepEqual(r.items.map((i:any)=>[i.quarterEnd,i.legacy]),[['2024-03-31',true]]);
 assert.deepEqual(r.coverage,{received:7,selected:1,rejected:3,outOfRange:2});
 assert.throws(()=>parseLegacyAnnualIndex('{}','TEST',now));
});
test('legacy filings need the expected symbol and ISIN, the declared full year and a consistent revenue',async()=>{
 const {parseFinancialDisclosure}=await import('../server/financialStatements.js');
 const docs:Record<string,string>={[legacyUrl('1')]:legacyXml('TEST'),[legacyUrl('2')]:legacyXml('TEST',{yearRevenue:500}),[legacyUrl('3')]:legacyXml('OTHER')};
 const read=async(url:string)=>url.includes('corporates-financial-results')?JSON.stringify([legacyRow('1'),{...legacyRow('2'),broadCastDate:'21-May-2024 18:00:00'},{...legacyRow('3'),broadCastDate:'22-May-2024 18:00:00'}]):url.includes('api')?index([]):docs[url];
 const store=memoryStore(),r=await backfillFundamentalFilings({targets:[{symbol:'TEST',isin:'INE000D01010'}],store,read,clock:()=>now,pause:async()=>{}});
 assert.deepEqual(r.symbols[0].outcomes.map((o:any)=>o.status),['RECORDED','RECORDED','LEGACY_UNVERIFIABLE']);
 assert.equal(r.symbols[0].status,'COMPLETE');
 const [good,inconsistent]=store.saved;
 assert.equal(good.instrumentKey,'NSE_EQ|INE000D01010');assert.equal(good.identityBasis,'SYMBOL_MATCHED_EXPECTED_ISIN');
 // Context-dated periods carry no basis field; only the legacy declared basis is recorded.
 assert.deepEqual(good.periods.map((p:any)=>[p.start,p.end,p.periodBasis]),[['2023-04-01','2024-03-31','DECLARED_FACTS_LEGACY'],['2024-01-01','2024-03-31',undefined]]);
 assert(!inconsistent.periods.some((p:any)=>p.start==='2023-04-01'),'a year whose revenue is under 2.5× its quarter is dropped');
 // Without an expected company the same file has no identity; legacy period dates are never used.
 assert.throws(()=>parseFinancialDisclosure(legacyXml('TEST'),{id:'f'.repeat(64),url:legacyUrl('1'),publishedAt:'2024-05-20T12:30:00Z'},now),/identity/);
 const skipped=await backfillFundamentalFilings({targets:[{symbol:'TEST',isin:'INE000D01010'}],store:memoryStore(),legacy:false,read,clock:()=>now,pause:async()=>{}});
 assert.equal(skipped.symbols[0].status,'NO_SUPPORTED_ANNUAL_FILINGS');
});

test('ISIN structure and NSE face-value changes',async()=>{
 const {validIsin,sameIssuerEquity,parseCorporateActions}=await import('../server/isinLineage.js');
 assert(validIsin('INE237A01028')&&validIsin('INE237A01036'));assert(!validIsin('INE237A01037'));assert(!validIsin('ine237a01036'));
 assert(sameIssuerEquity('INE237A01028','INE237A01036'),'same issuer, equity, earlier serial');
 assert(!sameIssuerEquity('INE237A01036','INE237A01028'),'a later serial is not a former ISIN');
 assert(!sameIssuerEquity('INE009A01021','INE040A01034'),'different issuers');assert(!sameIssuerEquity('INE237A01036','INE237A01036'));
 const body=JSON.stringify([{symbol:'KOTAKBANK',exDate:'14-Jan-2026',subject:'Face Value Split (Sub-Division) - From Rs 5/- Per Share To Re 1/- Per Share'},{symbol:'KOTAKBANK',exDate:'17-Jul-2026',subject:'Dividend - Rs 0.65 Per Share'},
  {symbol:'KOTAKBANK',exDate:'01-Jan-2027',subject:'Consolidation of shares'},{symbol:'OTHER',exDate:'14-Jan-2026',subject:'Face Value Split'},{symbol:'KOTAKBANK',exDate:'bad',subject:'Face Value Split'}]);
 assert.deepEqual(parseCorporateActions(body,'KOTAKBANK',now).actions,[{subject:'Face Value Split (Sub-Division) - From Rs 5/- Per Share To Re 1/- Per Share',exDate:'2026-01-14'}]);
 assert.throws(()=>parseCorporateActions('{}','KOTAKBANK',now));
});
test('filings under a former ISIN are relinked only with a later NSE face-value change; per-share facts are dropped',async()=>{
 const eps='<BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations contextRef="OneD" unitRef="EPS" decimals="2">12.5</BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations><unit id="EPS"><divide><unitNumerator><measure>iso4217:INR</measure></unitNumerator><unitDenominator><measure>xbrli:shares</measure></unitDenominator></divide></unit></xbrl>';
 const docs:Record<string,string>={[x('1')]:filingXml('KOTAKBANK','INE237A01028').replace('</xbrl>',eps),[x('2')]:filingXml('KOTAKBANK','INE237A01036',120),[x('3')]:filingXml('KOTAKBANK','INE009A01021')};
 const items=[row('1','31-MAR-2026'),row('2','31-MAR-2026','24-Apr-2026 20:47:17'),row('3','31-MAR-2026','25-Apr-2026 20:47:17')];
 let actionReads=0;
 const reader=(exDate:string|null)=>async(url:string)=>{
  if(url.includes('corporateActions')){actionReads++;if(exDate===null)throw Error('blocked');return JSON.stringify([{symbol:'KOTAKBANK',exDate,subject:'Face Value Split (Sub-Division) - From Rs 5/- Per Share To Re 1/- Per Share'}]);}
  return url.includes('corporates-financial-results')?'[]':url.includes('api')?index(items):docs[url];
 };
 const run=async(exDate:string|null)=>{const store=memoryStore();const r=await backfillFundamentalFilings({targets:[{symbol:'KOTAKBANK',isin:'INE237A01036'}],store,read:reader(exDate),clock:()=>now,pause:async()=>{}});return {store,outcomes:r.symbols[0].outcomes};};
 const ok=await run('14-Jun-2026');
 assert.deepEqual(ok.outcomes.map((o:any)=>[o.status,o.relinkedFrom??o.lineage??null]),[['RECORDED','NSE_EQ|INE237A01028'],['RECORDED',null],['IDENTITY_MISMATCH','NOT_SAME_ISSUER_EQUITY']]);
 assert.equal(actionReads,1,'corporate actions are read once per company');
 const relinked=ok.store.saved[0];
 assert.equal(relinked.instrumentKey,'NSE_EQ|INE237A01036');assert.equal(relinked.identityBasis,'FORMER_ISIN_SAME_ISSUER');
 assert.deepEqual({...relinked.lineage,corporateAction:{...relinked.lineage.corporateAction,sourceHash:'h'}},{policy:'isin-lineage-v1',filedIsin:'INE237A01028',currentIsin:'INE237A01036',
  corporateAction:{subject:'Face Value Split (Sub-Division) - From Rs 5/- Per Share To Re 1/- Per Share',exDate:'2026-06-14',source:'https://www.nseindia.com/api/corporates-corporateActions?index=equities&symbol=KOTAKBANK',sourceHash:'h'}});
 const year=relinked.periods[0];
 assert(!year.facts.some((f:any)=>f.key==='basicEps'));assert.deepEqual(year.unavailable.find((u:any)=>u.key==='basicEps'),{key:'basicEps',status:'BEFORE_FACE_VALUE_CHANGE',tag:'BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations'});
 assert(year.facts.some((f:any)=>f.key==='revenue'),'totals are kept');
 // Inputs from the relinked filing carry the former-ISIN warning; the current filing's do not.
 const d=deriveFundamentals(ok.store.saved,{instrumentKey:'NSE_EQ|INE237A01036',asOf:now});
 assert.deepEqual(d.scopes.Consolidated.growth.find((g:any)=>g.key==='totalProfit'&&g.years===1)?.warnings??[],[]);
 const only=deriveFundamentals([relinked],{instrumentKey:'NSE_EQ|INE237A01036',asOf:now}).scopes.Consolidated.ratios;
 assert.deepEqual(only.find((r:any)=>r.key==='roe').warnings,['FILED_UNDER_FORMER_ISIN']);
 assert.deepEqual(only.find((r:any)=>r.key==='pe').missingInputs.includes('basicEps'),true,'pre-split EPS is not used');
 assert.equal((await run('14-Jan-2026')).outcomes[0].lineage,'NO_FACE_VALUE_CHANGE_AFTER_FILING');
 assert.equal((await run('14-Jan-2099')).outcomes[0].lineage,'NO_FACE_VALUE_CHANGE_AFTER_FILING','future actions are not evidence');
 assert.equal((await run(null)).outcomes[0].lineage,'CORPORATE_ACTIONS_UNAVAILABLE');
});
