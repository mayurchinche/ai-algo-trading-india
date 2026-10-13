import {backend,check} from './pushBackend.js';
export function reportEvidenceStore(){const db=backend();return {
 list:async()=>check(await db.from('report_evidence').select('id,created_at,report').eq('account_id','user1').order('created_at',{ascending:false}).limit(200)),
 prior:async id=>check(await db.from('report_evidence').select('id,created_at,report').eq('account_id','user1').eq('id',id).maybeSingle()),
 save:async(id,report)=>check(await db.rpc('save_report_evidence',{p_id:id,p_report:report})),
};}
