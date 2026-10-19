import {useEffect,useRef,useState} from 'react';
import {useSharedOpportunities,type SharedOpportunity} from '../hooks/useSharedOpportunities';
import {formatIST} from '../services/tradingTime';
const seen=new Set<string>();
export function SignalPopup({onView}:{onView:()=>void}){
 const {data,now,fresh}=useSharedOpportunities();const [queue,setQueue]=useState<SharedOpportunity[]>([]);const last=useRef<unknown>(null);
 useEffect(()=>{if(!fresh||document.visibilityState!=='visible'){setQueue([]);return;}
  if(last.current!==data){last.current=data;const added=(data?.events||[]).map(r=>r.event).filter(s=>Date.parse(s.expiresAt)>Date.now()&&!seen.has(s.signalId));for(const s of added)seen.add(s.signalId);setQueue(q=>[...q.filter(a=>Date.parse(a.expiresAt)>Date.now()),...added]);}
 },[data,fresh]);
 useEffect(()=>{const hide=()=>{if(document.visibilityState!=='visible')setQueue([]);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 const s=queue.find(s=>Date.parse(s.expiresAt)>now);if(!s||!fresh)return null;
 return <aside role="alert" aria-label="Shared strong signal" className="card" style={{position:'fixed',top:16,right:16,left:16,maxWidth:440,marginLeft:'auto',zIndex:100,maxHeight:'80dvh',overflowY:'auto',boxShadow:'0 12px 48px #0004'}}><div className="trade-heading"><strong>{s.side} {s.symbol} · Intraday</strong><button aria-label="Dismiss signal" onClick={()=>setQueue(q=>q.filter(a=>a.signalId!==s.signalId))}>×</button></div><p>Score {Math.abs(s.score)}/100 · Shared research signal</p><p>Signal: {formatIST(s.generatedAt)}</p><p>Quote: {formatIST(s.quoteTime)}</p><p>Reference ₹{s.entry.toFixed(2)} · Stop ₹{s.stop.toFixed(2)} · Target ₹{s.target.toFixed(2)}</p><p>Expires {formatIST(s.expiresAt)}. Check current prices and the paper ledger for execution status.</p><button onClick={()=>{setQueue(q=>q.filter(a=>a.signalId!==s.signalId));onView();}}>View shared alerts</button></aside>;
}
