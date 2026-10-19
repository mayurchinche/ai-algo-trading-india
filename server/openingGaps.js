// Opening gaps: NSE pre-open session data (09:00–09:08 IST) for F&O stocks, enriched with the context a gap
// trader checks: catalyst (exchange announcements since the previous session), technical position, peer
// rank, where validated rules stand, and after 09:15 whether the gap is holding or filling.
import {nseDate} from './marketIntel.js';
export const GAPS_VERSION='opening-gaps-v1';
export const PREOPEN_URL='https://www.nseindia.com/api/market-data-pre-open?key=FO';
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};
async function json(fetcher,url,max){
 const r=await fetcher(url,{headers:{'User-Agent':UA,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Object.assign(new Error('nse'),{code:'NSE_UNAVAILABLE'});
 const b=Buffer.from(await r.arrayBuffer());if(b.length>max)throw Object.assign(new Error('large'),{code:'NSE_RESPONSE_TOO_LARGE'});
 return JSON.parse(b.toString('utf8'));
}
// Pre-open rows: indicative equilibrium price (IEP) against the previous close, plus order imbalance.
export function parsePreOpen(body){
 if(!Array.isArray(body?.data))throw Object.assign(new Error('format'),{code:'PREOPEN_FORMAT_CHANGED'});
 return body.data.map(r=>{const m=r.metadata??{},d=r.detail?.preOpenMarket??{},buy=n(d.totalBuyQuantity),sell=n(d.totalSellQuantity);
  return {symbol:m.symbol,prevClose:n(m.previousClose),iep:n(m.iep??d.IEP),gapPct:n(m.pChange),preOpenQty:n(m.finalQuantity),turnover:n(m.totalTurnover),
   buyQty:buy,sellQty:sell,imbalance:buy!==null&&sell!==null&&buy+sell>0?(buy-sell)/(buy+sell):null,yearHigh:n(m.yearHigh),yearLow:n(m.yearLow),updatedAt:d.lastUpdateTime??null};})
  .filter(r=>typeof r.symbol==='string'&&/^[A-Z0-9&-]{1,30}$/.test(r.symbol)&&r.prevClose>0&&r.iep>0&&r.gapPct!==null);
}
export const readPreOpen=async({fetcher=fetch}={})=>parsePreOpen(await json(fetcher,PREOPEN_URL,5e6));
const ddmmyyyy=ms=>{const d=new Date(ms+19800000).toISOString().slice(0,10);return `${d.slice(8,10)}-${d.slice(5,7)}-${d.slice(0,4)}`;};
// Exchange announcements for all companies since the previous weekday: the usual source of an overnight gap.
export async function readRecentAnnouncements(now,{fetcher=fetch}={}){
 let from=now-86400000;while([0,6].includes(new Date(from+19800000).getUTCDay()))from-=86400000;
 const rows=await json(fetcher,`https://www.nseindia.com/api/corporate-announcements?index=equities&from_date=${ddmmyyyy(from)}&to_date=${ddmmyyyy(now)}`,8e6);
 if(!Array.isArray(rows))throw Object.assign(new Error('format'),{code:'ANNOUNCEMENTS_FORMAT_CHANGED'});
 const by=new Map();for(const a of rows){if(typeof a.symbol!=='string')continue;if(!by.has(a.symbol))by.set(a.symbol,[]);const l=by.get(a.symbol);if(l.length<3)l.push({time:a.an_dt??null,date:nseDate(String(a.an_dt??'').slice(0,11)),subject:String(a.desc??''),text:String(a.attchmntText??'').slice(0,240),url:typeof a.attchmntFile==='string'&&a.attchmntFile.startsWith('https://nsearchives.nseindia.com/')?a.attchmntFile:null});}
 return by;
}
// rows: parsed pre-open; ctx: {quotes Map symbol→{price,open,high,low}, board rows, validations, scorecards companies, announcements Map}.
export function buildGapBoard(rows,{quotes=new Map(),board=[],validations=[],scorecards=[],announcements=new Map(),minGapPct=1,limit=40}={}){
 const gappers=rows.filter(r=>Math.abs(r.gapPct)>=minGapPct).sort((a,b)=>Math.abs(b.gapPct)-Math.abs(a.gapPct)).slice(0,limit);
 return gappers.map(r=>{
  const q=quotes.get(r.symbol)??null,card=scorecards.find(c=>c.symbol===r.symbol);
  const open=q?.open??null,ltp=q?.price??null,up=r.gapPct>0;
  // After the open: a gap "holds" while price stays beyond the previous close on the gap side and "fills" once it returns there.
  const status=ltp===null?'PRE_OPEN':(up?ltp<=r.prevClose:ltp>=r.prevClose)?'FILLED':(up?ltp>=open:ltp<=open)?'EXTENDING':'HOLDING';
  return {...r,direction:up?'UP':'DOWN',open,ltp,fromOpenPct:ltp!==null&&open?(ltp/open-1)*100:null,status,
   nearYearHigh:r.yearHigh?(1-r.iep/r.yearHigh)*100:null,aboveYearHighPreOpen:r.yearHigh?r.iep>r.yearHigh:null,
   catalyst:announcements.get(r.symbol)??[],
   rules:board.filter(b=>b.symbol===r.symbol).map(b=>({strategyId:b.strategyId,strategyName:b.strategyName,state:b.state,trigger:b.trigger??null,since:b.since??null})),
   validated:validations.filter(v=>v.symbol===r.symbol&&v.verdict==='VALIDATED').map(v=>v.strategy_id),
   composite:card?.composite?.status==='SCORED'?card.composite.score:null};
 });
}
