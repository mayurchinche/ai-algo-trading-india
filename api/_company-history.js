import {reportPassageReader} from '../server/reportPassages.js';
import {allowRequest} from '../server/pushBackend.js';
import {companyHistoryReader,companySymbol} from '../server/companyHistory.js';
export function createCompanyHistoryHandler(read=companyHistoryReader,passages=reportPassageReader){return async(req,res)=>{
 if(!allowRequest(req,res))return;if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 try{if(Object.keys(req.query||{}).some(k=>!['symbol','segment','id'].includes(k)))throw Error();companySymbol(req.query?.symbol);if(req.query.id!==undefined&&(typeof req.query.id!=='string'||!/^[a-f0-9]{64}$/.test(req.query.id)))throw Error();if(req.query?.segment!==undefined&&!['equities','sme'].includes(req.query.segment))throw Error();}catch{return res.status(400).json({error:'An exact uppercase NSE symbol and equities or sme segment are required.'});}
 try{return res.status(200).json(req.query.id?{report:await passages(req.query.symbol,req.query.segment||'equities',req.query.id)}:{history:await read(req.query.symbol,req.query.segment||'equities')});}catch{return res.status(503).json({error:'Company report history or PDF extraction unavailable. This is not evidence of no reports or no governance concerns.'});}
};}
export default createCompanyHistoryHandler();
