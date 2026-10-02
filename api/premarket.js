import {allowRequest} from '../server/pushBackend.js';
import {premarketStore} from '../server/premarketStore.js';
import {observePremarket} from '../server/premarket.js';
let preview, pending;
export default async function handler(req,res){
 if(!allowRequest(req,res))return;
 if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 if(req.query.preview==='1'){
  try{
   if(preview&&Date.now()-Date.parse(preview.observedAt)<300000)return res.status(200).json({preview});
   if(!pending)pending=observePremarket().then(value=>(preview=value)).finally(()=>{pending=null;});
   return res.status(200).json({preview:await pending});
  }catch{return res.status(503).json({error:'Research preview unavailable: news or instrument source failed. No stored shortlist was changed.'});}
 }
 const date=req.query.date??new Date(Date.now()+19800000).toISOString().slice(0,10);
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return res.status(400).json({error:'Valid ISO date required'});
 try{
  const db=premarketStore();const [reports,rows]=await Promise.all([db.read(date),db.dates()]);
  return res.status(200).json({date,reports,dates:[...new Set(rows.map(r=>r.session_date))],status:reports.length?'RECORDED':'NOT_RECORDED'});
 }catch{return res.status(503).json({error:'Shared pre-market storage is not available. A preview is not a saved morning shortlist.'});}
}
