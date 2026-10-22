import {allowRequest} from '../server/pushBackend.js';
import {signalStore} from '../server/signalStore.js';
import {specPaperStore} from '../server/specPaperStore.js';
import {aggressiveStore} from '../server/aggressiveStore.js';
import {buildAccuracy} from '../server/accuracy.js';
// GET: live paper results next to their backtests. Each source is read independently; an unavailable one is
// reported, never filled.
export function createAccuracyHandler({signals=signalStore,runs=specPaperStore,book=aggressiveStore,now=Date.now}={}){return async(req,res)=>{
 if(!allowRequest(req,res))return;
 if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 if(Object.keys(req.query??{}).length)return res.status(400).json({error:'No query parameters are accepted'});
 const names=['validations','signalRuns','aggressiveBook'];
 const got=await Promise.allSettled([signals().pooledStats(),runs().signalRuns(),book().read()]);
 const v=i=>got[i].status==='fulfilled'?got[i].value:undefined;
 const out=buildAccuracy({validations:v(0)??[],runs:v(1)??[],book:v(2)?.data?.version==='aggressive-book-v1'?v(2).data:null,now:now()});
 return res.status(200).json({...out,unavailable:names.filter((_,i)=>got[i].status==='rejected')});
};}
export default createAccuracyHandler();
