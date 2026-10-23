import test from 'node:test';import assert from 'node:assert/strict';
import {compare,buildAccuracy,tradeReturnPct,MIN_TRADES} from '../server/accuracy.js';
import {createAccuracyHandler} from '../api/_accuracy.js';
import {researchRoutes} from '../api/research.js';
import {readFileSync} from 'node:fs';

test('live returns get a verdict only after 20 trades, against two standard errors of the backtest mean',()=>{
 assert.equal(compare([1,2,-1],0.5).verdict,'TOO_FEW_TRADES');
 const flat=Array.from({length:MIN_TRADES},(_,i)=>i%2?1.2:-0.8);// mean 0.2, sd ~1.03, se ~0.23
 assert.equal(compare(flat,0.3).verdict,'IN_LINE');assert.equal(compare(flat,1).verdict,'BELOW_BACKTEST');assert.equal(compare(flat,-0.5).verdict,'ABOVE_BACKTEST');
 const s=compare(flat,0.3);assert.equal(s.trades,20);assert.equal(s.winRatePct,50);assert.equal(s.avgPct,0.2);assert.equal(s.profitFactor,1.5);
 assert.equal(compare(flat,null).verdict,'NO_BACKTEST');assert.equal(compare([],0.1).avgPct,null);
});

test('rules pair the pooled backtest with closed signal runs; setups pair the study with the book',()=>{
 const leg=(entryPrice:number,units:number)=>({entryPrice,units});
 const validations=[{strategy_id:'short-term-donchian',symbol:'INFY',verdict:'VALIDATED',computed_at:'c',pooled:{trades:900,winRate:0.42,expectancyPct:0.8,profitFactor:1.4}},{strategy_id:'short-term-donchian',symbol:'TCS',verdict:'REJECTED',computed_at:'c',pooled:{trades:900,winRate:0.42,expectancyPct:0.8,profitFactor:1.4}},
  {strategy_id:'swing-rsi2',symbol:'INFY',verdict:'REJECTED',computed_at:'c',pooled:{trades:500,winRate:0.5,expectancyPct:-0.1,profitFactor:null}}];
 const runs=[{status:'STOPPED',options:{signalId:'short-term-donchian:INFY:1'},entries:[{pnl:500,exitTime:5,reason:'EXIT',legs:[leg(1000,10)]}],paper:{lastOutcome:'TRADE_COMPLETED'}},
  {status:'STOPPED',options:{signalId:'short-term-donchian:TCS:1'},entries:[],paper:{lastOutcome:'SIGNAL_EXPIRED'}},{status:'ACTIVE',options:{signalId:'short-term-donchian:SBIN:1'},entries:[{pnl:null,legs:[leg(1,1)]}],paper:{}},{status:'STOPPED',options:{},entries:[]},{status:'ACTIVE',options:{signalId:'short-term-donchian:LT:2',joined:true},entries:[],paper:{}},{status:'STOPPED',options:{signalId:'short-term-donchian:LT:3',joined:true},entries:[{pnl:-100,legs:[leg(1000,10)]}],paper:{lastOutcome:'TRADE_COMPLETED'}}];
 assert.equal(tradeReturnPct(runs[0].entries[0]),5);
 const book={createdAt:'2026-10-21T00:00:00Z',positions:[{setup:'overnight-gap'}],closed:[{setup:'overnight-gap',policy:'aggressive-v3',netPct:0.4,net:2000},{setup:'discover-momentum',netPct:-1,net:-250}]};
 const a:any=buildAccuracy({validations,runs,book,now:Date.parse('2026-10-23T10:00:00Z')});
 assert.deepEqual(a.rules.map((r:any)=>r.id),['short-term-donchian'],'only rules with a validated stock or a run');
 const r=a.rules[0];assert.deepEqual(r.backtest,{trades:900,winRatePct:42,avgPct:0.8,profitFactor:1.4,computedAt:'c'});
 assert.equal(r.validatedSymbols,1);assert.equal(r.live.trades,1,'joined trades are kept out of the verdict');assert.equal(r.joined.trades,1);assert.equal(r.joined.avgPct,-1);assert.equal(r.joined.open,1);assert.equal(r.live.avgPct,5);assert.equal(r.open,1);assert.equal(r.expiredBeforeEntry,1);assert.equal(r.recent.find((t:any)=>!t.joined).symbol,'INFY');
 const g=a.setups.find((s:any)=>s.id==='overnight-gap');assert.equal(g.expected.netPct,0.15);assert.equal(g.live.trades,1);assert.equal(g.open,1);assert.deepEqual(g.policies,['aggressive-v3']);assert.equal(g.net,2000);
 assert.equal(a.setups.find((s:any)=>s.id==='breakout-early').expected.netPct,null);
});

test('the accuracy API reads each source independently and is routed like the other research routes',async()=>{
 const res:any={status(c:number){this.code=c;return this;},json(b:any){this.body=b;return this;},setHeader(){}};
 await createAccuracyHandler({signals:(()=>({pooledStats:async()=>[]})) as any,runs:(()=>({signalRuns:async()=>{throw new Error('down');}})) as any,book:(()=>({read:async()=>null})) as any,gap:(()=>({read:async()=>null})) as any,now:()=>0})({method:'GET',headers:{host:'x'},query:{}},res);
 assert.equal(res.code,200);assert.deepEqual(res.body.unavailable,['signalRuns']);assert.equal(res.body.setups.length,3);
 const bad:any={...res};await createAccuracyHandler()({method:'GET',headers:{host:'x'},query:{x:'1'}},bad);assert.equal(bad.code,400);
 assert.equal(typeof researchRoutes.accuracy,'function');
 assert.match(readFileSync('vercel.json','utf8'),/\|today\|accuracy\)/);
});
