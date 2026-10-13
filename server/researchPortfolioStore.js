import {backend,check} from './pushBackend.js';
export function researchPortfolioStore(){
 const db=backend();
 return {
  list:async()=>check(await db.from('research_portfolios').select('id,created_at,report').eq('account_id','user1').order('created_at',{ascending:false}).limit(50)),
  prior:async id=>check(await db.from('research_portfolios').select('id,created_at,report').eq('account_id','user1').eq('id',id).maybeSingle()),
  save:async(id,report)=>check(await db.rpc('save_research_portfolio',{p_id:id,p_report:report})),
  candidates:async segment=>{
   const id=`user1:${segment}`;
   const row=check(await db.from('shared_paper_accounts').select('state,updated_at').eq('id',id).maybeSingle());
   if(!row)return {candidates:[],source:{status:'ACCOUNT_NOT_RECORDED',accountId:id,updatedAt:null}};
   return {candidates:row.state.segmentSignals||[],source:{status:'RECORDED_SIGNAL_SAMPLE',accountId:id,updatedAt:row.updated_at,note:'Latest retained server signals, at most 200; not an exhaustive market screen.'}};
  },
 };
}
