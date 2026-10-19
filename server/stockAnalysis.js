// Assembles the stock analysis for one NSE symbol (or index) from independent sources. Each section carries its
// own status, so an unavailable source never blocks or silently fills another.
import {technicalProfile,optionChainSummary,dealsSummary,deliverySummary,peerRanks,buildSwot,ANALYSIS_VERSION} from '../shared/stockAnalysis.js';
import {STRATEGIES,INDEX_UNDERLYINGS,buildStrategySpec} from '../shared/strategyLibrary.js';
import {SEGMENTS} from '../shared/tradingHorizon.js';
import {createEngineState,stepEngine,computeStrategySeries} from '../shared/specEngine.js';
import {deriveFundamentals} from './fundamentals.js';
import {FUNDAMENTAL_READ_LIMIT} from './fundamentalsStore.js';
import {fetchNews} from './marketNews.js';
import {OPTION_UNDERLYINGS} from './optionChain.js';
import {MarketDataError} from './upstoxReadOnly.js';
import {nseDate,DEALS_URLS,parseDeals} from './marketIntel.js';
import {validUntilOf} from './signalEngine.js';
const DAY=86400000;
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);
const reason=e=>e instanceof MarketDataError?e.code:e?.code??'SOURCE_UNAVAILABLE';
// Takes a thunk so a synchronous failure (e.g. storage not configured) is contained like a rejected promise.
const settle=async(f)=>{try{return {status:'OK',value:await f()};}catch(e){return {status:'UNAVAILABLE',reason:reason(e)};}};
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// Latest NSE corporate announcements for a symbol (newest first).
export async function readAnnouncements(symbol,{fetcher=fetch,limit=15}={}){
 const r=await fetcher('https://www.nseindia.com/api/corporate-announcements?index=equities&symbol='+encodeURIComponent(symbol),{headers:{'User-Agent':UA,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Object.assign(new Error('announcements'),{code:'NSE_UNAVAILABLE'});
 const body=Buffer.from(await r.arrayBuffer());if(body.length>8e6)throw Object.assign(new Error('large'),{code:'NSE_RESPONSE_TOO_LARGE'});
 const rows=JSON.parse(body.toString('utf8'));if(!Array.isArray(rows))throw Object.assign(new Error('format'),{code:'ANNOUNCEMENTS_FORMAT_CHANGED'});
 return rows.slice(0,limit).map(a=>({date:nseDate(String(a.an_dt??'').slice(0,11))??null,time:a.an_dt??null,subject:String(a.desc??''),text:String(a.attchmntText??'').slice(0,600),url:typeof a.attchmntFile==='string'&&a.attchmntFile.startsWith('https://nsearchives.nseindia.com/')?a.attchmntFile:null,company:a.sm_name??null,industry:a.smIndustry??null}));
}
// Where the simulation of each daily library strategy stands today on this symbol.
export function strategyStates(symbol,bars,{index=false}={}){
 return STRATEGIES.filter(s=>s.timeframe==='1d'&&(s.universe==='fno'||!index)).map(s=>{
  try{
   const spec=buildStrategySpec(s,{symbol}),state=createEngineState(spec,{capital:1e9}),series=computeStrategySeries(spec,bars);
   for(let i=0;i<bars.length;i++){const b=bars[i],q={open:b.open,high:b.high,low:b.low,close:b.close};stepEngine(spec,state,series,i,Object.fromEntries(spec.legs.map(l=>[l.id,q])));}
   const e=state.entries.at(-1);
   return {strategyId:s.id,segment:s.segment,name:s.name,state:state.pending?.kind==='ENTRY'?'ENTRY_SIGNAL_TODAY':state.pending?.kind==='EXIT'?'EXIT_SIGNAL_TODAY':state.status==='OPEN'?'IN_POSITION':'WAITING',
    since:state.status==='OPEN'?istDate(e.time):null,lastExit:state.lastExit?{date:istDate(state.lastExit.time),reason:state.lastExit.reason}:null};
  }catch{return {strategyId:s.id,segment:s.segment,name:s.name,state:'UNAVAILABLE'};}
 });
}
export function segmentViews({tech,fno,chain,validations,states,ranks,fundamentals,delivery}){
 const ok=tech?.status==='OK';
 const facts={
  intraday:ok?[['Average daily range',tech.volatility.avgDailyRangePct,'%'],['Average opening gap',tech.volatility.avgOpeningGapPct,'%'],['ATR (14)',tech.volatility.atrPct,'% of price'],['Average traded value (20d)',tech.volume.avg20*tech.close/1e7,'₹ crore'],['Last session volume vs 20-day average',tech.volume.ratio,'×'],['Pivot / R1 / S1',[tech.levels.pivot,tech.levels.r1,tech.levels.s1].map(v=>v.toFixed(2)).join(' / '),''],['Delivery, latest',delivery?.latest?.deliveryPct??null,'%']]:[],
  swing:ok?[['RSI (14)',tech.momentum.rsi14,''],['MACD histogram',tech.momentum.macdHistogram,''],['20-day support / resistance',`${tech.levels.support20d?.toFixed(2)} / ${tech.levels.resistance20d?.toFixed(2)}`,''],['Bollinger %B',tech.bands.percentB,''],['1-week / 1-month return',`${tech.returnsPct['1w']?.toFixed(2)}% / ${tech.returnsPct['1m']?.toFixed(2)}%`,'']]:[],
  'short-term':ok?[['Trend score (0–10)',tech.trendScore?.score??null,''],['Price vs 50-day average',(tech.close/tech.movingAverages.sma50-1)*100,'%'],['55-day support / resistance',`${tech.levels.support55d?.toFixed(2)} / ${tech.levels.resistance55d?.toFixed(2)}`,''],['3-month return',tech.returnsPct['3m'],'%']]:[],
  'long-term':[...(ok?[['Price vs 200-day average',tech.movingAverages.sma200?(tech.close/tech.movingAverages.sma200-1)*100:null,'%'],['1-year return',tech.returnsPct['1y'],'%'],['Below 52-week high',tech.range.belowHighPct,'%']]:[]),...ranks.map(r=>[`${r.label} (NIFTY 50 percentile)`,r.percentile,''])],
  futures:fno?[['Futures available','yes',''],['Nearest future',fno.nearest?.trading_symbol??'—',''],['Lot size',fno.nearest?.lot_size??null,''],['Expiry',fno.nearest?istDate(fno.nearest.expiry):null,'']]:[['Futures available','no (not in the F&O list)','']],
  options:chain?[['Put-call OI ratio',chain.putCallOiRatio,''],['Max pain',chain.maxPain,''],['ATM IV (call / put)',`${fmtPct(chain.atmIv.CE)} / ${fmtPct(chain.atmIv.PE)}`,''],['Highest call OI strikes',chain.callOiWall.map(x=>x.strike).join(', '),''],['Highest put OI strikes',chain.putOiWall.map(x=>x.strike).join(', '),''],['Expiry',chain.expiry,'']]:[['Option chain','unavailable','']],
 };
 return SEGMENTS.map(seg=>{
  const v=validations.filter(x=>x.segment===seg.id),st=states.filter(x=>x.segment===seg.id);
  return {...seg,facts:facts[seg.id].map(([label,value,unit])=>({label,value,unit})),
   strategies:STRATEGIES.filter(s=>s.segment===seg.id).map(s=>{const val=v.find(x=>x.strategyId===s.id),state=st.find(x=>x.strategyId===s.id);return {id:s.id,name:s.name,verdict:val?.verdict??'NOT_VALIDATED_YET',stats:val?.onSymbol?.stats??null,buyHoldPct:val?.onSymbol?.buyHoldPct??null,state:state?.state??null,since:state?.since??null};}),
   fundamentalsNote:seg.id==='long-term'&&!ranks.length?(fundamentals?.status==='OK'?'Fundamentals available but too few comparable peers':'Fundamentals not available for this company'):null};
 });
}
const fmtPct=v=>v===null||v===undefined?'—':(v*100).toFixed(1)+'%';

export async function analyzeStock(symbol,{market,master,fundamentals,scorecards,signals,delivery,news=fetchNews,announcements=readAnnouncements,now,fetcher=fetch}){
 const at=now(),index=INDEX_UNDERLYINGS.includes(symbol);
 const rows=await master(),eq=index?null:rows.find(r=>r.segment==='NSE_EQ'&&r.instrument_type==='EQ'&&r.trading_symbol===symbol);
 if(!index&&!eq)return {status:'NOT_FOUND',symbol};
 const key=index?OPTION_UNDERLYINGS[symbol]:eq.instrument_key,name=index?symbol:eq.name;
 const futs=rows.filter(r=>r.segment==='NSE_FO'&&r.instrument_type==='FUT'&&r.underlying_key===key&&r.expiry>at).sort((a,b)=>a.expiry-b.expiry);
 const fno=futs.length?{nearest:futs[0],next:futs[1]??null}:null;
 const [bars,quote,fund,cards,validations,recent,news_,ann,deals,live,deliv,flows,chain]=await Promise.all([
  settle(()=>market.history(key,'1d',at-760*DAY,at)),
  settle(()=>market.quotes([key,...(fno?[fno.nearest.instrument_key]:[])],at)),
  index?{status:'NOT_APPLICABLE'}:settle(()=>fundamentals.forInstrument(key)),
  index?{status:'NOT_APPLICABLE'}:settle(()=>scorecards()),
  settle(()=>signals.validations()),settle(()=>signals.signals(200)),
  settle(()=>news(name.replace(/ (Limited|Ltd\.?)$/i,''),{topic:'company',days:7})),
  index?{status:'NOT_APPLICABLE'}:settle(()=>announcements(symbol,{fetcher})),
  index?{status:'NOT_APPLICABLE'}:settle(()=>signals.dealsFor(symbol,istDate(at-365*DAY))),
  index?{status:'NOT_APPLICABLE'}:settle(()=>Promise.all(Object.entries(DEALS_URLS).map(async([kind,url])=>{const r=await fetcher(url,{headers:{'User-Agent':UA},redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Object.assign(new Error('deals'),{code:'NSE_UNAVAILABLE'});return parseDeals(await r.text(),kind);})).then(x=>x.flat().filter(d=>d.symbol===symbol))),
  index?{status:'NOT_APPLICABLE'}:settle(()=>delivery(symbol,at)),
  settle(()=>signals.flows(4)),
  fno?settle(()=>market.optionChain({underlying:index?symbol:key,expiry:'current-month'})):{status:'NOT_APPLICABLE'},
 ]);
 const tech=bars.status==='OK'?technicalProfile(bars.value):{status:'UNAVAILABLE',reason:bars.reason};
 const close=tech.status==='OK'?{status:'OBSERVED',instrumentKey:key,value:tech.close,currency:'INR',date:tech.asOf,source:'UPSTOX_HISTORICAL_CANDLE_V3',observedAt:new Date(at).toISOString()}:{status:'UNAVAILABLE',instrumentKey:key};
 const fundamentalsOut=fund.status==='OK'?deriveFundamentals(fund.value.map(r=>r.filing),{instrumentKey:key,asOf:at,price:close,truncated:fund.value.length>=FUNDAMENTAL_READ_LIMIT}):fund;
 const card=cards.status==='OK'?cards.value.companies?.find(c=>c.symbol===symbol)??null:null,ranks=peerRanks(card);
 const myValidations=validations.status==='OK'?validations.value.filter(v=>v.symbol===symbol).map(v=>v.record):[];
 const mySignals=recent.status==='OK'?recent.value.filter(r=>r.signal.symbol===symbol).map(r=>{const validUntil=validUntilOf(r.signal);return {...r.signal,validUntil,status:at>validUntil?'EXPIRED':'ACTIVE'};}):[];
 const dealRows=[...(deals.status==='OK'?deals.value.map(d=>({date:d.trade_date,kind:d.kind,client:d.client,side:d.side,quantity:Number(d.quantity),price:Number(d.price)})):[]),
  ...(live.status==='OK'?live.value.filter(d=>!(deals.value??[]).some(s=>s.trade_date===d.date&&s.client===d.client&&Number(s.quantity)===d.quantity)).map(({symbol:_s,...d})=>d):[])];
 const dealSum=deals.status==='OK'||live.status==='OK'?dealsSummary(dealRows):null;
 const delivSum=deliv.status==='OK'?deliverySummary(deliv.value.days):null;
 const flowRows=flows.status==='OK'?flows.value.map(f=>({date:f.trade_date,category:f.category,buy:Number(f.buy_value),sell:Number(f.sell_value),net:Number(f.net_value)})):[];
 const chainSum=chain.status==='OK'?optionChainSummary(chain.value):null;
 const states=bars.status==='OK'?strategyStates(symbol,bars.value,{index}):[];
 const quoteRow=quote.status==='OK'?quote.value.get(key)??null:null,futQuote=quote.status==='OK'&&fno?quote.value.get(fno.nearest.instrument_key)??null:null;
 return {status:'OK',version:ANALYSIS_VERSION,symbol,name,instrumentKey:key,isIndex:index,industry:ann.status==='OK'?ann.value[0]?.industry??null:null,computedAt:new Date(at).toISOString(),
  quote:quoteRow?{price:quoteRow.price,bid:quoteRow.bid,ask:quoteRow.ask,spreadPct:quoteRow.spread*100,timestamp:quoteRow.timestamp,depth:quoteRow.depth}:{status:quote.status==='OK'?'NO_FRESH_QUOTE':'UNAVAILABLE',reason:quote.reason??null},
  futures:fno?{nearest:{symbol:fno.nearest.trading_symbol,expiry:istDate(fno.nearest.expiry),lotSize:fno.nearest.lot_size,price:futQuote?.price??null,basisPct:futQuote&&quoteRow?(futQuote.price/quoteRow.price-1)*100:null},next:fno.next?{symbol:fno.next.trading_symbol,expiry:istDate(fno.next.expiry)}:null}:null,
  technicals:tech,fundamentals:fundamentalsOut,peerRanks:ranks,scorecard:card?{composite:card.composite,styles:card.styles.map(s=>({id:s.id,label:s.label,status:s.status,score:s.score}))}:null,
  news:news_.status==='OK'?{articles:news_.value.articles.slice(0,20),summary:news_.value.summary,source:news_.value.source}:news_,
  announcements:ann.status==='OK'?ann.value:ann,
  deals:dealSum?{...dealSum,rows:dealRows.slice(0,50),coverage:deals.status==='OK'?'Recorded daily since the market-day job was enabled, plus today’s published files':'Today’s published files only (storage unavailable)'}:{status:'UNAVAILABLE'},
  delivery:delivSum?{...delivSum,history:deliv.value.days,source:deliv.value.source}:deliv,
  flows:flowRows,optionChain:chainSum??(chain.status==='NOT_APPLICABLE'?{status:'NOT_FNO'}:chain),
  validations:myValidations,signals:mySignals,strategyStates:states,
  swot:buildSwot({tech,ranks,news:news_.status==='OK'?news_.value:null,deals:dealSum,delivery:delivSum,flows:flowRows.slice(0,2),signals:mySignals,announcements:ann.status==='OK'?ann.value:[]}),
  segments:segmentViews({tech,fno,chain:chainSum,validations:myValidations,states,ranks,fundamentals:fund,delivery:delivSum}),
  limitations:['Prices: Upstox completed daily candles; the live quote is read-only.','Fundamentals come only from NSE XBRL filings stored since FY2025; banks, NBFCs and insurers are not parsed.','News tone is a headline keyword count, not a reading of the articles.','Bulk/block deal history starts when the market-day job was enabled; NSE publishes only the latest day as a file.','Peer percentiles compare against NIFTY 50 members only and are not sector-adjusted.']};
}
