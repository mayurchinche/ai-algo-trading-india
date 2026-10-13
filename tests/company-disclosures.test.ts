import test from 'node:test';import assert from 'node:assert/strict';
import {disclosureTime,parseDisclosures,parseOrderDisclosure,createDisclosureReader,DISCLOSURE_FEED} from '../server/companyDisclosures.js';
import {createDisclosureHandler} from '../api/company-disclosures.js';
const now=Date.parse('2026-10-04T06:30:00Z');
const item=(description='Test Company Limited received an award letter',url='https://nsearchives.nseindia.com/corporate/xbrl/test.xml',date='04-Oct-2026 10:27:35')=>`<item><title>Test Company Limited</title><link>${url}</link><description>${description}</description><pubDate>${date}</pubDate></item>`;
const feed=(items:string)=>`<rss><channel><title>NSE News - Latest Announcements</title>${items}</channel></rss>`;
const doc=`<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:in-capmkt="http://www.sebi.gov.in/xbrl/test"><xbrli:context id="MainI"><xbrli:entity><xbrli:identifier>12345</xbrli:identifier></xbrli:entity></xbrli:context><xbrli:unit id="INR"><xbrli:measure>iso4217:INR</xbrli:measure></xbrli:unit><in-capmkt:NSESymbol contextRef="MainI">TEST</in-capmkt:NSESymbol><in-capmkt:ISIN contextRef="MainI">INE000A01010</in-capmkt:ISIN><in-capmkt:NameOfTheCompany contextRef="MainI">Test Company</in-capmkt:NameOfTheCompany><in-capmkt:SubTypeOfEventAsPerRegulation30ParaBOfPartAOfScheduleIII contextRef="MainI">Bagging/Receiving of orders/contracts</in-capmkt:SubTypeOfEventAsPerRegulation30ParaBOfPartAOfScheduleIII><in-capmkt:NameOfTheEntityAwardingTheOrdersOrContracts contextRef="MainI">Fixture customer</in-capmkt:NameOfTheEntityAwardingTheOrdersOrContracts><in-capmkt:AmountOfTheOrdersOrContracts contextRef="MainI" unitRef="INR">1234</in-capmkt:AmountOfTheOrdersOrContracts></xbrli:xbrl>`;
test('NSE timestamps are interpreted as IST and invalid dates fail',()=>{assert.equal(disclosureTime('04-Oct-2026 10:27:35'),'2026-10-04T04:57:35.000Z');assert.equal(disclosureTime('31-Feb-2026 10:27:35'),null);assert.equal(disclosureTime('04-Oct-2026 25:27:35'),null);});
test('official RSS parsing keeps source timing, deduplicates and rejects unsafe or future entries',()=>{
 const r=parseDisclosures(feed(item()+item()+item('unsafe','https://evil.test/a.xml')+item('future',undefined,'05-Oct-2026 10:27:35')),now);
 assert.equal(r.items.length,1);assert.equal(r.coverage.rejected,2);assert.deepEqual(r.items[0].tags,['orders']);assert.equal(r.items[0].verification,'DISCLOSURE_INDEX_ONLY');assert.equal(r.sourceHash.length,64);
 assert.equal(parseDisclosures(feed(item('Actions initiated/taken or orders passed by regulator')),now).items[0].tags.includes('orders'),false);
});
test('malformed and entity-bearing XML cannot masquerade as empty feed',()=>{for(const body of ['<html>blocked</html>','<!DOCTYPE rss><rss/>','x'.repeat(1000001)])assert.throws(()=>parseDisclosures(body,now));assert.equal(parseDisclosures(feed(''),now).status,'EMPTY_FEED');});
test('structured document reports values without treating omitted metrics as zero or verified',()=>{
 const r=parseOrderDisclosure(doc,parseDisclosures(feed(item()),now).items[0],now);
 assert.equal(r.instrumentKey,'NSE_EQ|INE000A01010');assert.equal(r.status,'EXTRACTED_REQUIRES_REVIEW');assert.equal(r.reported.find((f:any)=>f.key==='customer').value,'Fixture customer');assert.equal(r.reported.find((f:any)=>f.key==='execution').value,null);assert.equal(r.documentHash.length,64);
 assert.throws(()=>parseOrderDisclosure(doc.replace('Bagging/Receiving of orders/contracts','Termination of contracts'),parseDisclosures(feed(item()),now).items[0],now));
});
test('reader only fetches documents in current feed, caches observations without rewriting receipt time',async()=>{
 const calls:string[]=[];let tick=now;const reader=createDisclosureReader({clock:()=>tick,fetcher:async(url:string)=>{calls.push(url);return new Response(url===DISCLOSURE_FEED?feed(item()):doc);}});
 const first=await reader.feed();tick+=1000;assert.deepEqual(await reader.feed(),first);await assert.rejects(reader.document('bad'));assert.equal(calls.length,1);
 await reader.document(first.items[0].id);await reader.document(first.items[0].id);assert.equal(calls.length,2);
});
test('API rejects arbitrary URLs and returns unavailable on source failure',async()=>{
 const handler=createDisclosureHandler({feed:async()=>{throw Error('provider details');},document:async()=>({})});
 const response=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}});
 const bad=response();await handler({method:'GET',headers:{host:'test'},query:{url:'https://evil.test'}},bad);assert.equal(bad.code,400);
 const failed=response();await handler({method:'GET',headers:{host:'test'},query:{}},failed);assert.equal(failed.code,503);assert(!failed.body.error.includes('provider details'));
});

test('ambiguous duplicate fields and missing currency definitions remain unavailable',()=>{
 const source=parseDisclosures(feed(item()),now).items[0];
 const duplicate=doc.replace('</xbrli:xbrl>','<in-capmkt:AmountOfTheOrdersOrContracts contextRef="MainI" unitRef="INR">999</in-capmkt:AmountOfTheOrdersOrContracts></xbrli:xbrl>');
 assert.equal(parseOrderDisclosure(duplicate,source,now).reported.find((f:any)=>f.key==='amount').value,null);
 assert.equal(parseOrderDisclosure(doc.replace('iso4217:INR','unknown'),source,now).reported.find((f:any)=>f.key==='amount').value,null);
});
