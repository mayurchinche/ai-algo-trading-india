import { allowRequest } from '../server/pushBackend.js';
// Vercel serverless proxy — forwards requests with proper headers
// ponytail: single proxy for all external APIs. Forwards method, body, and auth headers.

export default async function handler(req, res) {
  if (!allowRequest(req, res)) return;
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Read-only data gateway' });
  const allowed = ['www.goodreturns.in', 'www.nseindia.com', 'query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'webnodejs.investorgain.com'];

  let targetUrl;
  try { targetUrl = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
  if (targetUrl.protocol !== 'https:' || targetUrl.port || targetUrl.username || targetUrl.password || !allowed.includes(targetUrl.hostname)) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/html, */*',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  if (targetUrl.hostname.includes('nseindia.com')) {
    headers['Referer'] = 'https://www.nseindia.com';
  }
  if (targetUrl.hostname.includes('investorgain.com')) {
    headers['Referer'] = 'https://www.investorgain.com';
    headers['Origin'] = 'https://www.investorgain.com';
  }
  if (targetUrl.hostname.includes('goodreturns.in')) {
    headers['Referer'] = 'https://www.goodreturns.in';
  }

  const opts = { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(12000) };

  try {
    const upstream = await fetch(url, opts);
    const ct = upstream.headers.get('content-type') || 'text/plain';
    const body = await upstream.text();
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-store');
    res.status(upstream.status).send(body);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
