import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAlert, equityAlert, notificationContent } from '../server/alertPolicy.js';
import { androidMessage } from '../server/pushDelivery.js';
import mobileApi from '../api/mobile-alerts.js';
import dispatchApi from '../api/dispatch-alerts.js';
const now=Date.parse('2026-09-18T05:00:00Z');
const signal=()=>({id:'test:ABC:BUY',assetClass:'EQUITY',symbol:'ABC',side:'BUY',score:75,entry:100,stop:98,target:106,generatedAt:new Date(now).toISOString(),quoteTime:new Date(now).toISOString(),expiresAt:new Date(now+120000).toISOString(),strategyVersion:'test-v1'});
test('only strong signals with fresh quotes and correct risk levels qualify',()=>{
 assert.equal(validateAlert(signal(),now).symbol,'ABC');
 for(const patch of [{score:69},{entry:NaN},{stop:101},{score:-80},{quoteTime:'unknown'},{expiresAt:new Date(now).toISOString()},{generatedAt:new Date(now-180000).toISOString()}]) assert.throws(()=>validateAlert({...signal(),...patch},now));
});
test('options reject estimated contracts and underlying-price substitutions',()=>{
 const s={...signal(),assetClass:'OPTIONS',contract:{verified:true,instrumentId:'12345',optionType:'CE',strike:25000,expiry:'2026-09-24',lotSize:75,bid:99,ask:100,quoteTime:signal().quoteTime}};
 assert.equal(validateAlert(s,now).contract.lotSize,75);
 for(const contract of [undefined,{...s.contract,verified:false},{...s.contract,lotSize:0},{...s.contract,bid:90},{...s.contract,expiry:'2026-09-17'}])assert.throws(()=>validateAlert({...s,contract},now));
 assert.throws(()=>validateAlert({...s,entry:25000,stop:24000,target:26000},now));
});
test('equity adapter deduplicates by session/symbol/direction and rejects absent quote time',()=>{
 const stock={symbol:'ABC',eligible:true,overallScore:75,ltp:100,generatedAt:signal().generatedAt,quoteTime:signal().quoteTime,foAnalysis:{suggestedStopLoss:98,suggestedTarget:106}};
 assert.equal(equityAlert(stock,now).id,equityAlert({...stock,generatedAt:new Date(now+1000).toISOString()},now+1000).id);
 assert.equal(equityAlert({...stock,eligible:false},now),null); assert.equal(equityAlert({...stock,quoteTime:undefined},now),null);
});
test('Android push has visible content, high priority, short TTL and stable notification tag',()=>{
 const msg=androidMessage('token',signal(),'alert-id',now+30000);
 assert.equal(msg.android.ttl,90000);assert.equal(msg.android.priority,'high');assert.equal(msg.android.notification.tag,'alert-id');assert.equal(msg.data.alertId,'alert-id');assert.match(msg.notification.body,/10:30:00 IST/);assert.throws(()=>androidMessage('token',signal(),'id',now+120000));
 assert.match(notificationContent(signal()).title,/research/);
});
function response(){return{code:200,headers:{} as Record<string,string>,body:null as any,setHeader(k:string,v:string){this.headers[k]=v},status(n:number){this.code=n;return this},json(value:unknown){this.body=value;return this},end(){return this}}}
test('mobile endpoint rejects unauthenticated access before touching storage',async()=>{const r=response();await mobileApi({headers:{},method:'GET'},r);assert.equal(r.code,401);});
test('mobile endpoint rejects unapproved origins and permits native preflight',async()=>{let r=response();await mobileApi({headers:{origin:'https://attacker.example',host:'api.example'},method:'GET'},r);assert.equal(r.code,403);r=response();await mobileApi({headers:{origin:'capacitor://localhost',host:'api.example'},method:'OPTIONS'},r);assert.equal(r.code,204);assert.equal(r.headers['Access-Control-Allow-Origin'],'capacitor://localhost');});
test('dispatch endpoint denies calls with missing worker credentials',async()=>{const r=response();await dispatchApi({headers:{},method:'POST'},r);assert.equal(r.code,401);});

import { dispatchAlerts } from '../server/dispatchAlerts.js';
function fakeDatabase({enabled=true,expired=false,attempts=1}={}) {
 const t=Date.now();const patches:any[]=[];
 const payload={...signal(),generatedAt:new Date(t).toISOString(),quoteTime:new Date(t).toISOString(),expiresAt:new Date(t+(expired?-1:120000)).toISOString()};
 const records:any={mobile_push_devices:{id:'device',user_id:'user',enabled:true,token:'token',platform:'android'},mobile_alerts:{id:'alert',user_id:'user',payload},mobile_alert_preferences:{enabled,equity_enabled:true,options_enabled:false,min_score:70}};
 return {patches,rpc:async()=>({data:[{id:'job',user_id:'user',device_id:'device',alert_id:'alert',attempts,lease_id:'lease'}]}),from(table:string){let patch:any;const query:any={select(){return query},update(p:any){patch=p;return query},eq(){return query},async maybeSingle(){return{data:records[table]}},then(resolve:any){if(patch)patches.push({table,...patch});return Promise.resolve({data:null}).then(resolve)}};return query}};
}
test('dispatcher cancels revoked preferences and never sends expired alerts',async()=>{for(const config of [{enabled:false},{expired:true}]){let sends=0;const db=fakeDatabase(config);await dispatchAlerts(db,async()=>{sends++;return'receipt'});assert.equal(sends,0);assert.ok(['cancelled','expired'].includes(db.patches.at(-1).status));}});
test('dispatcher records provider acceptance without claiming device delivery',async()=>{const db=fakeDatabase();await dispatchAlerts(db,async()=> 'receipt-123');assert.equal(db.patches.at(-1).status,'accepted');assert.equal(db.patches.at(-1).provider_receipt,'receipt-123');});
test('dispatcher disables invalid device tokens and stops retrying',async()=>{const db=fakeDatabase();await dispatchAlerts(db,async()=>{throw Object.assign(new Error('invalid'),{invalidToken:true})});assert.ok(db.patches.some(p=>p.table==='mobile_push_devices'&&p.enabled===false));assert.equal(db.patches.at(-1).status,'failed');});
test('dispatcher retries transient failures with a bounded attempt count',async()=>{for(const attempts of [1,3]){const db=fakeDatabase({attempts});await dispatchAlerts(db,async()=>{throw new Error('timeout')});assert.equal(db.patches.at(-1).status,attempts===3?'failed':'pending');}});
