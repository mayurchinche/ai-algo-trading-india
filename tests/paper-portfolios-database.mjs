import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {tradingSegments} from '../shared/tradingSegments.js';
import {newPaperAccount} from '../server/paperEngine.js';
import {transferPaperFunds} from '../server/paperFunds.js';
const db=new PGlite();const token='00000000-0000-0000-0000-000000000001';
try{
 await db.exec('create role anon;create role authenticated;create role service_role;');
 await db.exec(await readFile('supabase/migrations/20260925_shared_paper_user1.sql','utf8'));
 const existing={...newPaperAccount(),capital:23789,realized:-42,sequence:1,orders:[{id:'preserve-existing-order',status:'CLOSED'}]};
 await db.query("insert into shared_paper_accounts(id,state,revision) values('user1',$1,7)",[JSON.stringify(existing)]);
 await db.query("insert into shared_paper_events values('user1',1,$1)",[JSON.stringify({id:1,kind:'EXISTING_EVENT'})]);
 await db.exec(await readFile('supabase/migrations/20260926_paper_portfolios.sql','utf8'));
 const account=async id=>(await db.query('select * from shared_paper_accounts where id=$1',[id])).rows[0];
 const commit=(id,before,result,request=token,action={transfer:100})=>db.query('select commit_shared_portfolio($1,$2,$3,false,$4,$5,$6) result',[id,before.revision,JSON.stringify(result.state),JSON.stringify(result.events),request,JSON.stringify(action)]);
 for(const segment of tradingSegments){
  for(let n=0;n<2;n++)await db.query('select ensure_shared_portfolio($1)',[segment.accountId]);
  const a=await account(segment.accountId);
  if(segment.id==='intraday'){assert.deepEqual(a.state,existing);assert.equal(a.revision,7);continue;}
  assert.equal(a.state.capital,segment.capital);assert.equal(a.state.sequence,1);
  const events=(await db.query('select event from shared_paper_events where account_id=$1',[segment.accountId])).rows;
  assert.equal(events.length,1);assert.equal(events[0].event.kind,'OPENING_CAPITAL');assert(Number.isFinite(Date.parse(events[0].event.at)));
  const result=transferPaperFunds(a.state,{id:'same-transfer-id-all-accounts',kind:'DEPOSIT',amount:100});
  assert.equal((await commit(segment.accountId,a,result)).rows[0].result,'saved');
  assert.equal((await commit(segment.accountId,a,result)).rows[0].result,'duplicate');
  await assert.rejects(commit(segment.accountId,a,result,token,{transfer:200}));
  assert.equal((await commit(segment.accountId,a,result,null)).rows[0].result,'conflict');
  const updated=await account(segment.accountId);assert.equal(updated.state.transfers.length,1);
  await assert.rejects(commit(segment.accountId,updated,{state:{...updated.state,orders:[{id:'forged'}]},events:[]},null));
  // Duplicate ledger sequence must roll back the state update as well.
  await assert.rejects(commit(segment.accountId,updated,{state:updated.state,events:[{id:1}]},null));
  assert.equal((await account(segment.accountId)).revision,1);
  assert.equal((await db.query('select lease_shared_portfolio($1,$2) ok',[segment.accountId,token])).rows[0].ok,true);
 }
 assert.deepEqual((await account('user1')).state,existing);
 assert.equal((await db.query('select lease_shared_paper($1) ok',[token])).rows[0].ok,true);
 await db.query('select release_shared_portfolio($1,$2)',['user1:options','00000000-0000-0000-0000-000000000002']);
 assert.equal((await db.query('select lease_shared_portfolio($1,$2) ok',['user1:options',token])).rows[0].ok,false);
 await db.query('select release_shared_portfolio($1,$2)',['user1:options',token]);
 assert.equal((await db.query('select lease_shared_portfolio($1,$2) ok',['user1:options',token])).rows[0].ok,true);
 await assert.rejects(db.query("select ensure_shared_portfolio('unknown')"));
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  for(const sql of ["select ensure_shared_portfolio('user1:options')",`select lease_shared_portfolio('user1:options','${token}')`,`select release_shared_portfolio('user1:options','${token}')`,"select commit_shared_portfolio('user1:options',1,'{}',false,'[]')",'select * from shared_paper_accounts','select * from shared_paper_events'])await assert.rejects(db.query(sql));
  await db.exec('reset role');
 }
 // A clean installation gets the new intraday default; rolling back this test keeps preservation assertions separate.
 await db.exec('begin');
 await db.exec("delete from shared_paper_events where account_id='user1';delete from shared_paper_accounts where id='user1'");
 await db.query("select ensure_shared_portfolio('user1')");
 assert.equal((await account('user1')).state.capital,10000);
 await db.exec('rollback');
 assert.deepEqual((await account('user1')).state,existing);
 console.log('PASS portfolio database: preserves intraday history, seeds once, isolates funding/retries/leases, denies unsupported execution and client access');
}finally{await db.close();}
