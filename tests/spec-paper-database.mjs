import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
 create schema net;create table net.requests(id bigint generated always as identity,url text,headers jsonb,body jsonb,timeout integer);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as 'insert into net.requests(url,headers,body,timeout) values(url,headers,body,timeout_milliseconds) returning id';
 create schema cron;create table cron.job(jobid bigint primary key,jobname text,schedule text,command text,active boolean);
 create function cron.schedule(text,text,text) returns bigint language sql as 'insert into cron.job values(1,$1,$2,$3,true) on conflict(jobid) do update set schedule=$2,command=$3 returning jobid';
 create function cron.alter_job(job_id bigint,schedule text default null,command text default null,database text default null,username text default null,active boolean default null) returns void language sql as 'update cron.job set schedule=coalesce($2,schedule),command=coalesce($3,command),active=coalesce($6,active) where jobid=$1';`);
 const sql=await readFile('supabase/migrations/20261019_spec_paper_runs.sql','utf8');
 await db.exec(sql);assert.equal((await db.query('select active from cron.job')).rows[0].active,false);
 await db.exec('update cron.job set active=true');await db.exec(sql);assert.equal((await db.query('select active from cron.job')).rows[0].active,true);
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',spec={schemaVersion:1,name:'t'},options={capital:1000},state={status:'FLAT'};
 const create=(i,s=spec,o=options,st=state)=>db.query('select create_spec_paper_run($1,$2,$3,$4) value',[i,JSON.stringify(s),JSON.stringify(o),JSON.stringify(st)]);
 const save=(i,v,st,status='ACTIVE')=>db.query('select save_spec_paper_state($1,$2,$3,$4) value',[i,v,JSON.stringify(st),status]);
 const first=(await create(id)).rows[0].value;assert.equal(first.version,0);assert.deepEqual((await create(id,{schemaVersion:1,name:'other'})).rows[0].value,first);
 await assert.rejects(create('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',{schemaVersion:2}),/Invalid spec paper run/);
 const v1=(await save(id,0,{status:'OPEN'})).rows[0].value;assert.equal(v1.version,1);assert.deepEqual(v1.state,{status:'OPEN'});
 assert.equal((await save(id,0,{status:'STALE'})).rows[0].value,null,'stale version never overwrites');
 await assert.rejects(save(id,1,{status:'x'},'DELETED'),/Invalid spec paper state/);
 assert.equal((await save(id,1,{status:'FLAT'},'STOPPED')).rows[0].value.status,'STOPPED');
 assert.equal((await save(id,2,{status:'OPEN'})).rows[0].value,null,'stopped runs accept no further cycles');
 for(let k=0;k<20;k++)await create(`cccccccc-cccc-4ccc-8ccc-${String(k).padStart(12,'0')}`);
 await assert.rejects(create('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),/limit reached/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from spec_paper_runs'));await assert.rejects(save(id,3,{}));await assert.rejects(db.query('select dispatch_spec_paper_cycle()'));await db.exec('reset role');}
 await db.exec('set role service_role');assert.equal((await db.query('select count(*)::int n from spec_paper_runs')).rows[0].n,21);await assert.rejects(db.query("update spec_paper_runs set state='{}'"));await assert.rejects(db.query('delete from spec_paper_runs'));await db.exec('reset role');
 console.log('PASS spec paper SQL: idempotent creation, versioned saves, stopped runs final, active cap, denied client access and inactive schedule');
}finally{await db.close();}
