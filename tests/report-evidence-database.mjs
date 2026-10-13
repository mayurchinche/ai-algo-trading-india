import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;');
 const sql=await readFile('supabase/migrations/20261004_report_evidence.sql','utf8');await db.exec(sql);await db.exec(sql);
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',report={policy:'report-passages-v1',status:'EXTRACTED_REQUIRES_REVIEW',symbol:'TEST',segment:'equities',id:'b'.repeat(64),documentHash:'c'.repeat(64),observedAt:new Date().toISOString(),topics:[{passages:[{page:101,text:'Test fixture only'}]}]};
 const save=(i,r)=>db.query('select save_report_evidence($1,$2) value',[i,JSON.stringify(r)]);
 const first=(await save(id,report)).rows[0].value;assert.deepEqual(first.report,report);assert.deepEqual((await save(id,{...report,topics:[]})).rows[0].value,first);
 await assert.rejects(save('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',{...report,observedAt:'2000-01-01T00:00:00Z'}),/observation time/);
 await assert.rejects(save('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',{...report,status:'VERIFIED'}),/Invalid report/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from report_evidence'));await assert.rejects(save(id,report));await db.exec('reset role');}
 await db.exec('set role service_role');assert.equal((await db.query('select * from report_evidence')).rows.length,1);await assert.rejects(db.query("update report_evidence set report='{}'"));await assert.rejects(db.query('delete from report_evidence'));await db.exec('reset role');
 console.log('PASS report evidence SQL: immutable snapshots, retries, permissions and observation time');
}finally{await db.close();}
