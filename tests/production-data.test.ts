import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMetalChart} from '../src/services/metalsService';
import {generateOptionsPicks} from '../src/services/optionsEngine';
import {autoApplyForIPO} from '../src/services/ipoAutoApply';
import {scoreIPO, isFreshIPOCache} from '../src/services/ipoService';
import {fetchNifty} from '../src/services/liveData';
import {discoverStocks} from '../src/services/stockDiscovery';
import proxy from '../api/proxy.js';
const now=Date.parse('2026-09-20T06:00:00Z');
const config={name:'Gold',ticker:'GC=F',unit:'USD / troy ounce'};
function chart(){return {chart:{result:[{meta:{currency:'USD',regularMarketPrice:100,regularMarketTime:now/1000-60},timestamp:Array.from({length:60},(_,i)=>now/1000-(61-i)*86400),indicators:{quote:[{close:Array.from({length:60},(_,i)=>100+i)}]}}]}};}
test('metals never substitute missing prices, timestamps or currency',()=>{
 for(const field of ['regularMarketPrice','regularMarketTime','currency']) {const data:any=chart();delete data.chart.result[0].meta[field];assert.throws(()=>parseMetalChart(data,config,now));}
 const data=chart();data.chart.result[0].meta.regularMarketTime=now/1000+60;assert.throws(()=>parseMetalChart(data,config,now));
});
test('metals preserve aligned provider dates through missing rows and original units',()=>{
 const data:any=chart();data.chart.result[0].indicators.quote[0].close[3]=null;
 const result=parseMetalChart(data,config,now);
 assert.equal(result.priceHistory.length,59);
 assert.equal(result.priceHistory[3].date,new Date(data.chart.result[0].timestamp[4]*1000).toISOString().slice(0,10));
 assert.equal(result.priceHistory[3].price,104);assert.equal(result.priceUSD,100);assert.equal(result.unit,'USD / troy ounce');
 assert.ok(!('pricePerGram' in result));assert.ok(!('high52w' in result));
});
test('unsupported options and broker execution fail without any provider call',async()=>{
 globalThis.fetch=async()=>{throw Error('network should not be reached')};
 assert.throws(()=>generateOptionsPicks([]),/Options unavailable/);
 await assert.rejects(autoApplyForIPO({name:'test'}),/IPO application unavailable/);
});
test('missing IPO observations produce unknown score and stale caches cannot be used',()=>{
 assert.equal(scoreIPO({name:'test'}).score,null);
 assert.equal(scoreIPO({gmp_pct:20,subscription_total:5}).score,60);
 for(const date of ['bad',new Date(now-3600001).toISOString(),new Date(now+6000).toISOString()]) assert.equal(isFreshIPOCache(date,now),false);
 assert.ok(isFreshIPOCache(new Date(now-60000).toISOString(),now));
});
test('Nifty missing prices or source time remains unavailable',async()=>{
 globalThis.fetch=async()=>new Response(JSON.stringify({chart:{result:[{meta:{chartPreviousClose:100}}]}}));assert.equal(await fetchNifty(),null);
});
test('failed or empty screeners do not silently inject a fixed stock list',async()=>{
 const requests:string[]=[];globalThis.fetch=async(url:any)=>{requests.push(String(url));return new Response(JSON.stringify({finance:{result:[{quotes:[]}]}}))};
 await assert.rejects(discoverStocks(),/No stocks/);assert.equal(requests.length,3);assert.ok(requests.every(url=>!url.includes('chart')));
});
const response=()=>({code:0,body:null as any,setHeader(){},status(code:number){this.code=code;return this},json(body:any){this.body=body;return this},send(body:any){this.body=body;return this}});
test('legacy data gateway cannot forward broker orders, messages or authentication',async()=>{
 let called=false;globalThis.fetch=async()=>{called=true;throw Error('unexpected')};
 for(const url of ['https://api.dhan.co/v2/orders','https://api.telegram.org/botsecret/sendMessage','https://evil.investorgain.com/']){const res=response();await proxy({headers:{},method:'GET',query:{url}},res);assert.equal(res.code,403);}
 const res=response();await proxy({headers:{},method:'POST',query:{url:'https://webnodejs.investorgain.com/cloud/v2/report/data-read/331'}},res);assert.equal(res.code,405);assert.equal(called,false);
});
