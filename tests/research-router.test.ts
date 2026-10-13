import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createResearchRouter,researchRoutes} from '../api/research.js';
const res=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;}});
test('router removes the rewrite key so strict handlers see only their own query',async()=>{
 const seen:any[]=[];const router=createResearchRouter({'company-history':async(req:any)=>{seen.push(req.query);}},async()=>{throw Error('news must not run');});
 await router({method:'GET',headers:{},query:{route:'company-history',symbol:'TEST',segment:'sme'}},res());
 assert.deepEqual(seen,[{symbol:'TEST',segment:'sme'}]);
});
test('requests without a route stay on news; unknown or inherited routes are rejected',async()=>{
 let news=0;const router=createResearchRouter({},async()=>{news++;});
 await router({method:'GET',headers:{},query:{q:'nifty'}},res());assert.equal(news,1);
 for(const route of ['proxy','__proto__','toString',['company-history']]){const r=res();await router({method:'GET',headers:{},query:{route}},r);assert.equal(r.code,404);}
 assert.equal(news,1);
});
test('vercel rewrites cover every routed endpoint and the deployment stays within 12 functions',()=>{
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 const rewrite=config.rewrites.find((r:any)=>r.destination==='/api/research?route=:route');
 assert(rewrite,'missing research rewrite');assert(config.rewrites.indexOf(rewrite)<config.rewrites.findIndex((r:any)=>r.destination==='/index.html'));
 const routed=rewrite.source.match(/\(([^)]+)\)/)[1].split('|').sort();assert.deepEqual(routed,Object.keys(researchRoutes).sort());
 const functions=readdirSync('api').filter(f=>/\.(js|ts|mjs)$/.test(f)&&!f.startsWith('_'));assert(functions.length<=12,`${functions.length} Vercel functions exceed the Hobby limit of 12`);
 for(const pattern of Object.keys(config.functions))if(!pattern.includes('*'))assert(functions.includes(pattern.slice(4)),`functions entry ${pattern} matches no deployed function`);
});
