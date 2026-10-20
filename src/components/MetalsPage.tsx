import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchLiveMetals, type LiveMetal } from '../services/metalsService';
import { formatIST, freshQuote } from '../services/tradingTime';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 1 : 3 });
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
// Every figure is from the provider's quote and its completed daily bars; nothing is estimated.
function MetalCard({ m }: { m: LiveMetal }) {
  const fresh = freshQuote({ price: m.priceUSD, timestamp: m.quoteTime, source: 'Yahoo' });
  const lastClose = m.priceHistory.at(-1)!.price, prices = m.priceHistory.map(p => p.price);
  const high = Math.max(...prices), low = Math.min(...prices), vsClose = (m.priceUSD / lastClose - 1) * 100;
  const [unit, per] = m.unit.split(' / ');
  return <article className="card data-card">
    <div className="data-card-head">
      <div><div className="data-card-title"><strong>{m.name}</strong><span className="badge badge-neutral">{m.ticker}</span></div>
        <p className="data-card-sub">Yahoo futures reference · quote {formatIST(m.quoteTime)}</p></div>
      <span className={`badge ${fresh ? 'badge-green' : 'badge-amber'}`}>{fresh ? 'Recent' : 'Stale'}</span>
    </div>
    <div className="flex items-baseline gap-3 flex-wrap">
      <span className="number-lg">{fmt(m.priceUSD)}</span><span className="muted text-sm">{unit} per {per}</span>
      <span className={`text-sm font-semibold ${vsClose >= 0 ? 'positive' : 'negative'}`}>{signed(vsClose)} <span className="faint font-normal">vs last completed close</span></span>
    </div>
    <dl className="fact-grid">
      <div><dt>SMA 20</dt><dd>{fmt(m.sma20)}</dd></div>
      <div><dt>SMA 50</dt><dd>{fmt(m.sma50)}</dd></div>
      <div><dt>Period high</dt><dd>{fmt(high)}</dd></div>
      <div><dt>Period low</dt><dd>{fmt(low)}</dd></div>
    </dl>
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={m.priceHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#edf0f5" vertical={false} />
        <XAxis dataKey="date" minTickGap={70} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e1e6ee' }} />
        <YAxis domain={['auto', 'auto']} width={52} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={v => fmt(Number(v))} />
        <Tooltip formatter={v => [fmt(Number(v)), m.unit]} />
        <Line type="linear" dataKey="price" dot={false} stroke="#3158d8" strokeWidth={1.6} />
      </LineChart>
    </ResponsiveContainer>
    <p className="caption">{fresh ? 'Recent observation; session and execution not verified.' : 'Historical or stale observation; not actionable.'} Completed bars {m.historyStart} to {m.historyEnd}; continuous futures history may include contract rolls.</p>
  </article>;
}

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
    <p className="notice">Indian retail prices, INR history and metal trade recommendations are unavailable until timestamped sources are connected. No currency fallback, synthetic retail history or estimated 52-week range is shown.</p>
    {!!errors.length && <section className="card" role="status">{errors.map(e => <p key={e}>{e}</p>)}</section>}
    {!loading && !metals.length && <p>No verified provider observations available.</p>}
    <div className="card-grid">{metals.map(m => <MetalCard key={m.ticker} m={m} />)}</div>
  </div>;
}
