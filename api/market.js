import { allowRequest } from '../server/pushBackend.js';
// Application-owned read API. No caller-supplied host, credentials, or write methods.
export default async function handler(req, res) {
  if (!allowRequest(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
  const { provider, path } = req.query;
  if (typeof path !== 'string' || typeof provider !== 'string') return res.status(400).json({ error: 'Provider and path required' });
  const base = provider === 'yahoo' ? 'https://query1.finance.yahoo.com' : provider === 'nse' ? 'https://www.nseindia.com' : null;
  if (!base) return res.status(400).json({ error: 'Unknown provider' });
  let target;
  try { target = new URL(path, base); } catch { return res.status(400).json({ error: 'Invalid data path' }); }
  const allowed = provider === 'yahoo'
    ? /^\/v8\/finance\/chart\/[^/]+$/.test(target.pathname) || target.pathname === '/v1/finance/screener/predefined/saved'
    : target.pathname === '/api/marketStatus';
  if (target.origin !== base || !allowed || target.username || target.password) return res.status(400).json({ error: 'Unsupported data request' });
  try {
    const upstream = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', ...(provider === 'nse' ? { Referer: base } : {}) } });
    if (!upstream.ok) return res.status(upstream.status).json({ error: `Data provider returned HTTP ${upstream.status}` });
    const body = await upstream.json();
    return res.status(200).json(body);
  } catch { return res.status(502).json({ error: 'Data provider unavailable. Trading observations paused.' }); }
}
