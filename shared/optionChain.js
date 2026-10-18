// Normalised option chain with model IV and Greeks, plus strike selection for strategy-spec legs.
import {impliedVolatility,bsGreeks,yearsToExpiry,OPTIONS_MATH_VERSION} from './optionsMath.js';
export const DEFAULT_RATE=0.065;// assumed annual risk-free rate (continuous); caller may override

const quote=(raw)=>{
 const m=raw?.market_data??{},n=v=>Number.isFinite(v)?v:null;
 const bid=n(m.bid_price),ask=n(m.ask_price),twoSided=bid>0&&ask>0&&ask>=bid;
 return {instrumentKey:typeof raw?.instrument_key==='string'?raw.instrument_key:null,ltp:n(m.ltp),close:n(m.close_price),bid,ask,bidQty:n(m.bid_qty),askQty:n(m.ask_qty),oi:n(m.oi),volume:n(m.volume),mid:twoSided?(bid+ask)/2:null,
  provider:raw?.option_greeks?{iv:n(raw.option_greeks.iv),delta:n(raw.option_greeks.delta),gamma:n(raw.option_greeks.gamma),theta:n(raw.option_greeks.theta),vega:n(raw.option_greeks.vega)}:null};
};
// rows: Upstox /v2/option/chain data[]. The response has no per-contract timestamps, so observedAt is
// the time the chain was read, not when each price last traded.
export function normalizeOptionChain(rows,{underlying,underlyingKey,observedAt,rate=DEFAULT_RATE,dividendYield=0}){
 if(!Array.isArray(rows)||!rows.length)throw new Error('EMPTY_OPTION_CHAIN');
 const expiries=new Set(rows.map(r=>r?.expiry)),spots=new Set(rows.map(r=>r?.underlying_spot_price));
 if(expiries.size!==1||!/^\d{4}-\d{2}-\d{2}$/.test([...expiries][0]))throw new Error('AMBIGUOUS_EXPIRY');
 if(spots.size!==1||!([...spots][0]>0))throw new Error('AMBIGUOUS_UNDERLYING_PRICE');
 if(rows.some(r=>r?.underlying_key!==underlyingKey))throw new Error('UNDERLYING_MISMATCH');
 const expiry=[...expiries][0],spot=[...spots][0],now=Date.parse(observedAt),T=yearsToExpiry(expiry,now);
 const seen=new Set(),strikes=[];
 for(const r of rows){
  if(!(r.strike_price>0)||seen.has(r.strike_price))throw new Error('INVALID_OR_DUPLICATE_STRIKE');seen.add(r.strike_price);
  const row={strike:r.strike_price};
  for(const [type,raw] of [['CE',r.call_options],['PE',r.put_options]]){
   const qt=quote(raw);
   if(!qt.instrumentKey){row[type]=null;continue;}
   if(!(T>0)){row[type]={...qt,iv:null,ivStatus:'EXPIRED',greeks:null};continue;}
   if(qt.mid===null){row[type]={...qt,iv:null,ivStatus:'NO_TWO_SIDED_QUOTE',greeks:null};continue;}
   const p={S:spot,K:r.strike_price,T,r:rate,q:dividendYield},solved=impliedVolatility(type,qt.mid,p);
   row[type]={...qt,iv:solved.iv,ivStatus:solved.status,greeks:solved.iv===null?null:bsGreeks(type,{...p,sigma:solved.iv})};
  }
  strikes.push(row);
 }
 strikes.sort((a,b)=>a.strike-b.strike);
 const gaps=strikes.slice(1).map((s,i)=>s.strike-strikes[i].strike),step=gaps.length?Math.min(...gaps):null;
 const atm=strikes.reduce((best,s)=>Math.abs(s.strike-spot)<Math.abs(best.strike-spot)?s:best).strike;
 return {underlying,underlyingKey,expiry,spot,observedAt,yearsToExpiry:T,model:{version:OPTIONS_MATH_VERSION,rate,dividendYield,price:'mid of best bid and ask',underlyingPrice:'provider spot; index forward basis is not modelled'},strikeStep:step,atmStrike:atm,strikes};
}

// selector: strategy-spec StrikeSelector. atm-offset steps > 0 move out of the money (higher strikes for
// calls, lower for puts), steps < 0 into the money. Premium and delta use the two-sided mid and model delta.
export function selectStrike(chain,optionType,selector){
 const listed=chain.strikes.filter(s=>s[optionType]);
 if(!listed.length)return {status:'NO_CONTRACTS'};
 if(selector.mode==='atm-offset'){
  const i=listed.findIndex(s=>s.strike===chain.atmStrike);if(i<0)return {status:'ATM_NOT_LISTED'};
  const j=i+(optionType==='CE'?selector.steps:-selector.steps);
  if(j<0||j>=listed.length)return {status:'OFFSET_OUTSIDE_CHAIN'};
  return {status:'SELECTED',strike:listed[j].strike,contract:listed[j][optionType]};
 }
 const value=s=>selector.mode==='premium'?s[optionType].mid:s[optionType].greeks?Math.abs(s[optionType].greeks.delta):null;
 const target=selector.mode==='premium'?selector.near:Math.abs(selector.near);
 const candidates=listed.filter(s=>value(s)!==null);
 if(!candidates.length)return {status:selector.mode==='premium'?'NO_TWO_SIDED_QUOTES':'NO_MODEL_DELTAS'};
 // Ties go to the strike closer to the money.
 const best=candidates.reduce((b,s)=>{const d=Math.abs(value(s)-target),db=Math.abs(value(b)-target);return d<db||(d===db&&Math.abs(s.strike-chain.spot)<Math.abs(b.strike-chain.spot))?s:b;});
 return {status:'SELECTED',strike:best.strike,contract:best[optionType],matched:value(best)};
}
