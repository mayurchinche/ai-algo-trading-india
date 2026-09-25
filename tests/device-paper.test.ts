import test from 'node:test';import assert from 'node:assert/strict';
import {devicePaperRequest,runDevicePaper} from '../src/services/devicePaperAccount';
const data=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)},configurable:true});
Object.defineProperty(globalThis,'window',{value:new EventTarget(),configurable:true});
Object.defineProperty(globalThis,'document',{value:{visibilityState:'visible'},configurable:true});
let queue=Promise.resolve();Object.defineProperty(globalThis,'navigator',{value:{locks:{request:(_key:string,fn:()=>any)=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;}}},configurable:true});
test('device paper account needs no login or network and persists funding across reads',async()=>{
 data.clear();const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('No network expected');};
 try{const first=await devicePaperRequest();assert.equal(first.balance.balance,20000);assert.equal(first.account.enabled,false);
 await devicePaperRequest({transfer:{id:'device-transfer-001',kind:'DEPOSIT',amount:500}});const after=await devicePaperRequest();assert.equal(after.balance.balance,20500);assert.equal(after.events.length,1);
 await devicePaperRequest({transfer:{id:'device-transfer-001',kind:'DEPOSIT',amount:500}});assert.equal((await devicePaperRequest()).balance.balance,20500);
 }finally{globalThis.fetch=original;}
});
test('device funding serializes concurrent writes without losing balance',async()=>{
 data.clear();await Promise.all([devicePaperRequest({transfer:{id:'device-transfer-002',kind:'DEPOSIT',amount:100}}),devicePaperRequest({transfer:{id:'device-transfer-003',kind:'DEPOSIT',amount:200}})]);assert.equal((await devicePaperRequest()).balance.balance,20300);
});
test('earlier archived P&L is carried forward once without modifying original journal',async()=>{
 data.clear();const old=JSON.stringify({version:3,trades:[],archivedNet:-150,archivedCount:2});data.set('paper_ledger_v3',old);assert.equal((await devicePaperRequest()).balance.balance,19850);assert.equal((await devicePaperRequest()).balance.balance,19850);assert.equal(data.get('paper_ledger_v3'),old);
});
test('corrupt device data is preserved and hidden apps cannot execute',async()=>{
 data.clear();data.set('device_paper_account_v1','broken');await assert.rejects(devicePaperRequest());assert.equal(data.get('device_paper_account_v1'),'broken');data.clear();await devicePaperRequest();const before=data.get('device_paper_account_v1');Object.assign(document,{visibilityState:'hidden'});await runDevicePaper([],new Map(),true);assert.equal(data.get('device_paper_account_v1'),before);Object.assign(document,{visibilityState:'visible'});
});
test('manual signal review persists through the real device adapter and submits once',async()=>{
 data.clear();const now=Date.parse('2026-09-25T04:15:00Z');
 await devicePaperRequest({enabled:true});await devicePaperRequest({execution:{mode:'MANUAL',delaySeconds:0}});
 const stock:any={symbol:'TEST',signalId:'adapter-ticket',signal:'STRONG_BUY',overallScore:80,eligible:true,ltp:100,generatedAt:new Date(now).toISOString(),firstSignalAt:new Date(now).toISOString(),quoteTime:new Date(now).toISOString(),foAnalysis:{suggestedStopLoss:99,suggestedTarget:104},reasons:['Test fixture only'],strategies:['test'],scores:{momentum:80}};
 await runDevicePaper([stock],new Map(),true,now);let result=await devicePaperRequest();assert.equal(result.account.state.orders.length,0);assert.equal(result.account.state.intents[0].status,'REVIEW');
 const original=Date.now;Date.now=()=>now+1000;
 try{await devicePaperRequest({reviewIntent:{signalId:'adapter-ticket',orderType:'LIMIT',quantity:1,limitPrice:100}});}finally{Date.now=original;}
 await runDevicePaper([],new Map([['TEST',{price:100,timestamp:new Date(now+2000).toISOString(),source:'test-only'}]]),true,now+2000);
 result=await devicePaperRequest();assert.equal(result.account.state.orders.length,1);assert.equal(result.account.state.orders[0].filled,0);assert.equal(result.account.state.orders[0].orderType,'LIMIT');
 await runDevicePaper([],new Map([['TEST',{price:99.8,timestamp:new Date(now+3000).toISOString(),source:'test-only'}]]),true,now+3000);
 result=await devicePaperRequest();assert.equal(result.account.state.orders[0].filled,1);assert.equal(result.account.state.orders[0].strategy.reasons[0],'Test fixture only');
});
test('order timeline includes its signal workflow, isolates other signals, and paginates at a fixed sequence',async()=>{
 data.clear();await devicePaperRequest();const saved=JSON.parse(data.get('device_paper_account_v1')!);
 saved.state.orders=[{id:'order-a',signalId:'signal-a',status:'CANCELLED',quantity:0,filled:0,exited:0}];
 saved.events=Array.from({length:505},(_,index)=>({id:index+1,kind:index===0?'SIGNAL_APPROVED':'ENTRY_FILL',signalId:'signal-a',orderId:index===0?null:'order-a'}));
 saved.events.push({id:506,kind:'SIGNAL_APPROVED',signalId:'signal-b',orderId:null});saved.state.sequence=506;
 data.set('device_paper_account_v1',JSON.stringify(saved));
 const first=await devicePaperRequest(undefined,0,504,'order-a');assert.equal(first.events.length,500);assert.equal(first.events[0].event.kind,'SIGNAL_APPROVED');assert.equal(first.hasMore,true);
 const second=await devicePaperRequest(undefined,first.nextCursor,504,'order-a');assert.equal(second.events.length,4);assert.equal(second.hasMore,false);assert.equal(second.nextCursor,504);
 assert.equal((await devicePaperRequest(undefined,0,undefined,'missing-order')).events.length,0);
});
