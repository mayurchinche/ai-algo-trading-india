import {useEffect,useState} from 'react';
import {sharedPaperRequest} from '../services/sharedPaperAccount';
export interface SharedOpportunity {id:number;signalId:string;symbol:string;side:'BUY'|'SELL';score:number;entry:number;stop:number;target:number;at:string;generatedAt:string;quoteTime:string;expiresAt:string;strategy?:{id:string;reasons?:string[]}}
export interface OpportunityFeed {account:{revision:number;state:{sequence:number;lastCycleAt?:string;marketOpen?:boolean;discoveryError?:string}};events:{sequence:number;event:SharedOpportunity}[];hasMore:boolean;nextCursor:number}
export const fetchSharedOpportunities=(before?:number,until?:number):Promise<OpportunityFeed>=>sharedPaperRequest(undefined,0,until,undefined,'intraday',{before});
export function useSharedOpportunities(){
 const [data,setData]=useState<OpportunityFeed|null>(null),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
 useEffect(()=>{let active=true,running=false;
  async function refresh(){if(running||document.visibilityState!=='visible')return;running=true;try{const next=await fetchSharedOpportunities();if(active){setData(old=>old&&old.account.revision>next.account.revision?old:next);setError('');}}catch(e){if(active){setData(null);setError(e instanceof Error?e.message:'Shared feed unavailable');}}finally{running=false;if(active)setNow(Date.now());}}
  void refresh();const timer=setInterval(()=>void refresh(),15000),clock=setInterval(()=>setNow(Date.now()),1000);const update=()=>void refresh();
  window.addEventListener('shared-paper-updated',update);document.addEventListener('visibilitychange',update);
  return()=>{active=false;clearInterval(timer);clearInterval(clock);window.removeEventListener('shared-paper-updated',update);document.removeEventListener('visibilitychange',update);};
 },[]);
 const cycle=Date.parse(data?.account.state.lastCycleAt||'');
 const fresh=!!data&&!data.account.state.discoveryError&&data.account.state.marketOpen===true&&now>=cycle&&now-cycle<=120000;
 return {data,error,now,fresh};
}
