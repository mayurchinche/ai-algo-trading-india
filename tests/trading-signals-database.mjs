import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
 create schema net;create table net.requests(id bigint generated always as identity,url text,headers jsonb,body jsonb,timeout integer);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as 'insert into net.requests(url,headers,body,timeout) values(url,headers,body,timeout_milliseconds) returning id';
 create schema cron;create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text,active boolean);
 create function cron.schedule(text,text,text) returns bigint language sql as 'insert into cron.job(jobname,schedule,command,active) values($1,$2,$3,true) on conflict(jobname) do update set schedule=$2,command=$3 returning jobid';
 create function cron.alter_job(job_id bigint,schedule text default null,command text default null,database text default null,username text default null,active boolean default null) returns void language sql as 'update cron.job set schedule=coalesce($2,schedule),command=coalesce($3,command),active=coalesce($6,active) where jobid=$1';`);
 for(const f of ['20261019_spec_paper_runs','20261020_spec_paper_ledger','20261021_trading_signals'])await db.exec(await readFile(`supabase/migrations/${f}.sql`,'utf8'));
 const sql=await readFile('supabase/migrations/20261021_trading_signals.sql','utf8');
 const jobs=async()=>(await db.query("select jobname,schedule,active from cron.job where jobname<>'spec-paper-cycle' order by jobname")).rows;
 assert.deepEqual(await jobs(),[{jobname:'market-day',schedule:'0 13 * * 1-5',active:false},{jobname:'signal-scan',schedule:'*/15 3-10 * * 1-5',active:false},{jobname:'signal-validate',schedule:'5 */2 * * *',active:false}]);
 await db.exec("update cron.job set active=true where jobname='signal-scan'");await db.exec(sql);assert.equal((await jobs()).find(j=>j.jobname==='signal-scan').active,true,'reapply keeps an enabled job');
 const v=(computedAt,verdict='VALIDATED')=>({strategyId:'short-term-donchian',symbol:'INFY',verdict,computedAt});
 const save=rows=>db.query('select save_strategy_validations($1) n',[JSON.stringify(rows)]);
 await save([v('2026-10-19T00:00:00Z')]);await save([v('2026-10-18T00:00:00Z','REJECTED')]);
 assert.equal((await db.query('select verdict from strategy_validations')).rows[0].verdict,'VALIDATED','an older recompute never replaces a newer one');
 await save([v('2026-10-20T00:00:00Z','REJECTED')]);assert.equal((await db.query('select verdict from strategy_validations')).rows[0].verdict,'REJECTED');
 await assert.rejects(save({}),/Invalid strategy validations/);
 const sig={id:'short-term-donchian:INFY:1760000000000',strategyId:'short-term-donchian',symbol:'INFY',segment:'short-term',barTime:1760000000000};
 const rec=rows=>db.query('select record_strategy_signals($1) n',[JSON.stringify(rows)]);
 assert.equal((await rec([sig])).rows[0].n,1);assert.equal((await rec([sig])).rows[0].n,0,'a retried signal is not duplicated');
 await assert.rejects(rec([{...sig,id:'bad id'}]));await assert.rejects(rec([{...sig,id:'x:Y:1760000000001',segment:'crypto'}]));
 const day=(deals,flows)=>db.query('select record_market_day($1,$2) r',[JSON.stringify(deals),JSON.stringify(flows)]);
 const deal={date:'2026-10-16',kind:'BULK',symbol:'INFY',client:'ABC',side:'BUY',quantity:100,price:1500.5};
 assert.deepEqual((await day([deal,deal],[{date:'2026-10-16',category:'DII',buy:1,sell:2,net:-1}])).rows[0].r,{deals:1,flows:1});
 assert.deepEqual((await day([deal],[{date:'2026-10-16',category:'DII',buy:5,sell:2,net:3}])).rows[0].r,{deals:0,flows:1});
 assert.equal(Number((await db.query('select net_value from market_flows')).rows[0].net_value),3,'a revised provisional flow replaces the earlier figure');
 await assert.rejects(day([{...deal,side:'HOLD'}],[]));
 await assert.rejects(db.query("select dispatch_signal_job('drop')"),/Unknown signal job/);
 await db.exec("insert into vault.decrypted_secrets values('paper_scheduler_secret','"+'s'.repeat(32)+"')");await db.query("select dispatch_signal_job('scan')");
 assert.match((await db.query('select url from net.requests')).rows[0].url,/\/api\/signals\?job=scan$/);
 for(const t of ['strategy_validations','strategy_signals','market_deals','market_flows'])for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from '+t));await db.exec('reset role');}
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(save([v('2027-01-01T00:00:00Z')]));await assert.rejects(rec([sig]));await assert.rejects(day([],[]));await assert.rejects(db.query("select dispatch_signal_job('scan')"));await db.exec('reset role');}
 await db.exec('set role service_role');assert.equal((await db.query('select count(*)::int n from strategy_signals')).rows[0].n,1);await assert.rejects(db.query('delete from market_deals'));await db.exec('reset role');
 const mk=i=>db.query('select create_spec_paper_run($1,$2,$3,$4) v',[`cccccccc-cccc-4ccc-8ccc-${String(i).padStart(12,'0')}`,'{"schemaVersion":1}','{}','{}']);
 for(let i=0;i<100;i++)await mk(i);await assert.rejects(mk(100),/limit reached/);
 console.log('PASS trading signals SQL: inactive idempotent jobs, newest validation wins, signals once, deals/flows upsert, client access denied, 100 active paper runs');
}finally{await db.close();}
