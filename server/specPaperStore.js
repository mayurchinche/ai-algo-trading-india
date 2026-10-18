import {backend,check} from './pushBackend.js';
export function specPaperStore(db=backend()){return {
 list:async()=>check(await db.from('spec_paper_runs').select('id,created_at,updated_at,status,version,spec,options,state').eq('account_id','user1').order('created_at',{ascending:false}).limit(50)),
 get:async id=>check(await db.from('spec_paper_runs').select('id,created_at,updated_at,status,version,spec,options,state').eq('account_id','user1').eq('id',id).maybeSingle()),
 create:async(id,spec,options,state)=>check(await db.rpc('create_spec_paper_run',{p_id:id,p_spec:spec,p_options:options,p_state:state})),
 save:async(id,version,state,status)=>check(await db.rpc('save_spec_paper_state',{p_id:id,p_expected_version:version,p_state:state,p_status:status})),
};}
