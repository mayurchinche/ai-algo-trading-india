import { useEffect, useState } from 'react';
import type { DiscoveredStock } from '../services/stockDiscovery';
import { collectForegroundAlerts, type ForegroundAlert } from '../services/foregroundAlerts';
import { formatIST } from '../services/tradingTime';
export function SignalPopup({ stocks, marketOpen, onView }: { stocks: DiscoveredStock[]; marketOpen: boolean; onView: () => void }) {
  const [queue, setQueue] = useState<ForegroundAlert[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const added = collectForegroundAlerts(stocks, document.visibilityState === 'visible', marketOpen);
      setQueue(q => [...q.filter(a => Date.parse(a.expiresAt) > Date.now()), ...added]);
      setError('');
    } catch { setError('Signal popup history could not be saved. Check app storage.'); }
  }, [stocks, marketOpen]);
  useEffect(() => {
    const hide = () => { if (document.visibilityState !== 'visible') setQueue([]); };
    const timer = setInterval(() => setQueue(q => q.filter(a => Date.parse(a.expiresAt) > Date.now())), 1000);
    document.addEventListener('visibilitychange', hide);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hide); };
  }, []);
  const a = queue[0];
  if (error) return <div role="status" className="runtime-status runtime-error">{error}</div>;
  if (!a) return null;
  return <aside role="alert" aria-label="Strong signal" className="card" style={{ position: 'fixed', top: 'max(16px, env(safe-area-inset-top))', right: 16, left: 16, maxWidth: 440, marginLeft: 'auto', zIndex: 100, boxShadow: '0 12px 48px #0004', maxHeight: '80dvh', overflowY: 'auto' }}>
    <div className="trade-heading"><strong>{a.side} {a.symbol} · Strong signal</strong><button aria-label="Dismiss signal" onClick={() => setQueue(q => q.slice(1))}>×</button></div>
    <p>Score {Math.abs(a.score)}/100 · Equity</p>
    <p>Signal: {formatIST(a.generatedAt)}</p><p>Quote: {formatIST(a.quoteTime)}</p>
    <p>Entry ₹{a.entry.toFixed(2)} · Stop ₹{a.stop.toFixed(2)} · Target ₹{a.target.toFixed(2)}</p>
    <p>Valid until {formatIST(a.expiresAt)}. Research signal; no order placed.</p>
    <button onClick={() => { setQueue(q => q.slice(1)); onView(); }}>View alert history</button>
    {queue.length > 1 && <p>{queue.length - 1} more strong signals</p>}
  </aside>;
}
