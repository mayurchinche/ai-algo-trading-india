import {useEffect,useState} from 'react';
import {tradingSegments} from '../../shared/tradingSegments';
import {sharedPaperRequest} from '../services/sharedPaperAccount';
import {paperEvidence} from '../services/paperEvidence';
import {formatIST} from '../services/tradingTime';
type Row={label:string;error?:string;closed?:number;evaluated?:number;excluded?:number;winRate?:number|null;net?:number;scan?:string};
export function SegmentComparison(){
 const [rows,setRows]=useState<Row[]>([]);
 useEffect(()=>{let active=true;const refresh=async()=>{
  const next=await Promise.all(tradingSegments.map(async s=>{try{
   const {account,balance}=await sharedPaperRequest(undefined,0,undefined,undefined,s.id),e=paperEvidence(account.state.orders);
   const evaluated=e.groups.reduce((n,g)=>n+g.trades,0),wins=e.groups.reduce((n,g)=>n+g.wins,0);
   return {label:s.label,closed:e.closed,evaluated,excluded:e.excluded,winRate:evaluated?wins/evaluated*100:null,net:balance.realized,scan:account.state.lastScan?.at};
  }catch{return {label:s.label,error:'Account unavailable'};}}));if(active)setRows(next);
 };void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},60000);return()=>{active=false;clearInterval(timer);};},[]);
 return <details className="card"><summary>Compare all five paper modes</summary><p>Recorded results after each mode's estimated costs. Different holding periods and capital budgets are not directly comparable. Win rate uses only complete, eligible closed trades; exclusions remain in ledger P&amp;L.</p><div style={{overflowX:'auto'}}><table><thead><tr><th>Mode</th><th>Closed</th><th>Evaluated / excluded</th><th>Evaluated win rate</th><th>Ledger net P&amp;L</th><th>Last scan</th></tr></thead><tbody>{rows.map(r=><tr key={r.label}><th>{r.label}</th>{r.error?<td colSpan={5}>{r.error}</td>:<><td>{r.closed}</td><td>{r.evaluated} / {r.excluded}</td><td>{r.winRate==null?'Insufficient evidence':r.winRate.toFixed(1)+'%'}</td><td>{r.net?.toLocaleString('en-IN',{style:'currency',currency:'INR'})}</td><td>{formatIST(r.scan)}</td></>}</tr>)}</tbody></table></div>{!rows.length&&<p>Loading account evidence…</p>}</details>;
}
