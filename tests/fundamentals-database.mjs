import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
 create schema net;create table net.requests(id bigint generated always as identity,url text,headers jsonb,body jsonb,timeout integer);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as 'insert into net.requests(url,headers,body,timeout) values(url,headers,body,timeout_milliseconds) returning id';
 create schema cron;create table cron.job(jobid bigint primary key,jobname text,schedule text,command text,active boolean);
 create function cron.schedule(text,text,text) returns bigint language sql as 'insert into cron.job values(1,$1,$2,$3,true) on conflict(jobid) do update set schedule=$2,command=$3 returning jobid';
 create function cron.alter_job(job_id bigint,active boolean) returns void language sql as 'update cron.job set active=$2 where jobid=$1';`);
 const sql=await readFile('supabase/migrations/20261018_fundamental_filings.sql','utf8');
 await db.exec(sql);assert.equal((await db.query('select active from cron.job')).rows[0].active,false);
 await db.exec('update cron.job set active=true');await db.exec(sql);assert.equal((await db.query('select active from cron.job')).rows[0].active,true);
 const now=new Date().toISOString(),filing={policy:'fundamental-filing-v1',status:'EXTRACTED_REQUIRES_REVIEW',id:'a'.repeat(64),documentHash:'b'.repeat(64),symbol:'TEST',instrumentKey:'NSE_EQ|INE000A01010',scope:'Consolidated',url:'https://nsearchives.nseindia.com/corporate/xbrl/test.xml',publishedAt:'2026-05-20T10:00:00Z',observedAt:now,periods:[{contextId:'P',start:'2025-04-01',end:'2026-03-31',facts:[{key:'revenue',value:1000,currency:'INR'}],unavailable:[]}]};
 const save=f=>db.query('select record_fundamental_filing($1) value',[JSON.stringify(f)]);
 const first=(await save(filing)).rows[0].value;assert.deepEqual(first.filing,filing);assert.equal(first.instrument_key,filing.instrumentKey);
 assert.deepEqual((await save({...filing,periods:[]})).rows[0].value,first,'retry by id returns the stored row');
 assert.deepEqual((await save({...filing,id:'c'.repeat(64)})).rows[0].value,first,'republished document returns the stored row');
 const other={...filing,id:'d'.repeat(64),documentHash:'e'.repeat(64)};
 for(const bad of [{...other,policy:'other'},{...other,instrumentKey:'NSE_EQ|TEST'},{...other,scope:'Group'},{...other,url:'https://example.com/x.xml'},{...other,periods:[]},{...other,periods:{}},{...other,positions:{}},{...other,positions:Array(17).fill({})},{...other,status:'VERIFIED'}])await assert.rejects(save(bad),/Invalid fundamental filing/);
 for(const bad of [{...other,observedAt:'2000-01-01T00:00:00Z'},{...other,observedAt:'not a time'},{...other,publishedAt:'2099-01-01T00:00:00Z'}])await assert.rejects(save(bad),/observation time/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from fundamental_filings'));await assert.rejects(save(other));await assert.rejects(db.query('select dispatch_fundamental_ingest()'));await db.exec('reset role');}
 await db.exec('set role service_role');assert.equal((await db.query('select * from fundamental_filings')).rows.length,1);await assert.rejects(db.query("update fundamental_filings set filing='{}'"));await assert.rejects(db.query('delete from fundamental_filings'));await db.exec('reset role');
 await assert.rejects(db.query('select dispatch_fundamental_ingest()'),/secret missing/);
 await db.exec("insert into vault.decrypted_secrets values('paper_scheduler_secret','"+'s'.repeat(32)+"')");await db.query('select dispatch_fundamental_ingest()');
 const request=(await db.query('select * from net.requests')).rows[0];assert.equal(request.url,'https://ai-algo-trading-india.vercel.app/api/fundamentals');assert.equal(request.headers.Authorization,'Bearer '+'s'.repeat(32));
 console.log('PASS fundamental filings SQL: insert-only idempotent capture, validation, no backdating, denied client access and inactive dispatch');
}finally{await db.close();}
