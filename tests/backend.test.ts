import { test } from 'node:test';
import assert from 'node:assert/strict';
import market from '../api/market.js';
import health from '../api/health.js';
import { validateMobileApiBase } from '../server/mobileConfig.js';
import { fetchMarketJSON } from '../src/utils/fetchMarketJSON';
const response = () => ({code:0,body:null as any,headers:{} as Record<string,string>,setHeader(k:string,v:string){this.headers[k]=v},status(c:number){this.code=c;return this},json(v:unknown){this.body=v;return this},end(){return this}});
test('mobile builds reject missing, placeholder, unsafe and path-based backend addresses',()=>{
 for(const value of ['',undefined,'http://example.com','https://localhost','https://your-app.example','https://example.com/api','https://user:secret@example.com','https://example.com/?token=x']) assert.throws(()=>validateMobileApiBase(value));
 assert.equal(validateMobileApiBase('https://ai-algo-trading-india.vercel.app/'),'https://ai-algo-trading-india.vercel.app');
});
test('health and market preflight support Android without Firebase credentials',async()=>{
 const res=response();health({headers:{origin:'https://localhost',host:'test.vercel.app'},method:'GET'},res);
 assert.equal(res.code,200);assert.equal(res.body.apiVersion,1);assert.equal(res.headers['Access-Control-Allow-Origin'],'https://localhost');
 const pre=response();await market({headers:{origin:'https://localhost',host:'test.vercel.app'},method:'OPTIONS',query:{}},pre);assert.equal(pre.code,204);
});
test('malformed and cross-host market paths fail without fetching upstream',async()=>{
 let fetched=false;globalThis.fetch=async()=>{fetched=true;throw new Error('unexpected')};
 for(const path of ['http://[','//evil.test/v8/finance/chart/A','/api/orders']){const res=response();await market({headers:{},method:'GET',query:{provider:'yahoo',path}},res);assert.equal(res.code,400)}
 assert.equal(fetched,false);
});
test('provider failure remains an error and successful chart data is preserved',async()=>{
 const req={headers:{},method:'GET',query:{provider:'yahoo',path:'/v8/finance/chart/ABC.NS?interval=1d&range=2y'}};
 globalThis.fetch=async()=>new Response('rate limited',{status:429});let res=response();await market(req,res);assert.equal(res.code,429);
 const data={chart:{result:[{meta:{regularMarketPrice:100,regularMarketTime:123}}]}};
 globalThis.fetch=async()=>new Response(JSON.stringify(data));res=response();await market(req,res);assert.deepEqual(res.body,data);assert.equal(res.headers['Cache-Control'],'no-store');
});
test('client distinguishes missing backend and SPA HTML from valid JSON',async()=>{
 globalThis.fetch=async()=>new Response('missing',{status:404});await assert.rejects(fetchMarketJSON('/api/yahoo/v8/finance/chart/A'),/Deploy the backend/);
 globalThis.fetch=async()=>new Response('<html>app</html>');await assert.rejects(fetchMarketJSON('/api/yahoo/v8/finance/chart/A'),/instead of JSON/);
 globalThis.fetch=async()=>new Response(JSON.stringify({chart:{result:[]}}));assert.deepEqual(await fetchMarketJSON('/api/yahoo/v8/finance/chart/A'),{chart:{result:[]}});
});
