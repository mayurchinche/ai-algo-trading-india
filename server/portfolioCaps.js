// Portfolio limits of the validated paper book (Phase 0 of the strategy plan, 23 Oct 2026). The book trades
// many rules on the same stocks; without limits several rules piled into one stock and one sector (11 of 15
// positions in IT on the first day). One owner decides what may be held, for new entries and open positions:
//   - one active position per stock, whichever rule holds it;
//   - at most two per sector (NSE industry of the NIFTY 50 constituent file; other stocks are their own sector);
//   - no stock or index futures: one lot (₹5–15 lakh) at the rules' 8–20% stops risks far more than a run's capital.
import {NIFTY50_UNIVERSE} from '../shared/universes.js';
import {strategyById} from '../shared/strategyLibrary.js';
export const PORTFOLIO_CAPS=Object.freeze({perSymbol:1,perSector:2,futures:false});
const INDUSTRY=new Map(NIFTY50_UNIVERSE.members.map(m=>[m.symbol,m.industry]));
export const sectorOf=symbol=>INDUSTRY.get(symbol)??`(${symbol})`;
export const REASONS=Object.freeze({FUTURES_EXCLUDED:'Futures are excluded from the book',STOCK_ALREADY_HELD:'Another rule already holds this stock',SECTOR_LIMIT:'Two positions already held in this sector'});
// Why a position in `symbol` for strategy `strategyId` cannot be added to `held` ([{symbol}]), or null.
export function capReason(held,{strategyId,symbol},caps=PORTFOLIO_CAPS){
 if(!caps.futures&&strategyById(strategyId)?.segment==='futures')return 'FUTURES_EXCLUDED';
 if(held.filter(h=>h.symbol===symbol).length>=caps.perSymbol)return 'STOCK_ALREADY_HELD';
 if(held.filter(h=>sectorOf(h.symbol)===sectorOf(symbol)).length>=caps.perSector)return 'SECTOR_LIMIT';
 return null;
}
const keyOf=run=>{const [strategyId,symbol]=String(run.options?.signalId??'').split(':');return {strategyId,symbol};};
// Open signal runs, oldest first, split into those kept and those over a limit (with the reason).
export function planCaps(activeRuns,caps=PORTFOLIO_CAPS){
 const kept=[],over=[];
 for(const run of [...activeRuns].filter(r=>r.options?.signalId).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)))){
  const k=keyOf(run),reason=capReason(kept,k,caps);
  if(reason)over.push({run,reason,...k});else kept.push({run,...k});
 }
 return {kept,over};
}
// State change for a run over a limit: an open position is sold at the next live quote (pending exit, filled
// by the paper cycle in market hours, never at a stale mark); a run not yet in a position is stopped.
export function capExit(state,reason,at){
 const s=structuredClone(state),ev={time:at,at,kind:s.status==='OPEN'?'EXIT_DECIDED':'RUN_STOPPED',reason:'PORTFOLIO_CAP',cap:reason};
 if(s.status==='OPEN'){if(s.pending?.kind==='EXIT')return null;s.pending={kind:'EXIT',reason:'PORTFOLIO_CAP',time:at};}
 else{s.pending=null;s.paper.lastOutcome='PORTFOLIO_CAP';}
 s.events.push(ev);s.paper.eventSeq=(s.paper.eventSeq??0)+1;
 return {state:s,status:s.status==='OPEN'?'ACTIVE':'STOPPED',events:[ev]};
}
// Applies the limits to the book's open runs; returns what it changed. Version conflicts are left for the next run.
export async function enforceCaps({paperStore,now}){
 const {over}=planCaps(await paperStore.active()),done=[];
 for(const o of over){const c=capExit(o.run.state,o.reason,now());if(!c)continue;
  const ok=await paperStore.commit(o.run.id,o.run.version,c.state,c.status,c.events).catch(()=>null);
  done.push({run:o.run.id,signal:o.run.options.signalId,reason:o.reason,action:c.status==='ACTIVE'?'EXIT_AT_NEXT_QUOTE':'STOPPED',saved:!!ok});}
 return done;
}
