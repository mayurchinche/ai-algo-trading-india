import {useRef,useState} from 'react';
import {loadLedger} from '../services/paperTrading';
import {formatIST} from '../services/tradingTime';
export interface PaperBalance {principal:number;deposits:number;withdrawals:number;realized:number;balance:number;reserved:number;positionPnl:number|null;equity:number|null;available:number;valuationStale:boolean}
export interface FundingState {capital:number;transfers?:{id:string;kind:string;amount:number;at:string}[];legacyImport?:{at:string;count:number;archivedNet:number}}
const money=(n?:number|null)=>n==null?'Unavailable':n.toLocaleString('en-IN',{style:'currency',currency:'INR'});
export function PaperFundsPanel({balance,state,disabled,onAction}:{balance:PaperBalance|null;state?:FundingState;disabled:boolean;onAction:(action:Record<string,unknown>)=>Promise<boolean>}) {
 const [amount,setAmount]=useState(''),[kind,setKind]=useState('DEPOSIT'),[notice,setNotice]=useState('');
 const retry=useRef<{id:string;kind:string;amount:number}|null>(null);
 async function transfer(){const value=Number(amount);if(!amount||!Number.isFinite(value)||value<=0){setNotice('Enter a positive paper amount.');return;}
  if(!retry.current||retry.current.kind!==kind||retry.current.amount!==value)retry.current={id:crypto.randomUUID(),kind,amount:value};
  if(await onAction({transfer:retry.current})){retry.current=null;setAmount('');setNotice('Paper balance adjusted. No real money was transferred.');}
 }
 async function importHistory(){try{const ledger=loadLedger();if(!ledger.trades.length&&!ledger.archivedNet){setNotice('No earlier trades or archived balance found on this device.');return;}
  if(await onAction({legacyLedger:ledger})){localStorage.setItem('paper_legacy_reconciled','true');setNotice('Earlier trades and archived P&L imported once. Device-local records retained.');}
 }catch(e){setNotice(e instanceof Error?e.message:'Unable to read earlier journal');}}
 return <div className="space-y-4"><div className="metric-grid account-metrics">{[
 ['Ledger balance',balance?.balance],['All-time net trade P&L',balance?.realized],['Net paper capital',balance?.principal],['Reserved for orders',balance?.reserved],['Open position P&L estimate',balance?.positionPnl],['Estimated account equity',balance?.equity],['Available to withdraw',balance?.available]
 ].map(([label,value])=><div className="card metric" key={String(label)}><span>{label}</span><strong>{money(value as number|undefined|null)}</strong></div>)}</div>
 <p className="notice">Ledger balance = initial capital + additions − withdrawals + all recorded closed-trade net P&amp;L, including earlier days. Open-position P&amp;L is separate. {balance?.valuationStale?'Open quotes are stale; equity is unknown and withdrawals are paused.':''}</p>
 <form className="card journal-toolbar" onSubmit={e=>{e.preventDefault();void transfer();}}><label>Paper transaction<select disabled={disabled} value={kind} onChange={e=>setKind(e.target.value)}><option value="DEPOSIT">Add paper balance</option><option value="WITHDRAWAL">Withdraw paper balance</option></select></label><label>Amount (₹)<input type="number" min="0.01" max="100000000" step="0.01" required disabled={disabled} value={amount} onChange={e=>setAmount(e.target.value)}/></label><button disabled={disabled}>Record paper transaction</button><p>Simulation only. No payment or bank connection.</p></form>
 <section className="card space-y-2"><h3>Balance ledger</h3><p>Initial virtual capital: {money(state?.capital??20000)}</p>{state?.legacyImport&&<p>Earlier journal reconciled {formatIST(state.legacyImport.at)} · {state.legacyImport.count} trades · Archived P&amp;L {money(state.legacyImport.archivedNet)}</p>}{[...(state?.transfers||[])].reverse().map(t=><p key={t.id}>{formatIST(t.at)} · {t.kind==='DEPOSIT'?'Added':'Withdrawn'} {money(t.amount)} · {t.id}</p>)}<p>Trade profits and losses are listed below and included in the full ledger export.</p></section>
 {!state?.legacyImport&&<section className="card space-y-2"><h3>Reconcile earlier device history</h3><p>Before starting new trades or adding funds, pause entries and import the previous journal from this device. Existing trades, open positions and archived P&amp;L will be carried forward once. Missing records are not invented.</p><button disabled={disabled} onClick={()=>void importHistory()}>Import earlier paper journal</button></section>}
 {notice&&<p role="status">{notice}</p>}</div>;
}
