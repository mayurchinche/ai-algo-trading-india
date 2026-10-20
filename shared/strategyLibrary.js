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
 // Published intraday rules added on 2026-10-19 with fixed parameters chosen before testing; whatever the
 // validation gate decides stands.
 ...['BUY','SELL'].map(side=>{const long=side==='BUY';return {id:'intraday-orb-'+(long?'long':'short'),segment:'intraday',name:`Opening range breakout ${long?'long':'short'} (15m)`,universe:'nifty50',timeframe:'15m',
  rule:`${long?'Buy':'Short'} when a 15-minute close breaks ${long?'above the high':'below the low'} of the first 30 minutes (09:15–09:45) while ${long?'above':'below'} VWAP, between 09:45 and 13:00; 1% stop; squared off at 15:15. One trade a day.`,
  reference:'Toby Crabel, “Day Trading with Short Term Price Patterns and Opening Range Breakout” (1990); Zarattini, Barbon and Aziz, “Can Day Trading Really Be Profitable?” (2023).',
  build:({symbol,units})=>({schemaVersion:1,name:`ORB ${long?'long':'short'} ${symbol}`,mode:'intraday',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'15m',
   schedule:{weekdays:WEEK,entryStart:'09:45',entryEnd:'13:00',squareOff:'15:15'},indicators:[ind('orng','opening_range',{bars:2}),ind('vw','vwap',{})],
   entry:{all:[cmp(P('close'),long?'crosses-above':'crosses-below',I('orng',long?'high':'low')),cmp(P('close'),long?'gt':'lt',I('vw'))]},
   legs:[{id:'eq',side,instrument:{type:'equity'},quantity:{units},stopLoss:pct(1)}]})};}),
 ...['BUY','SELL'].map(side=>{const long=side==='BUY';return {id:'intraday-momentum-'+(long?'long':'short'),segment:'intraday',name:`Intraday momentum ${long?'long':'short'} (15m)`,universe:'nifty50',timeframe:'15m',
  rule:`${long?'Buy':'Short'} at 15:00 when the first 30 minutes of the session (previous close to 09:45) ${long?'rose':'fell'}; squared off at 15:15; 1% stop. One trade a day.`,
  reference:'Gao, Han, Li and Zhou, “Market Intraday Momentum”, Journal of Financial Economics (2018): the first half-hour return predicts the last half-hour return. NSE intraday square-off limits the hold to 15:00–15:15.',
  build:({symbol,units})=>({schemaVersion:1,name:`Intraday momentum ${long?'long':'short'} ${symbol}`,mode:'intraday',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'15m',
   schedule:{weekdays:WEEK,entryStart:'14:59',entryEnd:'15:00',squareOff:'15:15'},indicators:[ind('orng','opening_range',{bars:2})],
   entry:cmp(I('orng','close'),long?'gt':'lt',I('orng','prevClose')),
   legs:[{id:'eq',side,instrument:{type:'equity'},quantity:{units},stopLoss:pct(1)}]})};}),
 // Opening-gap rules, added on 2026-10-19 with parameters fixed before testing.
 {id:'intraday-gap-and-go',segment:'intraday',name:'Gap-and-go (15m)',universe:'nifty50',timeframe:'15m',
  rule:'On a gap up of 1% or more, buy when a 15-minute close breaks above the first 30 minutes’ high while above VWAP, between 09:45 and 13:00; 1% stop; squared off at 15:15.',
  reference:'Opening-gap continuation with an opening-range trigger (Crabel 1990; common “gap and go” practice).',
  build:({symbol,units})=>({schemaVersion:1,name:'Gap-and-go '+symbol,mode:'intraday',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'15m',
   schedule:{weekdays:WEEK,entryStart:'09:45',entryEnd:'13:00',squareOff:'15:15'},indicators:[ind('orng','opening_range',{bars:2}),ind('vw','vwap',{})],
   entry:{all:[cmp(I('orng','gapPct'),'gte',V(1)),cmp(P('close'),'crosses-above',I('orng','high')),cmp(P('close'),'gt',I('vw'))]},
   legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units},stopLoss:pct(1)}]})},
 {id:'intraday-gap-fade',segment:'intraday',name:'Gap-up fade (15m)',universe:'nifty50',timeframe:'15m',
  rule:'On a gap up of 1% or more that fails, short when a 15-minute close breaks below the first 30 minutes’ low while below VWAP, between 09:45 and 13:00; 1% stop; squared off at 15:15.',
  reference:'Opening-gap reversal (“gap fill”) with an opening-range trigger (Crabel 1990).',
  build:({symbol,units})=>({schemaVersion:1,name:'Gap fade '+symbol,mode:'intraday',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'15m',
   schedule:{weekdays:WEEK,entryStart:'09:45',entryEnd:'13:00',squareOff:'15:15'},indicators:[ind('orng','opening_range',{bars:2}),ind('vw','vwap',{})],
   entry:{all:[cmp(I('orng','gapPct'),'gte',V(1)),cmp(P('close'),'crosses-below',I('orng','low')),cmp(P('close'),'lt',I('vw'))]},
   legs:[{id:'eq',side:'SELL',instrument:{type:'equity'},quantity:{units},stopLoss:pct(1)}]})},
 {id:'short-term-gap-continuation',segment:'short-term',name:'Gap-up continuation (daily)',universe:'nifty50',timeframe:'1d',
  rule:'After a day that gaps up 2% or more, closes above its open on at least 1.5× its 50-day average volume and above the 200-day SMA, buy the next session; exit on a close below the 20-day SMA or after 40 days; 8% stop.',
  reference:'Drift after news-driven gaps: Bernard and Thomas (1989) on post-earnings drift; Chan (2003), “Stock price reaction to news and no-news”; O’Neil’s breakaway gaps (CAN SLIM).',
  build:({symbol,units})=>({schemaVersion:1,name:'Gap continuation '+symbol,mode:'positional',underlying:{symbol,exchange:'NSE',kind:'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('gp','gap',{}),ind('vr','volume_ratio',{length:50}),ind('sma200','sma',{length:200},'close'),ind('sma20','sma',{length:20},'close')],
   entry:{all:[cmp(I('gp','pct'),'gte',V(2)),cmp(P('close'),'gt',P('open')),cmp(I('vr'),'gte',V(1.5)),cmp(P('close'),'gt',I('sma200'))]},exit:cmp(P('close'),'crosses-below',I('sma20')),
   legs:[{id:'eq',side:'BUY',instrument:{type:'equity'},quantity:{units},stopLoss:pct(8)}],risk:{maxHoldingDays:40}})},
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
  validationProxy:'futures-supertrend-'+(type==='CE'?'long':'short'),validationHoldingDays:10,
  rule:`When the daily Supertrend(10,3) turns ${type==='CE'?'up':'down'}, buy the ATM ${type} and sell the ${type} two strikes ${type==='CE'?'higher':'lower'} (current-month, defined risk); exit when the trend flips or after 10 days, or at 50% of the capital at risk.`,
  reference:'Vertical debit spread (defined-risk directional position), entry timed by Supertrend (10, 3).',
  build:({symbol,lots})=>({schemaVersion:1,name:`${type==='CE'?'Bull call':'Bear put'} spread ${symbol}`,mode:'positional',underlying:{symbol,exchange:'NSE',kind:INDEX_UNDERLYINGS.includes(symbol)?'index':'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('st','supertrend',{length:10,multiplier:3})],entry:cmp(I('st','direction'),type==='CE'?'crosses-above':'crosses-below',V(0)),exit:cmp(I('st','direction'),type==='CE'?'crosses-below':'crosses-above',V(0)),
   legs:[{id:'long_opt',side:'BUY',instrument:{type:'option',optionType:type,expiry:'current-month',strike:{mode:'atm-offset',steps:0}},quantity:{lots}},{id:'short_opt',side:'SELL',instrument:{type:'option',optionType:type,expiry:'current-month',strike:{mode:'atm-offset',steps:type==='CE'?2:-2}},quantity:{lots}}],
   risk:{maxHoldingDays:10}})})),

 // The validated 20-day breakout traded through futures: same entry, exit, stop and holding period. Paper
 // runs roll the position into the next contract two days before expiry, as a futures trader would.
 {id:'futures-breakout-long',segment:'futures',name:'Futures 20-day breakout (rolled)',universe:'fno',timeframe:'1d',
  rule:'Buy the current-month future on a close above the prior 20-day high while above the 50-day SMA; exit on a close below the prior 10-day low or after 60 days; 8% stop. The position is rolled to the next contract before expiry.',
  reference:'Turtle System 1 entry and exit (Curtis Faith, “Way of the Turtle”, 2007), applied to stock and index futures with monthly rollover.',
  build:({symbol,lots})=>({schemaVersion:1,name:'Futures breakout '+symbol,mode:'positional',underlying:{symbol,exchange:'NSE',kind:INDEX_UNDERLYINGS.includes(symbol)?'index':'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('dc20','donchian',{length:20}),ind('dc10','donchian',{length:10}),ind('sma50','sma',{length:50},'close')],
   entry:{all:[cmp(P('close'),'crosses-above',I('dc20','upper',1)),cmp(P('close'),'gt',I('sma50'))]},exit:cmp(P('close'),'crosses-below',I('dc10','lower',1)),
   legs:[{id:'fut',side:'BUY',instrument:{type:'future',expiry:'current-month'},quantity:{lots},stopLoss:pct(8)}],risk:{maxHoldingDays:60}})},
 // Added 2026-10-20 with parameters fixed before testing: the published Turtle and moving-average rules on
 // the short side and through futures, and defined-risk option spreads timed by the 20-day breakout rules.
 {id:'futures-breakdown-short',segment:'futures',name:'Futures 20-day breakdown short (rolled)',universe:'fno',timeframe:'1d',
  rule:'Sell the current-month future on a close below the prior 20-day low while below the 50-day SMA; cover on a close above the prior 10-day high or after 60 days; 8% stop. The position is rolled to the next contract before expiry.',
  reference:'Turtle System 1 short entry and exit (Curtis Faith, “Way of the Turtle”, 2007), applied to stock and index futures with monthly rollover.',
  build:({symbol,lots})=>({schemaVersion:1,name:'Futures breakdown short '+symbol,mode:'positional',underlying:{symbol,exchange:'NSE',kind:INDEX_UNDERLYINGS.includes(symbol)?'index':'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('dc20','donchian',{length:20}),ind('dc10','donchian',{length:10}),ind('sma50','sma',{length:50},'close')],
   entry:{all:[cmp(P('close'),'crosses-below',I('dc20','lower',1)),cmp(P('close'),'lt',I('sma50'))]},exit:cmp(P('close'),'crosses-above',I('dc10','upper',1)),
   legs:[{id:'fut',side:'SELL',instrument:{type:'future',expiry:'current-month'},quantity:{lots},stopLoss:pct(8)}],risk:{maxHoldingDays:60}})},
 {id:'futures-golden-trend-long',segment:'futures',name:'Futures 200-day trend (rolled)',universe:'fno',timeframe:'1d',
  rule:'Buy the current-month future when the close crosses above the 200-day SMA while the 50-day SMA is above the 200-day SMA; sell on a close below the 200-day SMA; 20% disaster stop. The position is rolled to the next contract before expiry.',
  reference:'Moving-average timing studied in Mebane Faber, “A Quantitative Approach to Tactical Asset Allocation” (2007), applied to stock and index futures with monthly rollover.',
  build:({symbol,lots})=>({schemaVersion:1,name:'Futures 200-day trend '+symbol,mode:'positional',underlying:{symbol,exchange:'NSE',kind:INDEX_UNDERLYINGS.includes(symbol)?'index':'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('sma50','sma',{length:50},'close'),ind('sma200','sma',{length:200},'close')],
   entry:{all:[cmp(P('close'),'crosses-above',I('sma200')),cmp(I('sma50'),'gt',I('sma200'))]},exit:cmp(P('close'),'crosses-below',I('sma200')),
   legs:[{id:'fut',side:'BUY',instrument:{type:'future',expiry:'current-month'},quantity:{lots},stopLoss:pct(20)}]})},
 // Option spreads: expired option prices are not available, so the timing rule is validated on the underlying
 // with the spread's own exit rule and 20-day holding limit (validationHoldingDays). Next-month contracts keep
 // roughly 20 or more sessions to expiry at entry.
 ...['CE','PE'].map(type=>{const bull=type==='CE';return {id:'options-breakout-'+(bull?'bull-call':'bear-put')+'-spread',segment:'options',name:`${bull?'Bull call':'Bear put'} spread on a 20-day ${bull?'breakout':'breakdown'}`,universe:'fno',timeframe:'1d',
  validationProxy:bull?'futures-breakout-long':'futures-breakdown-short',validationHoldingDays:20,
  rule:`On a close ${bull?'above the prior 20-day high while above':'below the prior 20-day low while below'} the 50-day SMA, buy the next-month ATM ${type} and sell the ${type} two strikes ${bull?'higher':'lower'} (defined risk); exit on a close ${bull?'below the prior 10-day low':'above the prior 10-day high'} or after 20 days.`,
  reference:`Vertical debit spread (defined-risk directional position), entry and exit timed by Turtle System 1 ${bull?'breakout':'breakdown'} rules (Curtis Faith, “Way of the Turtle”, 2007).`,
  build:({symbol,lots})=>({schemaVersion:1,name:`${bull?'Bull call':'Bear put'} spread ${symbol}`,mode:'positional',underlying:{symbol,exchange:'NSE',kind:INDEX_UNDERLYINGS.includes(symbol)?'index':'equity'},timeframe:'1d',schedule:DAY,
   indicators:[ind('dc20','donchian',{length:20}),ind('dc10','donchian',{length:10}),ind('sma50','sma',{length:50},'close')],
   entry:{all:[cmp(P('close'),bull?'crosses-above':'crosses-below',I('dc20',bull?'upper':'lower',1)),cmp(P('close'),bull?'gt':'lt',I('sma50'))]},exit:cmp(P('close'),bull?'crosses-below':'crosses-above',I('dc10',bull?'lower':'upper',1)),
   legs:[{id:'long_opt',side:'BUY',instrument:{type:'option',optionType:type,expiry:'next-month',strike:{mode:'atm-offset',steps:0}},quantity:{lots}},{id:'short_opt',side:'SELL',instrument:{type:'option',optionType:type,expiry:'next-month',strike:{mode:'atm-offset',steps:bull?2:-2}},quantity:{lots}}],
   risk:{maxHoldingDays:20}})};}),

];
// Distance from the last close to the price that would trigger each breakout-style entry, for "near a trigger"
// watchlists. Returns null when the rule has no single price level (for example a pending moving-average cross).
const BREAKOUT_LEVEL={'short-term-donchian':{high:20,above:'sma50'},'futures-breakout-long':{high:20,above:'sma50'},'options-breakout-bull-call-spread':{high:20,above:'sma50'},'long-term-52w-high':{high:250}};
export function triggerLevel(strategyId,bars){
 const cfg=BREAKOUT_LEVEL[strategyId],c=bars.at(-1)?.close;
 if(strategyId==='long-term-golden-trend'||strategyId==='futures-golden-trend-long'){
  if(bars.length<200)return null;const avg=n=>bars.slice(-n).reduce((a,b)=>a+b.close,0)/n,s50=avg(50),s200=avg(200);
  return s50>s200&&c<s200?{level:s200,distancePct:(s200/c-1)*100,condition:'close above the 200-day average (50-day is above it)'}:null;
 }
 if(!cfg||bars.length<cfg.high+1)return null;
 const level=Math.max(...bars.slice(-cfg.high).map(b=>b.high));
 if(cfg.above){const s=bars.slice(-50).reduce((a,b)=>a+b.close,0)/50;if(c<=s)return null;}
 return {level,distancePct:(level/c-1)*100,condition:`next close above the ${cfg.high}-day high`};
}
export const STRATEGIES=Object.freeze(RAW.map(s=>Object.freeze(s)));
export const strategyById=id=>STRATEGIES.find(s=>s.id===id)??null;
// Builds and parses the spec for one symbol; a library rule that fails to parse is a programming error.
export function buildStrategySpec(strategy,{symbol,units=1,lots=1}){
 const parsed=parseStrategySpec(strategy.build({symbol,units,lots}));
 if(!parsed.ok)throw new Error(`Library strategy ${strategy.id} is invalid: ${parsed.issues.map(i=>i.path+' '+i.message).join('; ')}`);
 return parsed.spec;
}
