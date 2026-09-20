import { PaperFundsPanel, type PaperBalance, type FundingState } from './PaperFundsPanel';
import { useEffect, useState } from 'react';
import { devicePaperRequest } from '../services/devicePaperAccount';
import { formatIST, istDate } from '../services/tradingTime';
import { downloadJSON } from '../services/journalStorage';
interface Order {id:string;symbol:string;side:string;status:string;quantity:number;filled:number;exited:number;submittedAt:string;signalTime?:string;orderTimeUnknown?:boolean;entryTime?:string;exitTime?:string;entryQuoteTime?:string;exitQuoteTime?:string;entryPrice?:number;exitPrice?:number;netPnl?:number;fees?:number;monitoringGap?:boolean;exitReason?:string}
interface Account {enabled:boolean;revision:number;state:FundingState & {capital:number;realized:number;sequence:number;orders:Order[];lastCycleAt:string|null;marketOpen?:boolean;missingQuotes?:string[]}}
const money=(n?:number)=>n==null?'—':n.toLocaleString('en-IN',{style:'currency',currency:'INR'});
interface PaperEvent {id:number;at:string;kind:string;price?:number;quantity?:number;quoteTime?:string;reason?:string;model?:string}
export function ServerPaperPage() {
 const [expanded,setExpanded]=useState<string|null>(null),[trail,setTrail]=useState<PaperEvent[]>([]),[symbolFilter,setSymbolFilter]=useState(''),[dateFilter,setDateFilter]=useState('');
 const [account,setAccount]=useState<Account|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const [balance,setBalance]=useState<PaperBalance|null>(null);
 function accept(data:{account:Account|null;balance:PaperBalance|null}){setAccount(data.account);setBalance(data.balance);}
 async function accountAction(action:Record<string,unknown>){setBusy(true);try{const data=await request(action);accept(data);setError('');setLoaded(true);return true;}catch(e){setError(e instanceof Error?e.message:'Account adjustment failed');return false;}finally{setBusy(false);}}
 async function request(action?:Record<string,unknown>,after=0,until?:number,orderId?:string) {
  return devicePaperRequest(action,after,until,orderId) as unknown as Promise<{account:Account;balance:PaperBalance;events:{sequence:number;event:PaperEvent}[];nextCursor:number;hasMore:boolean}>;
 }
 async function refresh(enabled?:boolean) {
  setBusy(true);try {const data=await request(enabled==null?undefined:{enabled});accept(data);setError('');setLoaded(true);}catch(e){setError(e instanceof Error?e.message:'Device paper account unavailable');}finally{setBusy(false);}
 }
 useEffect(()=>{
  void refresh();
  const update=()=>void refresh();
  window.addEventListener('device-paper-updated',update);window.addEventListener('storage',update);
  const timer=setInterval(()=>{if(document.visibilityState==='visible')update();},15000);
  return()=>{clearInterval(timer);window.removeEventListener('device-paper-updated',update);window.removeEventListener('storage',update);};
 // Device persistence is shared across page navigation.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function showTrail(id:string){if(expanded===id){setExpanded(null);return;}setBusy(true);try{let cursor=0;const list:PaperEvent[]=[];let data;let until:number|undefined;do{data=await request(undefined,cursor,until,id);until??=data.account.state.sequence;list.push(...data.events.map((r:{event:PaperEvent})=>r.event));if(data.hasMore&&data.nextCursor<=cursor)throw new Error('Invalid ledger cursor');cursor=data.nextCursor;}while(data.hasMore);setTrail(list);setExpanded(id);}catch(e){setError(e instanceof Error?e.message:'Audit trail unavailable');}finally{setBusy(false);}}
 async function closeOrder(id:string){setBusy(true);try{const data=await request({closeOrderId:id});accept(data);setError('');}catch(e){setError(e instanceof Error?e.message:'Close request failed');}finally{setBusy(false);}}
 async function exportLedger(){setBusy(true);try{let cursor=0;const events:unknown[]=[];let snapshot:Account|null=null;let data;do{data=await request(undefined,cursor,snapshot?.state.sequence);snapshot??=data.account;events.push(...data.events.map((r:{event:unknown})=>r.event));if(data.nextCursor<=cursor&&data.hasMore)throw new Error('Invalid ledger cursor');cursor=data.nextCursor;}while(data.hasMore);downloadJSON('device-paper-ledger.json',{account:snapshot,events});}catch(e){setError(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}}
 const state=account?.state;const healthy=state?.lastCycleAt&&Date.now()-Date.parse(state.lastCycleAt)<30000;
 return <section className="space-y-4"><div className="page-title"><div><p className="eyebrow">YOUR PAPER ACCOUNT · NO SIGN-IN REQUIRED</p><h2>Paper trading account</h2><p>A complete record of your trades, balance and decisions.</p></div></div>
 <><div className="journal-toolbar"><button disabled={busy||!loaded} onClick={()=>void refresh(!account?.enabled)}>{account?.enabled?'Pause new entries':'Enable paper trading'}</button><button disabled={busy} onClick={()=>void refresh()}>Refresh</button><button disabled={busy||!account} onClick={()=>void exportLedger()}>Export full ledger</button></div>
 <p className="notice">{account?`${account.enabled?'New entries enabled':'New entries paused; existing positions still monitored'}. ${healthy?'App recently checked quotes':'Waiting for the next app scan'}. Last cycle: ${formatIST(state?.lastCycleAt||undefined)}`:'No paper account yet. Enable to create a ₹20,000 virtual account.'}</p>
 <p className="notice">Saved on this device. Export your ledger before clearing app data or reinstalling. Automatic paper trading runs only while this app is open and visible; there is no cross-device sync. Public quote snapshots, not tick-by-tick exchange execution. Fills use the next eligible observed quote with estimated slippage and charges. Missing intervals stay marked as unknown. No background notifications.</p>
 {!!state?.missingQuotes?.length&&<p role="alert">Missing quotes: {state.missingQuotes.join(', ')}. Earlier price crossings cannot be reconstructed.</p>}
 <PaperFundsPanel balance={balance} state={state} disabled={busy||!loaded} onAction={accountAction}/>
 <h3>Paper trades</h3>
 {loaded && !state?.orders.length && <div className="card" role="status"><h4>No paper trades recorded yet</h4><p>{account?.enabled?'New entries are enabled. A trade appears here when a qualifying strong signal produces a paper order during market hours. Keep the app open for monitoring.':'Select Enable paper trading to start automatic paper orders from qualifying strong signals during market hours.'}</p><p>Entry time, exit time, status and net profit or loss will appear here for each order.</p></div>}
 <div className="journal-toolbar"><label>Symbol<input value={symbolFilter} onChange={e=>setSymbolFilter(e.target.value)}/></label><label>Order date (IST)<input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/></label></div>
 {[...(state?.orders||[])].filter(o=>o.symbol.toLowerCase().includes(symbolFilter.toLowerCase())&&(!dateFilter||istDate(o.submittedAt)===dateFilter)).reverse().map(o=><article className="card paper-order-card space-y-2" key={o.id}><div className="order-card-heading"><h3>{o.symbol}</h3><span className={`badge ${o.side==='BUY'?'badge-green':'badge-red'}`}>{o.side}</span><span className="order-status">{o.status.replaceAll('_',' ')}</span></div>{!['CLOSED','CANCELLED','EXIT_PENDING'].includes(o.status)&&<button disabled={busy} onClick={()=>void closeOrder(o.id)}>{o.filled?'Request paper exit':'Cancel paper order'}</button>}<p>Ordered {o.quantity} · Filled {o.filled} · Exited {o.exited}</p><p>Signal: {formatIST(o.signalTime)} · Order: {o.orderTimeUnknown?'Not recorded in earlier journal':formatIST(o.submittedAt)}</p><div className="trade-details"><div><label>First entry fill processed</label><b>{money(o.entryPrice)}</b><time>{formatIST(o.entryTime)}</time><p>Source quote: {formatIST(o.entryQuoteTime)}</p></div><div><label>Final exit fill processed</label><b>{money(o.exitPrice)}</b><time>{formatIST(o.exitTime)}</time><p>Source quote: {formatIST(o.exitQuoteTime)}</p></div></div><p>Exit reason: {o.exitReason||'—'} · Estimated charges: {money(o.fees)} · Net P&amp;L: {money(o.netPnl)}</p><button disabled={busy} onClick={()=>void showTrail(o.id)}>{expanded===o.id?'Hide':'View'} audit trail</button>{expanded===o.id&&<div className="audit-trail">{trail.map(e=><p key={e.id}><b>{e.kind}</b> · {formatIST(e.at)}{e.quoteTime&&` · Quote ${formatIST(e.quoteTime)}`}{e.price!=null&&` · ${money(e.price)} × ${e.quantity}`}{e.reason&&` · ${e.reason}`}{e.model&&` · ${e.model}`}</p>)}</div>}{o.monitoringGap&&<p className="quality-note">Monitoring gap: earlier crossings unknown; not suitable for accuracy evaluation.</p>}</article>)}
 </>{error&&<p role="alert" className="notice">{error}</p>}</section>;
}
