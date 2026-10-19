import {allowRequest} from '../server/pushBackend.js';
import {readPreOpen,readRecentAnnouncements,buildGapBoard,GAPS_VERSION} from '../server/openingGaps.js';
import {createSpecPaperMarket} from '../server/specPaperMarket.js';
import {getTradingInstruments} from '../server/upstoxReadOnly.js';
import {signalStore} from '../server/signalStore.js';
import {summarizeSignals} from '../server/signalEngine.js';
import {strategyBoard} from './_automation.js';
import {scorecardsCache} from './_scorecards.js';
const CACHE_MS=60000,GAP_STRATEGIES=['short-term-gap-continuation','intraday-gap-and-go','intraday-gap-fade'];
const istMinute=ms=>{const d=new Date(ms+19800000);return d.getUTCHours()*60+d.getUTCMinutes();};
const soft=async f=>{try{return await f();}catch{return null;}};
// GET: today's opening gaps from the NSE pre-open session with catalysts, rule context and live status.
export function createOpeningGapsHandler({market=createSpecPaperMarket(),master=getTradingInstruments,signals=signalStore,board=strategyBoard,scorecards=()=>scorecardsCache('NIFTY50'),now=Date.now,fetcher=fetch}={}){
 let cache=null,inflight=null;
 const build=async()=>{
  const at=now(),rows=await readPreOpen({fetcher});
  const [ann,brd,vals,cards]=await Promise.all([soft(()=>readRecentAnnouncements(at,{fetcher})),soft(()=>board.read()),soft(()=>signals().validations()),soft(scorecards)]);
  let quotes=new Map();const m=istMinute(at);
  if(m>=555&&m<=930){const keys=await soft(async()=>{const eq=new Map((await master()).filter(r=>r.segment==='NSE_EQ'&&r.instrument_type==='EQ').map(r=>[r.trading_symbol,r.instrument_key]));return rows.filter(r=>Math.abs(r.gapPct)>=1).sort((a,b)=>Math.abs(b.gapPct)-Math.abs(a.gapPct)).slice(0,40).map(r=>[r.symbol,eq.get(r.symbol)]).filter(([,k])=>k);});
   if(keys?.length){const q=await soft(()=>market.quotes(keys.map(([,k])=>k),at));if(q)quotes=new Map(keys.map(([sym,k])=>[sym,q.get(k)]).filter(([,v])=>v));}}
  const strategies=summarizeSignals([],vals??[],at).strategies.filter(s=>GAP_STRATEGIES.includes(s.id));
  return {version:GAPS_VERSION,computedAt:new Date(at).toISOString(),preOpenUpdatedAt:rows.find(r=>r.updatedAt)?.updatedAt??null,
   summary:{stocks:rows.length,gapUp:rows.filter(r=>r.gapPct>=1).length,gapDown:rows.filter(r=>r.gapPct<=-1).length,flat:rows.filter(r=>Math.abs(r.gapPct)<1).length},
   rows:buildGapBoard(rows,{quotes,board:brd?.rows??[],validations:vals??[],scorecards:cards?.companies??[],announcements:ann??new Map()}),
   strategies,sources:{preOpen:'NSE pre-open (F&O stocks)',announcements:ann?'NSE corporate announcements since the previous session':'unavailable',live:quotes.size?'Upstox full quote':'not in session'},
   limitations:['The gap is the pre-open indicative equilibrium price (IEP) against the previous close; the actual open can differ.','Pre-open covers F&O stocks only.','A catalyst is any exchange announcement since the previous session; its content is not interpreted.']};
 };
 return async(req,res)=>{
  if(!allowRequest(req,res))return;
  if(req.method!=='GET')return res.status(405).json({error:'GET required'});
  if(Object.keys(req.query??{}).length)return res.status(400).json({error:'No query parameters are accepted'});
  if(cache&&now()-cache.at<CACHE_MS)return res.status(200).json(cache.data);
  inflight??=build().then(data=>{cache={at:now(),data};return data;}).finally(()=>{inflight=null;});
  try{return res.status(200).json(await inflight);}catch{return res.status(503).json({error:'NSE pre-open data unavailable right now. No gap list was generated.'});}
 };
}
export default createOpeningGapsHandler();
