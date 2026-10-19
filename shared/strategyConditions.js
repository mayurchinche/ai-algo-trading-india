// Evaluates parsed strategy specs (see strategySpec.js) against completed OHLCV bars.
// Conditions use three-valued logic: true, false, or null when an operand is not yet defined
// (indicator warm-up, or barsAgo before the first bar). Callers must act only on `true` and must
// pass completed bars, so a bar's own close is never used before that bar has finished.

import { atr, bollinger, donchian, ema, gapPercent, highest, lowest, macd, openingRange, rsi, sma, supertrend, volumeRatio, vwap, zlema } from './indicators.js';
import { INDICATOR_TYPES } from './strategySpec.js';

const IST_OFFSET_MS=330*60*1000;
const istSession=time=>new Date(time+IST_OFFSET_MS).toISOString().slice(0,10);

function priceSeries(bars){
 if(!Array.isArray(bars)) throw new TypeError('bars must be an array');
 const fields=['open','high','low','close','volume'], out={time:[],open:[],high:[],low:[],close:[],volume:[]};
 bars.forEach((bar,i)=>{
  if(!Number.isFinite(bar?.time)) throw new TypeError(`bars[${i}].time must be epoch milliseconds`);
  if(i>0&&bar.time<=bars[i-1].time) throw new TypeError(`bars[${i}] is not after the previous bar`);
  for(const f of fields) if(!Number.isFinite(bar[f])) throw new TypeError(`bars[${i}].${f} must be a finite number`);
  if(bar.low>Math.min(bar.open,bar.close)||bar.high<Math.max(bar.open,bar.close)||bar.volume<0) throw new TypeError(`bars[${i}] has inconsistent OHLCV`);
  out.time.push(bar.time); for(const f of fields) out[f].push(bar[f]);
 });
 return out;
}

function source(price,name='close'){
 if(name==='hl2') return price.high.map((h,i)=>(h+price.low[i])/2);
 if(name==='hlc3') return price.high.map((h,i)=>(h+price.low[i]+price.close[i])/3);
 return price[name];
}

function compute(def,price){
 const {type,params={}}=def, src=source(price,def.source);
 switch(type){
  case 'sma': return {value:sma(src,params.length)};
  case 'ema': return {value:ema(src,params.length)};
  case 'zlema': return {value:zlema(src,params.length)};
  case 'rsi': return {value:rsi(src,params.length)};
  case 'highest': return {value:highest(src,params.length)};
  case 'lowest': return {value:lowest(src,params.length)};
  case 'atr': return {value:atr(price.high,price.low,price.close,params.length)};
  case 'macd': return macd(src,params);
  case 'bollinger': return bollinger(src,params.length,params.multiplier);
  case 'supertrend': return supertrend(price.high,price.low,price.close,params.length,params.multiplier);
  case 'donchian': return donchian(price.high,price.low,params.length);
  case 'vwap': return {value:vwap(price.high,price.low,price.close,price.volume,price.time.map(istSession))};
  case 'gap': return {pct:gapPercent(price.open,price.close)};
  case 'volume_ratio': return {value:volumeRatio(price.volume,params.length)};
  case 'opening_range': return openingRange(price.open,price.high,price.low,price.close,price.time.map(istSession),params.bars);
  default: throw new TypeError(`unsupported indicator type ${type}`);
 }
}

// spec must come from parseStrategySpec. Returns the evaluation context for evaluateCondition.
export function computeStrategySeries(spec,bars){
 const price=priceSeries(bars), indicators={};
 for(const def of spec.indicators) indicators[def.id]=Object.freeze({defaultOutput:INDICATOR_TYPES[def.type].outputs[0],outputs:compute(def,price)});
 return Object.freeze({length:price.close.length,price,indicators});
}

function operandAt(operand,ctx,index){
 if('value' in operand) return operand.value;
 const at=index-(operand.barsAgo??0);
 if(at<0||at>=ctx.length) return NaN;
 if('price' in operand) return ctx.price[operand.price][at];
 const indicator=ctx.indicators[operand.indicator];
 return indicator.outputs[operand.output??indicator.defaultOutput][at];
}

function compare({left,op,right},ctx,index){
 const l=operandAt(left,ctx,index), r=operandAt(right,ctx,index);
 if(Number.isNaN(l)||Number.isNaN(r)) return null;
 switch(op){
  case 'gt': return l>r;
  case 'gte': return l>=r;
  case 'lt': return l<r;
  case 'lte': return l<=r;
  case 'crosses-above': case 'crosses-below': {
   const pl=operandAt(left,ctx,index-1), pr=operandAt(right,ctx,index-1);
   if(Number.isNaN(pl)||Number.isNaN(pr)) return null;
   return op==='crosses-above'?pl<=pr&&l>r:pl>=pr&&l<r;
  }
  default: throw new TypeError(`unsupported comparator ${op}`);
 }
}

export function evaluateCondition(condition,ctx,index){
 if(!Number.isInteger(index)||index<0||index>=ctx.length) throw new RangeError('index must address a completed bar');
 if('compare' in condition) return compare(condition.compare,ctx,index);
 if('not' in condition){ const v=evaluateCondition(condition.not,ctx,index); return v===null?null:!v; }
 const results=(condition.all??condition.any).map(c=>evaluateCondition(c,ctx,index));
 if('all' in condition) return results.includes(false)?false:results.includes(null)?null:true;
 return results.includes(true)?true:results.includes(null)?null:false;
}
