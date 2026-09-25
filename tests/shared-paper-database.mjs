import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();const id='00000000-0000-0000-0000-000000000001';
try{
 await db.exec('create role anon;create role authenticated;create role service_role;');
 await db.exec(await readFile('supabase/migrations/20260925_shared_paper_user1.sql','utf8'));
 await db.query("insert into shared_paper_accounts(id,state) values('user1','{}')");
 const event={id:1,at:'2026-09-25T04:15:00Z',kind:'DEPOSIT'};
 const commit=(revision,request=id,action={transfer:100},events=[event])=>db.query('select commit_shared_paper($1,$2,true,$3,$4,$5) as result',[revision,JSON.stringify({sequence:1}),JSON.stringify(events),request,JSON.stringify(action)]);
 assert.equal((await commit(0)).rows[0].result,'saved');assert.equal((await commit(0)).rows[0].result,'duplicate');
 await assert.rejects(commit(1,id,{transfer:500}));assert.equal((await commit(0,null)).rows[0].result,'conflict');
 await assert.rejects(commit(1,null));assert.equal((await db.query("select revision from shared_paper_accounts where id='user1'")).rows[0].revision,1);
 assert.equal((await db.query('select lease_shared_paper($1) as ok',[id])).rows[0].ok,true);assert.equal((await db.query('select lease_shared_paper($1) as ok',[id])).rows[0].ok,false);
 await db.query('select release_shared_paper($1)',['00000000-0000-0000-0000-000000000002']);assert.equal((await db.query('select lease_shared_paper($1) as ok',[id])).rows[0].ok,false);
 await db.query('select release_shared_paper($1)',[id]);assert.equal((await db.query('select lease_shared_paper($1) as ok',[id])).rows[0].ok,true);
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);for(const table of ['shared_paper_accounts','shared_paper_events','shared_paper_requests'])await assert.rejects(db.query(`select * from ${table}`));await assert.rejects(commit(1));await db.exec('reset role');}
 assert.equal((await db.query('select * from shared_paper_events')).rows.length,1);
 console.log('PASS shared user1 database: atomic commit, idempotency, conflict/rollback, leases and denied direct client access');
}finally{await db.close();}
