// Read-only release gate: exercise real endpoints, including the Android origin.
const base = process.argv[2];
if (!base || !/^https:\/\/[^/?#]+\/?$/.test(base)) throw new Error('Usage: npm run check:deployment -- https://your-deployment.vercel.app');
const origin = 'https://localhost';
const requireProductionData = process.argv.includes('--require-production-data');
async function json(path) {
  const res = await fetch(new URL(path, base), { headers: { Origin: origin }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`${path.split('?')[0]} returned HTTP ${res.status}`);
  if (res.headers.get('access-control-allow-origin') !== origin) throw new Error('Android CORS origin not allowed');
  try { return await res.json(); } catch { throw new Error('API returned non-JSON content'); }
}
function check(value, message) { if (!value) throw new Error(message); }
function market(provider, path) { return json(`/api/market?${new URLSearchParams({provider,path})}`); }
const health = await json('/api/health');
if (requireProductionData) check(health.dataPolicyVersion === 'observed-data-v1' && health.options === 'unavailable' && health.brokerExecution === 'disabled', 'Production-data hardening is not deployed');
check(health.service === 'algotrader-market-api' && health.apiVersion === 1, 'Wrong backend version');
const preflight = await fetch(new URL('/api/market',base), {method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET'},signal:AbortSignal.timeout(25000)});
check(preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === origin, 'Android preflight failed');
for (const symbol of ['RELIANCE.NS','^NSEI']) {
  const data = await market('yahoo',`/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y`);
  const r = data.chart?.result?.[0];
  check(r?.timestamp?.length >= 200 && Number.isFinite(r.meta?.regularMarketPrice) && Number.isFinite(r.meta?.regularMarketTime), `Invalid history or missing quote time for ${symbol}`);
  console.log(JSON.stringify({symbol,bars:r.timestamp.length,quoteTime:new Date(r.meta.regularMarketTime*1000).toISOString()}));
}
const status = await market('nse','/api/marketStatus');
check(status.marketState?.some(m=>m.market === 'Capital Market'), 'NSE session status unavailable; release blocked');
const screener = await market('yahoo','/v1/finance/screener/predefined/saved?scrIds=most_actives_in&count=25');
check(screener.finance?.result?.[0]?.quotes?.some(q=>q.symbol?.endsWith('.NS')), 'NSE screener unavailable');
console.log('PASS: API version, Android CORS/preflight, equity/index history, timestamps, market status and screener. Closed-market quotes are history, not actionable alerts.');

if (requireProductionData) {
  for (const symbol of ['GC=F','SI=F','PL=F','PA=F','HG=F']) {
    const data = await market('yahoo', `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`);
    const result=data.chart?.result?.[0];
    check(result?.meta?.currency==='USD' && result.timestamp?.length>=50 && Number.isFinite(result.meta.regularMarketTime) && result.meta.regularMarketPrice>0, `${symbol} source data unavailable`);
  }
  const now=new Date(),start=now.getMonth()>=3?now.getFullYear():now.getFullYear()-1;
  for (const report of ['331','333']) {
    const url=`https://webnodejs.investorgain.com/cloud/v2/report/data-read/${report}/1/9/${now.getFullYear()}/${start}-${String(start+1).slice(-2)}/0/all?search=&v=21-49`;
    const data=await json(`/api/proxy?${new URLSearchParams({url})}`);
    check(Array.isArray(data.reportTableData) && data.reportTableData.length>0, `IPO report ${report} unavailable`);
  }
  console.log('PASS: observed-data version, metal source observations and IPO reports. Options and broker execution remain explicitly unavailable. Database policy and phone behavior require separate checks.');
}
