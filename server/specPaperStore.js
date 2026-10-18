import {backend,check} from './pushBackend.js';
export function specPaperStore(db=backend()){return {
 list:async()=>check(await db.from('spec_paper_runs').select('id,created_at,updated_at,status,version,spec,options,state').eq('account_id','user1').order('created_at',{ascending:false}).limit(50)),
 get:async id=>check(await db.from('spec_paper_runs').select('id,created_at,updated_at,status,version,spec,options,state').eq('account_id','user1').eq('id',id).maybeSingle()),
 create:async(id,spec,options,state)=>check(await db.rpc('create_spec_paper_run',{p_id:id,p_spec:spec,p_options:options,p_state:state})),
 commit:async(id,version,state,status,events)=>check(await db.rpc('commit_spec_paper_cycle',{p_id:id,p_expected_version:version,p_state:state,p_status:status,p_events:events})),
 events:async(id,after=0,limit=500)=>check(await db.from('spec_paper_events').select('seq,recorded_at,kind,event').eq('run_id',id).gt('seq',after).order('seq',{ascending:true}).limit(limit)),
};}
