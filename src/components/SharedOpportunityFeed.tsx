import {useState} from 'react';
import {fetchSharedOpportunities,useSharedOpportunities} from '../hooks/useSharedOpportunities';
import {formatIST} from '../services/tradingTime';
import {describeOpportunity,type DecisionGroup} from '../services/opportunityDecision';
import {downloadJSON} from '../services/journalStorage';
export function SharedOpportunityFeed({title='Shared strong signals',onOpen}:{title?:string;onOpen?:(id:string)=>void}){
 const {data,error,now,fresh}=useSharedOpportunities();const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
 const [filter,setFilter]=useState<DecisionGroup|'all'>('all'),[search,setSearch]=useState('');
 const rows=(data?.events||[]).map(({event})=>({signal:event,decision:data?.decisions?.[event.signalId],summary:describeOpportunity(data?.decisions?.[event.signalId],now,fresh)}));
 const shown=rows.filter(row=>(filter==='all'||row.summary.group===filter)&&row.signal.symbol.toLowerCase().includes(search.trim().toLowerCase()));
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
 <div className="journal-toolbar"><label>Find a symbol<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recorded symbols"/></label><label>Paper decision<select value={filter} onChange={e=>setFilter(e.target.value as DecisionGroup|'all')}><option value="all">All decisions</option><option value="review">Review / waiting</option><option value="active">Orders / open positions</option><option value="closed">Closed trades</option><option value="blocked">Blocked / cancelled / expired</option><option value="unknown">Decision not recorded</option></select></label></div>
 {data&&<p>{shown.length} of {rows.length} loaded signals · Decisions reflect the latest account snapshot; signal timestamps remain unchanged.</p>}
 {data&&rows.length>0&&!shown.length&&<p role="status">No recorded signals match these filters.</p>}
 <div className="opportunity-grid">{shown.map(({signal:s,decision,summary})=>{const o=decision?.order;return <article className="card space-y-3" key={s.signalId}>
 <div className="home-section-heading"><h3>{s.side} {s.symbol}</h3><span className="home-tag">Score {Math.abs(s.score)}/100</span></div>
 <div className="notice"><strong>{summary.label}</strong><p>{summary.reason}</p></div>
 {o&&<div><p>Filled {o.filled} · Exited {o.exited} · Remaining position {Math.max(0,o.filled-o.exited)}</p><p>Submitted: {formatIST(o.submittedAt)}</p>{o.entryPrice!=null&&<p>Average entry ₹{o.entryPrice.toFixed(2)} · {formatIST(o.entryTime)}</p>}{o.status==='CLOSED'&&<><p>Exit: {formatIST(o.exitTime)}{o.exitPrice!=null?` · ₹${o.exitPrice.toFixed(2)}`:''}</p><p>Recorded net P&amp;L: {o.netPnl!=null?o.netPnl.toLocaleString('en-IN',{style:'currency',currency:'INR'}):'Not recorded'} · Costs: {o.fees!=null?`₹${o.fees.toFixed(2)}`:'Not recorded'}</p></>}{o.monitoringGap&&<p className="notice">Monitoring gap recorded. Intervening price crossings are unknown.</p>}</div>}
 {o?.economics&&<details><summary>Cost-adjusted reference · {o.economics.quantity} units</summary><p>Calculated {formatIST(o.economics.at)} at reference ₹{o.economics.entry.toFixed(2)}.</p><p>Estimated net at target: ₹{o.economics.targetNet.toFixed(2)} · Estimated net at stop: ₹{o.economics.stopNet.toFixed(2)}</p><p>Net reward / risk: {o.economics.netRewardRisk??'Unavailable'} · Target-side estimated costs: ₹{o.economics.targetCosts.toFixed(2)}</p>{o.economics.costsExceedTarget&&<p className="notice">Estimated costs exceed the target reward at this quantity.</p>}<p>Submission/amendment diagnostic, not realized P&amp;L or a current quote. Uses the simulator’s approximate charges and exit slippage; spreads, gaps and liquidity can worsen outcomes. No profitability probability is implied.</p></details>}
 <p>Signal: {formatIST(s.generatedAt)}</p><p>Quote: {formatIST(s.quoteTime)}</p>
 <p>{fresh&&Date.parse(s.expiresAt)>now?`Reference window: ${Math.ceil((Date.parse(s.expiresAt)-now)/1000)}s remaining`:'Historical reference · not a current entry price'}</p>
 <p>Reference ₹{s.entry.toFixed(2)} · Stop ₹{s.stop.toFixed(2)} · Target ₹{s.target.toFixed(2)}</p>
 <details><summary>Signal evidence and timing</summary><p>{s.strategy?.reasons?.join(' · ')||'No strategy reasons recorded.'}</p><p>Recorded: {formatIST(s.at)}</p><p>Reference expires: {formatIST(s.expiresAt)}</p><p>Strategy: {s.strategy?.id||'Not recorded'}</p></details>
 {onOpen&&<button onClick={()=>onOpen(s.signalId)}>{o?'Open Paper trades':summary.group==='review'?'Open paper review':'View paper decision'}</button>}</article>;})}</div>
 {data?.hasMore&&<p>Showing the latest 100 records. Export includes the complete retained history.</p>}</section>;
}
