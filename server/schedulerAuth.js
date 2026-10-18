import {timingSafeEqual} from 'node:crypto';
// Shared credential check for Supabase pg_cron dispatches (Bearer PAPER_SCHEDULER_SECRET).
// Writes the response and returns false when the request must not proceed.
export function authorizeScheduler(req,res,expected,notConfigured='Scheduler not configured'){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.status(405).json({error:'POST required'});return false;}
 if(typeof expected!=='string'||expected.length<32){res.status(503).json({error:notConfigured});return false;}
 const provided=req.headers?.authorization;
 const token=typeof provided==='string'&&provided.startsWith('Bearer ')?provided.slice(7):'';
 if(Buffer.byteLength(token)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(token),Buffer.from(expected))){res.status(401).json({error:'Unauthorized'});return false;}
 return true;
}
export const emptySchedulerBody=body=>body==null||(typeof body==='object'&&!Array.isArray(body)&&!Object.keys(body).length);
