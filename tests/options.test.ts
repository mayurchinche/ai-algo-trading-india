import test from 'node:test';import assert from 'node:assert/strict';
import {bsPrice,bsGreeks,impliedVolatility,normCdf,yearsToExpiry,arbitrageBounds} from '../shared/optionsMath.js';
import {normalizeOptionChain,selectStrike} from '../shared/optionChain.js';
import {createOptionChainReader,underlyingKeyOf,expiryParam} from '../server/optionChain.js';
import {createOptionChainHandler} from '../api/_option-chain.js';
import {createUpstoxReader} from '../server/upstoxReadOnly.js';
import {researchRoutes} from '../api/research.js';
const near=(a:number,b:number,tol=1e-4)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
const P={S:100,K:100,T:1,r:0.05,q:0,sigma:0.2};

test('Black-Scholes prices and Greeks match textbook values and put-call parity',()=>{
 near(normCdf(0),0.5,1e-7);near(normCdf(1.96),0.975002,1e-6);near(normCdf(-1.96),0.024998,1e-6);
 near(bsPrice('CE',P),10.4506);near(bsPrice('PE',P),5.5735);
 near(bsPrice('CE',P)-bsPrice('PE',P),100-100*Math.exp(-0.05),1e-9);
 const g=bsGreeks('CE',P);near(g.delta,0.6368);near(g.gamma,0.018762,1e-6);near(g.vega,0.37524);near(g.theta,-6.4140/365,1e-5);
 near(bsGreeks('PE',P).delta,0.6368-1);
 const qd={...P,q:0.02};near(bsPrice('CE',qd)-bsPrice('PE',qd),100*Math.exp(-0.02)-100*Math.exp(-0.05),1e-9);
 assert.throws(()=>bsPrice('CE',{...P,T:0}));assert.throws(()=>bsPrice('CE',{...P,sigma:0}));
});
test('implied volatility round-trips and refuses prices outside arbitrage bounds',()=>{
 for(const sigma of [0.05,0.2,0.8,2])for(const type of ['CE','PE'] as const){const r=impliedVolatility(type,bsPrice(type,{...P,sigma}),P);assert.equal(r.status,'SOLVED');near(r.iv!,sigma,1e-5);}
 const b=arbitrageBounds('CE',P);assert.equal(impliedVolatility('CE',b.lower,P).status,'OUTSIDE_ARBITRAGE_BOUNDS');assert.equal(impliedVolatility('CE',101,P).status,'OUTSIDE_ARBITRAGE_BOUNDS');
 assert.equal(impliedVolatility('CE',0,P).status,'INVALID_PRICE');
 near(yearsToExpiry('2026-10-20',Date.parse('2026-10-19T10:00:00Z')),1/365,1e-9);
});

const now=Date.parse('2026-10-19T04:30:00Z'),expiry='2026-10-27',T=yearsToExpiry(expiry,now),spot=25000;
const side=(type:'CE'|'PE',K:number,key:string,sigma=0.15,spread=1)=>{const p=bsPrice(type,{S:spot,K,T,r:0.065,q:0,sigma});return {instrument_key:key,market_data:{ltp:p,close_price:p,bid_price:p-spread/2,ask_price:p+spread/2,bid_qty:75,ask_qty:75,oi:1,volume:1},option_greeks:{iv:15,delta:0.5,gamma:0,theta:0,vega:0}};};
const rows=[24800,24900,25000,25100,25200].map(K=>({expiry,pcr:1,strike_price:K,underlying_key:'NSE_INDEX|Nifty 50',underlying_spot_price:spot,call_options:side('CE',K,'NSE_FO|C'+K),put_options:side('PE',K,'NSE_FO|P'+K)}));
const ctx={underlying:'NIFTY',underlyingKey:'NSE_INDEX|Nifty 50',observedAt:new Date(now).toISOString()};
test('chain normalisation solves model IV from the two-sided mid and keeps provider Greeks separate',()=>{
 const c=normalizeOptionChain([...rows].reverse(),ctx);
 assert.deepEqual(c.strikes.map(s=>s.strike),[24800,24900,25000,25100,25200]);assert.equal(c.atmStrike,25000);assert.equal(c.strikeStep,100);
 const ce=c.strikes[2].CE!;assert.equal(ce.ivStatus,'SOLVED');near(ce.iv!,0.15,1e-4);near(ce.greeks!.delta,0.5,0.05);assert.equal(ce.provider!.iv,15);
 const noBook=normalizeOptionChain(rows.map(r=>({...r,put_options:{...r.put_options,market_data:{...r.put_options.market_data,bid_price:0}}})),ctx);
 assert.equal(noBook.strikes[0].PE!.ivStatus,'NO_TWO_SIDED_QUOTE');assert.equal(noBook.strikes[0].PE!.greeks,null);
 assert.equal(normalizeOptionChain(rows,{...ctx,observedAt:'2026-10-28T00:00:00Z'}).strikes[0].CE!.ivStatus,'EXPIRED');
 assert.throws(()=>normalizeOptionChain([],ctx),/EMPTY/);assert.throws(()=>normalizeOptionChain([rows[0],{...rows[1],expiry:'2026-11-03'}],ctx),/AMBIGUOUS_EXPIRY/);
 assert.throws(()=>normalizeOptionChain([rows[0],rows[0]],ctx),/DUPLICATE/);assert.throws(()=>normalizeOptionChain(rows,{...ctx,underlyingKey:'NSE_INDEX|Nifty Bank'}),/MISMATCH/);
});
test('strike selection by ATM offset, premium and delta follows option direction',()=>{
 const c=normalizeOptionChain(rows,ctx);
 assert.equal(selectStrike(c,'CE',{mode:'atm-offset',steps:1}).strike,25100);assert.equal(selectStrike(c,'PE',{mode:'atm-offset',steps:1}).strike,24900);
 assert.equal(selectStrike(c,'CE',{mode:'atm-offset',steps:-2}).strike,24800);assert.equal(selectStrike(c,'CE',{mode:'atm-offset',steps:3}).status,'OFFSET_OUTSIDE_CHAIN');
 const prem=c.strikes[3].CE!.mid!;assert.equal(selectStrike(c,'CE',{mode:'premium',near:prem+0.1}).strike,25100);
 const d=selectStrike(c,'PE',{mode:'delta',near:0.3});assert.equal(d.status,'SELECTED');assert(d.strike!<25000);
 assert.equal(selectStrike({...c,strikes:c.strikes.map(s=>({...s,CE:null}))},'CE',{mode:'atm-offset',steps:0}).status,'NO_CONTRACTS');
});
test('reader requests one read-only chain path, joins lot sizes and maps relative expiries',async()=>{
 const paths:string[]=[];const reader=createOptionChainReader({read:async(p:string)=>{paths.push(p);return rows;},master:async()=>[{segment:'NSE_FO',instrument_key:'NSE_FO|C25000',lot_size:75}],clock:()=>now});
 const c=await reader({underlying:'NIFTY',expiry:'current-week'});
 assert.deepEqual(paths,['/v2/option/chain?instrument_key=NSE_INDEX%7CNifty%2050&expiry_date=current_week']);assert.equal(c.strikes[2].CE!.lotSize,75);assert.equal(c.strikes[2].PE!.lotSize,null);assert.equal(c.lotSizes,'UPSTOX_INSTRUMENT_MASTER');
 assert.equal(underlyingKeyOf('NSE_EQ|INE009A01021'),'NSE_EQ|INE009A01021');assert.throws(()=>underlyingKeyOf('NSE_FO|X'));assert.throws(()=>expiryParam('2026-02-30'));
 let called=false;await assert.rejects(createUpstoxReader({fetcher:async()=>{called=true;return new Response('{}');},token:()=>'t'})('/v2/order/place?x=1'),/UNSUPPORTED_READ_PATH/);assert.equal(called,false);
});
const response=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}});
test('route validates input, caches for a minute and reports provider failures without detail',async()=>{
 let calls=0,t=now;const h=createOptionChainHandler({reader:async()=>{calls++;return {ok:true} as any;},now:()=>t});
 const req=(query:any)=>({method:'GET',headers:{host:'x'},query});
 await h(req({underlying:'NIFTY',expiry:'current-week'}),response());await h(req({underlying:'NIFTY',expiry:'current-week'}),response());assert.equal(calls,1);t+=60001;await h(req({underlying:'NIFTY',expiry:'current-week'}),response());assert.equal(calls,2);
 const bad=response();await h(req({underlying:'NIFTY'}),bad);assert.equal(bad.code,400);
 const real=createOptionChainHandler({reader:createOptionChainReader({read:async()=>{throw Error('token secret');},master:async()=>[]})});
 const unsupported=response();await real(req({underlying:'XYZ',expiry:'current-week'}),unsupported);assert.equal(unsupported.code,400);assert.equal(unsupported.body.reason,'UNSUPPORTED_UNDERLYING');
 const down=response();await real(req({underlying:'NIFTY',expiry:'current-week'}),down);assert.equal(down.code,503);assert(!JSON.stringify(down.body).includes('secret'));
 assert.equal(typeof researchRoutes['option-chain'],'function');
});
