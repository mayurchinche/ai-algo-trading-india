import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();const u='00000000-0000-0000-0000-000000000001',v='00000000-0000-0000-0000-000000000002';
try {
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${u}'),('${v}');`);
 await db.exec(await readFile('supabase/migrations/20260921_paper_accounts.sql','utf8'));
 await db.exec(`insert into paper_accounts(user_id,state)values('${u}','{}'),('${v}','{}');`);
 const event={id:1,at:'2026-09-21T04:30:00Z',kind:'ENTRY_FILL'};
 const commit=()=>db.query('select commit_paper_cycle($1,0,$2,$3) as ok',[u,'{"sequence":1}',JSON.stringify([event])]);
 assert.equal((await commit()).rows[0].ok,true);assert.equal((await commit()).rows[0].ok,false);assert.equal((await db.query('select * from paper_events')).rows.length,1);
 await assert.rejects(db.query('select commit_paper_cycle($1,1,$2,$3)',[u,'{"sequence":2}',JSON.stringify([event])]));
 assert.equal((await db.query('select revision from paper_accounts where user_id=$1',[u])).rows[0].revision,1);
 await db.exec(`set test.user_id='${u}';set role authenticated;`);
 assert.equal((await db.query('select * from paper_accounts')).rows.length,1);assert.equal((await db.query('select * from paper_events')).rows.length,1);
 await assert.rejects(db.query("update paper_accounts set state='{}'"));await assert.rejects(db.query('delete from paper_events'));await assert.rejects(commit());
 await db.exec(`reset role;set test.user_id='${v}';set role authenticated;`);assert.equal((await db.query('select * from paper_events')).rows.length,0);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from paper_accounts'));
 console.log('PASS durable paper database: atomic state/event commit, duplicate retry, rollback, owner isolation, anonymous denial, immutable client ledger');
}finally{await db.close();}
