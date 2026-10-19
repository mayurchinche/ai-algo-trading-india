import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {assessRiskProfile,mandateLimits,PROFILE_LIMITS,QUESTIONS,LEVELS} from '../shared/riskProfile.js';
import {importHoldingsCsv,parseCsv} from '../shared/holdingsImport.js';
import {assessPortfolioFit} from '../shared/portfolioFit.js';
import {validateMandate} from '../server/researchPortfolio.js';
import {observeClose,priceHoldings,buildReference} from '../src/services/portfolioFit';
import {FitReport,RiskProfileResult} from '../src/components/PortfolioFitPage';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';

const all=(level:number)=>Object.fromEntries(QUESTIONS.map(q=>[q.id,level]));
test('profile follows the most cautious answer and names what limits it',()=>{
 assert.equal(assessRiskProfile(all(2)).profile,'GROWTH');
 const r:any=assessRiskProfile({...all(2),horizon:0});
 assert.equal(r.profile,'CONSERVATIVE');assert.deepEqual(r.limitedBy,['horizon']);assert.deepEqual(r.tensions.map((t:any)=>t.question),['drawdown','reliance','experience']);
 assert.deepEqual(assessRiskProfile({...all(1),drawdown:2}).tensions,[],'one level apart is not a tension');
 const partial:any=assessRiskProfile({horizon:1,drawdown:9});assert.equal(partial.status,'INCOMPLETE');assert.deepEqual(partial.missing,['drawdown','reliance','experience']);
 assert.throws(()=>assessRiskProfile({other:1}));assert.throws(()=>assessRiskProfile([] as any));
});
test('every profile produces a mandate the research-portfolio builder accepts, cautious to aggressive',()=>{
 for(const level of LEVELS)assert.doesNotThrow(()=>validateMandate({name:'p',segment:'long-term',budget:100000,...mandateLimits(level)}));
 const [c,b,g]=LEVELS.map(l=>PROFILE_LIMITS[l]);
 for(const k of ['maxStockPct','maxTopFivePct','maxSectorPct','riskBudgetPct'] as const)assert(c[k]<b[k]&&b[k]<g[k],k);
 for(const k of ['minHoldings','cashReservePct'] as const)assert(c[k]>b[k]&&b[k]>g[k],k);
 assert.throws(()=>mandateLimits('RISKY' as any));
});

test('CSV parser handles quotes, embedded commas and line breaks, BOM and CRLF',()=>{
 const rows=parseCsv('\ufeffa,b\r\n"x, y","he said ""hi""\nthere"\r\n\r\nlast,1');
 assert.deepEqual(rows.map(r=>r.cells),[['a','b'],['x, y','he said "hi"\nthere'],['last','1']]);assert.deepEqual(rows.map(r=>r.line),[1,2,5]);
 assert.throws(()=>parseCsv('a\n"open'),/Unterminated/);
});
test('holdings import recognises broker headers, merges repeats and reports every skipped row',()=>{
 const csv='Instrument,Qty.,Avg. cost,LTP\nINFY,"1,000",1500.5,1600\nNSE:TCS,10,3000,3100\nINFY,500,1400,1600\nBAD SYMBOL,1,1,1\nHDFCBANK,0,1,1\nITC,5,,400\n';
 const r=importHoldingsCsv(csv);
 assert.deepEqual(r.columns,{symbol:'Instrument',isin:null,quantity:'Qty.',averagePrice:'Avg. cost'});assert.deepEqual(r.ignoredColumns,['LTP']);
 const infy=r.holdings.find(h=>h.symbol==='INFY')!;assert.equal(infy.quantity,1500);assert(Math.abs(infy.averagePrice!-(1500.5*1000+1400*500)/1500)<1e-9);assert.deepEqual(infy.lines,[2,4]);
 assert.equal(r.holdings.find(h=>h.symbol==='TCS')!.quantity,10);assert.equal(r.holdings.find(h=>h.symbol==='ITC')!.averagePrice,null);
 assert.deepEqual(r.skipped,[{line:5,reason:'INVALID_SYMBOL'},{line:6,reason:'INVALID_QUANTITY'}]);assert.deepEqual(r.coverage,{rows:6,imported:3,mergedRows:1,skipped:2});
 const isin=importHoldingsCsv('ISIN Code,Quantity Available\nINE009A01021,5\nINE009A01021,5\nbad,1\n');assert.deepEqual(isin.holdings.map(h=>[h.isin,h.quantity]),[['INE009A01021',10]]);assert.equal(isin.skipped[0].reason,'INVALID_ISIN');
 assert.throws(()=>importHoldingsCsv('Name,Value\nx,1\n'),/quantity column/);assert.throws(()=>importHoldingsCsv('Symbol,Qty,Quantity\n'),/More than one column/);assert.throws(()=>importHoldingsCsv(''),/no rows/);
 assert.equal(importHoldingsCsv('Symbol,ISIN,Qty\nINFY,INE009A01021,1\nTCS,INE009A01021,1\n').skipped[0].reason,'CONFLICTS_WITH_EARLIER_ROW');
});

const limits={maxStockPct:20,maxTopFivePct:75,maxSectorPct:45,minHoldings:5};
const ref=new Map<string,any>();for(const [symbol,industry,valueScore] of [['A','IT',80],['B','IT',null],['C','Banks',60],['D','Auto',40],['E','Auto',20],['F','Pharma',90]] as const){const e={symbol,isin:'INE'+symbol.repeat(9),industry,supportedFiling:true,valueScore};ref.set(symbol,e);ref.set(e.isin,e);}
const holding=(symbol:string|null,quantity:number,isin:string|null=null)=>({symbol,isin,quantity,averagePrice:null,lines:[1]});
const observed=(close:number)=>({status:'OBSERVED',close,date:'2026-10-16'});
test('fit passes, breaches and stays unknown exactly when the data proves it',()=>{
 const holdings=['A','B','C','D','E','F'].map(s=>holding(s,10)),prices=new Map(holdings.map(h=>[h.symbol!,observed(100)]));
 const ok=assessPortfolioFit({holdings,prices,reference:ref,limits:{...limits,maxTopFivePct:85}});
 assert.equal(ok.status,'WITHIN_LIMITS');assert.equal(ok.totals.marketValue,6000);assert(Math.abs(ok.checks.find(c=>c.id==='largestSector')!.value!-100/3)<1e-9);
 assert(Math.abs(ok.quality.supportedFilingPct!-100)<1e-9);assert(Math.abs(ok.quality.valueScoreCoveragePct!-500/6)<1e-9);assert(Math.abs(ok.quality.weightedValueScore!-58)<1e-9);
 const heavy=assessPortfolioFit({holdings:[...holdings.slice(1),holding('A',100)],prices,reference:ref,limits});
 assert.equal(assessPortfolioFit({holdings,prices,reference:ref,limits}).checks.find(c=>c.id==='topFive')!.status,'BREACH','six equal holdings put 83% in the top five');
 assert.equal(heavy.status,'OUTSIDE_LIMITS');assert.equal(heavy.checks.find(c=>c.id==='largestHolding')!.holding,'A');assert.equal(heavy.checks.find(c=>c.id==='largestSector')!.status,'BREACH');
 const unpriced=assessPortfolioFit({holdings,prices:new Map([...prices].filter(([s])=>s!=='F')),reference:ref,limits});
 assert.equal(unpriced.status,'INCOMPLETE');assert.deepEqual(unpriced.unpriced,['F']);assert(unpriced.checks.filter(c=>c.id!=='holdings').every(c=>c.status==='UNKNOWN'&&c.value===null));
 assert.equal(unpriced.totals.marketValue,null);assert.equal(unpriced.quality.supportedFilingPct,null);
 const few=assessPortfolioFit({holdings:holdings.slice(0,4),prices,reference:ref,limits});assert.equal(few.checks[0].status,'BREACH');
});
test('unclassified holdings block a sector pass but never hide a proven breach',()=>{
 const prices=new Map([['A',observed(100)],['B',observed(100)],['C',observed(100)],['X',observed(100)],['Y',observed(100)]]);
 const fit=(qa:number)=>assessPortfolioFit({holdings:[holding('A',qa),holding('B',10),holding('C',40),holding('X',20),holding('Y',20)],prices,reference:ref,limits:{...limits,maxStockPct:100,maxTopFivePct:100}}).checks.find(c=>c.id==='largestSector')!;
 const unknown=fit(10);assert.equal(unknown.status,'UNKNOWN');assert.equal(unknown.reason,'UNCLASSIFIED_HOLDINGS');assert.equal(unknown.unclassifiedPct,40);
 assert.equal(fit(60).status,'BREACH');
 const isinOnly=assessPortfolioFit({holdings:[holding(null,1,'INE'+'A'.repeat(9))],prices:new Map([['A',observed(5)]]),reference:ref,limits});assert.equal(isinOnly.positions[0].symbol,'A');assert.equal(isinOnly.positions[0].value,5);
});

const day=Date.parse('2026-10-18T06:00:00Z');
const hist=(date:string)=>({dates:['2026-10-01',date],closes:[1,123.4],highs:[2,124],lows:[1,120],volumes:[1,1],meta:{}});
test('prices use the latest completed close, refuse stale history and resolve ISIN-only holdings',async()=>{
 const asked:string[]=[];assert.deepEqual(await observeClose('M&M',day,async s=>{asked.push(s);return hist('2026-10-16') as any;}),{status:'OBSERVED',close:123.4,date:'2026-10-16'});assert.deepEqual(asked,['M&M.NS']);
 assert.equal((await observeClose('X',day,async()=>hist('2026-09-30') as any)).status,'PRICE_STALE');
 assert.equal((await observeClose('X',day,async()=>{throw Error('down');})).status,'PRICE_UNAVAILABLE');
 const reference=buildReference(null);assert.equal(reference.get('INE009A01021')!.symbol,'INFY');assert.equal(reference.get('INFY')!.industry,'Information Technology');assert.equal(reference.get('INFY')!.supportedFiling,null);
 const seen:string[]=[];const prices=await priceHoldings([holding(null,1,'INE009A01021'),holding('INFY',1),holding('ZZZ',1),holding(null,1,'INE999Z99999')],reference,{observe:async s=>{seen.push(s);return observed(1);}});
 assert.deepEqual(seen.sort(),['INFY','ZZZ']);assert.equal(prices.size,2);assert.equal(NIFTY50_UNIVERSE.members.every(m=>!!m.industry),true);
});
test('report shows check results, reasons and the binding answer',()=>{
 const fit=assessPortfolioFit({holdings:[holding('A',1),holding('ZZZ',1)],prices:new Map([['A',observed(10)]]),reference:ref,limits});
 const html=renderToStaticMarkup(createElement(FitReport,{fit}));assert.match(html,/Outside your limits/,'a proven breach outranks unknown checks');assert.match(html,/unpriced holdings/);assert.match(html,/No usable price for ZZZ/);assert.match(html,/Unclassified/);assert.match(html,/badge-red/);
 const profile=renderToStaticMarkup(createElement(RiskProfileResult,{result:assessRiskProfile({...all(2),horizon:0})}));assert.match(profile,/Conservative/);assert.match(profile,/most cautious/);
});

// A minimal real .xlsx (inline strings) with broker-style account rows above the header and a blank row.
const xlsx=async(rows:(string|number|null)[][])=>{
 const {zipSync,strToU8}=await import('fflate');
 const col=(i:number)=>String.fromCharCode(65+i);
 const cell=(v:string|number|null,ref:string)=>v===null?'':typeof v==='number'?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;
 const sheet=`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r,i)=>r.length?`<row r="${i+1}">${r.map((v,j)=>cell(v,col(j)+(i+1))).join('')}</row>`:'').join('')}</sheetData></worksheet>`;
 return Buffer.from(zipSync({
  '[Content_Types].xml':strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
  '_rels/.rels':strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
  'xl/workbook.xml':strToU8('<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Equity" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  'xl/_rels/workbook.xml.rels':strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
  'xl/worksheets/sheet1.xml':strToU8(sheet),
 }));
};
test('Excel holdings: header found below account rows, numbers kept, row numbers reported',async()=>{
 const {readSheet}=await import('read-excel-file/node');const {importHoldingsSheet,importHoldingsRows,HEADER_SCAN_ROWS}=await import('../shared/holdingsImport.js');
 const file=await xlsx([['Client ID','AB1234'],['Statement','Equity holdings'],[],['Symbol','ISIN','Quantity Available','Average Price'],['INFY','INE009A01021',10,1450.5],['TCS',null,'x',3200],['INFY','INE009A01021',5,1500]]);
 const r=importHoldingsSheet(await readSheet(file));
 assert.equal(r.headerLine,4);assert.deepEqual(r.skipped,[{line:6,reason:'INVALID_QUANTITY'}]);
 assert.deepEqual(r.holdings.map((h:any)=>[h.symbol,h.isin,h.quantity,h.lines]),[['INFY','INE009A01021',15,[5,7]]]);
 assert(Math.abs(r.holdings[0].averagePrice-(1450.5*10+1500*5)/15)<1e-9);
 assert.deepEqual(r.coverage,{rows:3,imported:1,mergedRows:1,skipped:1});
 // Dates are not read as quantities; a header beyond the scanned rows is not found.
 assert.equal(importHoldingsSheet([['Symbol','Qty'],['INFY',new Date('2026-01-01')]]).skipped[0].reason,'INVALID_QUANTITY');
 assert.throws(()=>importHoldingsRows([...Array.from({length:HEADER_SCAN_ROWS},(_,i)=>({line:i+1,cells:['note']})),{line:HEADER_SCAN_ROWS+1,cells:['Symbol','Qty']}]),/header row/);
 assert.throws(()=>importHoldingsSheet('x' as any),TypeError);
});
