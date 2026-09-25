import {useEffect,useState} from 'react';
import type {TradingSegment} from '../../shared/tradingSegments';
import {sharedPaperRequest} from '../services/sharedPaperAccount';
import {PaperFundsPanel,type PaperBalance,type FundingState} from './PaperFundsPanel';
import {downloadJSON} from '../services/journalStorage';
import {formatIST} from '../services/tradingTime';
type Snapshot={account:{id:string;revision:number;state:FundingState};balance:PaperBalance;events:{sequence:number;event:{at:string;kind:string;amount?:number}}[]};
export function SegmentPaperAccount({segment}:{segment:TradingSegment}){
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;
  async function refresh(){try{const next=await sharedPaperRequest(undefined,0,undefined,undefined,segment.id);if(active){setData(previous=>previous&&previous.account.revision>next.account.revision?previous:next);setError('');}}catch(e){if(active){setData(null);setError(e instanceof Error?e.message:'Account unavailable');}}}
  void refresh();const timer=setInterval(()=>void refresh(),15000);
  return()=>{active=false;clearInterval(timer);};
 },[segment.id]);
 async function action(value:Record<string,unknown>){setBusy(true);try{const next=await sharedPaperRequest(value,0,undefined,undefined,segment.id);setData(previous=>previous&&previous.account.revision>next.account.revision?previous:next);setError('');return true;}catch(e){setError(e instanceof Error?e.message:'Funding failed');return false;}finally{setBusy(false);}}
 async function exportLedger(){setBusy(true);try{let cursor=0;let until:number|undefined;const events:unknown[]=[];let snapshot;
  for(;;){const page=await sharedPaperRequest(undefined,cursor,until,undefined,segment.id);until??=page.account.state.sequence;snapshot??=page.account;events.push(...page.events);if(!page.hasMore)break;if(page.nextCursor<=cursor)throw new Error('Ledger pagination did not advance');cursor=page.nextCursor;}
  downloadJSON(`user1-${segment.id}-ledger.json`,{account:snapshot,throughSequence:until,events});
 }catch(e){setError(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}}
 return <section className="space-y-4"><header className="card"><p>Shared user1 · {segment.label}</p><h1>{segment.label} paper account</h1><p>Web and Android use this same backend account. Its funds and history are separate from every other segment.</p></header>
 <p className="notice" role="status">Trading unavailable: {segment.id==='options'||segment.id==='futures'?'licensed contract feeds, contract sizing, margin and execution models':'holding-period strategies, delivery costs and overnight execution'} still require validation. Funding is available; no signals or simulated fills are generated for this segment.</p>
 {error&&<p className="notice" role="alert">{error}</p>}
 {!data&&!error&&<p role="status">Loading shared balance…</p>}
 <PaperFundsPanel balance={data?.balance??null} state={data?.account.state} disabled={busy||!data} onAction={action} showDeviceArchive={false}/>
 <section className="card space-y-2"><h2>Account activity</h2><button disabled={busy||!data} onClick={()=>void exportLedger()}>Export full account ledger</button>
 {data?.events.map(({sequence,event})=><p key={sequence}>{formatIST(event.at)} · {event.kind.replaceAll('_',' ')}{event.amount!=null?` · ₹${event.amount.toLocaleString('en-IN')}`:''}</p>)}
 <p>Activity preview shows the first 500 events. The export includes all recorded events and timestamps.</p></section></section>;
}
