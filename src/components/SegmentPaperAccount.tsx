import {SegmentComparison} from './SegmentComparison';
import {useEffect,useState} from 'react';
import type {TradingSegment} from '../../shared/tradingSegments';
import {sharedPaperRequest} from '../services/sharedPaperAccount';
import {PaperFundsPanel,type PaperBalance,type FundingState} from './PaperFundsPanel';
import {PaperEvidencePanel} from './PaperEvidencePanel';
import {TradeDetailTimeline} from './TradeDetailTimeline';
import {ScannerStatus,type ScannerState} from './ScannerStatus';
import {downloadJSON} from '../services/journalStorage';
import {formatIST} from '../services/tradingTime';
import {orderValuation,type PaperOrder} from '../services/paperWorkspace';
type Signal={signalId:string;symbol:string;side:string;signalTime:string;strategy:{id:string;reasons:string[]}};
type Snapshot={account:{id:string;revision:number;enabled:boolean;executionReady:boolean;activation?:{marketDataConfigured:boolean};state:FundingState & ScannerState & {orders:PaperOrder[];segmentSignals?:Signal[];discoveryError?:string;missingQuotes?:string[]}};balance:PaperBalance;events:{sequence:number;event:{at:string;kind:string;amount?:number;reason?:string;symbol?:string;minimumCapital?:number}}[]};
const money=(n:number|null|undefined)=>n==null?'Unavailable':n.toLocaleString('en-IN',{style:'currency',currency:'INR'});
export function SegmentPaperAccount({segment,initialView='positions'}:{segment:TradingSegment;initialView?:'positions'|'signals'}){
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState<string>();
 const [view,setView]=useState<'positions'|'history'|'signals'>(initialView);
 useEffect(()=>{let active=true;
  async function refresh(){try{const next=await sharedPaperRequest(undefined,0,undefined,undefined,segment.id);if(active){setData(previous=>previous&&previous.account.revision>next.account.revision?previous:next);setError('');}}catch(e){if(active){setData(null);setError(e instanceof Error?e.message:'Account unavailable');}}}
  void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);
  return()=>{active=false;clearInterval(timer);};
 },[segment.id]);
 async function action(value:Record<string,unknown>){setBusy(true);try{const next=await sharedPaperRequest(value,0,undefined,undefined,segment.id);setData(previous=>previous&&previous.account.revision>next.account.revision?previous:next);setError('');return true;}catch(e){setError(e instanceof Error?e.message:'Account action failed');return false;}finally{setBusy(false);}}
 async function exportLedger(){setBusy(true);try{let cursor=0;let until:number|undefined;const events:unknown[]=[];let snapshot;
  for(;;){const page=await sharedPaperRequest(undefined,cursor,until,undefined,segment.id);until??=page.account.state.sequence;snapshot??=page.account;events.push(...page.events);if(!page.hasMore)break;if(page.nextCursor<=cursor)throw new Error('Ledger pagination did not advance');cursor=page.nextCursor;}
  downloadJSON(`user1-${segment.id}-ledger.json`,{account:snapshot,throughSequence:until,events});
 }catch(e){setError(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}}
 const state=data?.account.state,orders=state?.orders||[],closed=orders.filter(o=>o.status==='CLOSED');
 const derivative=['options','futures'].includes(segment.id);
 const ready=data?.account.executionReady&&data.account.activation?.marketDataConfigured;
 return <section className="space-y-4"><header className="card"><p>Shared user1 · {segment.label} · Forward paper experiment</p><h1>{segment.label} paper account</h1><p>Web and Android use this same backend account. Its funds, orders and history are separate from every other segment.</p></header>
 <section className="notice space-y-2"><h3>{!data?(error?'Execution setup unavailable':'Checking execution setup'):!data.account.executionReady?'Deployment activation required':!data.account.activation?.marketDataConfigured?'Upstox read-only token required':data.account.enabled?'Automatic paper entries enabled':'Paper entries paused'}</h3>
 <p>{derivative?'Index contracts only. Whole lots, fresh bid/ask quotes and session exits; no expiry-day entries. Options buy calls or puts only. Futures reserve full notional until verified margin support is added.':'Cash-funded, long-only delivery simulation. Completed daily-bar trend signals; positions carry across sessions with stops, targets and a holding limit.'}</p>
 <p>Experimental strategies and conservative cost allowances are not verified broker returns. Missing quotes never create fills. Delivery settlement and corporate actions are not reconciled; those outcomes are excluded from validated accuracy.</p>
 <button disabled={busy||!ready} onClick={()=>void action({enabled:!data?.account.enabled})}>{data?.account.enabled?'Pause new entries':'Enable automatic paper entries'}</button>{data?.account.executionReady&&<button disabled={busy} onClick={()=>void action({tick:true})}>Run server scan</button>}</section>
 {error&&<p className="notice" role="alert">{error}</p>}
 <ScannerStatus state={state}/>{state?.discoveryError&&<p className="notice" role="alert">Feed/scan failure: {state.discoveryError}</p>}
 {!!state?.missingQuotes?.length&&<p>Missing fresh quotes: {state.missingQuotes.join(', ')}</p>}
 <PaperFundsPanel balance={data?.balance??null} state={state} disabled={busy||!data} onAction={action} showDeviceArchive={false}/>
 <SegmentComparison/><section className="card"><h2>Recorded outcomes</h2><p>{data?closed.length:'Unavailable'} closed trades · Net realized {money(data?.balance.realized)} · Open P&amp;L {money(data?.balance.positionPnl)}</p><p>Deposits and withdrawals are excluded from P&amp;L. Compare holding periods and complete samples, not just win counts.</p>{data&&<PaperEvidencePanel orders={orders}/>}</section>
 <div className="paper-tabs" role="group" aria-label="Segment ledger view">{(['positions','history','signals'] as const).map(v=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{v}</button>)}</div>
 {view==='signals'?<section className="space-y-3"><h2>Recorded strategy signals</h2>{data&&!(state?.segmentSignals?.length)&&<p>No signals recorded yet. Setup failures and rejected entries are shown separately.</p>}{[...(state?.segmentSignals||[])].reverse().map(s=><article className="card" key={s.signalId}><h3>{s.symbol} · {s.side}</h3><p>{formatIST(s.signalTime)} · {s.strategy.id}</p><ul>{s.strategy.reasons.map(r=><li key={r}>{r}</li>)}</ul></article>)}</section>:<section className="space-y-3"><h2>{view==='positions'?'Working orders and positions':'Trade history'}</h2>{data&&!orders.filter(o=>view==='history'||!['CLOSED','CANCELLED'].includes(o.status)).length&&<p>No {view==='history'?'trades':'working orders or positions'} recorded. An empty ledger is not proof that a scan ran successfully.</p>}{[...orders].reverse().filter(o=>view==='history'||!['CLOSED','CANCELLED'].includes(o.status)).map(o=>{const value=orderValuation(o);return <article className="card" key={o.id}><h3>{o.symbol} · {o.side} · {o.status}</h3><p>Filled {o.filled} / Exited {o.exited} · Lot {o.lotSize} · Entry {money(o.entryPrice)} · Net {money(value.net)}</p><p>Signal {formatIST(o.signalTime)} · Entry {formatIST(o.entryTime)} · Exit {formatIST(o.exitTime)}</p><p>Stop {money(o.stop)} · Target {money(o.target)} · Source quote {formatIST(o.lastQuoteTime)}</p>{o.evaluationExcludedReason&&<p className="quality-note">Evaluation limitation: {o.evaluationExcludedReason}</p>}{!['CLOSED','CANCELLED','EXIT_PENDING'].includes(o.status)&&<button disabled={busy} onClick={()=>void action({closeOrderId:o.id})}>{o.filled?'Request exit':'Cancel entry'}</button>}<button onClick={()=>setExpanded(expanded===o.id?undefined:o.id)}>Trade timeline</button>{expanded===o.id&&<TradeDetailTimeline order={o} segment={segment.id} revision={data?.account.revision}/>}</article>;})}</section>}
 <section className="card space-y-2"><h2>Account activity and rejection evidence</h2><button disabled={busy||!data} onClick={()=>void exportLedger()}>Export full account ledger</button>{data?.events.map(({sequence,event})=><p key={sequence}>{formatIST(event.at)} · {event.kind.replaceAll('_',' ')} {event.symbol} {event.reason}{event.minimumCapital!=null?` · Model minimum capital ${money(event.minimumCapital)} (before existing exposure)`:''}{event.amount!=null?` · ${money(event.amount)}`:''}</p>)}<p>Preview shows the first 500 events. Export includes all recorded events.</p></section></section>;
}
