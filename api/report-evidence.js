import {allowRequest} from '../server/pushBackend.js';
import {reportEvidenceStore} from '../server/reportEvidenceStore.js';
import {reportPassageReader} from '../server/reportPassages.js';
import {companySymbol} from '../server/companyHistory.js';
export function createReportEvidenceHandler({store=reportEvidenceStore,read=reportPassageReader}={}){return async(req,res)=>{
 if(!allowRequest(req,res))return;if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'GET or POST required'});
 const b=req.body;
 if(req.method==='POST')try{if(!b||Object.keys(b).some(k=>!['requestId','id','symbol','segment','documentHash'].includes(k)))throw Error();companySymbol(b.symbol);if(!['equities','sme'].includes(b.segment)||![b.id,b.documentHash].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))||typeof b.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.requestId))throw Error();}catch{return res.status(400).json({error:'Only a current report reference, document hash and request ID are accepted.'});}
 try{const db=store();if(req.method==='GET')return res.status(200).json({account:'user1',evidence:await db.list()});
 const matches=r=>r.symbol===b.symbol&&r.segment===b.segment&&r.id===b.id&&r.documentHash===b.documentHash;
 const prior=await db.prior(b.requestId);if(prior)return matches(prior.report)?res.status(200).json({evidence:prior}):res.status(409).json({error:'Request ID already belongs to different evidence.'});
 const report=await read(b.symbol,b.segment,b.id);
 if(report.documentHash!==b.documentHash||report.id!==b.id||report.symbol!==b.symbol)return res.status(409).json({error:'The source changed. Read the report again before saving.'});
 const saved=await db.save(b.requestId,{...report,segment:b.segment,note:report.note.replace('This preview is not saved with a portfolio.','Saved research observation; not a verified governance finding.')});
 if(!matches(saved.report))return res.status(409).json({error:'Request ID already belongs to different evidence.'});
 return res.status(201).json({evidence:saved});
 }catch{return res.status(503).json({error:'Shared report archive or source unavailable. Check the report-evidence migration and server connection. No local fallback was saved.'});}
};}
export default createReportEvidenceHandler();
