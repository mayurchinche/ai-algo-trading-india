import {parseFinancialDisclosure} from './financialStatements.js';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {createHash} from 'node:crypto';
export const DISCLOSURE_FEED='https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml';
const FEEDS={announcements:DISCLOSURE_FEED,financials:'https://nsearchives.nseindia.com/content/RSS/Integrated_Filing_Financials.xml'};
const sha=value=>createHash('sha256').update(value).digest('hex');
const parser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,trimValues:true});
const plain=v=>typeof v==='string'?v:typeof v?.['#text']==='string'?v['#text']:'';
const clean=v=>plain(v).replace(/<[^>]*>/g,'').slice(0,3000);
function xml(body){if(typeof body!=='string'||Buffer.byteLength(body)>1000000||/<!DOCTYPE|<!ENTITY/i.test(body)||XMLValidator.validate(body)!==true)throw Error('Invalid disclosure XML');return parser.parse(body);}
function link(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='nsearchives.nseindia.com'&&!u.username&&!u.password&&!u.port&&/^\/corporate\/(?:xbrl\/)?[A-Za-z0-9_.%-]+\.(?:pdf|xml)$/i.test(u.pathname)&&!u.search&&!u.hash?u.href:null;}catch{return null;}}
export function disclosureTime(value){
 const match=/^(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value||'');if(!match)return null;
 const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[2]);if(month<0)return null;
 const iso=`${match[3]}-${String(month+1).padStart(2,'0')}-${match[1]}T${match[4]}:${match[5]}:${match[6]}+05:30`,ms=Date.parse(iso);
 if(!Number.isFinite(ms)||new Date(ms+19800000).toISOString().slice(0,19)!==iso.slice(0,19))return null;
 return new Date(ms).toISOString();
}
export function parseDisclosures(body,now,kind='announcements'){
 if(!Object.hasOwn(FEEDS,kind))throw Error('Unsupported feed');
 const channel=xml(body).rss?.channel;if(!channel||!clean(channel.title).startsWith('NSE News'))throw Error('Unexpected disclosure feed');
 const raw=channel.item===undefined?[]:Array.isArray(channel.item)?channel.item:[channel.item];
 const seen=new Set();let rejected=0;
 const items=raw.flatMap(row=>{
  const url=link(plain(row.link)),publishedAt=disclosureTime(plain(row.pubDate)),company=clean(row.title),summary=clean(row.description);
  if(!url||!company||!publishedAt||Date.parse(publishedAt)>now||now-Date.parse(publishedAt)>30*86400000){rejected++;return [];}
  const id=sha(url+'|'+publishedAt);if(seen.has(id))return [];seen.add(id);
  const tags=kind==='financials'?['financials']:[];
  if(/\b(export|international|overseas|foreign|tariff|currency)\b/i.test(summary))tags.push('global');
  if(/\b(contracts?|order book|award letter|bagging|receiving of orders)\b/i.test(summary))tags.push('orders');
  if(/\b(auditor|director|management|promoter|esop|allotment|fund raising|related party|resignation|actions initiated|regulatory)\b/i.test(summary))tags.push('management');
  return [{id,company,summary,url,publishedAt,observedAt:new Date(now).toISOString(),tags,format:url.endsWith('.xml')?'XML':'PDF',verification:'DISCLOSURE_INDEX_ONLY'}];
 }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 return {source:FEEDS[kind],receivedAt:new Date(now).toISOString(),sourceHash:sha(body),status:items.length?'AVAILABLE':raw.length?'NO_VALID_ITEMS':'EMPTY_FEED',coverage:{received:raw.length,rejected,returned:Math.min(items.length,50),truncated:items.length>50},items:items.slice(0,50),limitations:['Latest rolling exchange feed, not a historical or exhaustive company archive.','Tags describe text topics, not positive sentiment or verified investment facts.','No match does not establish that a company has no orders or governance issues.']};
}
const fields=[['customer','NameOfTheEntityAwardingTheOrdersOrContracts'],['geography','WhetherOrdersOrContractsIsAwardedByDomesticOrInternationalEntity'],['amount','AmountOfTheOrdersOrContracts'],['terms','SignificantTermsAndConditionsOfOrdersOrContractsIsAwarded'],['execution','TimePeriodByWhichTheOrdersOrContractsIsToBeExecuted'],['relatedParty','WhetherTheOrderOrContractWouldFallWithinRelatedPartyTransactions']];
export function parseOrderDisclosure(body,item,now){
 const root=xml(body).xbrl;if(!root)throw Error('Unsupported document');
 const symbol=plain(root.NSESymbol),isin=plain(root.ISIN),name=plain(root.NameOfTheCompany);
 if(!/^[A-Z0-9&-]{1,30}$/.test(symbol)||!/^INE[A-Z0-9]{9}$/.test(isin)||!name)throw Error('Issuer identity unavailable');
 const subtype=plain(root.SubTypeOfEventAsPerRegulation30ParaBOfPartAOfScheduleIII);
 if(subtype!=='Bagging/Receiving of orders/contracts')throw Error('This disclosure needs manual document review');
 const contexts=Array.isArray(root.context)?root.context:[root.context];
 const issuer=contexts.find(c=>c?.['@_id']===root.ISIN?.['@_contextRef']);
 if(!issuer||!plain(issuer.entity?.identifier))throw Error('Issuer context unavailable');
 const units=Array.isArray(root.unit)?root.unit:[root.unit];
 const reported=fields.map(([key,tag])=>{
  const value=root[tag];if(!value||Array.isArray(value)||!plain(value))return {key,value:null,status:'NOT_UNAMBIGUOUSLY_REPORTED'};
  const context=contexts.find(c=>c?.['@_id']===value['@_contextRef']);
  if(!context||plain(context.entity?.identifier)!==plain(issuer.entity?.identifier))return {key,value:null,status:'CONTEXT_MISMATCH'};
  if(key==='amount'){const unit=units.find(u=>u?.['@_id']===value['@_unitRef']);if(!unit||!/^iso4217:[A-Z]{3}$/.test(plain(unit.measure))||!/^\d+(?:\.\d+)?$/.test(plain(value)))return {key,value:null,status:'AMOUNT_OR_CURRENCY_UNVERIFIED'};}
  return {key,value:plain(value).slice(0,4000),unitRef:key==='amount'?plain(units.find(u=>u?.['@_id']===value['@_unitRef']).measure).split(':')[1]:null,contextId:value['@_contextRef'],status:'ISSUER_REPORTED'};
 });
 return {id:item.id,symbol,instrumentKey:'NSE_EQ|'+isin,company:name,url:item.url,publishedAt:item.publishedAt,observedAt:new Date(now).toISOString(),documentHash:sha(body),subtype,reported,status:'EXTRACTED_REQUIRES_REVIEW',note:'Issuer-reported fields only. Contract value is not revenue, profit or the total outstanding order book. No facts or trade approval were created.'};
}
async function readPublic(url,fetcher){
 const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Disclosure source unavailable');
 const reader=r.body?.getReader();if(!reader)throw Error('Empty response');const chunks=[];let bytes=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1000000)throw Error('Disclosure too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks).toString('utf8');
}
export function createDisclosureReader({fetcher=fetch,clock=Date.now,kind='announcements'}={}){
 if(!Object.hasOwn(FEEDS,kind))throw Error('Unsupported feed');
 let cached,pending;const documents=new Map(),inflight=new Map();
 async function feed(){if(cached&&clock()-Date.parse(cached.receivedAt)<300000)return cached;if(!pending)pending=readPublic(FEEDS[kind],fetcher).then(body=>(cached=parseDisclosures(body,clock(),kind))).finally(()=>{pending=null;});return pending;}
 async function document(id){
  const current=await feed(),item=current.items.find(item=>item.id===id);if(!item||item.format!=='XML')throw Error('Document not in current XML feed');
  const hit=documents.get(id);if(hit&&clock()-Date.parse(hit.observedAt)<300000)return hit;
  if(!inflight.has(id)){if(inflight.size>=4)throw Error('Disclosure reader busy');inflight.set(id,readPublic(item.url,fetcher).then(body=>{const result=(kind==='financials'?parseFinancialDisclosure:parseOrderDisclosure)(body,item,clock());if(documents.size>=50)documents.delete(documents.keys().next().value);documents.set(id,result);return result;}).finally(()=>inflight.delete(id)));}
  return inflight.get(id);
 }
 return {feed,document};
}
export const disclosureReader=createDisclosureReader();

export const financialDisclosureReader=createDisclosureReader({kind:'financials'});
