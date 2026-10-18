import {parseStrategySpec} from '../shared/strategySpec.js';
import {createEngineState,stepEngine,markToMarket,closeAtMarks,computeStrategySeries} from '../shared/specEngine.js';
import {MarketDataError} from './upstoxReadOnly.js';
// Forward paper runs of strategy specs on live read-only data. One cycle steps each active run at most once,
// on its latest completed bar. Fills use the live quote at the cycle after a decision (ask to buy, bid to
// sell); leg levels are checked against that quote, so moves between cycles are not observed.
export const SPEC_PAPER_VERSION='spec-paper-v1';
export const MAX_EVENTS=500;
const OPTION_RANGES={capital:[1000,1e8],costBps:[0,100],costPerOrder:[0,1000],slippageBps:[0,100]};
export function validatePaperOptions(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>![...Object.keys(OPTION_RANGES),'maxUnitsPerOrder'].includes(k)))throw new Error('Invalid paper options');
 const o={};for(const [k,[min,max]] of Object.entries(OPTION_RANGES)){const v=input[k];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`Invalid ${k}`);o[k]=v;}
 const m=input.maxUnitsPerOrder??null;if(m!==null&&!(Number.isInteger(m)&&m>=1&&m<=1e6))throw new Error('Invalid maxUnitsPerOrder');
 return {...o,maxUnitsPerOrder:m};
}
export function newPaperState(spec,options,now){
 return {...createEngineState(spec,options),paper:{version:SPEC_PAPER_VERSION,createdAt:new Date(now).toISOString(),lastBarTime:null,lastCycleAt:null,cycles:0,missedBars:0,droppedEvents:0,lastOutcome:null}};
}
const trim=state=>{const extra=state.events.length-MAX_EVENTS;if(extra>0){state.events.splice(0,extra);state.paper.droppedEvents+=extra;}};

export async function cycleRun(run,{market,now}){
 const parsed=parseStrategySpec(run.spec);if(!parsed.ok)return {outcome:'INVALID_SPEC',stop:true};
 const spec=parsed.spec,state=structuredClone(run.state),at=now();
 const key=await market.underlyingKey(spec),bars=await market.bars(spec,key,at);
 if(!bars.length)return {outcome:'NO_COMPLETED_BARS'};
 const i=bars.length-1,last=state.paper.lastBarTime;
 if(last!==null&&bars[i].time<=last)return {outcome:'NO_NEW_BAR'};
 const missed=last===null?0:bars.filter(b=>b.time>last).length-1;
 // Contracts: legs entering now are resolved on the live chain/master; open legs keep their contract.
 const contracts={};const unresolved=[];
 if(state.pending?.kind==='ENTRY')for(const leg of spec.legs){try{contracts[leg.id]=await market.resolveLeg(spec,leg,key,at);}catch(e){unresolved.push({leg:leg.id,reason:e instanceof MarketDataError?e.code:'CONTRACT_UNAVAILABLE'});}}
 for(const l of state.legs)if(l.open)contracts[l.id]=l.instrument;
 const quotes=await market.quotes([...new Set(Object.values(contracts).map(c=>c.instrumentKey))],at);
 const legQuotes={};
 for(const [id,c] of Object.entries(contracts)){const q=quotes.get(c.instrumentKey);if(q)legQuotes[id]={open:q.price,high:q.price,low:q.price,close:q.price,bid:q.bid,ask:q.ask,instrument:c,lotSize:c.lotSize};}
 stepEngine(spec,state,computeStrategySeries(spec,bars),i,legQuotes);
 if(unresolved.length)state.events.push({time:bars[i].time,kind:'CONTRACT_UNRESOLVED',legs:unresolved});
 Object.assign(state.paper,{lastBarTime:bars[i].time,lastCycleAt:new Date(at).toISOString(),cycles:state.paper.cycles+1,missedBars:state.paper.missedBars+Math.max(0,missed),lastOutcome:'STEPPED'});
 trim(state);
 return {outcome:'STEPPED',state,missed,quotesMissing:Object.keys(contracts).filter(id=>!legQuotes[id])};
}

export async function runSpecPaperCycle({store,market,now=Date.now,budgetMs=45000}){
 const started=now();
 let open;try{open=await market.marketOpen();}catch(e){return {status:'MARKET_STATUS_UNAVAILABLE',reason:e instanceof MarketDataError?e.code:'MARKET_STATUS_FAILED',runs:[]};}
 if(!open)return {status:'MARKET_CLOSED',runs:[]};
 const runs=(await store.list()).filter(r=>r.status==='ACTIVE'),results=[];
 for(const run of runs){
  if(now()-started>budgetMs){results.push({id:run.id,outcome:'DEFERRED'});continue;}
  try{
   const r=await cycleRun(run,{market,now});
   if(r.stop){const s=structuredClone(run.state);s.paper.lastOutcome=r.outcome;await store.save(run.id,run.version,s,'STOPPED');}
   else if(r.state&&!(await store.save(run.id,run.version,r.state,'ACTIVE'))){results.push({id:run.id,outcome:'VERSION_CONFLICT'});continue;}
   results.push({id:run.id,outcome:r.outcome,missedBars:r.missed??0,quotesMissing:r.quotesMissing??[]});
  }catch(e){results.push({id:run.id,outcome:'CYCLE_FAILED',reason:e instanceof MarketDataError?e.code:'UNEXPECTED_ERROR'});}
 }
 const failed=results.filter(r=>['CYCLE_FAILED','VERSION_CONFLICT'].includes(r.outcome)).length;
 return {status:failed?'PARTIAL':'COMPLETED',startedAt:new Date(started).toISOString(),runs:results};
}

// Stopping closes open legs at their last marks; the run then accepts no further cycles.
export function stopRunState(run,now){
 const parsed=parseStrategySpec(run.spec),state=structuredClone(run.state);
 if(parsed.ok)closeAtMarks(parsed.spec,state,now,'RUN_STOPPED');
 state.paper.lastOutcome='STOPPED';trim(state);return state;
}
export function summarizeRun(run){
 const s=run.state,closed=s.entries.filter(e=>e.pnl!==null);
 return {id:run.id,createdAt:run.created_at,updatedAt:run.updated_at,status:run.status,version:run.version,name:run.spec?.name,underlying:run.spec?.underlying,timeframe:run.spec?.timeframe,options:run.options,
  position:s.status,pending:s.pending,netPnl:markToMarket(s),realized:s.realized,costs:s.costs,orders:s.orders,trades:closed.length,wins:closed.filter(e=>e.pnl>0).length,
  legs:s.legs.map(l=>({id:l.id,dir:l.dir,units:l.units,entry:l.entry,mark:l.mark,open:l.open,stop:l.stop,target:l.target,exitReason:l.exitReason??null,contract:l.instrument?.description??null})),
  entries:s.entries.slice(-50),events:s.events.slice(-100),paper:s.paper};
}
