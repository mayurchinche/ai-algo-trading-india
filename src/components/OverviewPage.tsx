import {useEffect,useRef,useState} from 'react';
import {useStockDiscovery} from '../hooks/useStockDiscovery';
import {usePaperSnapshot} from '../hooks/usePaperSnapshot';
import {dailyResult,rupees} from '../services/tradingHome';
import {inPaperView,orderValuation,type PaperOrder} from '../services/paperWorkspace';
import {strongSignalId} from '../services/strongSignalPolicy';
import {formatIST} from '../services/tradingTime';
import {OpportunityCard} from './OpportunityCard';
import {TradeDetailTimeline} from './TradeDetailTimeline';
export function OverviewPage({onOpenWorkspace}:{onOpenWorkspace:(signalId?:string)=>void}) {
 const {stocks,marketOpen,loading,lastScan,error:feedError,rescan}=useStockDiscovery();
 const {data,error,now}=usePaperSnapshot();
 const [filter,setFilter]=useState('strong'),[selected,setSelected]=useState<string|null>(null);
 const detail=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(selected){detail.current?.scrollIntoView({block:'start'});detail.current?.focus({preventScroll:true});}},[selected]);
 const orders=data?.account.state.orders||[],active=orders.filter(o=>inPaperView(o,'positions'));
 const recent=orders.filter(o=>inPaperView(o,'closed')).slice().reverse().slice(0,5);
 const opportunities=stocks.filter(s=>filter==='all'||['STRONG_BUY','STRONG_SELL'].includes(s.signal)).slice().sort((a,b)=>Math.abs(b.overallScore)-Math.abs(a.overallScore));
 const selectedOrder=orders.find(o=>o.id===selected);
 function tradeRow(order:PaperOrder){const valuation=orderValuation(order,now);return <button className="home-trade-row" key={order.id} onClick={()=>setSelected(order.id)}><span><b>{order.symbol}</b><small>{order.side} · {valuation.remaining} open · {order.status.replaceAll('_',' ')}</small><time>{formatIST(order.exitTime||order.entryTime||order.submittedAt)}</time></span><span><b className={valuation.net==null?'':valuation.net>=0?'positive':'negative'}>{rupees(valuation.net)}</b><small>{order.status==='CLOSED'?'Realized net':'Estimated net'} · View timeline →</small></span></button>;}
 return <section className="trading-home space-y-6"><div className="page-title"><div><p className="eyebrow">USER1 · SHARED PAPER ACCOUNT · NSE EQUITIES</p><h2>Your trading day</h2><p>Review opportunities. Follow positions. Learn from every exit.</p></div><button className="primary-button" onClick={()=>onOpenWorkspace()}>Paper trades &amp; funds →</button></div>
 <div className="home-session"><span className="home-tag">{marketOpen?'Market open':'Market closed / unavailable'}</span><span>{data?(data.account.enabled?'Entries enabled':'Entries paused'):error?'Account unavailable':'Account loading'} · {data?(data.account.state.execution?.mode==='MANUAL'?'Manual review':'Automatic paper execution'):'Execution settings unavailable'}</span><span>Last scan {lastScan?formatIST(lastScan.toISOString()):'Awaiting observations'}</span></div>
 {error&&<p className="notice" role="alert">{error}</p>}
 <div className="metric-grid home-metrics">{[['Ledger balance',rupees(data?.balance.balance),'Includes earlier days and transfers'],['Open position P&L',rupees(data?.balance.positionPnl),'Net estimate · fresh quotes required'],["Today’s closed-trade P&L",rupees(data?dailyResult(orders,now):null),'Net result · exit date in IST'],['Open positions',data?String(active.length):'Unavailable',data?`${orders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status)&&o.filled<o.quantity).length} orders with unfilled quantity`:'Waiting for ledger']].map(([label,value,hint])=><div className="card metric" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>)}</div>
 {selectedOrder?<section className="card" ref={detail} tabIndex={-1}><button className="home-back" onClick={()=>setSelected(null)}>← Back to daily overview</button><TradeDetailTimeline order={selectedOrder} revision={data?.account.revision}/><button onClick={()=>onOpenWorkspace()}>Manage this trade in Paper trades →</button></section>:<>
 <div className="home-columns"><section className="card home-position-list"><div className="home-section-heading"><h3>Open positions</h3><span className="home-tag">Equity intraday</span></div>{active.map(tradeRow)}{!active.length&&<p className="home-empty">{data?'No open positions. Filled paper orders appear here until their exit is complete.':'Waiting for the paper account.'}</p>}</section><section className="card home-position-list"><div className="home-section-heading"><h3>Recent outcomes</h3><button onClick={()=>onOpenWorkspace()}>Full ledger →</button></div>{recent.map(tradeRow)}{!recent.length&&<p className="home-empty">{data?'No completed trades yet. Recorded outcomes appear here after closing or cancellation.':'Waiting for the paper account.'}</p>}</section></div>
 <section aria-label="Market opportunities"><div className="home-section-heading"><div><p className="eyebrow">OBSERVED SETUPS</p><h3>Opportunities to review</h3></div><button disabled={loading} onClick={()=>void rescan()}>{loading?'Scanning…':'Refresh scan'}</button></div><p>Existing strategy scores are research signals. Account limits, fresh quotes and execution checks still apply.</p><div className="paper-tabs" role="group" aria-label="Opportunity filter"><button aria-pressed={filter==='strong'} onClick={()=>setFilter('strong')}>Strong signals</button><button aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All observations</button></div>
 {feedError&&<p role="alert" className="notice">Feed unavailable: {feedError}. Retained observations may be stale.</p>}
 {!opportunities.length&&<div className="card home-empty" role="status"><h4>{loading?'Scanning market observations…':stocks.length?'No strong signals in this scan':'Waiting for market observations'}</h4><p>A quiet screen is valid. No opportunity is fabricated to fill it.</p></div>}
 <div className="opportunity-grid">{opportunities.map(stock=><OpportunityCard key={stock.symbol} stock={stock} intent={data?.account.state.intents?.find(i=>i.signalId===(stock.signalId||strongSignalId(stock,now)))} marketOpen={marketOpen&&!feedError} enabled={!!data?.account.enabled} now={now} onOpen={()=>onOpenWorkspace(stock.signalId||strongSignalId(stock,now))}/>)}</div></section></>}
 <section className="home-unavailable" aria-label="Unavailable trading products">{['Options','Futures'].map(product=><div key={product}><span className="home-tag">Unavailable</span><h3>{product}</h3><p>Trading stays disabled until verified contract feeds and execution models are ready.</p></div>)}</section>
 <p className="notice">Paper money only · Shared backend ledger across web and Android · Monitoring is requested while an app is open and visible. Public quote snapshots and estimated costs cannot reproduce every exchange fill.</p>
 </section>;
}
