import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchLiveMetals, type LiveMetal } from '../services/metalsService';
import { formatIST, freshQuote } from '../services/tradingTime';

export function MetalsPage() {
  const [metals, setMetals] = useState<LiveMetal[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await fetchLiveMetals(); setMetals(data.metals); setErrors(data.errors); }
    catch { setMetals([]); setErrors(['Metals provider unavailable']); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 60000); return () => clearInterval(timer); }, [load]);
  return <div className="space-y-6">
    <div className="page-title"><div><h2>Metals market observations</h2><p>Yahoo futures reference prices in provider units. Not Indian retail gold, MCX contracts or executable bid/ask quotes.</p></div><button className="btn btn-secondary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    <section className="card"><p>Indian retail prices, INR history and metal trade recommendations are unavailable until timestamped sources are connected. No currency fallback, synthetic retail history or estimated 52-week range is shown.</p></section>
    {!!errors.length && <section className="card" role="status">{errors.map(e => <p key={e}>{e}</p>)}</section>}
    {!loading && !metals.length && <p>No verified provider observations available.</p>}
    <div className="grid md:grid-cols-2 gap-5">{metals.map(m => <article className="card space-y-3" key={m.ticker}>
      <h3>{m.name} · {m.ticker}</h3><strong>{m.priceUSD.toLocaleString('en-US', {maximumFractionDigits: 3})} {m.unit}</strong>
      <p>Source: Yahoo futures reference · Quote: {formatIST(m.quoteTime)}</p>
      <p>{freshQuote({price:m.priceUSD,timestamp:m.quoteTime,source:'Yahoo'}) ? 'Recent observation; session and execution not verified' : 'Historical / stale observation; not actionable'}</p>
      <p>Derived SMA20: {m.sma20.toFixed(3)} · SMA50: {m.sma50.toFixed(3)} ({m.unit})</p>
      <p>Completed provider bars: {m.historyStart} to {m.historyEnd}. Continuous futures history may include contract rolls.</p>
      <ResponsiveContainer width="100%" height={180}><LineChart data={m.priceHistory}><XAxis dataKey="date" minTickGap={60}/><YAxis domain={['auto','auto']}/><Tooltip/><Line type="linear" dataKey="price" dot={false} stroke="#2563eb"/></LineChart></ResponsiveContainer>
    </article>)}</div>
  </div>;
}
