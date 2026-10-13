import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();
try{
 await db.exec('create role anon;create role authenticated;create role service_role;');
 const sql=await readFile('supabase/migrations/20261004_research_portfolios.sql','utf8');await db.exec(sql);await db.exec(sql);
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',report={account:'user1',policy:'evidence-portfolio-v1',scope:'RESEARCH_PROPOSAL_NO_ORDERS',status:'UNALLOCATED',allocations:[],assessments:[],mandate:{name:'test'},source:{financialSnapshot:{status:'CAPTURED_SAMPLE',documents:[{symbol:'FIXTURE',observedAt:'2026-10-04T05:00:00Z',periods:[{revenue:100}]}]}},snapshotHash:'a'.repeat(64),asOf:new Date().toISOString()};
 const save=(i,r)=>db.query('select save_research_portfolio($1,$2) value',[i,JSON.stringify(r)]);
 const first=(await save(id,report)).rows[0].value;const again=(await save(id,{...report,mandate:{name:'changed'}})).rows[0].value;assert.deepEqual(first,again);assert.deepEqual(first.report.source,report.source);
 await assert.rejects(save('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',{...report,asOf:'2000-01-01T00:00:00Z'}),/decision time/);
 await assert.rejects(save('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',{...report,scope:'EXECUTE'}),/Invalid portfolio/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from research_portfolios'));await assert.rejects(save(id,report));await db.exec('reset role');}
 await db.exec('set role service_role');assert.equal((await db.query('select * from research_portfolios')).rows.length,1);await assert.rejects(db.query("update research_portfolios set report='{}'"));await db.exec('reset role');
 console.log('PASS research portfolio SQL: idempotency, immutable history, denied direct client access and no backdating');
}finally{await db.close();}
