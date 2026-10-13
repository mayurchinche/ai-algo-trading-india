import {captureArchivedEvidence} from '../server/archivedPortfolioEvidence.js';
import {captureCompanyHistories} from '../server/companyHistory.js';
import {captureFinancialEvidence} from '../server/financialEvidenceSnapshot.js';
import {disclosureReader} from '../server/companyDisclosures.js';
import {allowRequest} from '../server/pushBackend.js';
import {researchPortfolioStore} from '../server/researchPortfolioStore.js';
import {validateMandate,buildResearchPortfolio} from '../server/researchPortfolio.js';
import {evidenceHash} from '../server/decisionEvidence.js';
import {createUpstoxReader,normalizeUpstoxQuotes} from '../server/upstoxReadOnly.js';
export function createPortfolioHandler({store=researchPortfolioStore,read=createUpstoxReader(),clock=Date.now,disclosures=()=>disclosureReader.feed(),financials=()=>captureFinancialEvidence({clock}),histories=candidates=>captureCompanyHistories(candidates,{clock}),archived=candidates=>captureArchivedEvidence(candidates,{clock})}={}){
 return async(req,res)=>{
  if(!allowRequest(req,res))return;
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'GET or POST required'});
  let mandate,id;
  if(req.method==='POST')try{
   if(!req.body||Object.keys(req.body).some(k=>!['id','mandate'].includes(k)))throw Error('Only portfolio settings may be submitted');
   id=req.body.id;if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('A valid request ID is required');
   mandate=validateMandate(req.body.mandate);
  }catch(e){return res.status(400).json({error:e.message});}
  try{
   const db=store();
   if(req.method==='GET')return res.status(200).json({account:'user1',portfolios:await db.list()});
   const prior=await db.prior(id);
   if(prior)return evidenceHash(prior.report.mandate)===evidenceHash(mandate)?res.status(200).json({portfolio:prior}):res.status(409).json({error:'Request ID belongs to different settings'});
   const observation=await db.candidates(mandate.segment);
   const keys=[...new Set(observation.candidates.map(c=>c.instrumentKey).filter(k=>typeof k==='string'&&k.startsWith('NSE_EQ|')))];
   let quotes=[],quoteStatus='NO_CANDIDATES';
   if(keys.length)try{quotes=normalizeUpstoxQuotes(await read('/v3/market-quote/quotes?instrument_key='+encodeURIComponent(keys.join(','))),keys,clock());quoteStatus=quotes.length===keys.length?'FRESH':'MISSING_OR_STALE';}catch{quoteStatus='UNAVAILABLE';}
   let disclosureSnapshot;try{disclosureSnapshot=await disclosures();}catch{disclosureSnapshot={status:'UNAVAILABLE',items:[],note:'Disclosure source unavailable; not evidence of no announcements'};}
   const [financialSnapshot,companyHistorySnapshot,archivedEvidence]=await Promise.all([financials(),histories(observation.candidates),archived(observation.candidates)]);
   const report=buildResearchPortfolio({mandate,candidates:observation.candidates,quotes,asOf:new Date(clock()).toISOString(),source:{...observation.source,quoteStatus,disclosureSnapshot,financialSnapshot,companyHistorySnapshot,archivedEvidence}});
   const saved=await db.save(id,report);
   if(evidenceHash(saved.report.mandate)!==evidenceHash(mandate))return res.status(409).json({error:'Request ID belongs to different settings'});
   return res.status(201).json({portfolio:saved});
  }catch{return res.status(503).json({error:'Shared portfolio storage or research data is unavailable. Check the research portfolio migration and server connection; no local portfolio or trade was created.'});}
 };
}
export default createPortfolioHandler();
