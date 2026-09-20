import { backend,check,allowRequest,signedInUser } from '../server/pushBackend.js';
import { transferPaperFunds,importLegacyPaper,paperBalance,PaperAccountError } from '../server/paperFunds.js';
import { newPaperAccount } from '../server/paperEngine.js';
export default async function handler(req,res) {
 if(!allowRequest(req,res)) return;
 if(!['GET','POST'].includes(req.method)) return res.status(405).json({error:'GET or POST required'});
 try {
  const user=await signedInUser(req); if(!user) return res.status(401).json({error:'Sign in to access your paper account'});
  const db=backend();
  if(req.method==='POST') {
   if(req.body?.transfer || req.body?.legacyLedger) {
    check(await db.from('paper_accounts').upsert({user_id:user.id,state:newPaperAccount()},{onConflict:'user_id',ignoreDuplicates:true}));
    const current=check(await db.from('paper_accounts').select('*').eq('user_id',user.id).single());
    if(req.body.legacyLedger&&current.enabled)throw new PaperAccountError('Pause new entries before reconciling earlier history.');
    const {state,events}=req.body.transfer?transferPaperFunds(current.state,req.body.transfer):importLegacyPaper(current.state,req.body.legacyLedger);
    if(events.length){const saved=check(await db.rpc('commit_paper_cycle',{p_user:user.id,p_revision:current.revision,p_state:state,p_events:events}));if(!saved)return res.status(409).json({error:'Account changed concurrently; retry the same adjustment.'});}
   } else if(typeof req.body?.closeOrderId==='string') {
    const current=check(await db.from('paper_accounts').select('*').eq('user_id',user.id).single());
    const state=structuredClone(current.state),o=state.orders.find(o=>o.id===req.body.closeOrderId);
    if(!o||['CLOSED','CANCELLED','EXIT_PENDING'].includes(o.status))return res.status(409).json({error:'Order cannot be closed in its current state'});
    const at=new Date().toISOString();o.quantity=o.filled;
    if(o.filled>o.exited){o.exitRequestedAt=at;o.exitReason='MANUAL';o.status='EXIT_PENDING';}else{o.status='CANCELLED';}
    const events=[{id:++state.sequence,orderId:o.id,at,kind:o.filled?'EXIT_REQUESTED':'ENTRY_CANCELLED',reason:'MANUAL'}];
    const saved=check(await db.rpc('commit_paper_cycle',{p_user:user.id,p_revision:current.revision,p_state:state,p_events:events}));
    if(!saved)return res.status(409).json({error:'Account updated concurrently; retry'});
   } else {
    if(typeof req.body?.enabled!=='boolean') return res.status(400).json({error:'enabled must be boolean'});
    check(await db.from('paper_accounts').upsert({user_id:user.id,state:newPaperAccount()},{onConflict:'user_id',ignoreDuplicates:true}));
    // Revision bump fences in-flight worker decisions when a user pauses entries.
    const current=check(await db.from('paper_accounts').select('revision').eq('user_id',user.id).single());
    const rows=check(await db.from('paper_accounts').update({enabled:req.body.enabled,revision:current.revision+1}).eq('user_id',user.id).eq('revision',current.revision).select('revision'));
    if(!rows.length) return res.status(409).json({error:'Account updated concurrently; retry'});
   }
  }
  const account=check(await db.from('paper_accounts').select('*').eq('user_id',user.id).maybeSingle());
  const cursor=Number(req.query?.after||0);if(!Number.isSafeInteger(cursor)||cursor<0)return res.status(400).json({error:'Invalid event cursor'});
  const until=req.query?.until==null?(account?.state.sequence||0):Number(req.query.until);
  if(!Number.isSafeInteger(until)||until<0||until>(account?.state.sequence||0))return res.status(400).json({error:'Invalid snapshot sequence'});
  let query=db.from('paper_events').select('sequence,event').eq('user_id',user.id).gt('sequence',cursor).lte('sequence',until).order('sequence').limit(500);
  if(req.query?.orderId)query=query.eq('event->>orderId',String(req.query.orderId));
  const events=account?check(await query):[];
  return res.json({account,balance:account?paperBalance(account.state):null,events,nextCursor:events.at(-1)?.sequence||cursor,hasMore:events.length===500});
 } catch(error) {if(error instanceof PaperAccountError)return res.status(400).json({error:error.message});return res.status(503).json({error:'Paper backend unavailable; no local replacement fills generated'});}
}
