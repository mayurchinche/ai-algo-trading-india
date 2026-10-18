import test from 'node:test';import assert from 'node:assert/strict';
import {computeTrendScore,trendZone,TREND_MODEL} from '../shared/trendScore.js';
import {replayTrendSymbol,summarizeTrendReplay} from '../research/trendReplay.js';
const day=(i:number)=>new Date(Date.UTC(2024,0,1)+i*86400000).toISOString().slice(0,10);
// Flat, then a steady rise, then a steady fall: a known trend start and end.
const path=Array.from({length:120},(_,i)=>i<40?100+Math.sin(i)*0.5:i<80?100+(i-40)*1.5:160-(i-80)*1.5);
const series=(closes:number[])=>({dates:closes.map((_,i)=>day(i)),close:closes,high:closes.map(c=>c+1),low:closes.map(c=>c-1)});
const bars=(closes:number[])=>closes.map((c,i)=>({date:day(i),open:i?closes[i-1]:c,high:c+1,low:c-1,close:c}));

test('score is bounded, warm-up is null and zones follow 4 and 7',()=>{
 const r=computeTrendScore(series(path));
 const first=r.score.findIndex(s=>s!==null);assert(first>=TREND_MODEL.zlemaLength);assert(r.score.slice(0,first).every(s=>s===null));
 assert(r.score.slice(first).every(s=>s!==null&&s>=0&&s<=10));
 assert.deepEqual([trendZone(3.99),trendZone(4),trendZone(6.99),trendZone(7),trendZone(null)],['BEARISH','NEUTRAL','NEUTRAL','BULLISH',null]);
 assert.equal(r.zone[60],'BULLISH');assert.equal(r.zone[110],'BEARISH');
});
test('one BUY in the rise and one SELL in the fall, with no re-entry while in trend',()=>{
 const r=computeTrendScore(series(path));
 assert.deepEqual(r.signals.map(s=>s.type),['BUY','SELL']);
 const [buy,sell]=r.signals;assert(buy.index>40&&buy.index<60,`buy at ${buy.index}`);assert(sell.index>80&&sell.index<95,`sell at ${sell.index}`);
 assert(buy.score>=7&&r.score[buy.index-1]!<7);assert(sell.score<=4);
 assert.equal(r.latest.status,'SCORED');if(r.latest.status==='SCORED'){assert.equal(r.latest.inTrend,false);assert.equal(r.latest.sessionsSinceSignal,119-sell.index);assert.equal(r.latest.category,null);}
});
test('signals and scores never use later bars',()=>{
 const full=computeTrendScore(series(path));
 for(const k of [45,55,85,100]){
  const prefix=computeTrendScore(series(path.slice(0,k)));
  assert.deepEqual(prefix.score,full.score.slice(0,k));assert.deepEqual(prefix.signals,full.signals.filter(s=>s.index<k));
 }
 const start=computeTrendScore(series(path.slice(0,full.signals[0].index+2)));
 if(start.latest.status==='SCORED'){assert.equal(start.latest.category,'TREND_START');assert.equal(start.latest.sessionsSinceSignal,1);}
});
test('invalid bars and short history are explicit',()=>{
 assert.throws(()=>computeTrendScore({...series(path),close:path.slice(1)}));
 assert.throws(()=>computeTrendScore({...series(path),low:path.map(c=>c+2)}));
 assert.throws(()=>computeTrendScore({...series(path),dates:path.map(()=>'2024-01-01')}));
 assert.equal(computeTrendScore(series(path.slice(0,10))).latest.status,'INSUFFICIENT_HISTORY');
});

test('replay fills at the next open, charges the round-trip cost and marks open trades separately',()=>{
 const b=bars(path),r=replayTrendSymbol('TEST',b),signals=computeTrendScore(series(path)).signals;
 assert.equal(r.trades.length,1);const t=r.trades[0];
 assert.equal(t.entryIndex,signals[0].index+1);assert.equal(t.entry,b[signals[0].index+1].open);assert.equal(t.exit,b[signals[1].index+1].open);
 assert.equal(t.net,t.gross-0.0025);assert.equal(r.openTrade,null);
 assert(Math.abs(r.strategy.netReturn-((1+t.gross)*(1-0.0025)-1))<1e-12,'equity equals the single trade after cost');
 const open=replayTrendSymbol('TEST',bars(path.slice(0,70)));assert.equal(open.trades.length,0);assert.equal(open.openTrade.status,'OPEN_MARKED_AT_LAST_CLOSE');
});
test('summary applies the pre-declared criteria and never passes on too few trades',()=>{
 const s=summarizeTrendReplay([replayTrendSymbol('A',bars(path)),replayTrendSymbol('B',bars(path.map(c=>c*2)))]);
 assert.equal(s.trades.closed,2);assert.equal(s.checks.enoughTrades,false);assert.equal(s.status,'NOT_VALIDATED');
 assert.equal(s.forwardStudy.length,2);assert.equal(s.strategyVersusBuyAndHold.symbols,2);
});
