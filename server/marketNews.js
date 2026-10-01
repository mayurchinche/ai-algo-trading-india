import { XMLParser, XMLValidator } from 'fast-xml-parser';

const MAX_BYTES = 1_000_000;
const DAY = 86_400_000;
const parser = new XMLParser({ignoreAttributes:false, processEntities:true, trimValues:true});
export function newsQuery(value = '') {
  if (typeof value !== 'string' || value.length > 100 || (/[<>]/.test(value) || [...value].some(char=>char.charCodeAt(0)<32))) throw new Error('Search must contain at most 100 plain-text characters');
  return value.trim().replace(/\s+/g, ' ');
}
function plain(value) { return (typeof value === 'string' ? value : value?.['#text'] ?? '').toString().replace(/<[^>]*>/g, '').trim(); }
function safeLink(value) {
  try { const url=new URL(value); return url.protocol==='https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function headlineTone(title) {
  // Transparent headline-only heuristic, never used as a trade/entry score.
  const positive = /\b(rall(?:y|ies)|surge[sd]?|gain[sd]?|rise[sn]?|record high|upgrade[sd]?|profit growth)\b/i.test(title);
  const negative = /\b(fall[sn]?|drop[sp]?|crash(?:es|ed)?|slip[sp]?|plunge[sd]?|loss(?:es)?|downgrade[sd]?|fraud|slump[sd]?)\b/i.test(title);
  if (/\b(not|no|may|could|unlikely|expected|defy|despite)\b/i.test(title) || positive === negative) return 'unclear';
  return positive ? 'positive' : 'negative';
}
export function parseNews(xml, now = Date.now()) {
  if (typeof xml !== 'string' || Buffer.byteLength(xml) > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml)!==true) throw new Error('Invalid news response');
  const root=parser.parse(xml);
  if (!root.rss?.channel) throw new Error('Invalid news feed');
  const items=root.rss.channel.item ?? [];
  const seen=new Set();
  return (Array.isArray(items)?items:[items]).flatMap(item=>{
    const title=plain(item.title).slice(0,500), source=plain(item.source).slice(0,120);
    const url=safeLink(plain(item.link)), timestamp=Date.parse(plain(item.pubDate));
    const fingerprint=title.toLowerCase().replace(/[^a-z0-9]/g,'');
    if(!title || !source || !url || !Number.isFinite(timestamp) || timestamp>now+60_000 || now-timestamp>7*DAY || seen.has(fingerprint) || seen.has(url)) return [];
    seen.add(fingerprint);seen.add(url);
    return [{title,source,url,publishedAt:new Date(timestamp).toISOString(),tone:headlineTone(title),fresh:now-timestamp<=DAY}];
  }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,50);
}
export function summarizeNews(articles) {
  const fresh=articles.filter(a=>a.fresh), publishers=new Set(fresh.map(a=>a.source.toLowerCase())).size;
  const counts={positive:0,negative:0,unclear:0};
  for(const item of fresh) counts[item.tone]++;
  return {status:fresh.length>=3 && publishers>=2?'available':'insufficient_evidence',sampleSize:fresh.length,publishers,counts,method:'Headline keyword counts over the last 24 hours. Not full-article analysis, overall market sentiment, or a trading signal.'};
}
export async function fetchNews(query, {fetcher=fetch,now=Date.now()}={}) {
  const q=newsQuery(query);
  const url=new URL('https://news.google.com/rss/search');
  url.search=new URLSearchParams({q:`${q ? '"'+q.replace(/["\\]/g,' ')+'" India' : 'India stock market NSE BSE'} when:1d`,hl:'en-IN',gl:'IN',ceid:'IN:en'}).toString();
  const response=await fetcher(url,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/rss+xml, application/xml'}});
  if(!response.ok) throw new Error(response.status===429?'News source rate-limited; retry later':'News source unavailable');
  if(Number(response.headers.get('content-length'))>MAX_BYTES) throw new Error('News response too large');
  const reader=response.body?.getReader();
  if(!reader) throw new Error('News response missing');
  const chunks=[];let total=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_BYTES)throw new Error('News response too large');chunks.push(value);} }
  finally {await reader.cancel().catch(()=>{});}
  const articles=parseNews(Buffer.concat(chunks).toString('utf8'),now);
  return {query:q,receivedAt:new Date(now).toISOString(),source:'Google News RSS index',status:articles.length?'available':'no_results',articles,summary:summarizeNews(articles)};
}
