import {allowRequest} from '../server/pushBackend.js';
import {analyzeStock} from '../server/stockAnalysis.js';
import {createSpecPaperMarket} from '../server/specPaperMarket.js';
import {getTradingInstruments} from '../server/upstoxReadOnly.js';
import {fundamentalsStore} from '../server/fundamentalsStore.js';
import {signalStore} from '../server/signalStore.js';
import {createDeliveryReader} from '../server/marketIntel.js';
import {scorecardsCache} from './_scorecards.js';
const CACHE_MS=300000;
// GET ?symbol=INFY (NSE symbol, or NIFTY / BANKNIFTY): the full analysis, cached for five minutes.
export function createStockAnalysisHandler({market=createSpecPaperMarket(),master=getTradingInstruments,fundamentals=fundamentalsStore,signals=signalStore,scorecards=()=>scorecardsCache('NIFTY50'),delivery=createDeliveryReader(),now=Date.now,fetcher=fetch}={}){
 const cache=new Map(),inflight=new Map();
 return async(req,res)=>{
  if(!allowRequest(req,res))return;
  if(req.method!=='GET')return res.status(405).json({error:'GET required'});
  const q=req.query??{},symbol=typeof q.symbol==='string'?q.symbol.trim().toUpperCase():'';
  if(Object.keys(q).some(k=>k!=='symbol')||!/^[A-Z0-9&-]{1,30}$/.test(symbol))return res.status(400).json({error:'One NSE symbol is required, for example ?symbol=INFY'});
  const hit=cache.get(symbol);if(hit&&now()-hit.at<CACHE_MS)return res.status(200).json(hit.data);
  if(!inflight.has(symbol)){
   if(inflight.size>=4)return res.status(503).json({error:'Analysis busy; retry in a moment'});
   const lazy=(f)=>{let s;return new Proxy({},{get:(_,k)=>(...a)=>(s??=f())[k](...a)});};
   inflight.set(symbol,analyzeStock(symbol,{market,master,fundamentals:lazy(fundamentals),signals:lazy(signals),scorecards,delivery,now,fetcher}).then(data=>{if(data.status==='OK'){if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(symbol,{at:now(),data});}return data;}).finally(()=>inflight.delete(symbol)));
  }
  try{const data=await inflight.get(symbol);return res.status(data.status==='NOT_FOUND'?404:200).json(data);}
  catch{return res.status(503).json({error:'Market data unavailable (instrument list or price source). No analysis was generated.'});}
 };
}
export default createStockAnalysisHandler();
