import {recordOpportunities} from './sharedOpportunities.js';
import {randomUUID} from 'node:crypto';
import {tradingSegment} from '../shared/tradingSegments.js';
import {paperBalance,transferPaperFunds} from './paperFunds.js';
import {configureExecution,reviewIntent,cancelEntryRemainder,amendPendingEntry,advanceWorkflow} from './paperWorkflow.js';
import {backend,allowRequest} from './pushBackend.js';
// Log only provider status/error codes, never credentials or database row contents.
function check(result){
 if(result.error){console.error('Shared paper database request failed',{status:result.status,code:/^[A-Z0-9_]{1,32}$/.test(result.error.code||'')?result.error.code:'unspecified'});throw new Error('Database operation failed');}
 return result.data;
}
export class SharedPaperError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function applySharedAction(account,action,now=Date.now()){
 if(!action||typeof action!=='object'||Array.isArray(action)||Object.keys(action).length!==1)throw new SharedPaperError('Exactly one paper action is required.');
 let result;let enabled=account.enabled;
 try {
 if(action.execution)result=configureExecution(account.state,action.execution,now);
 else if(action.reviewIntent)result=reviewIntent(account.state,action.reviewIntent,now);
 else if(action.amendOrder)result=amendPendingEntry(account.state,action.amendOrder,now);
 else if(typeof action.cancelRemainder==='string')result=cancelEntryRemainder(account.state,action.cancelRemainder,now);
 else if(action.transfer)result=transferPaperFunds(account.state,action.transfer,now);
 else if(typeof action.enabled==='boolean'){
  enabled=action.enabled;const state=structuredClone(account.state);const at=new Date(now).toISOString();
  result={state,events:[{id:++state.sequence,at,kind:enabled?'ENTRIES_ENABLED':'ENTRIES_PAUSED'}]};
  if(!enabled)for(const i of state.intents||[])if(['REVIEW','WAITING','APPROVED'].includes(i.status)){i.status='CANCELLED';i.reason='New entries paused';result.events.push({id:++state.sequence,at,kind:'SIGNAL_CANCELLED',signalId:i.signalId,reason:i.reason});}
 }else if(typeof action.closeOrderId==='string'){
  const state=structuredClone(account.state),o=state.orders.find(o=>o.id===action.closeOrderId);
  if(!o||['CLOSED','CANCELLED','EXIT_PENDING'].includes(o.status))throw new Error('Order cannot be closed in its current state.');
  const at=new Date(now).toISOString();o.quantity=o.filled;o.status=o.filled>o.exited?'EXIT_PENDING':'CANCELLED';
  if(o.status==='EXIT_PENDING'){o.exitRequestedAt=at;o.exitReason='MANUAL';}
  result={state,events:[{id:++state.sequence,orderId:o.id,at,kind:o.status==='EXIT_PENDING'?'EXIT_REQUESTED':'ENTRY_CANCELLED',reason:'MANUAL'}]};
 }else throw new Error('Unsupported shared paper action. Quotes and fills cannot be supplied by clients.');
 }catch(e){throw new SharedPaperError(e.message);}
 return {...result,enabled};
}
export function sharedStore(segment='intraday',db=backend()){
 const {accountId}=tradingSegment(segment);
 return {
 async account(){check(await db.rpc('ensure_shared_portfolio',{p_account:accountId}));return check(await db.from('shared_paper_accounts').select('id,enabled,revision,state,updated_at').eq('id',accountId).single());},
 async prior(id){return check(await db.from('shared_paper_requests').select('action').eq('account_id',accountId).eq('request_id',id).maybeSingle());},
 async commit(account,result,id=null,action=null){return check(await db.rpc('commit_shared_portfolio',{p_account:accountId,p_revision:account.revision,p_state:result.state,p_enabled:result.enabled,p_events:result.events,p_request:id,p_action:action}));},
 async lease(token){return check(await db.rpc('lease_shared_portfolio',{p_account:accountId,p_token:token}));},
 async release(token){check(await db.rpc('release_shared_portfolio',{p_account:accountId,p_token:token}));},
 async opportunities(before,until){return check(await db.from('shared_paper_events').select('sequence,event').eq('account_id',accountId).eq('event->>kind','OPPORTUNITY_RECORDED').lt('sequence',before).lte('sequence',until).order('sequence',{ascending:false}).limit(101));},
 async events(after,until,orderId,signalId){let query=db.from('shared_paper_events').select('sequence,event').eq('account_id',accountId).gt('sequence',after).lte('sequence',until).order('sequence').limit(501);
  // Only server-resolved IDs are allowed in PostgREST filter syntax.
  if(orderId)query=query.or(`event->>orderId.eq."${orderId}",event->>signalId.eq."${signalId||''}"`);
  return check(await query);
 }
 };
}
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function canonical(v){return v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;}
export function createSharedPaperHandler({store=sharedStore,observe,enabled=()=>process.env.SHARED_PAPER_ENABLED==='true',now=Date.now}={}){
 return async(req,res)=>{
  if(!allowRequest(req,res))return;
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'GET or POST required'});
  if(!enabled())return res.status(503).json({error:'Shared user1 paper account is not activated. No device account is used as a replacement.'});
  try{
   if(req.query?.feed!=null&&(req.query.feed!=='opportunities'||req.method!=='GET'))throw new SharedPaperError('Invalid feed request.');
   const segment=req.query?.segment??'intraday';
   const config=tradingSegment(segment);
   if(!config)throw new SharedPaperError('Unknown trading segment.');
   const db=store(segment);let account=await db.account();
   if(req.method==='POST'){
    const body=req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>10000)throw new SharedPaperError('Invalid paper request.');
    if(!config.executionReady&&!(body.action&&Object.keys(body.action).length===1&&body.action.transfer))throw new SharedPaperError('Trading for this segment is unavailable pending feed and execution validation. Only paper funding is enabled.',409);
    if(body.tick===true&&Object.keys(body).length===1){
     const token=randomUUID();
     if(await db.lease(token))try{
      account=await db.account();
      // A database lease prevents web and Android running the same cycle concurrently.
      if(now()-Date.parse(account.state.lastCycleAt||'')>=10000||!account.state.lastCycleAt){
       const observation=await observe(account,now());
       const observed=recordOpportunities(account.state,observation.candidates,now(),observation.marketOpen);
       const admitted=new Set(observed.events.map(event=>event.signalId));
       const result=advanceWorkflow(observed.state,{...observation,candidates:(observation.candidates||[]).filter(candidate=>admitted.has(candidate.signalId)),now:now(),acceptEntries:account.enabled});
       result.events=[...observed.events,...result.events];
       result.enabled=account.enabled;result.state.marketOpen=observation.marketOpen;result.state.missingQuotes=observation.missingQuotes||[];result.state.discoveryError=observation.discoveryError||null;
       await db.commit(account,result); // Conflict means another control won; discard this cycle.
      }
     }finally{await db.release(token);}
    }else{
     if(!uuid(body.requestId)||Object.keys(body).some(k=>!['requestId','action'].includes(k)))throw new SharedPaperError('A unique requestId and action are required.');
     const prior=await db.prior(body.requestId);
     if(prior&&!same(prior.action,body.action))throw new SharedPaperError('Request ID belongs to a different action.',409);
     if(!prior){
      const result=applySharedAction(account,body.action,now());
      const saved=await db.commit(account,result,body.requestId,body.action);
      if(saved==='conflict')throw new SharedPaperError('Account changed on another device. Refresh and retry.',409);
     }
    }
    account=await db.account();
   }
   const after=Number(req.query?.after??0),until=Number(req.query?.until??account.state.sequence);
   if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(until)||until<after||until>account.state.sequence)throw new SharedPaperError('Invalid ledger cursor.');
   if(req.query?.feed!=null){
    if(req.query.feed!=='opportunities'||req.method!=='GET')throw new SharedPaperError('Invalid feed request.');
    const before=Number(req.query.before??until+1);
    if(!Number.isSafeInteger(before)||before<1||before>until+1)throw new SharedPaperError('Invalid opportunity cursor.');
    const rows=await db.opportunities(before,until),events=rows.slice(0,100);
    return res.status(200).json({account:{id:account.id,name:'user1',storage:'shared-backend',segment,revision:account.revision,state:{sequence:until,lastCycleAt:account.state.lastCycleAt,marketOpen:account.state.marketOpen,discoveryError:account.state.discoveryError}},balance:paperBalance(account.state,now()),events,nextCursor:events.at(-1)?.sequence??before,hasMore:rows.length>100});
   }
   const orderId=req.query?.orderId;
   if(orderId!=null&&(typeof orderId!=='string'||!/^[a-zA-Z0-9:_ .-]{1,240}$/.test(orderId)))throw new SharedPaperError('Invalid order identifier.');
   const order=orderId?account.state.orders.find(o=>o.id===orderId):null;
   const signalId=order?.signalId;
   if(signalId&&!/^[a-zA-Z0-9:_ .-]{1,240}$/.test(signalId))throw new SharedPaperError('Unsupported signal identifier.');
   const rows=orderId&&!order?[]:await db.events(after,until,orderId,signalId);
   const events=rows.slice(0,500);
   return res.status(200).json({account:{...account,name:'user1',segment,executionReady:config.executionReady,storage:'shared-backend'},balance:paperBalance(account.state,now()),events,nextCursor:events.at(-1)?.sequence??after,hasMore:rows.length>500});
  }catch(e){return res.status(e instanceof SharedPaperError?e.status:503).json({error:e instanceof SharedPaperError?e.message:'Shared paper backend unavailable. Existing records are preserved; no local replacement trades are generated.'});}
 };
}
