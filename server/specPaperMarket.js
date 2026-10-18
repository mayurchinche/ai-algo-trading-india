import {createUpstoxReader,getTradingInstruments,normalizeUpstoxQuotes,MarketDataError} from './upstoxReadOnly.js';
import {createUpstoxMarginCalculator} from './upstoxMargin.js';
import {createOptionChainReader,OPTION_UNDERLYINGS} from './optionChain.js';
import {selectStrike} from '../shared/optionChain.js';
import {TIMEFRAME_MS} from '../shared/specEngine.js';
// Upstox market data for spec paper runs: underlying bars, live quotes with depth, 1-minute candles of held
// contracts, contract resolution and the broker margin calculator. Nothing here places or modifies orders.
const UNIT={'1m':['minutes',1,20],'3m':['minutes',3,20],'5m':['minutes',5,20],'15m':['minutes',15,25],'30m':['minutes',30,25],'1h':['hours',1,90],'1d':['days',1,400]};
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);
export function parseCandles(candles,timeframe,now){
 const tf=TIMEFRAME_MS[timeframe],byTime=new Map();
 for(const c of candles){
  if(!Array.isArray(c)||typeof c[0]!=='string')continue;
  const time=timeframe==='1d'?Date.parse(c[0].slice(0,10)+'T00:00:00+05:30'):Date.parse(c[0]);
  const [open,high,low,close,volume]=c.slice(1,6);
  if(![time,open,high,low,close].every(Number.isFinite)||low<=0||low>Math.min(open,close)||high<Math.max(open,close))continue;
  const end=timeframe==='1d'?Date.parse(istDate(time)+'T15:30:00+05:30'):time+tf;
  if(end>now)continue;// in-progress bar
  byTime.set(time,{time,open,high,low,close,volume:Number.isFinite(volume)?volume:0});
 }
 return [...byTime.values()].sort((a,b)=>a.time-b.time);
}
export function createSpecPaperMarket({read=createUpstoxReader(),master=getTradingInstruments,chains=createOptionChainReader({read,master}),margin=createUpstoxMarginCalculator()}={}){
 async function underlyingKey(spec){
  if(spec.underlying.kind==='index'){const k=OPTION_UNDERLYINGS[spec.underlying.symbol];if(!k)throw new MarketDataError('UNSUPPORTED_UNDERLYING');return k;}
  const row=(await master()).find(r=>r.segment==='NSE_EQ'&&r.instrument_type==='EQ'&&r.trading_symbol===spec.underlying.symbol);
  if(!row)throw new MarketDataError('UNDERLYING_NOT_FOUND');return row.instrument_key;
 }
 return {
  underlyingKey,
  async bars(spec,key,now){
   const [unit,n,days]=UNIT[spec.timeframe],enc=encodeURIComponent(key);
   const hist=await read(`/v3/historical-candle/${enc}/${unit}/${n}/${istDate(now-86400000)}/${istDate(now-days*86400000)}`);
   const today=unit==='days'?{candles:[]}:await read(`/v3/historical-candle/intraday/${enc}/${unit}/${n}`);
   if(!Array.isArray(hist?.candles)||!Array.isArray(today?.candles))throw new MarketDataError('INVALID_CANDLE_RESPONSE');
   return parseCandles([...hist.candles,...today.candles],spec.timeframe,now);
  },
  async quotes(keys,now){
   if(!keys.length)return new Map();
   return new Map(normalizeUpstoxQuotes(await read('/v3/market-quote/quotes?instrument_key='+encodeURIComponent(keys.join(','))),keys,now).map(q=>[q.symbol,q]));
  },
  // Contract for one leg at entry time: equity, nearest/next futures, or an option strike on the live chain.
  async resolveLeg(spec,leg,key,now){
   const ins=leg.instrument;
   if(ins.type==='equity')return {instrumentKey:key,lotSize:1,description:spec.underlying.symbol};
   if(ins.type==='future'){
    const rows=(await master()).filter(r=>r.segment==='NSE_FO'&&r.instrument_type==='FUT'&&r.underlying_key===key&&r.expiry>now&&Number.isInteger(r.lot_size)).sort((a,b)=>a.expiry-b.expiry);
    const row=rows[ins.expiry==='next-month'?1:0];if(!row)throw new MarketDataError('FUTURE_NOT_FOUND');
    return {instrumentKey:row.instrument_key,lotSize:row.lot_size,description:row.trading_symbol,expiry:istDate(row.expiry)};
   }
   const chain=await chains({underlying:spec.underlying.kind==='index'?spec.underlying.symbol:key,expiry:ins.expiry});
   const sel=selectStrike(chain,ins.optionType,ins.strike);
   if(sel.status!=='SELECTED')throw new MarketDataError('STRIKE_'+sel.status);
   if(!sel.contract.lotSize)throw new MarketDataError('LOT_SIZE_UNKNOWN');
   return {instrumentKey:sel.contract.instrumentKey,lotSize:sel.contract.lotSize,description:`${spec.underlying.symbol} ${chain.expiry} ${sel.strike} ${ins.optionType}`,strike:sel.strike,expiry:chain.expiry};
  },
  // Completed 1-minute candles of one contract that start at or after `since`: today's intraday series plus
  // earlier sessions (up to 28 days back) when a position was held overnight.
  async minuteBars(key,since,now){
   const enc=encodeURIComponent(key),todayStart=Date.parse(istDate(now)+'T00:00:00+05:30');
   const today=await read(`/v3/historical-candle/intraday/${enc}/minutes/1`);
   const hist=since<todayStart?await read(`/v3/historical-candle/${enc}/minutes/1/${istDate(now-86400000)}/${istDate(Math.max(since,now-28*86400000))}`):{candles:[]};
   if(!Array.isArray(hist?.candles)||!Array.isArray(today?.candles))throw new MarketDataError('INVALID_CANDLE_RESPONSE');
   return parseCandles([...hist.candles,...today.candles],'1m',now).filter(b=>b.time>=since);
  },
  margin,
  async marketOpen(){const s=await read('/v2/market/status/NSE');if(typeof s?.status!=='string')throw new MarketDataError('MARKET_STATUS_INVALID');return s.status==='NORMAL_OPEN';},
 };
}
