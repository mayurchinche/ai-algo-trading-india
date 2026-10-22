import {backend,check,readAll} from './pushBackend.js';
export function specPaperStore(db=backend()){return {
 list:async()=>check(await db.from('spec_paper_runs').select('id,created_at,updated_at,status,version,spec,options,state').eq('account_id','user1').order('created_at',{ascending:false}).limit(100)),
 // Every active run, for the scheduler (independent of how many stopped runs exist).
 active:async()=>check(await db.from('spec_paper_runs').select('id,created_at,updated_at,status,version,spec,options,state').eq('account_id','user1').eq('status','ACTIVE').order('created_at',{ascending:true}).limit(200)),
 // Every run opened for a strategy signal, with only the state parts needed for results.
 signalRuns:()=>readAll(()=>db.from('spec_paper_runs').select('id,status,created_at,options,entries:state->entries,paper:state->paper').eq('account_id','user1').not('options->>signalId','is',null).order('created_at')),
 get:async id=>check(await db.from('spec_paper_runs').select('id,created_at,updated_at,status,version,spec,options,state').eq('account_id','user1').eq('id',id).maybeSingle()),
 create:async(id,spec,options,state)=>check(await db.rpc('create_spec_paper_run',{p_id:id,p_spec:spec,p_options:options,p_state:state})),
 commit:async(id,version,state,status,events)=>check(await db.rpc('commit_spec_paper_cycle',{p_id:id,p_expected_version:version,p_state:state,p_status:status,p_events:events})),
 events:async(id,after=0,limit=500)=>check(await db.from('spec_paper_events').select('seq,recorded_at,kind,event').eq('run_id',id).gt('seq',after).order('seq',{ascending:true}).limit(limit)),
};}
