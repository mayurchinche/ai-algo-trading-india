import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStrategySpec } from '../shared/strategySpec.js';
import { computeStrategySeries, evaluateCondition } from '../shared/strategyConditions.js';

// "Buy NIFTY when RSI(14) < 30, exit at 5% profit or a 2% stop-loss, square off by 3:15pm" (Tradetron's example).
const rsiDip = () => ({
  schemaVersion: 1, name: 'NIFTY RSI dip', mode: 'intraday',
  underlying: { symbol: 'NIFTY', exchange: 'NSE', kind: 'index' }, timeframe: '5m',
  schedule: { weekdays: [1, 2, 3, 4, 5], entryStart: '09:20', entryEnd: '15:00', squareOff: '15:15' },
  indicators: [{ id: 'rsi14', type: 'rsi', params: { length: 14 } }],
  entry: { compare: { left: { indicator: 'rsi14' }, op: 'lt', right: { value: 30 } } },
  legs: [{ id: 'atm_call', side: 'BUY', instrument: { type: 'option', optionType: 'CE', expiry: 'current-week', strike: { mode: 'atm-offset', steps: 0 } }, quantity: { lots: 1 },
    target: { unit: 'percent', value: 5 }, stopLoss: { unit: 'percent', value: 2 } }],
});

const shortStraddle = () => ({
  schemaVersion: 1, name: 'BANKNIFTY 09:20 short straddle', mode: 'intraday',
  underlying: { symbol: 'BANKNIFTY', exchange: 'NSE', kind: 'index' }, timeframe: '1m',
  schedule: { weekdays: [1, 2, 3, 4, 5], entryStart: '09:20', entryEnd: '09:21', squareOff: '15:15' },
  indicators: [],
  entry: { compare: { left: { price: 'close' }, op: 'gt', right: { value: 0 } } },
  legs: ['CE', 'PE'].map(optionType => ({ id: `short_${optionType.toLowerCase()}`, side: 'SELL', instrument: { type: 'option', optionType, expiry: 'current-week', strike: { mode: 'atm-offset', steps: 0 } },
    quantity: { lots: 1 }, stopLoss: { unit: 'percent', value: 25 }, trailingStop: { unit: 'points', trigger: 20, step: 10 } })),
  risk: { maxLoss: { unit: 'percent-capital', value: 1 }, reEntry: { maxCount: 2, after: 'stop-loss', cooldownMinutes: 5 }, exitOnExpiryDay: false },
});

test('valid strategies parse into frozen specs', () => {
  for (const input of [rsiDip(), shortStraddle()]) {
    const result = parseStrategySpec(input);
    assert.ok(result.ok, JSON.stringify(!result.ok && result.issues));
    assert.ok(Object.isFrozen(result.spec.legs[0].instrument));
    assert.deepEqual(result.spec, input);
  }
  const positional = { ...rsiDip(), mode: 'positional', timeframe: '1d', underlying: { symbol: 'RELIANCE', exchange: 'NSE', kind: 'equity' },
    schedule: { weekdays: [1, 2, 3, 4, 5], entryStart: '09:15', entryEnd: '15:30' },
    legs: [{ id: 'stock', side: 'BUY', instrument: { type: 'equity' }, quantity: { units: 10 }, stopLoss: { unit: 'percent', value: 8 } }], risk: { maxHoldingDays: 60 } };
  assert.ok(parseStrategySpec(positional).ok);
});

test('every problem is reported with its path instead of being guessed', () => {
  const bad: any = rsiDip();
  bad.schemaVersion = 2; bad.timeframe = '1d'; bad.extra = true;
  bad.schedule = { weekdays: [1, 1, 6], entryStart: '15:00', entryEnd: '09:20' };
  bad.indicators.push({ id: 'rsi14', type: 'rsi', params: { length: 1 } }, { id: 'v', type: 'vwap' }, { id: 'm', type: 'macd', params: { fast: 26, slow: 12, signal: 9 } });
  bad.entry = { all: [{ compare: { left: { indicator: 'missing' }, op: 'eq', right: { value: 1 } } }, { compare: { left: { value: 1 }, op: 'crosses-above', right: { value: 2 } } }] };
  bad.legs[0].instrument = { type: 'equity' }; bad.legs[0].quantity = { lots: 1 }; bad.legs[0].trailingStop = { unit: 'points', trigger: 5, step: 1 }; delete bad.legs[0].stopLoss;
  bad.risk = { maxHoldingDays: 5, maxLoss: { unit: 'percent-capital', value: 150 } };
  const result = parseStrategySpec(bad);
  assert.equal(result.ok, false);
  const paths = !result.ok ? result.issues.map(i => i.path) : [];
  for (const path of ['$.extra', '$.schemaVersion', '$.timeframe', '$.schedule.weekdays', '$.schedule.weekdays[2]', '$.schedule.entryEnd', '$.schedule.squareOff',
    '$.indicators[1].id', '$.indicators[1].params.length', '$.indicators[2].type', '$.indicators[3].params.fast',
    '$.entry.all[0].compare.op', '$.entry.all[0].compare.left.indicator', '$.entry.all[1].compare', '$.entry.all[1].compare.left',
    '$.legs[0].instrument.type', '$.legs[0].quantity.lots', '$.legs[0].trailingStop', '$.risk.maxHoldingDays', '$.risk.maxLoss.value'])
    assert.ok(paths.includes(path), `missing issue at ${path}: ${paths.join(' | ')}`);
  assert.deepEqual(parseStrategySpec(null), { ok: false, issues: [{ path: '$', message: 'must be an object' }] });
});

test('instrument rules follow the underlying', () => {
  const stockWeekly: any = { ...rsiDip(), underlying: { symbol: 'RELIANCE', exchange: 'NSE', kind: 'equity' } };
  const r = parseStrategySpec(stockWeekly);
  assert.ok(!r.ok && r.issues.some(i => i.path === '$.legs[0].instrument.expiry' && /index options/.test(i.message)));
  const delta: any = rsiDip(); delta.legs[0].instrument.strike = { mode: 'delta', near: 1.2 };
  const d = parseStrategySpec(delta);
  assert.ok(!d.ok && d.issues.some(i => i.path === '$.legs[0].instrument.strike.near'));
  const deep: any = rsiDip(); let node: any = deep.entry; for (let i = 0; i < 9; i++) node = { not: node }; deep.entry = node;
  const n = parseStrategySpec(deep);
  assert.ok(!n.ok && n.issues.some(i => /nest deeper/.test(i.message)));
});

const minute = Date.parse('2026-10-16T09:15:00+05:30');
const barsFrom = (closes: number[], start = minute) => closes.map((close, i) => ({ time: start + i * 60000, open: close, high: close + 1, low: close - 1, close, volume: 100 }));

test('conditions evaluate with three-valued logic over completed bars', () => {
  const spec: any = parseStrategySpec({ ...rsiDip(), indicators: [{ id: 'fast', type: 'sma', params: { length: 2 } }, { id: 'slow', type: 'sma', params: { length: 3 } }],
    entry: { compare: { left: { indicator: 'fast' }, op: 'crosses-above', right: { indicator: 'slow' } } } });
  assert.ok(spec.ok);
  const ctx = computeStrategySeries(spec.spec, barsFrom([10, 9, 8, 9, 11, 12]));
  // fast: [-, 9.5, 8.5, 8.5, 10, 11.5], slow: [-, -, 9, 8.67, 9.33, 10.67]
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(i => evaluateCondition(spec.spec.entry, ctx, i)), [null, null, null, false, true, false]);
  const below = { compare: { left: { price: 'close' }, op: 'lt', right: { price: 'close', barsAgo: 1 } } } as const;
  assert.deepEqual([0, 1, 2, 3].map(i => evaluateCondition(below, ctx, i)), [null, true, true, false]);
  assert.equal(evaluateCondition({ all: [below, { compare: { left: { indicator: 'slow' }, op: 'gt', right: { value: 0 } } }] }, ctx, 1), null);
  assert.equal(evaluateCondition({ all: [below, { compare: { left: { indicator: 'slow' }, op: 'gt', right: { value: 0 } } }] }, ctx, 3), false);
  assert.equal(evaluateCondition({ any: [below, { compare: { left: { indicator: 'slow' }, op: 'gt', right: { value: 0 } } }] }, ctx, 1), true);
  assert.equal(evaluateCondition({ not: below }, ctx, 0), null);
  assert.equal(evaluateCondition({ not: below }, ctx, 3), true);
  assert.throws(() => evaluateCondition(below, ctx, 6), RangeError);
});

test('multi-output indicators use named outputs and VWAP resets per IST session', () => {
  const parsed: any = parseStrategySpec({ ...rsiDip(), indicators: [{ id: 'bb', type: 'bollinger', params: { length: 3, multiplier: 1 } }, { id: 'vw', type: 'vwap' }],
    entry: { all: [{ compare: { left: { price: 'close' }, op: 'gt', right: { indicator: 'bb', output: 'upper' } } }, { compare: { left: { price: 'close' }, op: 'gt', right: { indicator: 'vw' } } }] } });
  assert.ok(parsed.ok);
  const nextDay = minute + 86400000;
  const ctx = computeStrategySeries(parsed.spec, [...barsFrom([10, 10, 10, 20]), ...barsFrom([5], nextDay)]);
  assert.equal(ctx.indicators.bb.defaultOutput, 'middle');
  assert.equal(evaluateCondition(parsed.spec.entry, ctx, 3), true);
  assert.equal(ctx.indicators.vw.outputs.value[4], 5, 'VWAP restarts on the next IST session');
  assert.throws(() => computeStrategySeries(parsed.spec, [barsFrom([10])[0], barsFrom([10])[0]]), /not after/);
  assert.throws(() => computeStrategySeries(parsed.spec, [{ time: minute, open: 10, high: 9, low: 8, close: 10, volume: 1 }]), /inconsistent/);
});
