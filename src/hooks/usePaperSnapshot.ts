import {useEffect,useState} from 'react';
import {devicePaperRequest} from '../services/devicePaperAccount';
import type {PaperOrder} from '../services/paperWorkspace';
import type {PaperBalance} from '../components/PaperFundsPanel';
import type {ExecutionSettings,PaperIntent} from '../components/PaperExecutionPanel';
export interface PaperSnapshot {account:{enabled:boolean;revision:number;state:{orders:PaperOrder[];sequence:number;execution?:ExecutionSettings;intents?:PaperIntent[];lastCycleAt?:string}};balance:PaperBalance}
export function usePaperSnapshot(){
 const [data,setData]=useState<PaperSnapshot|null>(null),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
 useEffect(()=>{let active=true;
  const refresh=async()=>{try{const next=await devicePaperRequest();if(active){setData(next as unknown as PaperSnapshot);setError('');setNow(Date.now());}}catch(e){if(active){setData(null);setError(e instanceof Error?e.message:'Paper account unavailable');}}};
  void refresh();const update=()=>void refresh();
  window.addEventListener('device-paper-updated',update);window.addEventListener('storage',update);document.addEventListener('visibilitychange',update);
  const timer=setInterval(update,15000);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('device-paper-updated',update);window.removeEventListener('storage',update);document.removeEventListener('visibilitychange',update);};
 },[]);
 return {data,error,now};
}
