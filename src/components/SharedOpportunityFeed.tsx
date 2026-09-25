import {useState} from 'react';
import {fetchSharedOpportunities,useSharedOpportunities} from '../hooks/useSharedOpportunities';
import {formatIST} from '../services/tradingTime';
import {downloadJSON} from '../services/journalStorage';
export function SharedOpportunityFeed({title='Shared strong signals',onOpen}:{title?:string;onOpen?:(id:string)=>void}){
 const {data,error,now,fresh}=useSharedOpportunities();const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
 async function exportAll(){setExporting(true);setExportError('');try{let before:number|undefined,until:number|undefined;const records=[];
  for(;;){const page=await fetchSharedOpportunities(before,until);until??=page.account.state.sequence;records.push(...page.events);if(!page.hasMore)break;if(before!=null&&page.nextCursor>=before)throw new Error('Feed cursor did not advance');before=page.nextCursor;}
  downloadJSON('user1-intraday-opportunities.json',{throughSequence:until,records});
 }catch(e){setExportError(e instanceof Error?e.message:'Export failed');}finally{setExporting(false);}}
 return <section className="space-y-4"><div className="home-section-heading"><h2>{title}</h2><button disabled={!data||exporting} onClick={()=>void exportAll()}>{exporting?'Exporting…':'Export all signals'}</button></div>
 <p>Shared backend history · Intraday · Strong strategy scores are not probabilities of profit. These are research references, not executed fills. Actual P&amp;L appears in Paper trades.</p>
 <p>Last server scan: {formatIST(data?.account.state.lastCycleAt)} · {fresh?'Feed current':'Feed not actionable: closed, stale or unavailable'}</p>
 {(error||data?.account.state.discoveryError||exportError)&&<p role="alert" className="notice">{error||data?.account.state.discoveryError||exportError}</p>}
 {!data&&!error&&<p role="status">Loading shared opportunities…</p>}
 {data&&!data.events.length&&<p>No strong signals recorded in the shared feed yet. Existing device history is not imported or counted as shared history.</p>}
 <div className="opportunity-grid">{data?.events.map(({event:s})=><article className="card space-y-2" key={s.signalId}><h3>{s.side} {s.symbol} · {Math.abs(s.score)}/100</h3><p>{fresh&&Date.parse(s.expiresAt)>now?'Within observation window':'Historical / not actionable'}</p><p>Signal: {formatIST(s.generatedAt)}</p><p>Quote: {formatIST(s.quoteTime)}</p><p>Recorded: {formatIST(s.at)}</p><p>Expires: {formatIST(s.expiresAt)}</p><p>Reference ₹{s.entry.toFixed(2)} · Stop ₹{s.stop.toFixed(2)} · Target ₹{s.target.toFixed(2)}</p><p>{s.strategy?.reasons?.join(' · ')}</p>{onOpen&&<button onClick={()=>onOpen(s.signalId)}>View paper decision / trade</button>}</article>)}</div>
 {data?.hasMore&&<p>Showing the latest 100 records. Export includes the complete retained history.</p>}</section>;
}
