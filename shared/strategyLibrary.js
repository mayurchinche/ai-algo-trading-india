// Strategy library: fixed-parameter, publicly documented trading rules, one or more per segment, expressed as
// strategy specs so the same engine backtests, validates, signals and paper-trades them. Parameters are the
// published defaults and are never tuned on our data, so the held-out validation window stays unseen.
// Inclusion here is not evidence of profitability; strategyValidation decides that per run, on data.
import {parseStrategySpec} from './strategySpec.js';
export const LIBRARY_VERSION='strategy-library-v1';
export const INDEX_UNDERLYINGS=Object.freeze(['NIFTY','BANKNIFTY']);
const WEEK=[1,2,3,4,5];
const DAY={weekdays:WEEK,entryStart:'09:15',entryEnd:'15:30'};
const ind=(id,type,params,source)=>({id,type,params,...(source?{source}:{})});
const cmp=(left,op,right)=>({compare:{left,op,right}});
const I=(indicator,output,barsAgo)=>({indicator,...(output?{output}:{}),...(barsAgo?{barsAgo}:{})});
const P=(price,barsAgo)=>({price,...(barsAgo?{barsAgo}:{})});
const V=value=>({value});
const pct=value=>({unit:'percent',value});

// Each entry: id, segment, name, rule summary, reference, universe ('nifty50' equities, or 'fno': NIFTY 50
// stock derivatives plus index derivatives), validation proxy for option strategies, and build({symbol, units, lots}) → spec.
const RAW=[
 {id:'intraday-vwap-breakout',segment:'intraday',name:'VWAP trend breakout (15m)',universe:'nifty50',timeframe:'15m',
  rule:'Buy when a 15-minute close breaks the prior hour’s high while above VWAP and the 20-bar EMA; 1% stop, 2% target, squared off 15:15.',
  reference:'Opening-range / channel breakout with VWAP confirmation, as described in Toby Crabel, “Day Trading with Short Term Price Patterns” (1990), and common VWAP practice.',
  build:({symbol,units})=>({schemaVersion:1,name:'VWAP trend breakout '+symbol,mode:'intraday',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'15m',
   schedule:{weekdays:WEEK,entryStart:'09:45',entryEnd:'14:30',squareOff:'15:15'},indicators:[ind('dc','donchian',{length:4}),ind('vw','vwap',{}),ind('ema20','ema',{length:20},'close')],
   entry:{all:[cmp(P('close'),'crosses-above',I('dc','upper',1)),cmp(P('close'),'gt',I('vw')),cmp(P('close'),'gt',I('ema20'))]},
   legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units},stopLoss:pct(1),target:pct(2)}]})},
 {id:'intraday-supertrend',segment:'intraday',name:'Supertrend flip (15m)',universe:'nifty50',timeframe:'15m',
  rule:'Buy when Supertrend(10,3) turns up on a 15-minute close above VWAP; 1% stop trailed by 0.25% every 0.5%; squared off 15:15.',
  reference:'Supertrend indicator by Olivier Seban; default parameters (10, 3).',
  build:({symbol,units})=>({schemaVersion:1,name:'Supertrend intraday '+symbol,mode:'intraday',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'15m',
   schedule:{weekdays:WEEK,entryStart:'09:30',entryEnd:'14:30',squareOff:'15:15'},indicators:[ind('st','supertrend',{length:10,multiplier:3}),ind('vw','vwap',{})],
   entry:{all:[cmp(I('st','direction'),'crosses-above',V(0)),cmp(P('close'),'gt',I('vw'))]},
   legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units},stopLoss:pct(1),trailingStop:{unit:'percent',trigger:0.5,step:0.25}}]})},
 {id:'swing-rsi2',segment:'swing',name:'RSI(2) pullback in an uptrend',universe:'nifty50',timeframe:'1d',
  rule:'Buy when the 2-day RSI falls below 10 while the close is above the 200-day SMA; sell when the close rises above the 5-day SMA or after 10 days; 10% disaster stop.',
  reference:'Larry Connors and Cesar Alvarez, “Short Term Trading Strategies That Work” (2008).',
  build:({symbol,units})=>({schemaVersion:1,name:'RSI(2) pullback '+symbol,mode:'positional',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('rsi2','rsi',{length:2},'close'),ind('sma200','sma',{length:200},'close'),ind('sma5','sma',{length:5},'close')],
   entry:{all:[cmp(I('rsi2'),'lt',V(10)),cmp(P('close'),'gt',I('sma200'))]},exit:cmp(P('close'),'gt',I('sma5')),
   legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units},stopLoss:pct(10)}],risk:{maxHoldingDays:10}})},
 {id:'swing-ema-pullback',segment:'swing',name:'EMA trend pullback',universe:'nifty50',timeframe:'1d',
  rule:'In an uptrend (20 EMA above 50 EMA above 200 SMA), buy when the 14-day RSI recovers above 40; exit below the 20 EMA or after 10 days; 6% stop, 12% target.',
  reference:'Trend-pullback entry as described in Alexander Elder, “Trading for a Living” (triple-screen idea), with standard indicator defaults.',
  build:({symbol,units})=>({schemaVersion:1,name:'EMA pullback '+symbol,mode:'positional',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('ema20','ema',{length:20},'close'),ind('ema50','ema',{length:50},'close'),ind('sma200','sma',{length:200},'close'),ind('rsi14','rsi',{length:14},'close')],
   entry:{all:[cmp(I('ema20'),'gt',I('ema50')),cmp(I('ema50'),'gt',I('sma200')),cmp(I('rsi14'),'crosses-above',V(40))]},exit:cmp(P('close'),'crosses-below',I('ema20')),
   legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units},stopLoss:pct(6),target:pct(12)}],risk:{maxHoldingDays:10}})},
 {id:'short-term-donchian',segment:'short-term',name:'20-day breakout (Turtle style)',universe:'nifty50',timeframe:'1d',
  rule:'Buy a close above the prior 20-day high while above the 50-day SMA; exit on a close below the prior 10-day low or after 60 days; 8% stop.',
  reference:'Richard Dennis / William Eckhardt Turtle rules (System 1: 20-day entry, 10-day exit), as published by Curtis Faith, “Way of the Turtle” (2007).',
  build:({symbol,units})=>({schemaVersion:1,name:'20-day breakout '+symbol,mode:'positional',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('dc20','donchian',{length:20}),ind('dc10','donchian',{length:10}),ind('sma50','sma',{length:50},'close')],
   entry:{all:[cmp(P('close'),'crosses-above',I('dc20','upper',1)),cmp(P('close'),'gt',I('sma50'))]},exit:cmp(P('close'),'crosses-below',I('dc10','lower',1)),
   legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units},stopLoss:pct(8)}],risk:{maxHoldingDays:60}})},
 {id:'long-term-golden-trend',segment:'long-term',name:'200-day trend following',universe:'nifty50',timeframe:'1d',
  rule:'Buy when the close crosses above the 200-day SMA while the 50-day SMA is above the 200-day SMA; sell on a close below the 200-day SMA; 20% disaster stop.',
  reference:'Moving-average timing studied in Mebane Faber, “A Quantitative Approach to Tactical Asset Allocation” (2007).',
  build:({symbol,units})=>({schemaVersion:1,name:'200-day trend '+symbol,mode:'positional',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('sma50','sma',{length:50},'close'),ind('sma200','sma',{length:200},'close')],
   entry:{all:[cmp(P('close'),'crosses-above',I('sma200')),cmp(I('sma50'),'gt',I('sma200'))]},exit:cmp(P('close'),'crosses-below',I('sma200')),
   legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units},stopLoss:pct(20)}]})},
 {id:'long-term-52w-high',segment:'long-term',name:'52-week-high momentum',universe:'nifty50',timeframe:'1d',
  rule:'Buy a close above the prior 52-week (250-day) high; sell on a close below the 200-day SMA; 20% disaster stop.',
  reference:'Thomas George and Chuan-Yang Hwang, “The 52-Week High and Momentum Investing”, Journal of Finance (2004).',
  build:({symbol,units})=>({schemaVersion:1,name:'52-week high '+symbol,mode:'positional',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('hi250','highest',{length:250},'high'),ind('sma200','sma',{length:200},'close')],
   entry:cmp(P('close'),'crosses-above',I('hi250',undefined,1)),exit:cmp(P('close'),'crosses-below',I('sma200')),
   legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units},stopLoss:pct(20)}]})},
 ...['BUY','SELL'].map(side=>({id:'futures-supertrend-'+(side==='BUY'?'long':'short'),segment:'futures',name:`Futures Supertrend ${side==='BUY'?'long':'short'}`,universe:'fno',timeframe:'1d',
  rule:`${side==='BUY'?'Buy':'Sell'} the current-month future when the daily Supertrend(10,3) turns ${side==='BUY'?'up':'down'}; exit when it flips back or after 30 days; ${'3%'} stop.`,
  reference:'Supertrend indicator by Olivier Seban; default parameters (10, 3), applied to stock and index futures.',
  build:({symbol,lots})=>({schemaVersion:1,name:`Supertrend futures ${side==='BUY'?'long':'short'} ${symbol}`,mode:'positional',underlying:{symbol,exchange:'NSE',kind:INDEX_UNDERLYINGS.includes(symbol)?'index':'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('st','supertrend',{length:10,multiplier:3})],entry:cmp(I('st','direction'),side==='BUY'?'crosses-above':'crosses-below',V(0)),exit:cmp(I('st','direction'),side==='BUY'?'crosses-below':'crosses-above',V(0)),
   legs:[{id:'fut',side,instrument:{type:'future',expiry:'current-month'},quantity:{lots},stopLoss:pct(3)}],risk:{maxHoldingDays:30}})})),
 ...['CE','PE'].map(type=>({id:'options-trend-'+(type==='CE'?'bull-call':'bear-put')+'-spread',segment:'options',name:`${type==='CE'?'Bull call':'Bear put'} spread on trend turn`,universe:'fno',timeframe:'1d',
  validationProxy:'futures-supertrend-'+(type==='CE'?'long':'short'),
  rule:`When the daily Supertrend(10,3) turns ${type==='CE'?'up':'down'}, buy the ATM ${type} and sell the ${type} two strikes ${type==='CE'?'higher':'lower'} (current-month, defined risk); exit when the trend flips or after 10 days, or at 50% of the capital at risk.`,
  reference:'Vertical debit spread (defined-risk directional position), entry timed by Supertrend (10, 3).',
  build:({symbol,lots})=>({schemaVersion:1,name:`${type==='CE'?'Bull call':'Bear put'} spread ${symbol}`,mode:'positional',underlying:{symbol,exchange:'NSE',kind:INDEX_UNDERLYINGS.includes(symbol)?'index':'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('st','supertrend',{length:10,multiplier:3})],entry:cmp(I('st','direction'),type==='CE'?'crosses-above':'crosses-below',V(0)),exit:cmp(I('st','direction'),type==='CE'?'crosses-below':'crosses-above',V(0)),
   legs:[{id:'long_opt',side:'BUY',instrument:{type:'option',optionType:type,expiry:'current-month',strike:{mode:'atm-offset',steps:0}},quantity:{lots}},{id:'short_opt',side:'SELL',instrument:{type:'option',optionType:type,expiry:'current-month',strike:{mode:'atm-offset',steps:type==='CE'?2:-2}},quantity:{lots}}],
   risk:{maxHoldingDays:10}})})),
];
export const STRATEGIES=Object.freeze(RAW.map(s=>Object.freeze(s)));
export const strategyById=id=>STRATEGIES.find(s=>s.id===id)??null;
// Builds and parses the spec for one symbol; a library rule that fails to parse is a programming error.
export function buildStrategySpec(strategy,{symbol,units=1,lots=1}){
 const parsed=parseStrategySpec(strategy.build({symbol,units,lots}));
 if(!parsed.ok)throw new Error(`Library strategy ${strategy.id} is invalid: ${parsed.issues.map(i=>i.path+' '+i.message).join('; ')}`);
 return parsed.spec;
}
