import {allowRequest} from '../server/pushBackend.js';
import {signalStore} from '../server/signalStore.js';
import {discoveryStore} from '../server/discoveryLedger.js';
import {aggressiveStore} from '../server/aggressiveStore.js';
import {buildToday} from '../server/todayBoard.js';
import {strategyBoard,automationStatus} from './_automation.js';
// GET: Today's board. Each source is read independently; one that is unavailable is reported, not fatal.
export function createTodayHandler({signals=signalStore,discovery=discoveryStore,book=aggressiveStore,board=strategyBoard,status=automationStatus,now=Date.now}={}){return async(req,res)=>{
 if(!allowRequest(req,res))return;
 if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 if(Object.keys(req.query??{}).length)return res.status(400).json({error:'No query parameters are accepted'});
 const at=now(),today=new Date(at+19800000).toISOString().slice(0,10),s=signals();
 const names=['signals','board','verdicts','book','discoveries','deals','automation'];
 const got=await Promise.allSettled([s.signals(200),board.read(),s.verdicts(),book().read(),discovery().day(today),s.latestDeals(),status.read()]);
 const v=i=>got[i].status==='fulfilled'?got[i].value:undefined;
 const out=buildToday({now:at,signals:v(0)??[],board:v(1)??null,verdicts:v(2)??[],book:v(3)?.data?.version==='aggressive-book-v1'?v(3).data:null,discoveries:v(4)??[],deals:v(5)??[],automation:v(6)??null});
 return res.status(200).json({...out,unavailable:names.filter((_,i)=>got[i].status==='rejected')});
};}
export default createTodayHandler();
