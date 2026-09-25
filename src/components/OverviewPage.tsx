import {useEffect,useRef,useState} from 'react';
import {usePaperSnapshot} from '../hooks/usePaperSnapshot';
import {dailyResult,rupees} from '../services/tradingHome';
import {inPaperView,orderValuation,type PaperOrder} from '../services/paperWorkspace';
import {formatIST} from '../services/tradingTime';
import {SharedOpportunityFeed} from './SharedOpportunityFeed';
import {TradeDetailTimeline} from './TradeDetailTimeline';
export function OverviewPage({onOpenWorkspace}:{onOpenWorkspace:(signalId?:string)=>void}) {
 const {data,error,now}=usePaperSnapshot();
 const [selected,setSelected]=useState<string|null>(null);
 const detail=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(selected){detail.current?.scrollIntoView({block:'start'});detail.current?.focus({preventScroll:true});}},[selected]);
 const orders=data?.account.state.orders||[],active=orders.filter(o=>inPaperView(o,'positions'));
 const recent=orders.filter(o=>inPaperView(o,'closed')).slice().reverse().slice(0,5);
 const selectedOrder=orders.find(o=>o.id===selected);
 function tradeRow(order:PaperOrder){const valuation=orderValuation(order,now);return <button className="home-trade-row" key={order.id} onClick={()=>setSelected(order.id)}><span><b>{order.symbol}</b><small>{order.side} · {valuation.remaining} open · {order.status.replaceAll('_',' ')}</small><time>{formatIST(order.exitTime||order.entryTime||order.submittedAt)}</time></span><span><b className={valuation.net==null?'':valuation.net>=0?'positive':'negative'}>{rupees(valuation.net)}</b><small>{order.status==='CLOSED'?'Realized net':'Estimated net'} · View timeline →</small></span></button>;}
 return <section className="trading-home space-y-6"><div className="page-title"><div><p className="eyebrow">USER1 · SHARED PAPER ACCOUNT · NSE EQUITIES</p><h2>Your trading day</h2><p>Review opportunities. Follow positions. Learn from every exit.</p></div><button className="primary-button" onClick={()=>onOpenWorkspace()}>Paper trades &amp; funds →</button></div>
 <div className="home-session"><span className="home-tag">{data?.account.state.marketOpen?'Market open':'Market closed / unavailable'}</span><span>{data?(data.account.enabled?'Entries enabled':'Entries paused'):error?'Account unavailable':'Account loading'} · {data?(data.account.state.execution?.mode==='MANUAL'?'Manual review':'Automatic paper execution'):'Execution settings unavailable'}</span><span>Last scan {data?.account.state.lastCycleAt?formatIST(data.account.state.lastCycleAt):'Awaiting observations'}</span></div>
 {error&&<p className="notice" role="alert">{error}</p>}
 <div className="metric-grid home-metrics">{[['Ledger balance',rupees(data?.balance.balance),'Includes earlier days and transfers'],['Open position P&L',rupees(data?.balance.positionPnl),'Net estimate · fresh quotes required'],["Today’s closed-trade P&L",rupees(data?dailyResult(orders,now):null),'Net result · exit date in IST'],['Open positions',data?String(active.length):'Unavailable',data?`${orders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status)&&o.filled<o.quantity).length} orders with unfilled quantity`:'Waiting for ledger']].map(([label,value,hint])=><div className="card metric" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>)}</div>
 {selectedOrder?<section className="card" ref={detail} tabIndex={-1}><button className="home-back" onClick={()=>setSelected(null)}>← Back to daily overview</button><TradeDetailTimeline order={selectedOrder} revision={data?.account.revision}/><button onClick={()=>onOpenWorkspace()}>Manage this trade in Paper trades →</button></section>:<>
 <div className="home-columns"><section className="card home-position-list"><div className="home-section-heading"><h3>Open positions</h3><span className="home-tag">Equity intraday</span></div>{active.map(tradeRow)}{!active.length&&<p className="home-empty">{data?'No open positions. Filled paper orders appear here until their exit is complete.':'Waiting for the paper account.'}</p>}</section><section className="card home-position-list"><div className="home-section-heading"><h3>Recent outcomes</h3><button onClick={()=>onOpenWorkspace()}>Full ledger →</button></div>{recent.map(tradeRow)}{!recent.length&&<p className="home-empty">{data?'No completed trades yet. Recorded outcomes appear here after closing or cancellation.':'Waiting for the paper account.'}</p>}</section></div>
 <SharedOpportunityFeed title="Shared opportunities to review" onOpen={onOpenWorkspace}/></>}
 <section className="home-unavailable" aria-label="Unavailable trading products">{['Options','Futures'].map(product=><div key={product}><span className="home-tag">Unavailable</span><h3>{product}</h3><p>Trading stays disabled until verified contract feeds and execution models are ready.</p></div>)}</section>
 <p className="notice">Paper money only · Shared backend ledger across web and Android · Monitoring is requested while an app is open and visible. Public quote snapshots and estimated costs cannot reproduce every exchange fill.</p>
 </section>;
}
