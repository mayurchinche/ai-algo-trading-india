import test from 'node:test';
import assert from 'node:assert/strict';
import { atr, bollinger, crossover, crossunder, donchian, ema, macd, rma, rsi, sma, stdev, supertrend, technicalRating, trueRange, vwap, zlema } from '../shared/indicators.js';
import { simulateBacktest } from '../src/services/backtestEngine';
import golden from './fixtures/backtest-golden.json';

const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
// Wilder's RSI worked example (StockCharts ChartSchool closes).
const closes = [44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46.00,46.03,46.41,46.22,45.64,46.21,46.25,45.71,46.45,45.78,45.35,44.03,44.18,44.22,44.57,43.42,42.66,43.13];

test('warm-up bars are NaN and outputs keep input length', () => {
  const out = sma([1, 2, 3, 4], 3);
  assert.equal(out.length, 4); assert.ok(Number.isNaN(out[1])); assert.equal(out[2], 2); assert.equal(out[3], 3);
  assert.ok(rsi(closes, 14).slice(0, 14).every(Number.isNaN));
  assert.ok(atr([2, 3], [1, 1], [1.5, 2], 14).every(Number.isNaN));
});

test('Wilder RSI matches the hand-derived worked example', () => {
  // First 14 changes: gains 3.34, losses 1.40 -> RS = (3.34/14)/(1.40/14); next change is 0.00, then -0.28.
  const out = rsi(closes, 14);
  near(out[14], 100 - 100 / (1 + 3.34 / 1.40), 1e-9);
  const gain = 3.34 / 14 * 13 / 14, loss = (1.40 / 14 * 13 + 0.28) / 14;
  near(out[15], 100 - 100 / (1 + gain / loss), 1e-9);
  near(out[14], 70.4641, 1e-4);
  assert.equal(rsi([1, 2, 3, 4], 3)[3], 100);
  assert.equal(rsi([4, 3, 2, 1], 3)[3], 0);
});

test('Cutler RSI uses plain averages of the latest changes', () => {
  const out = rsi(closes, 14, { method: 'simple' });
  let gains = 0, losses = 0;
  for (let i = closes.length - 14; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gains += d; else losses -= d; }
  near(out.at(-1)!, 100 - 100 / (1 + gains / losses), 1e-9);
});

test('EMA seeds are explicit: SMA seed (standard) and first-value seed (legacy)', () => {
  const standard = ema([2, 4, 6, 8], 3);
  assert.ok(Number.isNaN(standard[1])); assert.equal(standard[2], 4); assert.equal(standard[3], 8 * 0.5 + 4 * 0.5);
  const legacy = ema([2, 4, 6], 3, { seed: 'first' });
  assert.deepEqual(legacy, [2, 3, 4.5]);
  assert.throws(() => ema([1, 2], 2, { seed: 'bad' as any }), /seed/);
  // Derived series may keep a NaN prefix, but not interior gaps.
  assert.equal(ema([NaN, 2, 4, 6], 2)[2], 3);
  assert.throws(() => ema([1, NaN, 2], 2), /finite after its warm-up/);
});

test('Wilder ATR and RMA follow TradingView seeding', () => {
  const high = [10, 11, 12, 11, 13], low = [9, 9.5, 10, 10, 11], close = [9.5, 10.5, 11, 10.5, 12.5];
  const tr = trueRange(high, low, close);
  assert.deepEqual(tr, [1, 1.5, 2, 1, 2.5]);
  const w = atr(high, low, close, 3);
  assert.ok(Number.isNaN(w[1])); near(w[2], 1.5); near(w[3], (1.5 * 2 + 1) / 3); near(w[4], (w[3] * 2 + 2.5) / 3);
  assert.deepEqual(rma([3, 3, 3, 6], 3).slice(2), [3, 4]);
  const simple = atr(high, low, close, 3, { method: 'simple' });
  assert.ok(Number.isNaN(simple[2])); near(simple[3], (1.5 + 2 + 1) / 3); near(simple[4], (2 + 1 + 2.5) / 3);
});

test('MACD, Bollinger and channels', () => {
  const values = Array.from({ length: 60 }, (_, i) => 100 + 10 * Math.sin(i / 5));
  const m = macd(values);
  assert.ok(Number.isNaN(m.macd[24])); assert.ok(Number.isFinite(m.macd[25])); assert.ok(Number.isNaN(m.signal[32])); assert.ok(Number.isFinite(m.signal[33]));
  near(m.histogram[59], m.macd[59] - m.signal[59]);
  assert.throws(() => macd(values, { fast: 26, slow: 12 }), /fast/);
  const b = bollinger([1, 2, 3, 4, 5], 5, 2);
  near(b.middle[4], 3); near(stdev([1, 2, 3, 4, 5], 5)[4], Math.sqrt(2)); near(b.upper[4], 3 + 2 * Math.sqrt(2)); near(b.percentB[4], (5 - b.lower[4]) / (b.upper[4] - b.lower[4]));
  assert.ok(Number.isNaN(bollinger([5, 5, 5], 3).percentB[2]), 'collapsed bands have no position');
  const d = donchian([5, 7, 6, 9], [1, 2, 3, 4], 3);
  assert.equal(d.upper[3], 9); assert.equal(d.lower[3], 2); assert.equal(d.middle[3], 5.5);
});

test('ZLEMA removes lag with 2*src - src[lag]', () => {
  // length 3 -> lag 1 -> adjusted = [NaN, 2*2-1, 2*4-2, 2*8-4] = [NaN, 3, 6, 12]
  const out = zlema([1, 2, 4, 8], 3);
  assert.ok(Number.isNaN(out[2])); near(out[3], (3 + 6 + 12) / 3);
});

test('Supertrend follows trend direction and keeps its line on the correct side', () => {
  const up = Array.from({ length: 40 }, (_, i) => 100 + i * 2);
  const down = Array.from({ length: 40 }, (_, i) => 180 - i * 2);
  const series = [...up, ...down];
  const st = supertrend(series.map(c => c + 1), series.map(c => c - 1), series, 10, 3);
  assert.ok(Number.isNaN(st.direction[8])); assert.equal(st.direction[9], -1);
  assert.equal(st.direction[39], 1); assert.ok(st.line[39] < series[39]);
  assert.equal(st.direction[79], -1); assert.ok(st.line[79] > series[79]);
  assert.equal(st.direction.slice(9).filter((d, i, all) => i > 0 && d !== all[i - 1]).length, 2);
});

test('VWAP resets by session and crosses are edge-triggered', () => {
  const v = vwap([11, 21, 31], [9, 19, 29], [10, 20, 30], [1, 3, 2], ['d1', 'd1', 'd2']);
  near(v[1], (10 + 60) / 4); near(v[2], 30);
  assert.throws(() => vwap([1], [1], [1], [-1]), /negative/);
  assert.deepEqual(crossover([1, 2, 3, 2], 2), [false, false, true, false]);
  assert.deepEqual(crossunder([3, 2, 1, 2], [2, 2, 2, 2]), [false, false, true, false]);
  assert.deepEqual(crossover([NaN, 3], 2), [false, false]);
});

test('inputs are validated instead of silently producing NaN scores', () => {
  assert.throws(() => sma([1, Number.NaN, 3], 2), /finite/);
  assert.throws(() => sma([1, 2], 0), /positive integer/);
  assert.throws(() => atr([1, 2], [1], [1, 2]), /equal length/);
  assert.throws(() => supertrend([1], [1], [1], 10, 0), /multiplier/);
});

test('backtest results are unchanged by the shared indicator migration (golden from previous engine)', () => {
  for (const c of golden.cases as any[]) assert.deepEqual(simulateBacktest((golden.datasets as any)[c.dataset], c.config), c.expected);
  const strategies = new Set(golden.cases.flatMap((c: any) => c.expected.trades.map((t: any) => t.strategy)));
  assert.deepEqual([...strategies].sort(), ['Breakout', 'Mean Reversion', 'Momentum', 'Trend Following', 'Volume Pattern']);
});

test('technical rating: votes in [-1, 1], undefined before the 200-bar history, follows the trend',()=>{
 // Deterministic noisy trends: 260 bars up, then 260 bars down.
 let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const close:number[]=[];let p=100;for(let i=0;i<520;i++){p*=1+(i<260?0.004:-0.004)+(rnd()-0.5)*0.02;close.push(p);}
 const high=close.map(c=>c*(1+rnd()*0.01)),low=close.map(c=>c*(1-rnd()*0.01)),volume=close.map(()=>1e6*(0.5+rnd()));
 const {rating,maRating,oscRating}=technicalRating(high,low,close,volume);
 assert.equal(rating.length,520);assert(Number.isNaN(rating[198]),'needs the SMA 200');assert(Number.isFinite(rating[210]));
 for(let i=210;i<520;i++){assert(rating[i]>=-1&&rating[i]<=1);assert.equal(Math.round(maRating[i]*15),+(maRating[i]*15).toFixed(9),'15 MA votes');assert.equal(Math.round(oscRating[i]*11),+(oscRating[i]*11).toFixed(9),'11 oscillator votes');
  assert.equal(rating[i],(maRating[i]+oscRating[i])/2);}
 const avg=(a:number[],from:number,to:number)=>a.slice(from,to).reduce((x,y)=>x+y,0)/(to-from);
 assert(avg(maRating,220,260)>0.6,'moving averages vote buy in the uptrend');assert(avg(maRating,480,520)<-0.6,'and sell in the downtrend');
 assert(avg(rating,220,260)>avg(rating,480,520)+0.5);
 assert.throws(()=>technicalRating(high,low,close.slice(1),volume),/equal length/);
});
