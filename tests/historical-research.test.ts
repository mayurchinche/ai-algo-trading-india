import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsOfMarket,validateBars} from '../research/asOfMarket';
import type {ResearchBar} from '../research/asOfMarket';
import {normalizeKiteCandles,fetchKiteHistory} from '../research/kiteHistory.js';
import {evaluateDiscoverySnapshot} from '../src/services/discoveryScoring';
const open=Date.parse('2026-09-07T09:15:00+05:30');
function fixture(){
 const daily:ResearchBar[]=Array.from({length:500},(_,i)=>{const start=open-(500-i)*86400000,price=100+i*.1;return {symbol:'TEST.NS',interval:'day',start,end:start+22500000,availableAt:start+22501000,open:price,high:price+1,low:price-1,close:price,volume:2e6};});
 const minutes:ResearchBar[]=Array.from({length:40},(_,i)=>({symbol:'TEST.NS',interval:'minute',start:open+i*60000,end:open+(i+1)*60000,availableAt:open+(i+1)*60000+1000,open:150,high:151,low:149,close:150,volume:100000}));
 return [...daily,...minutes];
}
test('unfinished candles and publication lag remain invisible',()=>{
 const market=createAsOfMarket(fixture());assert.equal(market.snapshot('TEST.NS',open+60000).status,'NO_COMPLETED_MINUTE');assert.equal(market.snapshot('TEST.NS',open+61000).status,'SCORED');
});
test('decisions are invariant to removal or mutation of future outcomes',()=>{
 const bars=fixture(),now=open+30*60000+1000;
 const all=createAsOfMarket(bars).snapshot('TEST.NS',now);
 const prefix=createAsOfMarket(bars.filter(b=>b.availableAt<=now)).snapshot('TEST.NS',now);
 const poisoned=createAsOfMarket(bars.map(b=>b.availableAt>now?{...b,open:9000,high:9999,low:1,close:9000,volume:1e12}:b)).snapshot('TEST.NS',now);
 assert.deepEqual(all,prefix);assert.deepEqual(all,poisoned);assert.equal(all.status,'SCORED');
 if(all.status==='SCORED'){assert.equal(all.stock.volume,3e6);assert.equal(all.stock.generatedAt,new Date(now).toISOString());}
});
test('missing bars, stale data and duplicate rows cannot become a valid signal',()=>{
 const bars=fixture(),now=open+30*60000+1000;
 assert.equal(createAsOfMarket(bars.filter(b=>b.start!==open+60000)).snapshot('TEST.NS',now).status,'INCOMPLETE_SESSION_PREFIX');
 assert.throws(()=>validateBars([...bars,bars.at(-1)!]),/Duplicate/);
 assert.equal(createAsOfMarket(bars).snapshot('TEST.NS',open+50*60000).status,'STALE_CANDLE');
 const market=createAsOfMarket(bars);bars[0].close=9999;assert.equal(market.snapshot('TEST.NS',now).status,'SCORED');
});
test('same past bars and metadata produce the same score in research and shared scorer',()=>{
 const bars=fixture(),now=open+30*60000+1000,result=createAsOfMarket(bars).snapshot('TEST.NS',now);
 assert.equal(result.status,'SCORED');if(result.status!=='SCORED')return;
 const history=bars.filter(b=>b.interval==='day'),year=history.filter(b=>b.start>=open-365*86400000);
 const direct=evaluateDiscoverySnapshot('TEST.NS',{dates:history.map(b=>new Date(b.start+19800000).toISOString().slice(0,10)),closes:history.map(b=>b.close),highs:history.map(b=>b.high),lows:history.map(b=>b.low),volumes:history.map(b=>b.volume),meta:{regularMarketPrice:150,regularMarketTime:(now-1000)/1000,regularMarketVolume:3e6,fiftyTwoWeekHigh:151,fiftyTwoWeekLow:Math.min(...year.map(b=>b.low),149)}},now);
 assert.deepEqual(result.stock,direct);
});
test('Kite normalization exposes data after interval completion; rejects bad candles',()=>{
 const rows=[['2026-09-07T09:15:00+0530',100,102,99,101,50,7]];
 const [bar]=normalizeKiteCandles(rows,{symbol:'TEST',interval:'minute'});assert.equal(bar.availableAt,open+61000);assert.equal(bar.oi,7);
 assert.throws(()=>normalizeKiteCandles([...rows,...rows],{symbol:'TEST',interval:'minute'}),/unordered/);
 assert.throws(()=>normalizeKiteCandles([['2026-09-07T09:15:00',100,102,99,101,50]],{symbol:'TEST',interval:'minute'}),/timezone/);
});
test('Kite adapter makes no call without auth and never leaks provider errors',async()=>{
 let called=false;assert.deepEqual(await fetchKiteHistory({},async()=>{called=true;}),{status:'CREDENTIALS_MISSING'});assert.equal(called,false);
 const req={apiKey:'synthetic',accessToken:'synthetic',symbol:'TEST',instrumentToken:123,from:'2026-09-07',to:'2026-09-07'};
 const result=await fetchKiteHistory(req,async(url:any,options:any)=>{assert.equal(url.hostname,'api.kite.trade');assert.equal(options.method,'GET');return {ok:false,status:403};});assert.equal(result.status,'AUTH_OR_ENTITLEMENT_FAILED');
 assert.deepEqual(await fetchKiteHistory(req,async()=>{throw new Error('secret provider response');}),{status:'TRANSPORT_OR_SCHEMA_FAILED'});
});
import golden from './fixtures/discovery-golden.json';
test('shared scorer preserves pre-extraction outputs for rising, falling and sideways histories',()=>{
 for(const c of golden.cases){
  const closes=Array.from({length:500},(_,i)=>150+c.direction*(i-250)*.1+Math.sin(i/7));
  const hist={dates:closes.map((_,i)=>new Date(golden.now-(500-i)*86400000).toISOString().slice(0,10)),closes,highs:closes.map(p=>p+2),lows:closes.map(p=>p-2),volumes:closes.map(()=>2e6),meta:{regularMarketPrice:closes.at(-1),regularMarketTime:(golden.now-1000)/1000,regularMarketVolume:4e6,fiftyTwoWeekHigh:180,fiftyTwoWeekLow:120}};
  assert.deepEqual(evaluateDiscoverySnapshot('TEST.NS',hist,golden.now),c.expected);
 }
});
test('five-minute research also hides unfinished bars and future outcomes',()=>{
 const daily=fixture().filter(b=>b.interval==='day');
 const five=Array.from({length:8},(_,i)=>({symbol:'TEST.NS',interval:'5minute' as const,start:open+i*300000,end:open+(i+1)*300000,availableAt:open+(i+1)*300000+1000,open:150,high:151,low:149,close:150,volume:500000}));
 const all=[...daily,...five],now=open+1800000+1000;
 assert.equal(createAsOfMarket(all,'5minute').snapshot('TEST.NS',open+300000).status,'NO_COMPLETED_MINUTE');
 assert.deepEqual(createAsOfMarket(all,'5minute').snapshot('TEST.NS',now),createAsOfMarket(all.filter(b=>b.availableAt<=now),'5minute').snapshot('TEST.NS',now));
});
