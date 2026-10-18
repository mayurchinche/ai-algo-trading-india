// Options Wizard: preset multi-leg structures that generate a validated strategy spec, resolve strikes on a
// live chain and compute the payoff at the first expiry. Presets are standard textbook structures.
import {parseStrategySpec} from './strategySpec.js';
import {selectStrike} from './optionChain.js';
import {bsPrice} from './optionsMath.js';

const opt=(id,side,optionType,steps,lots,expiry='near')=>({id,side,kind:'option',optionType,steps,lots,expiry});
const fut=(id,side,lots)=>({id,side,kind:'future',lots});
// w = distance from ATM in strike steps, g = wing width; legs are templates resolved by buildWizardSpec.
export const PRESETS=Object.freeze({
 'long-straddle':{label:'Long straddle',view:'Big move either way',legs:()=>[opt('ce','BUY','CE',0,1),opt('pe','BUY','PE',0,1)]},
 'short-straddle':{label:'Short straddle',view:'Little movement',legs:()=>[opt('ce','SELL','CE',0,1),opt('pe','SELL','PE',0,1)]},
 'long-strangle':{label:'Long strangle',view:'Big move either way, lower cost',legs:({w})=>[opt('ce','BUY','CE',w,1),opt('pe','BUY','PE',w,1)]},
 'short-strangle':{label:'Short strangle',view:'Range-bound',legs:({w})=>[opt('ce','SELL','CE',w,1),opt('pe','SELL','PE',w,1)]},
 'iron-condor':{label:'Iron condor',view:'Range-bound with capped risk',legs:({w,g})=>[opt('ce_short','SELL','CE',w,1),opt('ce_wing','BUY','CE',w+g,1),opt('pe_short','SELL','PE',w,1),opt('pe_wing','BUY','PE',w+g,1)]},
 'butterfly':{label:'Long call butterfly',view:'Pin near the current price',legs:({w})=>[opt('lower','BUY','CE',-w,1),opt('body','SELL','CE',0,2),opt('upper','BUY','CE',w,1)]},
 'covered-call':{label:'Covered call',view:'Mildly bullish, earn premium',legs:({w})=>[fut('fut','BUY',1),opt('ce','SELL','CE',w,1)]},
 'protective-put':{label:'Protective put',view:'Bullish with downside protection',legs:({w})=>[fut('fut','BUY',1),opt('pe','BUY','PE',w,1)]},
 'collar':{label:'Collar',view:'Hold with capped gain and loss',legs:({w})=>[fut('fut','BUY',1),opt('pe','BUY','PE',w,1),opt('ce','SELL','CE',w,1)]},
 'jade-lizard':{label:'Jade lizard',view:'Neutral to bullish, no upside risk if credit exceeds call width',legs:({w,g})=>[opt('pe','SELL','PE',w,1),opt('ce_short','SELL','CE',w,1),opt('ce_wing','BUY','CE',w+g,1)]},
 'calendar':{label:'Call calendar',view:'Little movement before the near expiry',legs:()=>[opt('near_ce','SELL','CE',0,1,'near'),opt('far_ce','BUY','CE',0,1,'far')]},
 'ratio':{label:'Call ratio spread',view:'Moderately bullish, risk above the short strikes',legs:({w})=>[opt('long_ce','BUY','CE',0,1),opt('short_ce','SELL','CE',w,2)]},
});
const FAR={'current-week':'next-week','next-week':null,'current-month':'next-month','next-month':null};
export const INDEX_UNDERLYINGS=Object.freeze(['NIFTY','BANKNIFTY','FINNIFTY','MIDCPNIFTY']);

// input: {preset, underlying, kind:'index'|'equity', expiry, lots, w, g, mode, entryStart, entryEnd, squareOff, legStopLossPct, maxLossAmount, targetAmount}
export function buildWizardSpec(input){
 const preset=PRESETS[input.preset];if(!preset)return {ok:false,issues:[{path:'$.preset',message:'Unknown preset'}]};
 const far=FAR[input.expiry];
 const templates=preset.legs({w:input.w??1,g:input.g??1});
 if(templates.some(t=>t.expiry==='far')&&!far)return {ok:false,issues:[{path:'$.expiry',message:'A calendar needs a near expiry with a later one (current-week or current-month)'}]};
 const legs=templates.map(t=>({id:t.id,side:t.side,
  instrument:t.kind==='future'?{type:'future',expiry:input.expiry.endsWith('week')?'current-month':input.expiry}:{type:'option',optionType:t.optionType,expiry:t.expiry==='far'?far:input.expiry,strike:{mode:'atm-offset',steps:t.steps}},
  quantity:{lots:t.lots*input.lots},
  ...(input.legStopLossPct&&t.kind==='option'?{stopLoss:{unit:'percent',value:input.legStopLossPct}}:{})}));
 const intraday=input.mode!=='positional';
 const risk={...(input.maxLossAmount?{maxLoss:{unit:'amount',value:input.maxLossAmount}}:{}),...(input.targetAmount?{target:{unit:'amount',value:input.targetAmount}}:{}),...(intraday?{}:{exitOnExpiryDay:true})};
 return parseStrategySpec({schemaVersion:1,name:`${preset.label} · ${input.underlying}`,description:`Options Wizard preset ${input.preset}. Entry at the first bar in the entry window (close > 0 is true on every bar).`,
  mode:intraday?'intraday':'positional',underlying:{symbol:input.underlying,exchange:'NSE',kind:input.kind},timeframe:intraday?'5m':'1d',
  schedule:{weekdays:[1,2,3,4,5],entryStart:input.entryStart??'09:20',entryEnd:input.entryEnd??'10:00',...(intraday?{squareOff:input.squareOff??'15:15'}:{})},
  indicators:[],entry:{compare:{left:{price:'close'},op:'gt',right:{value:0}}},legs,...(Object.keys(risk).length?{risk}:{})});
}

// chains: {[expiryKeyword]: OptionChain}. Futures are priced at spot: the chain carries no futures quote.
export function resolveLegs(spec,chains){
 return spec.legs.map(leg=>{
  const sign=leg.side==='BUY'?1:-1,lots=leg.quantity.lots??0;
  if(leg.instrument.type==='future'){const c=Object.values(chains)[0];return c?{id:leg.id,kind:'future',sign,lots,lotSize:null,entry:c.spot,expiry:null,status:'SPOT_APPROXIMATION'}:{id:leg.id,status:'NO_CHAIN'};}
  const c=chains[leg.instrument.expiry];if(!c)return {id:leg.id,status:'NO_CHAIN',expiry:leg.instrument.expiry};
  const sel=selectStrike(c,leg.instrument.optionType,leg.instrument.strike);
  if(sel.status!=='SELECTED')return {id:leg.id,status:sel.status};
  if(sel.contract.mid===null||sel.contract.iv===null)return {id:leg.id,status:'NO_TWO_SIDED_QUOTE',strike:sel.strike};
  return {id:leg.id,kind:'option',optionType:leg.instrument.optionType,sign,lots,lotSize:sel.contract.lotSize??null,strike:sel.strike,entry:sel.contract.mid,iv:sel.contract.iv,expiry:c.expiry,instrumentKey:sel.contract.instrumentKey,greeks:sel.contract.greeks,rate:c.model.rate,status:'RESOLVED'};
 });
}

// P&L across underlying prices at the earliest option expiry. Later-expiry legs are valued with
// Black-Scholes at their entry IV; futures settle at the underlying price.
export function payoff(legs,{spot,from=spot*0.8,to=spot*1.2,points=241}){
 const bad=legs.filter(l=>!['RESOLVED','SPOT_APPROXIMATION'].includes(l.status));
 if(bad.length)return {status:'UNRESOLVED_LEGS',unresolved:bad};
 const expiries=legs.filter(l=>l.kind==='option').map(l=>l.expiry).sort(),at=expiries[0]??null;
 const lotKnown=legs.every(l=>l.kind==='future'||l.lotSize);
 const lotSize=lotKnown?(legs.find(l=>l.lotSize)?.lotSize??1):1;
 const value=(l,S)=>{
  if(l.kind==='future')return S;
  if(l.expiry===at)return Math.max(0,l.optionType==='CE'?S-l.strike:l.strike-S);
  const T=(Date.parse(l.expiry)-Date.parse(at))/(365*86400000);
  return bsPrice(l.optionType,{S,K:l.strike,T,r:l.rate,q:0,sigma:l.iv});
 };
 const units=l=>l.sign*l.lots*(l.kind==='future'?lotSize:(l.lotSize??lotSize));
 const curve=Array.from({length:points},(_,i)=>{const S=from+(to-from)*i/(points-1);return {price:S,pnl:legs.reduce((a,l)=>a+units(l)*(value(l,S)-l.entry),0)};});
 const pnls=curve.map(p=>p.pnl),edge=(a,b)=>b.pnl-a.pnl;
 const upSlope=edge(curve.at(-2),curve.at(-1)),downSlope=edge(curve[1],curve[0]);
 const breakevens=[];for(let i=1;i<curve.length;i++){const a=curve[i-1],b=curve[i];if(a.pnl===0)breakevens.push(a.price);else if(a.pnl*b.pnl<0)breakevens.push(a.price+(b.price-a.price)*(-a.pnl)/(b.pnl-a.pnl));}
 const eps=1e-9;
 return {status:'OK',evaluatedAt:at,lotSize:lotKnown?'FROM_CHAIN':'UNKNOWN_PER_UNIT',curve,
  netPremium:legs.filter(l=>l.kind==='option').reduce((a,l)=>a-units(l)*l.entry,0),
  maxProfit:upSlope>eps||downSlope>eps?{status:'UNBOUNDED_BEYOND_RANGE',value:Math.max(...pnls)}:{status:'WITHIN_RANGE',value:Math.max(...pnls)},
  maxLoss:upSlope<-eps||downSlope<-eps?{status:'UNBOUNDED_BEYOND_RANGE',value:Math.min(...pnls)}:{status:'WITHIN_RANGE',value:Math.min(...pnls)},
  breakevens,
  greeks:legs.reduce((g,l)=>{const u=units(l);if(l.kind==='future'){g.delta+=u;return g;}const k=l.greeks??{delta:0,gamma:0,theta:0,vega:0};g.delta+=u*k.delta;g.gamma+=u*k.gamma;g.theta+=u*k.theta;g.vega+=u*k.vega;return g;},{delta:0,gamma:0,theta:0,vega:0}),
  notes:['Futures legs are priced at spot; the futures basis is not modelled.','Entry uses two-sided mid prices; fills, costs and margin are not included.']};
}
