import { allowRequest } from '../server/pushBackend.js';
import { fetchNews, newsQuery, newsFilters } from '../server/marketNews.js';
import disclosureHandler from './_company-disclosures.js';
import companyHistoryHandler from './_company-history.js';
import reportEvidenceHandler from './_report-evidence.js';
import portfolioHandler from './_research-portfolios.js';
import fundamentalsHandler from './_fundamentals.js';
import scorecardsHandler from './_scorecards.js';
import optionChainHandler from './_option-chain.js';
import specPaperHandler from './_spec-paper.js';
import specPaperCycleHandler from './_spec-paper-cycle.js';
import signalsHandler from './_signals.js';
import stockAnalysisHandler from './_stock-analysis.js';
const cache=new Map(), inflight=new Map();
// The Vercel Hobby plan allows 12 functions per deployment. vercel.json rewrites these
// public paths to /api/research?route=<name>, and the router removes `route` before
// calling the handler, because each handler only accepts its own query keys.
export const researchRoutes={'company-disclosures':disclosureHandler,'company-history':companyHistoryHandler,'report-evidence':reportEvidenceHandler,'research-portfolios':portfolioHandler,'fundamentals':fundamentalsHandler,'scorecards':scorecardsHandler,'option-chain':optionChainHandler,'spec-paper':specPaperHandler,'spec-paper-cycle':specPaperCycleHandler,'signals':signalsHandler,'stock-analysis':stockAnalysisHandler};
export function createResearchRouter(routes=researchRoutes,news=newsHandler){return async(req,res)=>{
  const {route,...query}=req.query||{};
  if(route===undefined)return news(req,res);
  const target=typeof route==='string'&&Object.hasOwn(routes,route)?routes[route]:null;
  if(!target)return res.status(404).json({error:'Unknown research route'});
  try{req.query=query;}catch{delete req.query.route;}
  return target(req,res);
};}
export default createResearchRouter();
async function newsHandler(req,res) {
  if(!allowRequest(req,res))return;
  if(req.method!=='GET')return res.status(405).json({error:'GET required'});
  let q,filters;try{q=newsQuery(req.query.q??'');filters=newsFilters(req.query.topic,req.query.days);}catch(error){return res.status(400).json({error:error.message});}
  const key=JSON.stringify([q.toLowerCase(),filters.topic,filters.days]), hit=cache.get(key);
  if(hit && Date.now()-hit.at<300_000)return res.status(200).json(hit.data);
  if(!inflight.has(key)) {
    if(inflight.size>=10)return res.status(503).json({status:'unavailable',error:'News source busy; retry later'});
    inflight.set(key,fetchNews(q,filters).then(data=>{if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),data});return data;}).finally(()=>inflight.delete(key)));
  }
  try{return res.status(200).json(await inflight.get(key));}
  catch{return res.status(503).json({status:'unavailable',error:'News source unavailable or rate-limited. No sentiment result was generated.'});}
}
