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
