import test from 'node:test';import assert from 'node:assert/strict';
import {capReason,planCaps,capExit,enforceCaps,sectorOf} from '../server/portfolioCaps.js';
import {newPaperState,validatePaperOptions} from '../server/specPaperRunner.js';
import {buildStrategySpec,strategyById} from '../shared/strategyLibrary.js';

const run=(signalId:string,created:string,status='OPEN')=>{const spec=buildStrategySpec(strategyById(signalId.split(':')[0]),{symbol:signalId.split(':')[1],units:1,lots:1});
 const s:any=newPaperState(spec,validatePaperOptions({capital:100000,singleTrade:true,signalId}),0);s.status=status;return {id:signalId,version:3,created_at:created,options:{signalId},state:s};};

test('one position per stock, two per sector, no futures; earlier runs keep their place',()=>{
 assert.equal(sectorOf('TCS'),sectorOf('INFY'));assert.equal(sectorOf('NOTLISTED'),'(NOTLISTED)');
 assert.equal(capReason([],{strategyId:'futures-breakout-long',symbol:'INFY'}),'FUTURES_EXCLUDED');
 assert.equal(capReason([{symbol:'INFY'}],{strategyId:'short-term-donchian',symbol:'INFY'}),'STOCK_ALREADY_HELD');
 assert.equal(capReason([{symbol:'INFY'},{symbol:'TCS'}],{strategyId:'short-term-donchian',symbol:'HCLTECH'}),'SECTOR_LIMIT');
 assert.equal(capReason([{symbol:'INFY'},{symbol:'TCS'}],{strategyId:'short-term-donchian',symbol:'ICICIBANK'}),null);
 const runs=[run('short-term-donchian:TCS:1792089000000','2026-10-23T04:44:01Z'),run('short-term-donchian:INFY:1792089000000','2026-10-23T04:44:02Z'),run('long-term-golden-trend:TCS:1792089000000','2026-10-23T04:44:03Z'),
  run('short-term-donchian:HCLTECH:1792089000000','2026-10-23T04:44:04Z'),run('futures-breakout-long:BSE:1792089000000','2026-10-23T04:44:00Z'),run('short-term-donchian:BSE:1792089000000','2026-10-23T04:44:05Z')];
 const {kept,over}=planCaps(runs);
 assert.deepEqual(kept.map((k:any)=>k.run.id),['short-term-donchian:TCS:1792089000000','short-term-donchian:INFY:1792089000000','short-term-donchian:BSE:1792089000000']);
 assert.deepEqual(over.map((o:any)=>[o.run.id,o.reason]),[['futures-breakout-long:BSE:1792089000000','FUTURES_EXCLUDED'],['long-term-golden-trend:TCS:1792089000000','STOCK_ALREADY_HELD'],['short-term-donchian:HCLTECH:1792089000000','SECTOR_LIMIT']]);
});

test('an open position over a limit is sold at the next live quote; one not yet bought is stopped',async()=>{
 const open=capExit(run('short-term-donchian:TCS:1792089000000','x').state,'SECTOR_LIMIT',5)!;
 assert.equal(open.status,'ACTIVE');assert.deepEqual(open.state.pending,{kind:'EXIT',reason:'PORTFOLIO_CAP',time:5});assert.equal(open.events[0].cap,'SECTOR_LIMIT');
 assert.equal(capExit(open.state,'SECTOR_LIMIT',6),null,'an exit already pending is not repeated');
 const flat=capExit(run('short-term-donchian:TCS:1792089000000','x','FLAT').state,'STOCK_ALREADY_HELD',5)!;assert.equal(flat.status,'STOPPED');assert.equal(flat.state.paper.lastOutcome,'PORTFOLIO_CAP');
 const commits:any[]=[];const r=await enforceCaps({now:()=>9,paperStore:{active:async()=>[run('short-term-donchian:TCS:1792089000000','a'),run('short-term-donchian:TCS:1792175400000','b')],commit:async(id:string,v:number,s:any,st:string,ev:any[])=>{commits.push([id,v,st,ev[0].kind]);return {id};}}});
 assert.deepEqual(commits,[['short-term-donchian:TCS:1792175400000',3,'ACTIVE','EXIT_DECIDED']]);assert.deepEqual(r,[{run:'short-term-donchian:TCS:1792175400000',signal:'short-term-donchian:TCS:1792175400000',reason:'STOCK_ALREADY_HELD',action:'EXIT_AT_NEXT_QUOTE',saved:true}]);
});
