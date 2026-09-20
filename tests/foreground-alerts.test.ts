import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectForegroundAlerts, getForegroundAlerts } from '../src/services/foregroundAlerts';
import type { DiscoveredStock } from '../src/services/stockDiscovery';
const storage = new Map<string,string>();
Object.assign(globalThis, { localStorage: { getItem: (k:string)=>storage.get(k)??null, setItem:(k:string,v:string)=>storage.set(k,v) } });
const now=Date.parse('2026-09-18T05:00:00Z');
const stock=()=>({symbol:'ABC',eligible:true,signal:'STRONG_BUY',overallScore:75,ltp:100,generatedAt:new Date(now).toISOString(),quoteTime:new Date(now).toISOString(),foAnalysis:{suggestedStopLoss:98,suggestedTarget:106}} as DiscoveredStock);
test('foreground alerts require visibility, open market and fresh strong eligible signals',()=>{
 storage.clear();
 assert.equal(collectForegroundAlerts([stock()],false,true,now).length,0);
 assert.equal(collectForegroundAlerts([stock()],true,false,now).length,0);
 for(const patch of [{overallScore:69},{eligible:false},{signal:'BUY'},{quoteTime:new Date(now-121000).toISOString()},{generatedAt:'bad'},{foAnalysis:{suggestedStopLoss:101,suggestedTarget:106}}]) assert.equal(collectForegroundAlerts([{...stock(),...patch} as DiscoveredStock],true,true,now).length,0);
 assert.equal(collectForegroundAlerts([stock()],true,true,now).length,1);
 assert.equal(collectForegroundAlerts([stock()],true,true,now+1000).length,0);
 assert.equal(getForegroundAlerts(now).length,1);
});
test('sell direction is independent, expiry and 30-day retention are enforced',()=>{
 storage.clear();
 assert.equal(collectForegroundAlerts([stock()],true,true,now).length,1);
 const sell={...stock(),signal:'STRONG_SELL',overallScore:-80,foAnalysis:{suggestedStopLoss:102,suggestedTarget:94}} as DiscoveredStock;
 const alerts=collectForegroundAlerts([sell,sell],true,true,now);
 assert.equal(alerts.length,1); assert.equal(alerts[0].side,'SELL');
 assert.equal(Date.parse(alerts[0].expiresAt),now+120000);
 assert.equal(getForegroundAlerts(now+31*86400000).length,0);
});
