import {allowRequest} from '../server/pushBackend.js';
import {disclosureReader,financialDisclosureReader} from '../server/companyDisclosures.js';
export function createDisclosureHandler(reader=disclosureReader,financialReader=financialDisclosureReader){return async(req,res)=>{
 if(!allowRequest(req,res))return;
 if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 if(Object.keys(req.query||{}).some(k=>!['id','kind'].includes(k))||req.query?.id!==undefined&&(typeof req.query.id!=='string'||!/^[a-f0-9]{64}$/.test(req.query.id)))return res.status(400).json({error:'Only a current disclosure identifier is accepted'});
 if(req.query?.kind!==undefined&&!['announcements','financials'].includes(req.query.kind))return res.status(400).json({error:'Unsupported disclosure feed'});
 const selected=req.query?.kind==='financials'?financialReader:reader;
 try{return res.status(200).json(req.query?.id?{document:await selected.document(req.query.id)}:{feed:await selected.feed()});}
 catch{return res.status(503).json({error:'Disclosure feed or supported structured document unavailable. Use the original filing for manual review; no financial facts were inferred.'});}
};}
export default createDisclosureHandler();
