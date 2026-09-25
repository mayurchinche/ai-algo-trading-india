// Device-only adapter. Shares execution/accounting rules; never calls an authenticated backend.
// @ts-expect-error Shared pure JavaScript paper engine.
import {newPaperAccount,PAPER_VERSION} from '../../server/paperEngine.js';
// @ts-expect-error Shared pure JavaScript accounting.
import {paperBalance,transferPaperFunds,importLegacyPaper} from '../../server/paperFunds.js';
// @ts-expect-error Shared pure execution workflow.
import {advanceWorkflow,configureExecution,reviewIntent,cancelEntryRemainder,amendPendingEntry} from '../../server/paperWorkflow.js';
import {SIGNAL_POLICY} from './strongSignalPolicy';
import {loadLedger} from './paperTrading';
import {strongSignalId,strongSignalRejection} from './strongSignalPolicy';
import type {DiscoveredStock} from './stockDiscovery';
import type {MarketQuote} from './tradingTime';
const KEY='device_paper_account_v1';
type RecordData=Record<string,any>;
interface DeviceLedger {enabled:boolean;revision:number;state:RecordData;events:RecordData[]}
function read():DeviceLedger {
 const raw=localStorage.getItem(KEY);
 if(raw){const saved=JSON.parse(raw);if(saved.state?.version!==PAPER_VERSION||!Array.isArray(saved.state.orders)||!Array.isArray(saved.events)||!Number.isFinite(saved.state.realized)||typeof saved.enabled!=='boolean')throw new Error('Saved paper account is invalid. Original data preserved; trading paused.');return saved;}
 const initial={enabled:false,revision:0,state:newPaperAccount(),events:[]};
 const legacy=loadLedger();
 if(legacy.trades.length||legacy.archivedNet){const imported=importLegacyPaper(initial.state,legacy);initial.state=imported.state;initial.events=imported.events;}
 return initial;
}
function save(ledger:DeviceLedger){localStorage.setItem(KEY,JSON.stringify(ledger));window.dispatchEvent(new Event('device-paper-updated'));}
async function locked<T>(fn:()=>T):Promise<T>{if(!navigator.locks)throw new Error('Safe device storage requires browser locking support.');return navigator.locks.request('device-paper-account',fn);}
export function devicePaperSymbols():string[]{const s=read().state;return [...new Set([...deviceSymbols(s),...(s.intents||[]).filter((i:RecordData)=>['WAITING','REVIEW','APPROVED'].includes(i.status)).map((i:RecordData)=>i.symbol)])] as string[];}
export async function devicePaperRequest(action?:RecordData,after=0,until?:number,orderId?:string){return locked(()=>{
 const ledger=read();let changed=!localStorage.getItem(KEY);
 if(action){let result;
  if(action.execution)result=configureExecution(ledger.state,action.execution);
  else if(action.reviewIntent)result=reviewIntent(ledger.state,action.reviewIntent);
  else if(action.amendOrder)result=amendPendingEntry(ledger.state,action.amendOrder);
  else if(action.cancelRemainder)result=cancelEntryRemainder(ledger.state,action.cancelRemainder);
  else if(action.transfer)result=transferPaperFunds(ledger.state,action.transfer);
  else if(action.legacyLedger)result=importLegacyPaper(ledger.state,action.legacyLedger);
  else if(typeof action.enabled==='boolean'){ledger.enabled=action.enabled;changed=true;}
  else if(typeof action.closeOrderId==='string'){
   const o=ledger.state.orders.find((o:RecordData)=>o.id===action.closeOrderId);
   if(!o||['CLOSED','CANCELLED','EXIT_PENDING'].includes(o.status))throw new Error('Order cannot be closed in its current state');
   const at=new Date().toISOString();o.quantity=o.filled;o.status=o.filled>o.exited?'EXIT_PENDING':'CANCELLED';
   if(o.filled>o.exited){o.exitRequestedAt=at;o.exitReason='MANUAL';}
   ledger.events.push({id:++ledger.state.sequence,orderId:o.id,at,kind:o.filled?'EXIT_REQUESTED':'ENTRY_CANCELLED',reason:'MANUAL'});changed=true;
  }else throw new Error('Unsupported paper action');
  if(result){ledger.state=result.state;ledger.events.push(...result.events);changed=result.events.length>0||changed;}
 }
 if(changed){ledger.revision++;save(ledger);if(action?.reviewIntent&&!action.reviewIntent.dismiss)window.dispatchEvent(new Event('paper-scan-requested'));}
 const signalId=orderId?ledger.state.orders.find((o:RecordData)=>o.id===orderId)?.signalId:undefined;
 const filtered=ledger.events.filter(e=>e.id>after&&e.id<=(until??ledger.state.sequence)&&(!orderId||e.orderId===orderId||(signalId&&e.signalId===signalId)));
 const events=filtered.slice(0,500).map(e=>({sequence:e.id,event:e}));
 return {account:{enabled:ledger.enabled,revision:ledger.revision,state:ledger.state},balance:paperBalance(ledger.state),events,nextCursor:events.at(-1)?.sequence||after,hasMore:filtered.length>500};
});}
export async function runDevicePaper(stocks:DiscoveredStock[],quotes:Map<string,MarketQuote>,marketOpen:boolean,now=Date.now()){
 return locked(()=>{
  if(document.visibilityState!=='visible')return;
  const ledger=read();const candidates=stocks.filter(s=>!strongSignalRejection(s,now)).map(s=>({symbol:s.symbol,signalId:s.signalId||strongSignalId(s,now),signalTime:s.firstSignalAt||s.generatedAt,side:s.overallScore>0?'BUY':'SELL',score:s.overallScore,stop:s.foAnalysis.suggestedStopLoss,target:s.foAnalysis.suggestedTarget,signalPrice:s.ltp,signalQuoteTime:s.quoteTime,strategy:{id:SIGNAL_POLICY,score:s.overallScore,signal:s.signal,reasons:s.reasons,components:s.scores,strategies:s.strategies,recordedAt:new Date(now).toISOString()}}));
  const combined=new Map(quotes);
  for(const s of stocks)if(s.quoteTime&&(!combined.has(s.symbol)||Date.parse(s.quoteTime)>Date.parse(combined.get(s.symbol)!.timestamp)))combined.set(s.symbol,{price:s.ltp,timestamp:s.quoteTime,source:'Yahoo research feed'});
  const result=advanceWorkflow(ledger.state,{now,quotes:[...combined].map(([symbol,q])=>({symbol,...q})),candidates,marketOpen,acceptEntries:ledger.enabled});
  ledger.state=result.state;ledger.events.push(...result.events);ledger.state.missingQuotes=deviceSymbols(ledger.state).filter(s=>!combined.has(s));ledger.revision++;save(ledger);
 });
}
function deviceSymbols(state:RecordData):string[]{return state.orders.filter((o:RecordData)=>!['CLOSED','CANCELLED'].includes(o.status)).map((o:RecordData)=>o.symbol);}
