import { allowRequest } from '../server/pushBackend.js';
import { fetchNews, newsQuery, newsFilters } from '../server/marketNews.js';
const cache=new Map(), inflight=new Map();
export default async function handler(req,res) {
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
