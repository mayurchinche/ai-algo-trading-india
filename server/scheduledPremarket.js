import {timingSafeEqual} from 'node:crypto';
import {premarketSlot,observePremarket} from './premarket.js';
import {premarketStore} from './premarketStore.js';
export function createScheduledPremarketHandler({now=Date.now,secret=()=>process.env.PAPER_SCHEDULER_SECRET,store=premarketStore,observe=observePremarket}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'POST required'});
  const expected=secret(),provided=req.headers?.authorization;
  const token=typeof provided==='string'&&provided.startsWith('Bearer ')?provided.slice(7):'';
  if(typeof expected!=='string'||expected.length<32)return res.status(503).json({error:'Scheduler not configured'});
  if(Buffer.byteLength(token)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return res.status(401).json({error:'Unauthorized'});
  if(req.body!=null&&(typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).length))return res.status(400).json({error:'Empty scheduler body required'});
  const started=now(),slot=premarketSlot(started);
  if(!slot)return res.status(200).json({status:'OUTSIDE_RESEARCH_WINDOW'});
  try{
   const db=store();const existing=(await db.read(slot.date)).find(row=>row.slot===slot.slot);
   if(existing)return res.status(200).json({status:'ALREADY_RECORDED',publishedAt:existing.published_at});
   let report;
   try{report=await observe({now,mode:'scheduled'});}catch{report={version:1,mode:'scheduled',status:'UNAVAILABLE',startedAt:new Date(started).toISOString(),observedAt:new Date(now()).toISOString(),candidates:[],error:'News or instrument source failed. This is not evidence of no opportunities.'};}
   report.scheduledSlot=slot.slot;report.late=slot.late;report.beforeRegularOpen=now()<Date.parse(slot.date+'T09:15:00+05:30');
   const saved=await db.save(slot.date,slot.slot,report);
   return res.status(report.status==='UNAVAILABLE'?503:200).json({status:report.status,record:saved});
  }catch{return res.status(503).json({error:'Research snapshot storage unavailable'});}
 };
}
