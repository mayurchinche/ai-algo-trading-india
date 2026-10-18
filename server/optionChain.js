import {createUpstoxReader,getTradingInstruments,MarketDataError} from './upstoxReadOnly.js';
import {normalizeOptionChain,DEFAULT_RATE} from '../shared/optionChain.js';
// Index underlyings by app name; equity underlyings use NSE_EQ|ISIN directly.
export const OPTION_UNDERLYINGS=Object.freeze({NIFTY:'NSE_INDEX|Nifty 50',BANKNIFTY:'NSE_INDEX|Nifty Bank',FINNIFTY:'NSE_INDEX|Nifty Fin Service',MIDCPNIFTY:'NSE_INDEX|NIFTY MID SELECT'});
export const RELATIVE_EXPIRIES=Object.freeze({'current-week':'current_week','next-week':'next_week','current-month':'current_month','next-month':'next_month'});
export function underlyingKeyOf(value){
 if(Object.hasOwn(OPTION_UNDERLYINGS,value))return OPTION_UNDERLYINGS[value];
 if(typeof value==='string'&&/^NSE_EQ\|INE[A-Z0-9]{9}$/.test(value))return value;
 throw new MarketDataError('UNSUPPORTED_UNDERLYING');
}
export function expiryParam(value){
 if(Object.hasOwn(RELATIVE_EXPIRIES,value))return RELATIVE_EXPIRIES[value];
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value).toISOString().slice(0,10)===value)return value;
 throw new MarketDataError('INVALID_EXPIRY');
}
// Read-only: one chain per call; lot sizes come from the Upstox instrument master by instrument key.
export function createOptionChainReader({read=createUpstoxReader(),master=getTradingInstruments,clock=Date.now}={}){
 return async({underlying,expiry,rate=DEFAULT_RATE})=>{
  const key=underlyingKeyOf(underlying),exp=expiryParam(expiry);
  if(!(rate>=0&&rate<=0.2))throw new MarketDataError('INVALID_RATE');
  const rows=await read(`/v2/option/chain?instrument_key=${encodeURIComponent(key)}&expiry_date=${encodeURIComponent(exp)}`);
  let chain;try{chain=normalizeOptionChain(rows,{underlying,underlyingKey:key,observedAt:new Date(clock()).toISOString(),rate});}catch(e){throw new MarketDataError(e.message||'INVALID_OPTION_CHAIN');}
  let lots=null;try{const rowsMaster=await master();lots=new Map(rowsMaster.filter(r=>r.segment==='NSE_FO').map(r=>[r.instrument_key,r.lot_size]));}catch{/* lot sizes stay unknown */}
  for(const s of chain.strikes)for(const t of ['CE','PE'])if(s[t])s[t].lotSize=lots?.get(s[t].instrumentKey)??null;
  return {...chain,requestedExpiry:expiry,lotSizes:lots?'UPSTOX_INSTRUMENT_MASTER':'UNAVAILABLE',
   limitations:['Chain prices have no per-contract timestamps; observedAt is when the chain was read.','Model IV uses the two-sided mid, provider spot and an assumed risk-free rate; provider Greeks are shown separately.','Read-only market data: no orders can be placed from this endpoint.']};
 };
}
