import {TradeDetailTimeline} from './TradeDetailTimeline';
import {PaperAmendment} from './PaperAmendment';
import {PaperEvidencePanel} from './PaperEvidencePanel';
import {PaperExecutionPanel,type ExecutionSettings,type PaperIntent} from './PaperExecutionPanel';
import { PaperFundsPanel, type PaperBalance, type FundingState } from './PaperFundsPanel';
import { useEffect, useState } from 'react';
import { devicePaperRequest } from '../services/devicePaperAccount';
import { formatIST, istDate } from '../services/tradingTime';
import { downloadJSON } from '../services/journalStorage';
import {inPaperView,orderValuation,type PaperOrder as Order,type PaperView} from '../services/paperWorkspace';
interface Account {enabled:boolean;revision:number;state:FundingState & {execution?:ExecutionSettings;intents?:PaperIntent[];capital:number;realized:number;sequence:number;orders:Order[];lastCycleAt:string|null;marketOpen?:boolean;missingQuotes?:string[]}}
const money=(n?:number|null)=>n==null?'—':n.toLocaleString('en-IN',{style:'currency',currency:'INR'});
interface PaperEvent {id:number;at:string;kind:string;price?:number;quantity?:number;quoteTime?:string;reason?:string;model?:string}
export function ServerPaperPage({workspace=false,focusSignalId}:{workspace?:boolean;focusSignalId?:string}) {
 const [product,setProduct]=useState('intraday');
 const [view,setView]=useState<PaperView>('positions');
 const [expanded,setExpanded]=useState<string|null>(null),[symbolFilter,setSymbolFilter]=useState(''),[dateFilter,setDateFilter]=useState('');
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
 async function closeOrder(id:string){setBusy(true);try{const data=await request({closeOrderId:id});accept(data);setError('');}catch(e){setError(e instanceof Error?e.message:'Close request failed');}finally{setBusy(false);}}
 async function exportLedger(){setBusy(true);try{let cursor=0;const events:unknown[]=[];let snapshot:Account|null=null;let data;do{data=await request(undefined,cursor,snapshot?.state.sequence);snapshot??=data.account;events.push(...data.events.map((r:{event:unknown})=>r.event));if(data.nextCursor<=cursor&&data.hasMore)throw new Error('Invalid ledger cursor');cursor=data.nextCursor;}while(data.hasMore);downloadJSON('device-paper-ledger.json',{account:snapshot,events});}catch(e){setError(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}}
 const state=account?.state;const healthy=state?.lastCycleAt&&Date.now()-Date.parse(state.lastCycleAt)<90000;
 const orders=state?.orders||[];
 const visible=orders.filter(o=>inPaperView(o,view)&&o.symbol.toLowerCase().includes(symbolFilter.toLowerCase())&&(!dateFilter||istDate(o.submittedAt)===dateFilter));
 return <section className="space-y-4"><div className="page-title"><div><p className="eyebrow">YOUR PAPER ACCOUNT · NO SIGN-IN REQUIRED</p><h2>{workspace?'Paper trading workspace':'Paper trading account'}</h2><p>A complete record of your trades, balance and decisions.</p></div></div>
 <><div className="journal-toolbar"><button disabled={busy||!loaded} onClick={()=>void refresh(!account?.enabled)}>{account?.enabled?'Pause intraday entries':'Enable intraday paper trading'}</button><button disabled={busy} onClick={()=>void refresh()}>Refresh</button><button disabled={busy||!account} onClick={()=>void exportLedger()}>Export full ledger</button></div>
 <p className="notice">{account?`${account.enabled?'New entries enabled':'New entries paused; existing positions still monitored'}. ${healthy?'App recently checked quotes':'Waiting for the next app scan'}. Last cycle: ${formatIST(state?.lastCycleAt||undefined)}`:'No paper account yet. Enable to create a ₹20,000 virtual account.'}</p>
 <p className="notice">Saved on this device. Export your ledger before clearing app data or reinstalling. Automatic paper trading runs only while this app is open and visible; there is no cross-device sync. Public quote snapshots, not tick-by-tick exchange execution. Fills use the next eligible observed quote with estimated slippage and charges. Missing intervals stay marked as unknown. No background notifications.</p>
 {!!state?.missingQuotes?.length&&<p role="alert">Missing quotes: {state.missingQuotes.join(', ')}. Earlier price crossings cannot be reconstructed.</p>}
 {workspace?<details className="paper-funds-disclosure"><summary>Funds &amp; balance ledger · {money(balance?.balance)}</summary><PaperFundsPanel balance={balance} state={state} disabled={busy||!loaded} onAction={accountAction}/></details>:<PaperFundsPanel balance={balance} state={state} disabled={busy||!loaded} onAction={accountAction}/>}
 {error&&<p role="alert" className="notice">{error}</p>}
 <PaperExecutionPanel focusSignalId={focusSignalId} settings={state?.execution} intents={state?.intents||[]} disabled={busy||!loaded} onAction={accountAction}/>
 <PaperEvidencePanel orders={orders}/>
 <h3>Paper trades</h3>
 <div className="paper-tabs" role="group" aria-label="Trading product">{[['intraday','Intraday'],['short-term','Short-term'],['futures','Futures'],['options','Options']].map(([id,label])=><button key={id} aria-pressed={product===id} onClick={()=>setProduct(id)}>{label}{id!=='intraday'&&<small>Planned</small>}</button>)}</div>
 {product!=='intraday'?<section className="notice paper-mode-notice" role="status"><h4>{product==='short-term'?'Short-term holdings':product==='futures'?'Futures paper trading':'Options paper trading'} — execution unavailable</h4><p>{product==='short-term'?'Delivery holdings need a separate overnight policy, settlement, corporate-action handling and delivery-cost model. Current signals and orders are intraday; they are not carried forward as delivery trades.':'A verified contract feed is required: expiry, lot size, tick size, contract bid/ask and margin or settlement rules. Equity prices cannot be used to simulate derivative fills.'}</p><p>No orders are placed in this mode. Your existing intraday ledger is preserved.</p></section>:<>
 <p className="notice">Equity intraday · Signal-linked paper orders · Observed quote fills. Signal, submission and fill times are separate. A signal score is not a probability of profit.</p>
 <div className="paper-tabs" role="group" aria-label="Paper ledger view">{([['orders','Orders'],['positions','Positions'],['closed','Closed trades']] as [PaperView,string][]).map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}<small>{orders.filter(o=>inPaperView(o,id)).length}</small></button>)}</div>
 {loaded&&!visible.length&&<div className="card" role="status"><h4>{symbolFilter||dateFilter?'No trades match these filters':view==='positions'?'No open positions':view==='closed'?'No closed trades yet':'No paper orders yet'}</h4><p>{view==='positions'?'Orders appear here after an entry fill, and remain here while an exit is pending. Check Orders for submissions waiting for a later quote.':view==='closed'?'Completed and cancelled orders appear here with recorded timestamps and the net result after estimated charges.':account?.enabled?'New entries are enabled. A qualifying strong signal during market hours creates a pending order; a later valid quote is required to fill it.':'Enable paper trading to create automatic orders from qualifying strong signals during market hours.'}</p><p>Keep the app open for monitoring. No trades are reconstructed for periods when it was closed.</p></div>}
 <div className="journal-toolbar"><label>Symbol<input value={symbolFilter} onChange={e=>setSymbolFilter(e.target.value)}/></label><label>Order date (IST)<input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/></label></div>
 {[...visible].reverse().map(o=>{const valuation=orderValuation(o);return <article className="card paper-order-card space-y-2" key={o.id}><div className="order-card-heading"><h3>{o.symbol}</h3><span className={`badge ${o.side==='BUY'?'badge-green':'badge-red'}`}>{o.side}</span><span className="order-status">{o.status.replaceAll('_',' ')}</span></div>{!['CLOSED','CANCELLED','EXIT_PENDING'].includes(o.status)&&<button disabled={busy} onClick={()=>void closeOrder(o.id)}>{o.filled?'Request paper exit':'Cancel paper order'}</button>}<p>{o.legacy?'Imported earlier trade · ':''}Equity · Intraday · {o.orderType||'MARKET'}{o.limitPrice?` · Limit ₹${o.limitPrice}`:''}{o.triggerPrice?` · Entry trigger ₹${o.triggerPrice}`:''}</p>
 <div className="paper-position-grid"><div><span>Open quantity</span><strong>{valuation.remaining}</strong><time>Requested {o.requestedQuantity??o.quantity} · Working {Math.max(0,o.quantity-o.filled)} · Filled {o.filled} · Exited {o.exited}</time></div><div><span>Average entry</span><strong>{money(o.entryPrice)}</strong></div><div><span>Last observed price</span><strong>{money(o.lastPrice)}</strong><time>{formatIST(o.lastQuoteTime)}{valuation.stale?' · Stale; valuation unavailable':''}</time></div><div><span>{o.status==='CLOSED'?'Gross result':'Gross P&L estimate'}</span><strong>{money(valuation.gross)}</strong></div><div><span>Estimated charges</span><strong>{money(valuation.fees)}</strong></div><div><span>{o.status==='CLOSED'?'Realized net P&L':'Net P&L estimate'}</span><strong className={valuation.net==null?'':valuation.net>=0?'positive':'negative'}>{money(valuation.net)}</strong></div></div>
 {o.filled<o.quantity&&!['CLOSED','CANCELLED','EXIT_PENDING'].includes(o.status)&&<button disabled={busy} onClick={()=>void accountAction({cancelRemainder:o.id})}>Cancel unfilled quantity</button>}
 {o.strategy&&<details className="paper-funds-disclosure"><summary>Recorded signal analysis · {o.strategy.id}</summary><p>Score {o.strategy.score}/100 · {o.strategy.signal} · {formatIST(o.strategy.recordedAt)}</p><ul>{o.strategy.reasons?.map((reason,index)=><li key={index}>{reason}</li>)}</ul><p>Execution: {o.executionMode||'Not recorded'} · Minimum delay {o.reactionDelaySeconds??'Not recorded'} seconds</p></details>}
 {o.status==='PENDING'&&['LIMIT','STOP'].includes(o.orderType||'')&&<PaperAmendment key={`${o.id}:${o.modifiedAt||''}`} order={o} disabled={busy} onAction={accountAction}/>}
 <p>Validity: {o.validity||'TTL2'} · Last amendment: {formatIST(o.modifiedAt)}</p>
 <p>Stop: {money(o.stop)} · Target: {money(o.target)}. Stops are evaluated only on observed quotes.</p>
 <dl className="paper-timeline"><div><dt>1 · Signal observed</dt><dd>{formatIST(o.signalTime)}</dd></div><div><dt>2 · Order submitted</dt><dd>{o.approvedAt&&<>Approved {formatIST(o.approvedAt)}<br/></>}{o.orderTimeUnknown?'Not recorded in earlier journal':formatIST(o.submittedAt)}</dd></div><div><dt>3 · First entry fill</dt><dd>{formatIST(o.entryTime)}</dd></div><div><dt>4 · Exit requested / filled</dt><dd>{formatIST(o.exitRequestedAt)}<br/>{formatIST(o.exitTime)}</dd></div></dl><div className="trade-details"><div><label>First entry fill processed</label><b>{money(o.entryPrice)}</b><time>{formatIST(o.entryTime)}</time><p>Source quote: {formatIST(o.entryQuoteTime)}</p></div><div><label>Final exit fill processed</label><b>{money(o.exitPrice)}</b><time>{formatIST(o.exitTime)}</time><p>Source quote: {formatIST(o.exitQuoteTime)}</p></div></div><p>Exit reason: {o.exitReason||'—'}</p><button disabled={busy} onClick={()=>setExpanded(expanded===o.id?null:o.id)}>{expanded===o.id?'Hide':'View'} audit trail</button>{expanded===o.id&&<TradeDetailTimeline order={o} revision={account?.revision}/>}{o.monitoringGap&&<p className="quality-note">Monitoring gap: earlier crossings unknown; not suitable for accuracy evaluation.</p>}</article>})}
 </>}
 </></section>;
}
