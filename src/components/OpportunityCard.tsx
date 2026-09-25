import type {DiscoveredStock} from '../services/stockDiscovery';
import type {PaperIntent} from './PaperExecutionPanel';
import {formatIST} from '../services/tradingTime';
import {opportunityStatus,rupees} from '../services/tradingHome';
export function OpportunityCard({stock,intent,marketOpen,enabled,now,onOpen}:{stock:DiscoveredStock;intent?:PaperIntent;marketOpen:boolean;enabled:boolean;now:number;onOpen:()=>void}){
 const status=opportunityStatus(stock,marketOpen,enabled,now);
 const risk=Math.abs(stock.ltp-stock.foAnalysis.suggestedStopLoss),reward=Math.abs(stock.foAnalysis.suggestedTarget-stock.ltp);
 const valid=stock.overallScore>0?stock.foAnalysis.suggestedStopLoss<stock.ltp&&stock.foAnalysis.suggestedTarget>stock.ltp:stock.foAnalysis.suggestedStopLoss>stock.ltp&&stock.foAnalysis.suggestedTarget<stock.ltp;
 return <article className="card opportunity-card"><div className="home-section-heading"><div><h3>{stock.symbol}</h3><p className="opportunity-name">{stock.name}</p></div><span className={`badge ${stock.overallScore>=0?'badge-green':'badge-red'}`}>{stock.signal.replaceAll('_',' ')}</span></div>
 <p className="home-tag">{status}</p><p className="opportunity-score">{Math.abs(stock.overallScore)}<small>/100 · signal strength, not win probability</small></p>
 <div className="opportunity-levels"><div><span>Observed price</span><strong>{rupees(stock.ltp)}</strong></div><div><span>Protective stop</span><strong>{rupees(stock.foAnalysis.suggestedStopLoss)}</strong></div><div><span>Target</span><strong>{rupees(stock.foAnalysis.suggestedTarget)}</strong></div></div>
 <p>Gross reward / risk: {valid&&risk>0&&Number.isFinite(reward/risk)?`${(reward/risk).toFixed(2)} : 1`:'Unavailable'} · Before costs and slippage</p>
 <div className="opportunity-times"><time>Signal {formatIST(stock.firstSignalAt||stock.generatedAt)}</time><time>Quote {formatIST(stock.quoteTime)}</time></div>
 <details><summary>Why this setup?</summary><ul>{stock.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul>{stock.blockedReasons.length>0&&<p>Checks: {stock.blockedReasons.join(' · ')}</p>}</details>
 {intent&&<p>Paper decision: {['REVIEW','WAITING','APPROVED'].includes(intent.status)&&now>=Date.parse(intent.expiresAt)?'Expired; awaiting scan':intent.status.replaceAll('_',' ')}{intent.reason?` · ${intent.reason}`:''}</p>}
 <button onClick={onOpen}>Open paper-trading controls →</button></article>;
}
