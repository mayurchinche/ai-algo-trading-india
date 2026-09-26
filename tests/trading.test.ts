import { getDecisionJournal } from '../src/services/decisionJournal';
import { collectForegroundAlerts } from '../src/services/foregroundAlerts';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { inSession, istDate, freshQuote } from '../src/services/tradingTime';
import { openPaperTrades, updatePaperTrades, loadLedger, prunePaperTrades, getPaperTradeSummary } from '../src/services/paperTrading';
import { recordSignals, getSignalHistory, updateOutcomes } from '../src/services/signalHistory';
import { fetchMarketStatus } from '../src/services/marketStatus';
import { fetchHistorical, discoverStocks } from '../src/services/stockDiscovery';
import { exitAtBar, simulateBacktest } from '../src/services/backtestEngine';
import marketHandler from '../api/market.js';
import proxyHandler from '../api/proxy.js';
const storage = new Map<string,string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k,v), removeItem: (k: string) => storage.delete(k) } });
const now = new Date('2026-09-18T05:00:00Z').getTime();
const iso = (n = now) => new Date(n).toISOString();
const quote = (price = 100, time = now) => ({ price, timestamp: iso(time), source: 'test' });
const signal = (symbol = 'TEST', extra = {}) => ({ symbol, name: symbol, signal: 'STRONG_BUY', overallScore: 75, ltp:100, strategies:['Momentum'], foAnalysis:{suggestedStopLoss:98,suggestedTarget:106,riskReward:3}, signalId:symbol, generatedAt:iso(), quoteTime:iso(), eligible:true, ...extra });
beforeEach(async () => { storage.clear(); globalThis.fetch = async () => new Response(JSON.stringify({ marketState: [{market:'Capital Market',marketStatus:'Open'}] })); await fetchMarketStatus(); });
test('IST boundaries do not depend on machine timezone', () => { assert.equal(istDate('2026-09-17T20:00:00Z'),'2026-09-18'); assert.ok(inSession('2026-09-18T03:45:00Z')); assert.ok(!inSession('2026-09-18T10:00:00Z')); assert.ok(!inSession('2026-09-19T05:00:00Z')); });
test('freshness rejects stale, future and invalid observations', () => { assert.ok(freshQuote(quote(),now)); assert.ok(!freshQuote(quote(100,now-121000),now)); assert.ok(!freshQuote(quote(100,now+6000),now)); assert.ok(!freshQuote(quote(NaN),now)); });
test('risk sizing, capital reservation and symbol deduplication', () => { const trades=openPaperTrades(Array.from({length:9},(_,i)=>signal(`T${i}`)),now); assert.equal(trades.length,3); assert.ok(trades.reduce((n,t)=>n+t.quantity*t.entryPrice+40,0)<=18000); assert.equal(openPaperTrades([signal('T0')],now).length,3); assert.ok(trades.every(t=>t.type==='EQUITY')); });
test('rejects stale signals, unaffordable prices, wrong stop side', () => { assert.equal(openPaperTrades([signal('OLD',{quoteTime:iso(now-180000)}),signal('BAD',{signal:'STRONG_SELL',overallScore:-75}),signal('COST',{ltp:100000})],now).length,0); });
test('SELL entry uses correct levels and subsequent quote closes with costs', () => { let t=openPaperTrades([signal('SELL',{signal:'STRONG_SELL',overallScore:-75,foAnalysis:{suggestedStopLoss:102,suggestedTarget:96,riskReward:2}})],now)[0]; assert.ok(t); updatePaperTrades(new Map([['SELL',quote(95,now+60000)]]),now+60000); t=loadLedger().trades[0]; assert.equal(t.status,'TARGET_HIT'); assert.equal(t.exitQuoteTime,iso(now+60000)); assert.ok(t.netPnl!<t.grossPnl!); });
test('does not close on the entry quote or stale data', () => { openPaperTrades([signal()],now); updatePaperTrades(new Map([['TEST',quote(110)]]),now); assert.equal(loadLedger().trades[0].status,'OPEN'); updatePaperTrades(new Map([['TEST',quote(110)]]),now+180000); assert.equal(loadLedger().trades[0].status,'OPEN'); });
test('gap is audited and excluded from evaluated win rate', () => { openPaperTrades([signal()],now); updatePaperTrades(new Map([['TEST',quote(110,now+600000)]]),now+600000); assert.ok(loadLedger().trades[0].monitoringGap); assert.equal(getPaperTradeSummary().evaluated,0); assert.equal(getPaperTradeSummary().excluded,1); });
test('next-day recovery is not backdated as EOD', () => { openPaperTrades([signal()],now); updatePaperTrades(new Map([['TEST',quote(99,now+86400000)]]),now+86400000); assert.equal(loadLedger().trades[0].status,'EXPIRED'); assert.equal(loadLedger().trades[0].exitTime,iso(now+86400000)); });
test('retention preserves all recent records and old open trades; cleanup carries account balance', () => { const original=signal(); const trades=Array.from({length:250},(_,i)=>({id:String(i),...original,status:'SL_HIT',entryTime:iso(now-40*86400000),exitTime:iso(now-31*86400000),netPnl:-1})); trades.push({...trades[0],id:'OPEN',status:'OPEN'}); localStorage.setItem('paper_trades_v2',JSON.stringify(trades)); assert.equal(loadLedger().trades.length,251); assert.equal(prunePaperTrades(now),250); assert.equal(loadLedger().trades[0].id,'OPEN'); assert.equal(loadLedger().archivedNet,-250); });
test('corrupt storage fails closed and preserves raw evidence', () => { localStorage.setItem('paper_ledger_v3','bad-json'); assert.throws(()=>loadLedger()); assert.equal(localStorage.getItem('paper_ledger_v3'),'bad-json'); });
test('signal timestamp is immutable on repeated scan; signal expires without a quote', () => { const s={...signal(),signal:'STRONG_BUY'} as any; recordSignals([s],now); const later={...s,generatedAt:iso(now+60000)}; recordSignals([later],now+60000); assert.equal(getSignalHistory().length,1); assert.equal(later.firstSignalAt,iso()); assert.equal(later.generatedAt,iso(now+60000)); updateOutcomes(new Map(),now+16*86400000); assert.equal(getSignalHistory()[0].outcome,'EXPIRED'); });
test('historical candle filtering stays aligned and excludes partial current day', async () => { globalThis.fetch=async()=>new Response(JSON.stringify({chart:{result:[{timestamp:[1,2,3],meta:{},indicators:{quote:[{close:[100,null,300],high:[110,210,310],low:[90,190,290],volume:[10,20,30]}]}}]}})); const hist=await fetchHistorical('TEST'); assert.deepEqual(hist!.closes,[100,300]); assert.deepEqual(hist!.highs,[110,310]); });
test('discovery fails closed when every provider request fails', async () => { globalThis.fetch=async()=>new Response('{}',{status:503}); await assert.rejects(discoverStocks(),/No stocks/); });
test('ambiguous historical candle exits at stop; gaps use worse open', () => { const bar={date:'2026-01-01',open:100,high:120,low:80,close:105,volume:10}; assert.equal(exitAtBar('BUY',90,110,bar),90); assert.equal(exitAtBar('BUY',90,110,{...bar,open:85}),85); });
test('backtest respects dates, strategy filter and capital; charges affect curve', () => { const bars=Array.from({length:100},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),open:100+i,high:103+i,low:99+i,close:102+i,volume:i>60?3000:1000})); const empty=simulateBacktest(bars,{symbol:'TEST',strategies:[],startDate:bars[60].date,endDate:bars[80].date})!; assert.equal(empty.trades.length,0); assert.equal(empty.totalDays,21); const run=simulateBacktest(bars,{symbol:'TEST',initialCapital:20000,riskPerTrade:.02})!; assert.ok(run.trades.length>0); assert.ok(run.trades.every(t=>t.entryPrice*t.quantity<=10000)); assert.equal(run.finalCapital,run.equityCurve.at(-1)!.equity); });
function response(){ return { code:0, body:null as any, headers:{} as Record<string,string>, setHeader(k:string,v:string){this.headers[k]=v}, status(c:number){this.code=c;return this}, json(v:unknown){this.body=v;return this}, send(v:unknown){this.body=v;return this} }; }
test('market API rejects arbitrary hosts and writes',async()=>{let res=response();await marketHandler({headers:{},method:'GET',query:{provider:'yahoo',path:'https://evil.test/v8/finance/chart/A'}},res);assert.equal(res.code,400);res=response();await marketHandler({headers:{},method:'POST',query:{}},res);assert.equal(res.code,405);});
test('legacy gateway rejects suffix spoofing and HTTP',async()=>{for(const url of ['https://evilnseindia.com/api','http://nseindia.com/api']){const res=response();await proxyHandler({query:{url},headers:{},method:'GET'},res);assert.equal(res.code,403);}});

test('paper and popup admission share score, direction and timestamp rules', () => {
  for (const extra of [{ overallScore: 69 }, { signal: 'BUY' }, { overallScore: NaN }, { overallScore: 101 }, { generatedAt: 'bad' }, { generatedAt: iso(now + 6000) }]) {
    const candidate = signal('REJECT', extra);
    assert.equal(openPaperTrades([candidate], now).length, 0);
    assert.equal(collectForegroundAlerts([candidate as any], true, true, now).length, 0);
  }
  assert.ok(getDecisionJournal(now).every(d => d.reason !== 'PAPER_ENTRY'));
});
test('weak observation cannot steal first strong time; ledger, history and popup share identity', () => {
  const weak = signal('UPGRADE', { overallScore: 50, signal: 'BUY', signalId: undefined });
  recordSignals([weak as any], now);
  assert.equal(getSignalHistory().length, 0);
  const later = now + 180000;
  const strong = signal('UPGRADE', { signalId: undefined, generatedAt: iso(later), quoteTime: iso(later) });
  recordSignals([strong as any], later);
  const trade = openPaperTrades([strong], later)[0];
  const alert = collectForegroundAlerts([strong as any], true, true, later)[0];
  assert.ok(trade); assert.ok(alert);
  assert.equal(trade.signalTime, iso(later));
  assert.equal(alert.generatedAt, trade.signalTime);
  assert.equal(alert.id, trade.signalId);
  assert.equal(getSignalHistory()[0].id, trade.signalId);
  assert.equal(getDecisionJournal(later)[0].tradeId, trade.id);
});
test('paper and popup reject expired first observations and 15:15 IST cutoff', () => {
  const old = signal('OLD_FIRST', { firstSignalAt: iso(now - 180000) });
  assert.equal(openPaperTrades([old], now).length, 0);
  assert.equal(collectForegroundAlerts([old as any], true, true, now).length, 0);
  const cutoff = Date.parse('2026-09-18T09:45:00Z');
  const late = signal('LATE', { generatedAt: iso(cutoff), quoteTime: iso(cutoff) });
  assert.equal(openPaperTrades([late], cutoff).length, 0);
  assert.equal(collectForegroundAlerts([late as any], true, true, cutoff).length, 0);
  assert.ok(getDecisionJournal(cutoff).some(d => d.reason === 'ENTRY_CUTOFF_1515_IST'));
});
test('decision journal audits all daily-limit rejects and aggregates repeated skips', () => {
  const candidates = Array.from({length:5}, (_,i)=>signal(`AUDIT${i}`));
  openPaperTrades(candidates, now);
  let decisions = getDecisionJournal(now);
  assert.equal(decisions.filter(d => d.reason === 'PAPER_ENTRY').length, 3);
  assert.equal(decisions.filter(d => d.reason === 'DAILY_TRADE_LIMIT').length, 2);
  openPaperTrades(candidates, now+1000);
  decisions = getDecisionJournal(now+1000);
  const skipped = decisions.find(d => d.symbol === 'AUDIT4')!;
  assert.equal(skipped.observations, 2);
  assert.equal(skipped.firstObservedAt, iso());
  assert.equal(skipped.lastObservedAt, iso(now+1000));
  assert.equal(getDecisionJournal(now+31*86400000).length, 0);
  assert.equal(loadLedger().trades.length, 3);
});
test('new evaluation cohort excludes previous threshold trades but preserves their balance', () => {
  openPaperTrades([signal()],now);
  const ledger=loadLedger();
  Object.assign(ledger.trades[0], {modelVersion:'paper-equity-v3',status:'TARGET_HIT',netPnl:100});
  localStorage.setItem('paper_ledger_v3',JSON.stringify(ledger));
  const summary=getPaperTradeSummary();
  assert.equal(summary.evaluated,0); assert.equal(summary.excluded,1); assert.equal(summary.accountEquity,20100);
});

test('corrupt decision storage blocks new entries without rewriting the account', () => {
  const raw=JSON.stringify({version:3,trades:[],archivedNet:0,archivedCount:0,decisions:{bad:true}});
  localStorage.setItem('paper_ledger_v3',raw);
  assert.throws(()=>openPaperTrades([signal()],now), /Invalid paper ledger/);
  assert.equal(localStorage.getItem('paper_ledger_v3'),raw);
});

import {scoreStrategies} from '../src/services/stockDiscovery';
test('volatility cannot inflate directional trend scores',()=>{
 const args=[100,60,{value:1,signal:0,histogram:1},98,95,90,2,.5,101,70] as const;
 assert.deepEqual(scoreStrategies(...args,1),scoreStrategies(...args,6));
 assert.equal(scoreStrategies(...args,6).trendFollowing,80);
 assert.equal(scoreStrategies(100,40,{value:-1,signal:0,histogram:-1},102,105,110,2,.5,130,99,6).trendFollowing,-80);
});
