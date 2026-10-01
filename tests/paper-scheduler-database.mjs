import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
 // Cron/net extension entry points are stubbed; SQL functions, privileges and RLS are real PostgreSQL.
 await db.exec(`create role anon;create role authenticated;
 create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
 create schema net;create table net.requests(id bigint generated always as identity,url text,headers jsonb,body jsonb,timeout integer);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as 'insert into net.requests(url,headers,body,timeout) values(url,headers,body,timeout_milliseconds) returning id';
 create schema cron;create table cron.job(jobid bigint primary key,jobname text,schedule text,command text,active boolean);
 create function cron.schedule(text,text,text) returns bigint language sql as 'insert into cron.job values(1,$1,$2,$3,true) on conflict(jobid) do update set schedule=$2,command=$3 returning jobid';
 create function cron.alter_job(job_id bigint,active boolean) returns void language sql as 'update cron.job set active=$2 where jobid=$1';`);
 const original=await readFile('supabase/migrations/20261001_paper_scheduler.sql','utf8');
 const migration=original.replace(/^create extension.*;$/gm,'').replace("local_time timestamp := now() at time zone 'Asia/Kolkata'","local_time timestamp := timestamp '2026-10-01 10:00:00'");
 await db.exec(migration);await db.exec(migration);
 assert.equal((await db.query('select * from cron.job')).rows.length,1);
 assert.equal((await db.query('select active from cron.job')).rows[0].active,false);
 await assert.rejects(db.query('select public.dispatch_shared_paper_cycle()'),/secret missing/);
 await db.query('insert into vault.decrypted_secrets values($1,$2)',['paper_scheduler_secret','isolated-test-token-at-least-32-characters']);
 await db.query('select public.dispatch_shared_paper_cycle()');
 const request=(await db.query('select * from net.requests')).rows[0];
 assert.equal(request.url,'https://ai-algo-trading-india.vercel.app/api/scheduled-paper');assert.deepEqual(request.body,{});assert.equal(request.timeout,65000);
 assert.equal((await db.query('select * from paper_scheduler_dispatches')).rows.length,1);
 assert(!(await db.query('select command from cron.job')).rows[0].command.includes('isolated-test-token'));
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  await assert.rejects(db.query('select public.dispatch_shared_paper_cycle()'),/permission denied/);
  await assert.rejects(db.query('select * from public.paper_scheduler_dispatches'),/permission denied/);
  await db.exec('reset role');
 }
 await db.exec(migration.replace('2026-10-01 10:00:00','2026-10-03 10:00:00'));
 assert.equal((await db.query('select public.dispatch_shared_paper_cycle() result')).rows[0].result,null);
 assert.equal((await db.query('select * from net.requests')).rows.length,1);
 console.log('PASS scheduler SQL: inactive/idempotent installation, missing secret, authenticated dispatch shape, restricted roles, weekend skip (network and cron extensions stubbed)');
}finally{await db.close();}
