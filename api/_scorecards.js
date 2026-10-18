import {allowRequest} from '../server/pushBackend.js';
import {fundamentalsStore,FUNDAMENTAL_READ_LIMIT} from '../server/fundamentalsStore.js';
import {deriveFundamentals} from '../server/fundamentals.js';
import {createDailyBarsReader,latestClose,priceFacts} from '../server/dailyClose.js';
import {MarketDataError} from '../server/upstoxReadOnly.js';
import {scoreUniverse} from '../server/scorecards.js';
import {NIFTY50_UNIVERSE} from '../shared/universes.js';
export const UNIVERSES={NIFTY50:NIFTY50_UNIVERSE};
const CACHE_MS=600000;
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await fn(items[i]);}}));return out;}

// Scores are derived on read from stored filings and one year of completed daily bars per company.
export async function buildScorecards(universe,{store,bars,now}){
 const asOf=now(),db=store();
 const companies=await mapLimit(universe.members,8,async m=>{
  const key='NSE_EQ|'+m.isin;
  const [rows,history]=await Promise.all([db.forInstrument(key),bars(key,asOf,380).catch(e=>({status:'UNAVAILABLE',reason:e instanceof MarketDataError?e.code:'PRICE_SOURCE_FAILED'}))]);
  const close=history.status==='OBSERVED'?latestClose(history):history;
  const fundamentals=deriveFundamentals(rows.map(r=>r.filing),{instrumentKey:key,asOf,price:close,truncated:rows.length>=FUNDAMENTAL_READ_LIMIT});
  return {symbol:m.symbol,isin:m.isin,instrumentKey:key,fundamentals,price:priceFacts(history,asOf)};
 });
 const scored=scoreUniverse(companies);
 return {universe:{name:universe.name,asOf:universe.asOf,source:universe.source},computedAt:new Date(asOf).toISOString(),...scored,
  coverage:{companies:companies.length,withAnnualPeriod:scored.companies.filter(c=>c.basis).length,withPrice:companies.filter(c=>c.price.status==='OBSERVED').length,truncatedFilingReads:companies.filter(c=>c.fundamentals.coverage.truncated).length},
  limitations:['Banks, NBFCs and insurers use a filing format that is not parsed, so they have no scores.','Integrated NSE filings start with FY2025: 3- and 5-year growth and PEG stay unavailable until more years are stored.','Universe membership is the NSE list on its asOf date, applied to the current period only.','Price criteria need the Upstox read token; windows with a daily move above 35% are excluded as possible unadjusted corporate actions.']};
}
// One cache per process, shared by the scorecards route and stock analysis.
export function createScorecardsCache({store=fundamentalsStore,bars=createDailyBarsReader(),now=Date.now}={}){
 const cache=new Map(),inflight=new Map();
 return id=>{
  const hit=cache.get(id);if(hit&&now()-hit.at<CACHE_MS)return Promise.resolve(hit.data);
  if(!inflight.has(id))inflight.set(id,buildScorecards(UNIVERSES[id],{store,bars,now}).then(data=>{cache.set(id,{at:now(),data});return data;}).finally(()=>inflight.delete(id)));
  return inflight.get(id);
 };
}
export const scorecardsCache=createScorecardsCache();
export function createScorecardsHandler({store=fundamentalsStore,bars=createDailyBarsReader(),now=Date.now,cached=store===fundamentalsStore&&now===Date.now?scorecardsCache:createScorecardsCache({store,bars,now})}={}){
 return async(req,res)=>{
  if(!allowRequest(req,res))return;
  if(req.method!=='GET')return res.status(405).json({error:'GET required'});
  const query=req.query||{},id=query.universe;
  if(Object.keys(query).some(k=>k!=='universe')||typeof id!=='string'||!Object.hasOwn(UNIVERSES,id))return res.status(400).json({error:'universe must be one of: '+Object.keys(UNIVERSES).join(', ')});
  try{return res.status(200).json(await cached(id));}
  catch{return res.status(503).json({error:'Fundamentals storage unavailable. Check the fundamental-filings migration and server connection. No scores were generated.'});}
 };
}
export default createScorecardsHandler();
