import {backend,check} from './pushBackend.js';
export function premarketStore(){
 const db=backend();
 return {
  async read(date){return check(await db.from('premarket_snapshots').select('session_date,slot,published_at,report').eq('session_date',date).order('published_at',{ascending:false}));},
  async dates(){return check(await db.from('premarket_snapshots').select('session_date,published_at').order('published_at',{ascending:false}).limit(300));},
  async save(date,slot,report){return check(await db.rpc('record_premarket_snapshot',{p_date:date,p_slot:slot,p_report:report}));},
 };
}
