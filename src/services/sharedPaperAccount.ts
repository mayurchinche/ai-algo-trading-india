import {tradingSegment, type TradingSegmentId} from '../../shared/tradingSegments';
// One backend-owned simulation. Never fall back to a device ledger on network errors.
const apiBase=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
const pending=new Map<string,string>();
export async function sharedPaperRequest(action?:Record<string,unknown>,after=0,until?:number,orderId?:string,segment:TradingSegmentId='intraday',feed?:{before?:number}){
 const query=new URLSearchParams({after:String(after),segment});if(until!=null)query.set('until',String(until));if(orderId)query.set('orderId',orderId);
 if(feed){query.set('feed','opportunities');if(feed.before!=null)query.set('before',String(feed.before));}
 const actionKey=action&&action.tick!==true?`${segment}:${JSON.stringify(action)}`:undefined;
 if(actionKey&&!pending.has(actionKey))pending.set(actionKey,crypto.randomUUID());
 const body=action?JSON.stringify(action.tick===true?{tick:true}:{requestId:pending.get(actionKey!),action}):undefined;
 let response:Response;
 try{response=await fetch(`${apiBase}/api/shared-paper?${query}`,{method:action?'POST':'GET',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(65000)});}catch{throw new Error('Shared user1 account could not be reached. No device trades are being created.');}
 let data:any;try{data=await response.json();}catch{throw new Error('Shared paper API is missing or returned a web page. Deploy the shared-account backend first.');}
 if(actionKey&&(response.ok||(response.status>=400&&response.status<500)))pending.delete(actionKey);
 if(!response.ok)throw new Error(data.error||`Shared paper request failed (${response.status}).`);
 if(data.account?.id!==tradingSegment(segment)?.accountId||(data.account?.segment??'intraday')!==segment||data.account?.name!=='user1'||data.account?.storage!=='shared-backend'||(!feed&&!Array.isArray(data.account?.state?.orders))||(feed&&!Number.isSafeInteger(data.account?.state?.sequence))||!Array.isArray(data.events)||!data.balance)throw new Error('Invalid shared account response.');
 if(action){window.dispatchEvent(new Event('shared-paper-updated'));if(action.reviewIntent||action.enabled===true)window.dispatchEvent(new Event('paper-scan-requested'));}
 return data;
}
export function exportEarlierDeviceAccount(){
 const raw=localStorage.getItem('device_paper_account_v1');
 if(!raw)throw new Error('No earlier device paper account is stored here.');
 const data=JSON.parse(raw);
 if(!data.state||!Array.isArray(data.events))throw new Error('Device archive is invalid. Original storage has been preserved.');
 return data;
}
