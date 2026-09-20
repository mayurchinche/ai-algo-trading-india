import { timingSafeEqual } from 'node:crypto';
import { dispatchAlerts } from '../server/dispatchAlerts.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  const supplied=Buffer.from(req.headers.authorization || ''), expected=Buffer.from(`Bearer ${process.env.PUSH_WORKER_SECRET || ''}`);
  if (!process.env.PUSH_WORKER_SECRET || supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) return res.status(401).json({error:'Unauthorized'});
  if (req.method!=='POST') return res.status(405).json({error:'POST required'});
  try { const results=await dispatchAlerts(); return res.json({processed:results.length,accepted:results.filter(r=>r==='accepted').length}); }
  catch { return res.status(503).json({error:'Push dispatch unavailable'}); }
}
