import { PaperFundsPanel, type PaperBalance, type FundingState } from './PaperFundsPanel';
import { useEffect, useState } from 'react';
import { getSupabase } from '../services/supabaseClient';
import { formatIST, istDate } from '../services/tradingTime';
import { downloadJSON } from '../services/journalStorage';
interface Order {id:string;symbol:string;side:string;status:string;quantity:number;filled:number;exited:number;submittedAt:string;signalTime?:string;orderTimeUnknown?:boolean;entryTime?:string;exitTime?:string;entryQuoteTime?:string;exitQuoteTime?:string;entryPrice?:number;exitPrice?:number;netPnl?:number;fees?:number;monitoringGap?:boolean;exitReason?:string}
interface Account {enabled:boolean;revision:number;state:FundingState & {capital:number;realized:number;sequence:number;orders:Order[];lastCycleAt:string|null;marketOpen?:boolean;missingQuotes?:string[]}}
const money=(n?:number)=>n==null?'—':n.toLocaleString('en-IN',{style:'currency',currency:'INR'});
interface PaperEvent {id:number;at:string;kind:string;price?:number;quantity?:number;quoteTime?:string;reason?:string;model?:string}
export function ServerPaperPage() {
 const [expanded,setExpanded]=useState<string|null>(null),[trail,setTrail]=useState<PaperEvent[]>([]),[symbolFilter,setSymbolFilter]=useState(''),[dateFilter,setDateFilter]=useState('');
 const [account,setAccount]=useState<Account|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[signedIn,setSignedIn]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[loaded,setLoaded]=useState(false);
 const [balance,setBalance]=useState<PaperBalance|null>(null);
 const client=getSupabase();
 function accept(data:{account:Account|null;balance:PaperBalance|null}){setAccount(data.account);setBalance(data.balance);}
 async function accountAction(action:Record<string,unknown>){setBusy(true);try{const data=await request(action);accept(data);setError('');setLoaded(true);return true;}catch(e){setError(e instanceof Error?e.message:'Account adjustment failed');return false;}finally{setBusy(false);}}
 async function request(action?:Record<string,unknown>,after=0,until?:number,orderId?:string) {
  const session=await client?.auth.getSession();const token=session?.data.session?.access_token;
  if(!token)throw new Error('Sign in to view your persistent paper account.');
  const base=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
  const response=await fetch(`${base}/api/paper?after=${after}${until==null?'':'&until='+until}${orderId?'&orderId='+encodeURIComponent(orderId):''}`,{method:action==null?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(action==null?{}:{body:JSON.stringify(action)})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Paper backend unavailable');return data;
 }
 async function refresh(enabled?:boolean) {
  setBusy(true);try {const data=await request(enabled==null?undefined:{enabled});accept(data);setError('');setLoaded(true);}catch(e){setError(e instanceof Error?e.message:'Paper backend unavailable');}finally{setBusy(false);}
 }
 useEffect(()=>{
  if(!client)return;
  let active=true;
  const update=()=>void client.auth.getSession().then(({data})=>{if(!active)return;setSignedIn(!!data.session);if(data.session)void refresh();else{setAccount(null);setBalance(null);setLoaded(false);}});
  update();const {data}=client.auth.onAuthStateChange(()=>queueMicrotask(update));
  const timer=setInterval(()=>{if(document.visibilityState==='visible')update();},15000);
  return()=>{active=false;clearInterval(timer);data.subscription.unsubscribe();};
 // Account polling shares the configured client; credentials are read fresh for every request.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[client]);
 async function login(){setBusy(true);try{if(!client)throw new Error('Account service not configured');const {error}=await client.auth.signInWithPassword({email,password});setPassword('');if(error)throw error;}catch(e){setError(e instanceof Error?e.message:'Sign-in failed');}finally{setBusy(false);}}
 async function showTrail(id:string){if(expanded===id){setExpanded(null);return;}setBusy(true);try{let cursor=0;const list:PaperEvent[]=[];let data;let until:number|undefined;do{data=await request(undefined,cursor,until,id);until??=data.account.state.sequence;list.push(...data.events.map((r:{event:PaperEvent})=>r.event));if(data.hasMore&&data.nextCursor<=cursor)throw new Error('Invalid ledger cursor');cursor=data.nextCursor;}while(data.hasMore);setTrail(list);setExpanded(id);}catch(e){setError(e instanceof Error?e.message:'Audit trail unavailable');}finally{setBusy(false);}}
 async function closeOrder(id:string){setBusy(true);try{const data=await request({closeOrderId:id});accept(data);setError('');}catch(e){setError(e instanceof Error?e.message:'Close request failed');}finally{setBusy(false);}}
 async function exportLedger(){setBusy(true);try{let cursor=0;const events:unknown[]=[];let snapshot:Account|null=null;let data;do{data=await request(undefined,cursor,snapshot?.state.sequence);snapshot??=data.account;events.push(...data.events.map((r:{event:unknown})=>r.event));if(data.nextCursor<=cursor&&data.hasMore)throw new Error('Invalid ledger cursor');cursor=data.nextCursor;}while(data.hasMore);downloadJSON('persistent-paper-ledger.json',{account:snapshot,events});}catch(e){setError(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}}
 const state=account?.state;const healthy=state?.lastCycleAt&&Date.now()-Date.parse(state.lastCycleAt)<30000;
 return <section className="space-y-4"><div className="page-title"><div><p className="eyebrow">Virtual money · no broker orders</p><h2>Persistent paper account</h2><p>Orders and fills recorded by the backend, independent of this phone.</p></div></div>
 {!client?<p className="notice">Account service is not configured in this build. Continuous paper trading is unavailable; no substitute fills are generated.</p>:!signedIn?<form className="card space-y-3" onSubmit={e=>{e.preventDefault();void login();}}><p>Sign in with your configured trading account to keep the same ledger across devices.</p><label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>Sign in</button></form>:<><div className="journal-toolbar"><button disabled={busy||!loaded} onClick={()=>void refresh(!account?.enabled)}>{account?.enabled?'Pause new entries':'Enable paper trading'}</button><button disabled={busy} onClick={()=>void refresh()}>Refresh</button><button disabled={busy||!account} onClick={()=>void exportLedger()}>Export full ledger</button><button onClick={()=>void client.auth.signOut()}>Sign out</button></div>
 <p className="notice">{account?`${account.enabled?'New entries enabled':'New entries paused; existing positions still monitored'}. ${healthy?'Worker recently checked in':'Worker unavailable or late — execution not assured'}. Last cycle: ${formatIST(state?.lastCycleAt||undefined)}`:'No paper account yet. Enable to create a ₹20,000 virtual account.'}</p>
 <p className="notice">Public quote snapshots, not tick-by-tick exchange execution. Fills use the next eligible observed quote with estimated slippage and charges. Missing intervals stay marked as unknown. No background notifications.</p>
 {!!state?.missingQuotes?.length&&<p role="alert">Missing quotes: {state.missingQuotes.join(', ')}. Earlier price crossings cannot be reconstructed.</p>}
 <PaperFundsPanel balance={balance} state={state} disabled={busy||!loaded} onAction={accountAction}/>
 <div className="journal-toolbar"><label>Symbol<input value={symbolFilter} onChange={e=>setSymbolFilter(e.target.value)}/></label><label>Order date (IST)<input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/></label></div>
 {[...(state?.orders||[])].filter(o=>o.symbol.toLowerCase().includes(symbolFilter.toLowerCase())&&(!dateFilter||istDate(o.submittedAt)===dateFilter)).reverse().map(o=><article className="card space-y-2" key={o.id}><h3>{o.symbol} · {o.side} · {o.status}</h3>{!['CLOSED','CANCELLED','EXIT_PENDING'].includes(o.status)&&<button disabled={busy} onClick={()=>void closeOrder(o.id)}>{o.filled?'Request paper exit':'Cancel paper order'}</button>}<p>Ordered {o.quantity} · Filled {o.filled} · Exited {o.exited}</p><p>Signal: {formatIST(o.signalTime)} · Order: {o.orderTimeUnknown?'Not recorded in earlier journal':formatIST(o.submittedAt)}</p><div className="trade-details"><div><label>First entry fill processed</label><b>{money(o.entryPrice)}</b><time>{formatIST(o.entryTime)}</time><p>Source quote: {formatIST(o.entryQuoteTime)}</p></div><div><label>Final exit fill processed</label><b>{money(o.exitPrice)}</b><time>{formatIST(o.exitTime)}</time><p>Source quote: {formatIST(o.exitQuoteTime)}</p></div></div><p>Exit reason: {o.exitReason||'—'} · Estimated charges: {money(o.fees)} · Net P&amp;L: {money(o.netPnl)}</p><button disabled={busy} onClick={()=>void showTrail(o.id)}>{expanded===o.id?'Hide':'View'} audit trail</button>{expanded===o.id&&<div className="audit-trail">{trail.map(e=><p key={e.id}><b>{e.kind}</b> · {formatIST(e.at)}{e.quoteTime&&` · Quote ${formatIST(e.quoteTime)}`}{e.price!=null&&` · ${money(e.price)} × ${e.quantity}`}{e.reason&&` · ${e.reason}`}{e.model&&` · ${e.model}`}</p>)}</div>}{o.monitoringGap&&<p className="quality-note">Monitoring gap: earlier crossings unknown; not suitable for accuracy evaluation.</p>}</article>)}
 </>}{error&&<p role="alert" className="notice">{error}</p>}</section>;
}
