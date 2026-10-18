import {allowRequest} from '../server/pushBackend.js';
import {fundamentalsStore,FUNDAMENTAL_READ_LIMIT} from '../server/fundamentalsStore.js';
import {financialDisclosureReader} from '../server/companyDisclosures.js';
import {ingestFundamentalFilings} from '../server/fundamentalsIngest.js';
import {deriveFundamentals} from '../server/fundamentals.js';
import {authorizeScheduler,emptySchedulerBody} from '../server/schedulerAuth.js';
import {createDailyCloseReader,observeDailyClose} from '../server/dailyClose.js';
// GET derives fundamentals for one instrument; POST is the scheduler's feed ingestion.
export function createFundamentalsHandler({store=fundamentalsStore,reader=financialDisclosureReader,now=Date.now,secret=()=>process.env.PAPER_SCHEDULER_SECRET,close=createDailyCloseReader()}={}){return async(req,res)=>{
 if(req.method==='POST'){
  if(!authorizeScheduler(req,res,secret()))return;
  if(!emptySchedulerBody(req.body))return res.status(400).json({error:'Empty scheduler body required'});
  try{const result=await ingestFundamentalFilings({store:store(),reader,clock:now});return res.status(result.status==='FAILED'?503:200).json(result);}
  catch{return res.status(503).json({error:'Financial filings feed or fundamentals storage unavailable. Nothing was recorded from this attempt.'});}
 }
 if(!allowRequest(req,res))return;
 if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 const query=req.query||{},key=query.instrumentKey;
 if(Object.keys(query).some(k=>k!=='instrumentKey')||typeof key!=='string'||!/^NSE_EQ\|INE[A-Z0-9]{9}$/.test(key))return res.status(400).json({error:'One instrumentKey of the form NSE_EQ|<ISIN> is required.'});
 const asOf=now();
 // A price outage leaves only P/E and PEG unavailable; a storage outage fails the whole request.
 try{const [rows,price]=await Promise.all([store().forInstrument(key),observeDailyClose(close,key,asOf)]);return res.status(200).json(deriveFundamentals(rows.map(r=>r.filing),{instrumentKey:key,asOf,price,truncated:rows.length>=FUNDAMENTAL_READ_LIMIT}));}
 catch{return res.status(503).json({error:'Fundamentals storage unavailable. Check the fundamental-filings migration and server connection. No fallback values were generated.'});}
};}
export default createFundamentalsHandler();
