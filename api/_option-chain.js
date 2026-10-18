import {allowRequest} from '../server/pushBackend.js';
import {createOptionChainReader,OPTION_UNDERLYINGS,RELATIVE_EXPIRIES} from '../server/optionChain.js';
import {MarketDataError} from '../server/upstoxReadOnly.js';
const CACHE_MS=60000;
export function createOptionChainHandler({reader=createOptionChainReader(),now=Date.now}={}){
 const cache=new Map();
 return async(req,res)=>{
  if(!allowRequest(req,res))return;
  if(req.method!=='GET')return res.status(405).json({error:'GET required'});
  const q=req.query||{};
  if(Object.keys(q).some(k=>!['underlying','expiry','rate'].includes(k))||typeof q.underlying!=='string'||typeof q.expiry!=='string')return res.status(400).json({error:`underlying (${Object.keys(OPTION_UNDERLYINGS).join(', ')} or NSE_EQ|ISIN) and expiry (${Object.keys(RELATIVE_EXPIRIES).join(', ')} or YYYY-MM-DD) are required`});
  const rate=q.rate===undefined?undefined:Number(q.rate);
  const key=JSON.stringify([q.underlying,q.expiry,rate??null]),hit=cache.get(key);
  if(hit&&now()-hit.at<CACHE_MS)return res.status(200).json(hit.data);
  try{const data=await reader({underlying:q.underlying,expiry:q.expiry,rate});if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(key,{at:now(),data});return res.status(200).json(data);}
  catch(e){
   const code=e instanceof MarketDataError?e.code:'OPTION_CHAIN_UNAVAILABLE';
   return res.status(['UNSUPPORTED_UNDERLYING','INVALID_EXPIRY','INVALID_RATE'].includes(code)?400:503).json({error:'Option chain unavailable',reason:code});
  }
 };
}
export default createOptionChainHandler();
