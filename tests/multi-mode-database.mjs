import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();
try{
 await db.exec('create role anon;create role authenticated;create role service_role;');
 for(const file of ['20260925_shared_paper_user1.sql','20260926_paper_portfolios.sql','20261002_multi_mode_paper.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 for(const segment of ['short-term','long-term','options','futures']){
  const id='user1:'+segment;await db.query('select ensure_shared_portfolio($1)',[id]);
  const original=(await db.query('select * from shared_paper_accounts where id=$1',[id])).rows[0];
  const state={...original.state,segment};
  const commit=(value,enabled=true)=>db.query('select commit_shared_portfolio($1,0,$2,$3,$4)',[id,JSON.stringify(value),enabled,'[]']);
  await assert.rejects(commit(state));
  await db.query('insert into paper_segment_activation(account_id,activated) values($1,true)',[id]);
  await assert.rejects(commit({...state,segment:'intraday'}));
  await assert.rejects(commit({...state,orders:[{product:'intraday'}]}));
  assert.equal((await commit(state)).rows[0].commit_shared_portfolio,'saved');
  const saved=(await db.query('select * from shared_paper_accounts where id=$1',[id])).rows[0];assert.equal(saved.state.capital,original.state.capital);assert.equal(saved.enabled,true);assert.equal(saved.revision,1);
 }
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from paper_segment_activation'));await assert.rejects(db.query("select commit_shared_portfolio('user1:options',0,'{}',true,'[]')"));await db.exec('reset role');}
 await db.exec(await readFile('supabase/migrations/20261002_multi_mode_paper.sql','utf8'));
 assert.equal((await db.query('select count(*)::int n from paper_segment_activation where activated')).rows[0].n,4);
 console.log('PASS multi-mode SQL: activation required, account/product isolation, preserved balances, restricted roles and idempotent migration');
}finally{await db.close();}
