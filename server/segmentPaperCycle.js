import {randomUUID} from 'node:crypto';
import {advanceSegmentPaper} from './segmentPaperEngine.js';
import {recordScan} from './sharedPaperCycle.js';
import {observeSegmentPaper} from './segmentObservation.js';
export async function runSegmentPaperCycle({db,segment,observe=observeSegmentPaper,now=Date.now,source='foreground'}){
 const token=randomUUID();const initial=await db.account();
 if(!await db.lease(token))return {status:'BUSY'};
 try{
  const account=await db.account();
  if(account.state.lastCycleAt&&now()-Date.parse(account.state.lastCycleAt)<15000)return {status:'THROTTLED'};
  let observation;
  try{observation=await observe(account,now());}catch{observation={marketOpen:false,candidates:[],quotes:[],discoveryError:'SEGMENT_OBSERVATION_FAILED',scanDiagnostics:{status:'OBSERVATION_FAILED'}};}
  const before=structuredClone(account.state),signalEvents=[];before.segmentSignals??=[];
  const firstSeen=new Map(before.segmentSignals.map(s=>[s.signalId,s]));
  observation.candidates=(observation.candidates||[]).map(s=>firstSeen.get(s.signalId)||s);
  const known=new Set(before.segmentSignals.map(s=>s.signalId));
  for(const s of observation.candidates||[])if(!known.has(s.signalId)){known.add(s.signalId);before.segmentSignals.push(s);signalEvents.push({id:++before.sequence,at:new Date(now()).toISOString(),kind:'SEGMENT_SIGNAL_RECORDED',signalId:s.signalId,segment,signal:s});}
  const result=advanceSegmentPaper(before,{...observation,segment,now:now(),acceptEntries:account.enabled});
  result.events=[...signalEvents,...result.events];
  result.enabled=account.enabled;
  Object.assign(result.state,{marketOpen:observation.marketOpen,missingQuotes:observation.missingQuotes||[],discoveryError:observation.discoveryError||null});
  observation.scanDiagnostics??={};
  observation.scanDiagnostics.rejections={...observation.scanDiagnostics.rejections};
  for(const e of result.events.filter(e=>e.kind==='ORDER_REJECTED'))observation.scanDiagnostics.rejections[e.reason]=(observation.scanDiagnostics.rejections[e.reason]||0)+1;
  recordScan(result.state,observation,now(),source);
  result.state.segmentSignals=result.state.segmentSignals.filter(s=>now()-Date.parse(s.signalTime)<35*86400000).slice(-200);
  const saved=await db.commit(account,result);return {status:saved==='conflict'?'CONFLICT':'SAVED',scan:result.state.lastScan,accountId:initial.id};
 }finally{await db.release(token);}
}
