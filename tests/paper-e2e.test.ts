// End-to-end paper trading: authenticated scheduler -> production store -> cycle ->
// workflow -> engine -> production SQL functions -> API read. Only market data is scripted.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createScheduledPaperHandler} from '../server/scheduledPaper.js';
import {createSharedPaperHandler,sharedStore} from '../server/sharedPaper.js';
import {newPaperAccount} from '../server/paperEngine.js';
import {strongSignalRejection,toPaperCandidate} from '../src/services/strongSignalPolicy';

// Minimal supabase-js stand-in that turns the store's calls into real SQL.
function supabaseOver(pg:PGlite){
 const json=(v:unknown)=>v!==null&&typeof v==='object'?JSON.stringify(v):v;
 const col=(c:string)=>c.replace(/->>(\w+)/,"->>'$1'");
 const run=async(sql:string,params:unknown[],shape:(rows:any[])=>unknown)=>{try{return {data:shape((await pg.query(sql,params)).rows),error:null};}catch(error:any){return {data:null,error:{code:'SQL',message:error.message}};}};
 return {
  rpc:(name:string,args:Record<string,unknown>)=>run(`select public.${name}(${Object.keys(args).map((k,i)=>`${k}=>$${i+1}`).join(',')}) as data`,Object.values(args).map(json),rows=>rows[0].data),
  from(table:string){
   const where:string[]=[],params:unknown[]=[];let cols='*',tail='';
   const add=(op:string)=>(c:string,v:unknown)=>{params.push(v);where.push(`${col(c)} ${op} $${params.length}`);return q;};
   const sql=()=>`select ${cols} from public.${table}${where.length?' where '+where.join(' and '):''}${tail}`;
   const q:any={select(c:string){cols=c;return q;},eq:add('='),gt:add('>'),lt:add('<'),lte:add('<='),
    order(c:string,{ascending=true}={}){tail+=` order by ${col(c)} ${ascending?'asc':'desc'}`;return q;},limit(n:number){tail+=` limit ${n}`;return q;},
    single:()=>run(sql(),params,rows=>{if(rows.length!==1)throw Error('expected one row');return rows[0];}),
    maybeSingle:()=>run(sql(),params,rows=>rows[0]??null),
    then:(ok:any,fail:any)=>run(sql(),params,rows=>rows).then(ok,fail)};
   return q;
  },
 };
}
const res=()=>({code:0,body:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}});
const iso=(ms:number)=>new Date(ms).toISOString();

test('scheduler-driven paper trade: signal -> order -> fill -> target exit -> realized ledger and API',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('create role anon;create role authenticated;create role service_role;');
  for(const f of ['20260925_shared_paper_user1.sql','20260926_paper_portfolios.sql','20261002_multi_mode_paper.sql'])await pg.exec(await readFile('supabase/migrations/'+f,'utf8'));
  await pg.query("insert into shared_paper_accounts(id,state,enabled) values('user1',$1,true)",[JSON.stringify({...newPaperAccount(),capital:20000})]);
  const client=supabaseOver(pg),store=(segment:string)=>sharedStore(segment,client);
  const t0=Date.parse('2026-10-16T04:30:00Z');let clock=t0;const now=()=>clock;// Friday 10:00 IST
  // A scanner result that passes the production admission policy, mapped by the production mapper.
  const stock={symbol:'E2ETEST',signal:'STRONG_BUY',overallScore:75,eligible:true,ltp:500,generatedAt:iso(t0-1000),quoteTime:iso(t0-2000),foAnalysis:{suggestedStopLoss:490,suggestedTarget:515},reasons:['fixture'],scores:{},strategies:[]};
  assert.equal(strongSignalRejection(stock,t0),null);
  assert.equal(strongSignalRejection({...stock,overallScore:69},t0),'SCORE_BELOW_70');
  const quote=(price:number,at:number)=>({symbol:'E2ETEST',price,timestamp:iso(at),source:'fixture'});
  const script=new Map<number,any>([
   [t0,{candidates:[toPaperCandidate(stock,t0)],quotes:[quote(500,t0-2000)]}],
   [t0+60000,{candidates:[],quotes:[quote(501,t0+59000)]}],
   [t0+120000,{candidates:[],quotes:[quote(516,t0+119000)]}],
   [t0+180000,{candidates:[],quotes:[quote(516.5,t0+179000)]}],
  ]);
  const observe=async()=>({marketOpen:true,missingQuotes:[],scanDiagnostics:{scored:1,rejections:{}},...script.get(clock)});
  const secret='e2e-scheduler-secret-0123456789abcdef';
  const scheduler=createScheduledPaperHandler({observe,store,now,secret:()=>secret,enabled:()=>true,multiEnabled:()=>false});
  const call=async(auth=`Bearer ${secret}`)=>{const r=res();await scheduler({method:'POST',headers:{authorization:auth},body:{}},r);return r;};
  const account=async()=>(await pg.query("select revision,enabled,state from shared_paper_accounts where id='user1'")).rows[0] as any;

  const denied=await call('Bearer wrong-secret-0123456789abcdef-xyz');
  assert.equal(denied.code,401);assert.equal((await account()).revision,0,'unauthorized call must not touch the account');

  const expected=['ORDER_SUBMITTED','ENTRY_FILL','EXIT_REQUESTED','CLOSED'];
  for(const [i,at] of [...script.keys()].entries()){
   clock=at;const r=await call();
   assert.equal(r.code,200,JSON.stringify(r.body));assert.equal(r.body.status,'SAVED');
   const kinds=(await pg.query("select event->>'kind' k from shared_paper_events where account_id='user1' order by sequence")).rows.map((x:any)=>x.k);
   assert(kinds.includes(expected[i]),`cycle ${i+1} should record ${expected[i]}; got ${kinds.join(',')}`);
  }

  const final=await account();const order=final.state.orders[0];
  assert.equal(final.revision,4);assert.equal(final.state.orders.length,1);
  assert.deepEqual({status:order.status,side:order.side,filled:order.filled,exited:order.exited,exitReason:order.exitReason},{status:'CLOSED',side:'BUY',filled:5,exited:5,exitReason:'TARGET'});
  assert.equal(order.entryPrice,501.25);assert.equal(order.exitPrice,516.24);
  assert.equal(order.fees,42.54);assert.equal(order.netPnl,32.41);assert.equal(final.state.realized,32.41);
  assert.equal(final.state.lastScan.source,'scheduler');assert.equal(final.state.lastScan.status,'NO_ELIGIBLE_SIGNALS');
  const kinds=(await pg.query("select event->>'kind' k from shared_paper_events where account_id='user1' order by sequence")).rows.map((x:any)=>x.k);
  assert.deepEqual(kinds,['OPPORTUNITY_RECORDED','SIGNAL_QUEUED','ORDER_SUBMITTED','SIGNAL_SUBMITTED','ENTRY_FILL','EXIT_REQUESTED','EXIT_FILL','CLOSED']);
  assert.equal((await pg.query("select lease_shared_portfolio('user1','00000000-0000-0000-0000-0000000000aa') ok")).rows[0].ok,true,'lease must be released after each cycle');

  // What the web/Android app reads.
  const api=createSharedPaperHandler({store,observe,now,enabled:()=>true});const read=res();
  await api({method:'GET',headers:{},query:{segment:'intraday'}},read);
  assert.equal(read.code,200,JSON.stringify(read.body));
  assert.equal(read.body.balance.realized,32.41);assert.equal(read.body.balance.balance,20032.41);
  assert.equal(read.body.account.state.orders[0].status,'CLOSED');assert.equal(read.body.events.length,8);
 }finally{await pg.close();}
});
