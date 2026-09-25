import {useEffect,useState} from 'react';
import {sharedPaperRequest} from '../services/sharedPaperAccount';
import {formatIST} from '../services/tradingTime';
import {orderValuation,type PaperOrder} from '../services/paperWorkspace';
import {rupees} from '../services/tradingHome';
interface TradeEvent {id:number;at:string;kind:string;quoteTime?:string;price?:number;quantity?:number;reason?:string;note?:string;source?:string;netPnl?:number;fees?:number}
export function TradeDetailTimeline({order,revision=0}:{order:PaperOrder;revision?:number}){
 const [events,setEvents]=useState<TradeEvent[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;
  async function read(){setLoading(true);setError('');try{let cursor=0,until:number|undefined;const result:TradeEvent[]=[];let more=true;
   while(more){const page=await sharedPaperRequest(undefined,cursor,until,order.id);until??=page.account.state.sequence;result.push(...page.events.map((row:{event:unknown})=>row.event as unknown as TradeEvent));if(page.hasMore&&page.nextCursor<=cursor)throw new Error('Invalid ledger cursor');cursor=page.nextCursor;more=page.hasMore;}
   if(active)setEvents(result);
  }catch(e){if(active)setError(e instanceof Error?e.message:'Timeline unavailable');}finally{if(active)setLoading(false);}}
  void read();return()=>{active=false;};
 },[order.id,revision,retry]);
 return <TradeTimelineView order={order} events={events} loading={loading} error={error} onRetry={()=>setRetry(n=>n+1)}/>;
}
export function TradeTimelineView({order,events,loading=false,error='',onRetry}:{order:PaperOrder;events:TradeEvent[];loading?:boolean;error?:string;onRetry?:()=>void}){
 const value=orderValuation(order);
 return <section className="trade-detail" aria-label={`${order.symbol} trade detail`}>
 <div className="home-section-heading"><div><p className="eyebrow">RECORDED EXECUTION · IST</p><h3>{order.symbol} trade timeline</h3></div><span className="home-tag">{order.status.replaceAll('_',' ')}</span></div>
 <p>{order.side} · Equity intraday · {order.orderType||'MARKET'} · {order.filled} filled / {order.exited} exited</p>
 <div className="home-detail-metrics"><div><span>Average entry</span><strong>{rupees(order.entryPrice)}</strong></div><div><span>Average exit</span><strong>{rupees(order.exitPrice)}</strong></div><div><span>{order.status==='CLOSED'?'Realized net P&L':'Net P&L estimate'}</span><strong>{rupees(value.net)}</strong></div><div><span>Estimated charges</span><strong>{rupees(value.fees)}</strong></div></div>
 {value.remaining>0&&value.stale&&<p className="quality-note">Quote stale or missing. Current P&amp;L is unavailable.</p>}
 {order.monitoringGap&&<p className="quality-note">Monitoring gap recorded. Price crossings while unobserved are unknown.</p>}
 <p>Source quote time and processing time are separate. These are paper fills from observed quotes.</p>
 <ol className="execution-timeline"><li><span className="timeline-dot"/><div><h4>Signal generated</h4><time>{formatIST(order.signalTime)}</time>{order.strategy&&<p>{order.strategy.signal} · Score {order.strategy.score}/100 · {order.strategy.id}</p>}</div></li>
 {!loading&&!error&&events.map(event=><li key={event.id}><span className="timeline-dot"/><div><h4>{event.kind.toLowerCase().replaceAll('_',' ')}</h4><time>Processed {formatIST(event.at)}</time>{event.quoteTime&&<p>Source quote {formatIST(event.quoteTime)}</p>}{event.price!=null&&<p>{rupees(event.price)}{event.quantity!=null?` × ${event.quantity}`:''}</p>}{event.netPnl!=null&&<p>Net result {rupees(event.netPnl)} · Estimated charges {rupees(event.fees)}</p>}{event.reason&&<p>{event.reason}</p>}{event.note&&<p>{event.note}</p>}{event.source&&<p>Source: {event.source}</p>}</div></li>)}
 </ol>
 {loading&&<p role="status">Loading recorded events…</p>}{error&&<p role="alert">{error} <button onClick={onRetry}>Retry timeline</button></p>}
 {!loading&&!error&&!events.length&&<p>No detailed events were recorded for this trade. Entry: {formatIST(order.entryTime)} · Exit: {formatIST(order.exitTime)}.</p>}
 {order.strategy?.reasons?.length?<details><summary>Analysis saved with this trade</summary><ul>{order.strategy.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul></details>:null}
 </section>;
}
