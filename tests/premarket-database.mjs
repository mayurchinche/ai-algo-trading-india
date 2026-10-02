import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
 create schema net;create table net.requests(id bigint generated always as identity,url text,headers jsonb,body jsonb,timeout integer);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as 'insert into net.requests(url,headers,body,timeout) values(url,headers,body,timeout_milliseconds) returning id';
 create schema cron;create table cron.job(jobid bigint primary key,jobname text,schedule text,command text,active boolean);
 create function cron.schedule(text,text,text) returns bigint language sql as 'insert into cron.job values(1,$1,$2,$3,true) on conflict(jobid) do update set schedule=$2,command=$3 returning jobid';
 create function cron.alter_job(job_id bigint,active boolean) returns void language sql as 'update cron.job set active=$2 where jobid=$1';`);
 const sql=(await readFile('supabase/migrations/20261002_premarket_research.sql','utf8')).replace('captured timestamptz := clock_timestamp()',"captured timestamptz := timestamptz '2026-10-01T08:45:30+05:30'");
 await db.exec(sql);assert.equal((await db.query('select active from cron.job')).rows[0].active,false);
 await db.exec('update cron.job set active=true');await db.exec(sql);assert.equal((await db.query('select active from cron.job')).rows[0].active,true);
 const report={mode:'scheduled',status:'AVAILABLE',startedAt:'2026-10-01T08:45:00+05:30',candidates:[],beforeRegularOpen:false};
 const save=(date,slot,r)=>db.query('select record_premarket_snapshot($1,$2,$3) value',[date,slot,JSON.stringify(r)]);
 const first=(await save('2026-10-01','08:45',report)).rows[0].value;
 assert.equal(first.report.beforeRegularOpen,true);
 const second=(await save('2026-10-01','08:45',{...report,status:'UNAVAILABLE'})).rows[0].value;
 assert.deepEqual(first,second);
 await assert.rejects(save('2026-09-30','08:45',report),/Invalid research slot/);
 await assert.rejects(save('2026-10-01','08:30',report),/Invalid research slot/);
 await assert.rejects(save('2026-10-01','08:45',{...report,startedAt:'2026-09-30T08:45:00+05:30'}),/backdate/);
 await assert.rejects(save('2026-10-01','08:45',{...report,mode:'preview'}),/Invalid research report/);
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);await assert.rejects(db.query('select * from premarket_snapshots'));await assert.rejects(save('2026-10-01','08:45',report));await assert.rejects(db.query('select dispatch_premarket_research()'));await db.exec('reset role');
 }
 await db.exec('set role service_role');assert.equal((await db.query('select * from premarket_snapshots')).rows.length,1);await assert.rejects(db.query("update premarket_snapshots set report='{}'"));await db.exec('reset role');
 console.log('PASS premarket SQL: immutable/idempotent capture, no backdating, server publication time, denied client writes and active schedule preservation');
}finally{await db.close();}
