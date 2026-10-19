// Strategy specification v1: a declarative, validated description of a rule-based strategy.
// One owner parses unknown input into a typed spec; the backtester, paper engine and builders consume
// only parsed specs. Parsing never guesses: every problem is reported with its JSON path.

export const STRATEGY_SCHEMA_VERSION = 1;
export const TIMEFRAMES = Object.freeze(['1m','3m','5m','15m','30m','1h','1d']);
export const EXPIRIES = Object.freeze(['current-week','next-week','current-month','next-month']);
export const PRICE_FIELDS = Object.freeze(['open','high','low','close','volume']);
export const SOURCES = Object.freeze(['open','high','low','close','volume','hl2','hlc3']);
export const COMPARATORS = Object.freeze(['gt','gte','lt','lte','crosses-above','crosses-below']);

// Indicator catalogue: parameters, defaults and named outputs. The first output is the default.
export const INDICATOR_TYPES = Object.freeze({
 sma:{params:{length:[1,500]},source:true,outputs:['value']},
 ema:{params:{length:[1,500]},source:true,outputs:['value']},
 zlema:{params:{length:[1,500]},source:true,outputs:['value']},
 rsi:{params:{length:[2,200]},source:true,outputs:['value']},
 highest:{params:{length:[1,500]},source:true,outputs:['value']},
 lowest:{params:{length:[1,500]},source:true,outputs:['value']},
 atr:{params:{length:[1,200]},source:false,outputs:['value']},
 macd:{params:{fast:[1,200],slow:[2,400],signal:[1,200]},source:true,outputs:['macd','signal','histogram']},
 bollinger:{params:{length:[2,500],multiplier:[0.1,10,'number']},source:true,outputs:['middle','upper','lower','percentB']},
 supertrend:{params:{length:[1,200],multiplier:[0.1,20,'number']},source:false,outputs:['line','direction']},
 donchian:{params:{length:[1,500]},source:false,outputs:['middle','upper','lower']},
 vwap:{params:{},source:false,outputs:['value'],intradayOnly:true},
 opening_range:{params:{bars:[1,24]},source:false,outputs:['high','low','open','close','prevClose'],intradayOnly:true},
});

const ID=/^[a-z][a-z0-9_]{0,31}$/, SYMBOL=/^[A-Z0-9&-]{1,30}$/, CLOCK=/^([01]\d|2[0-3]):[0-5]\d$/;
const MARKET_OPEN='09:15', MARKET_CLOSE='15:30', MAX_CONDITION_DEPTH=8, MAX_CONDITION_NODES=64, MAX_BARS_AGO=50;

const isObject=v=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));

class Issues {
 constructor(){ this.list=[]; }
 add(path,message){ this.list.push({path,message}); }
 object(value,path,allowed){
  if(!isObject(value)){ this.add(path,'must be an object'); return false; }
  for(const key of Object.keys(value)) if(!allowed.includes(key)) this.add(`${path}.${key}`,'is not a recognised field');
  return true;
 }
 oneOf(value,path,options){ if(!options.includes(value)) this.add(path,`must be one of ${options.join(', ')}`); return options.includes(value); }
 integer(value,path,min,max){ const ok=Number.isInteger(value)&&value>=min&&value<=max; if(!ok) this.add(path,`must be an integer from ${min} to ${max}`); return ok; }
 number(value,path,min,max,{exclusiveMin=false}={}){
  const ok=typeof value==='number'&&Number.isFinite(value)&&(exclusiveMin?value>min:value>=min)&&value<=max;
  if(!ok) this.add(path,`must be a number ${exclusiveMin?'above':'from'} ${min}${Number.isFinite(max)?` to ${max}`:''}`);
  return ok;
 }
 text(value,path,max){ const ok=typeof value==='string'&&value.trim().length>0&&value.length<=max; if(!ok) this.add(path,`must be non-empty text up to ${max} characters`); return ok; }
 clock(value,path){
  const ok=typeof value==='string'&&CLOCK.test(value)&&minutes(value)>=minutes(MARKET_OPEN)&&minutes(value)<=minutes(MARKET_CLOSE);
  if(!ok) this.add(path,`must be HH:MM IST between ${MARKET_OPEN} and ${MARKET_CLOSE}`);
  return ok;
 }
}

function parseSchedule(value,mode,issues){
 if(!issues.object(value,'$.schedule',['weekdays','entryStart','entryEnd','squareOff'])) return;
 const {weekdays,entryStart,entryEnd,squareOff}=value;
 if(!Array.isArray(weekdays)||weekdays.length===0) issues.add('$.schedule.weekdays','must list at least one weekday (1=Monday … 5=Friday)');
 else {
  weekdays.forEach((d,i)=>issues.integer(d,`$.schedule.weekdays[${i}]`,1,5));
  if(new Set(weekdays).size!==weekdays.length) issues.add('$.schedule.weekdays','must not repeat a weekday');
 }
 const start=issues.clock(entryStart,'$.schedule.entryStart'), end=issues.clock(entryEnd,'$.schedule.entryEnd');
 if(start&&end&&minutes(entryStart)>=minutes(entryEnd)) issues.add('$.schedule.entryEnd','must be after entryStart');
 if(mode==='intraday'){
  if(issues.clock(squareOff,'$.schedule.squareOff')&&end&&minutes(squareOff)<minutes(entryEnd)) issues.add('$.schedule.squareOff','must not be before entryEnd');
 } else if(squareOff!==undefined) issues.add('$.schedule.squareOff','applies only to intraday strategies');
}

function parseIndicators(value,timeframe,issues){
 const ids=new Map();
 if(!Array.isArray(value)){ issues.add('$.indicators','must be an array'); return ids; }
 if(value.length>32) issues.add('$.indicators','must not exceed 32 indicators');
 value.forEach((item,i)=>{
  const path=`$.indicators[${i}]`;
  if(!issues.object(item,path,['id','type','params','source'])) return;
  const idOk=typeof item.id==='string'&&ID.test(item.id);
  if(!idOk) issues.add(`${path}.id`,'must be lowercase letters, digits or _ starting with a letter (max 32)');
  else if(ids.has(item.id)) issues.add(`${path}.id`,`duplicates indicator "${item.id}"`);
  const def=INDICATOR_TYPES[item.type];
  if(!def){ issues.add(`${path}.type`,`must be one of ${Object.keys(INDICATOR_TYPES).join(', ')}`); return; }
  if(def.intradayOnly&&timeframe==='1d') issues.add(`${path}.type`,`${item.type} requires an intraday timeframe`);
  if(item.source!==undefined&&(!def.source||!SOURCES.includes(item.source))) issues.add(`${path}.source`,def.source?`must be one of ${SOURCES.join(', ')}`:`is not used by ${item.type}`);
  const params=item.params??{};
  if(issues.object(params,`${path}.params`,Object.keys(def.params))){
   for(const [name,[min,max,kind]] of Object.entries(def.params)){
    if(params[name]===undefined){ issues.add(`${path}.params.${name}`,'is required'); continue; }
    if(kind==='number') issues.number(params[name],`${path}.params.${name}`,min,max); else issues.integer(params[name],`${path}.params.${name}`,min,max);
   }
   if(item.type==='macd'&&Number.isInteger(params.fast)&&Number.isInteger(params.slow)&&params.fast>=params.slow) issues.add(`${path}.params.fast`,'must be shorter than slow');
  }
  if(idOk&&!ids.has(item.id)) ids.set(item.id,def);
 });
 return ids;
}

function parseOperand(value,path,indicators,issues){
 if(!isObject(value)){ issues.add(path,'must be an operand object'); return; }
 const kinds=['indicator','price','value'].filter(k=>k in value);
 if(kinds.length!==1){ issues.add(path,'must have exactly one of indicator, price or value'); return; }
 if(kinds[0]==='value'){ issues.object(value,path,['value']); issues.number(value.value,`${path}.value`,-Infinity,Infinity); return 'value'; }
 if(kinds[0]==='price'){ issues.object(value,path,['price','barsAgo']); issues.oneOf(value.price,`${path}.price`,PRICE_FIELDS); }
 else {
  issues.object(value,path,['indicator','output','barsAgo']);
  const def=indicators.get(value.indicator);
  if(!def) issues.add(`${path}.indicator`,`refers to an undefined indicator "${value.indicator}"`);
  else if(value.output!==undefined) issues.oneOf(value.output,`${path}.output`,def.outputs);
 }
 if(value.barsAgo!==undefined) issues.integer(value.barsAgo,`${path}.barsAgo`,0,MAX_BARS_AGO);
 return kinds[0];
}

function parseCondition(value,path,indicators,issues,state,depth=1){
 if(++state.nodes>MAX_CONDITION_NODES){ if(!state.reported){ issues.add(path,`conditions must not exceed ${MAX_CONDITION_NODES} nodes`); state.reported=true; } return; }
 if(depth>MAX_CONDITION_DEPTH){ issues.add(path,`conditions must not nest deeper than ${MAX_CONDITION_DEPTH}`); return; }
 if(!isObject(value)||Object.keys(value).length!==1){ issues.add(path,'must have exactly one of all, any, not or compare'); return; }
 const [kind]=Object.keys(value);
 if(kind==='all'||kind==='any'){
  if(!Array.isArray(value[kind])||value[kind].length===0) issues.add(`${path}.${kind}`,'must be a non-empty array');
  else value[kind].forEach((c,i)=>parseCondition(c,`${path}.${kind}[${i}]`,indicators,issues,state,depth+1));
 } else if(kind==='not') parseCondition(value.not,`${path}.not`,indicators,issues,state,depth+1);
 else if(kind==='compare'){
  const c=value.compare, p=`${path}.compare`;
  if(!issues.object(c,p,['left','op','right'])) return;
  issues.oneOf(c.op,`${p}.op`,COMPARATORS);
  const left=parseOperand(c.left,`${p}.left`,indicators,issues), right=parseOperand(c.right,`${p}.right`,indicators,issues);
  if(left==='value'&&right==='value') issues.add(p,'compares two constants');
  if(left==='value'&&(c.op==='crosses-above'||c.op==='crosses-below')) issues.add(`${p}.left`,'must vary over time for a cross');
 } else issues.add(path,'must have exactly one of all, any, not or compare');
}

function parseLevel(value,path,issues){
 if(!issues.object(value,path,['unit','value'])) return;
 issues.oneOf(value.unit,`${path}.unit`,['percent','points']);
 issues.number(value.value,`${path}.value`,0,value.unit==='percent'?1000:Infinity,{exclusiveMin:true});
}

function parseLegs(value,underlying,issues){
 if(!Array.isArray(value)||value.length<1||value.length>6){ issues.add('$.legs','must contain 1 to 6 legs'); return; }
 const ids=new Set();
 value.forEach((leg,i)=>{
  const path=`$.legs[${i}]`;
  if(!issues.object(leg,path,['id','side','instrument','quantity','target','stopLoss','trailingStop'])) return;
  if(typeof leg.id!=='string'||!ID.test(leg.id)) issues.add(`${path}.id`,'must be lowercase letters, digits or _ starting with a letter (max 32)');
  else if(ids.has(leg.id)) issues.add(`${path}.id`,`duplicates leg "${leg.id}"`); else ids.add(leg.id);
  issues.oneOf(leg.side,`${path}.side`,['BUY','SELL']);
  const ins=leg.instrument, ip=`${path}.instrument`;
  let derivative=false;
  if(isObject(ins)&&ins.type==='equity'){
   issues.object(ins,ip,['type']);
   if(underlying?.kind==='index') issues.add(`${ip}.type`,'an index cannot be traded as equity; use a future or option');
  } else if(isObject(ins)&&ins.type==='future'){
   derivative=true; issues.object(ins,ip,['type','expiry']);
   issues.oneOf(ins.expiry,`${ip}.expiry`,['current-month','next-month']);
  } else if(isObject(ins)&&ins.type==='option'){
   derivative=true; issues.object(ins,ip,['type','optionType','expiry','strike']);
   issues.oneOf(ins.optionType,`${ip}.optionType`,['CE','PE']);
   if(issues.oneOf(ins.expiry,`${ip}.expiry`,EXPIRIES)&&ins.expiry.endsWith('week')&&underlying?.kind!=='index') issues.add(`${ip}.expiry`,'weekly expiries are available only for index options');
   const s=ins.strike, sp=`${ip}.strike`;
   if(isObject(s)&&s.mode==='atm-offset'){ issues.object(s,sp,['mode','steps']); issues.integer(s.steps,`${sp}.steps`,-20,20); }
   else if(isObject(s)&&s.mode==='premium'){ issues.object(s,sp,['mode','near']); issues.number(s.near,`${sp}.near`,0,Infinity,{exclusiveMin:true}); }
   else if(isObject(s)&&s.mode==='delta'){ issues.object(s,sp,['mode','near']); if(!(typeof s.near==='number'&&s.near>0&&s.near<1)) issues.add(`${sp}.near`,'must be an absolute delta between 0 and 1'); }
   else issues.add(sp,"must select a strike by mode 'atm-offset', 'premium' or 'delta'");
  } else issues.add(`${ip}.type`,"must be 'equity', 'future' or 'option'");
  const q=leg.quantity, qp=`${path}.quantity`;
  if(derivative){ if(issues.object(q,qp,['lots'])) issues.integer(q.lots,`${qp}.lots`,1,500); }
  else if(issues.object(q,qp,['units'])) issues.integer(q.units,`${qp}.units`,1,1_000_000);
  if(leg.target!==undefined) parseLevel(leg.target,`${path}.target`,issues);
  if(leg.stopLoss!==undefined) parseLevel(leg.stopLoss,`${path}.stopLoss`,issues);
  if(leg.trailingStop!==undefined){
   const t=leg.trailingStop, tp=`${path}.trailingStop`;
   if(issues.object(t,tp,['unit','trigger','step'])){
    issues.oneOf(t.unit,`${tp}.unit`,['percent','points']);
    issues.number(t.trigger,`${tp}.trigger`,0,Infinity,{exclusiveMin:true}); issues.number(t.step,`${tp}.step`,0,Infinity,{exclusiveMin:true});
   }
   if(leg.stopLoss===undefined) issues.add(tp,'requires a stopLoss to trail');
  }
 });
}

function parseRisk(value,mode,issues){
 if(value===undefined) return;
 if(!issues.object(value,'$.risk',['maxLoss','target','reEntry','exitOnExpiryDay','maxHoldingDays'])) return;
 for(const key of ['maxLoss','target']) if(value[key]!==undefined){
  const p=`$.risk.${key}`;
  if(issues.object(value[key],p,['unit','value'])){
   issues.oneOf(value[key].unit,`${p}.unit`,['percent-capital','amount']);
   issues.number(value[key].value,`${p}.value`,0,value[key].unit==='percent-capital'?100:Infinity,{exclusiveMin:true});
  }
 }
 if(value.reEntry!==undefined&&issues.object(value.reEntry,'$.risk.reEntry',['maxCount','after','cooldownMinutes'])){
  issues.integer(value.reEntry.maxCount,'$.risk.reEntry.maxCount',1,10);
  issues.oneOf(value.reEntry.after,'$.risk.reEntry.after',['stop-loss','target','any']);
  issues.integer(value.reEntry.cooldownMinutes??0,'$.risk.reEntry.cooldownMinutes',0,375);
 }
 if(value.exitOnExpiryDay!==undefined&&typeof value.exitOnExpiryDay!=='boolean') issues.add('$.risk.exitOnExpiryDay','must be true or false');
 if(value.maxHoldingDays!==undefined){
  if(mode==='intraday') issues.add('$.risk.maxHoldingDays','applies only to positional strategies');
  else issues.integer(value.maxHoldingDays,'$.risk.maxHoldingDays',1,3650);
 }
}

// Returns {ok:true, spec} with a deep-frozen copy, or {ok:false, issues:[{path, message}]}.
export function parseStrategySpec(input){
 const issues=new Issues();
 if(!issues.object(input,'$',['schemaVersion','name','description','mode','underlying','timeframe','schedule','indicators','entry','exit','legs','risk'])) return {ok:false,issues:issues.list};
 if(input.schemaVersion!==STRATEGY_SCHEMA_VERSION) issues.add('$.schemaVersion',`must be ${STRATEGY_SCHEMA_VERSION}`);
 issues.text(input.name,'$.name',120);
 if(input.description!==undefined) issues.text(input.description,'$.description',2000);
 issues.oneOf(input.mode,'$.mode',['intraday','positional']);
 if(issues.object(input.underlying,'$.underlying',['symbol','exchange','kind'])){
  if(typeof input.underlying.symbol!=='string'||!SYMBOL.test(input.underlying.symbol)) issues.add('$.underlying.symbol','must be an exchange symbol such as NIFTY or RELIANCE');
  issues.oneOf(input.underlying.exchange,'$.underlying.exchange',['NSE','BSE']);
  issues.oneOf(input.underlying.kind,'$.underlying.kind',['equity','index']);
 }
 issues.oneOf(input.timeframe,'$.timeframe',TIMEFRAMES);
 if(input.mode==='intraday'&&input.timeframe==='1d') issues.add('$.timeframe','intraday strategies need an intraday timeframe');
 parseSchedule(input.schedule,input.mode,issues);
 const indicators=parseIndicators(input.indicators??[],input.timeframe,issues);
 const state={nodes:0,reported:false};
 parseCondition(input.entry,'$.entry',indicators,issues,state);
 if(input.exit!==undefined) parseCondition(input.exit,'$.exit',indicators,issues,state);
 parseLegs(input.legs,isObject(input.underlying)?input.underlying:undefined,issues);
 parseRisk(input.risk,input.mode,issues);
 if(issues.list.length) return {ok:false,issues:issues.list};
 const spec=structuredClone({...input,indicators:input.indicators??[]});
 return {ok:true,spec:deepFreeze(spec)};
}

function deepFreeze(value){ if(value&&typeof value==='object'){ Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
