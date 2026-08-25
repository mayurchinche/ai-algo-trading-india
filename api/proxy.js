// Vercel serverless proxy — forwards requests with proper headers
// ponytail: single proxy for all external APIs. Forwards method, body, and auth headers.

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  const allowed = [
    'goodreturns.in', 'nseindia.com',
    'query1.finance.yahoo.com', 'query2.finance.yahoo.com',
    'api.dhan.co', 'auth.dhan.co',
    'apiconnect.angelbroking.com',
    'api.telegram.org',
    'investorgain.com',
  ];

  let targetUrl;
  try { targetUrl = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
  if (!allowed.some(d => targetUrl.hostname.endsWith(d))) {
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

  // Forward auth headers from client (for Dhan, Angel One, Telegram)
  const forward = ['access-token', 'client-id', 'x-api-key', 'authorization', 'content-type', 'dhanclientid'];
  for (const h of forward) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }

  const opts = { method: req.method || 'GET', headers };

  if (req.method === 'POST' || req.method === 'PUT') {
    opts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!headers['content-type']) headers['content-type'] = 'application/json';
  }

  try {
    const upstream = await fetch(url, opts);
    const ct = upstream.headers.get('content-type') || 'text/plain';
    const body = await upstream.text();
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(upstream.status).send(body);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
