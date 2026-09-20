import { getForegroundAlerts } from '../services/foregroundAlerts';
import { formatIST } from '../services/tradingTime';
export function AlertsPage() {
  const alerts = getForegroundAlerts();
  return <div className="space-y-6">
    <div className="page-title"><div><p className="eyebrow">While you are here</p><h2>Signal alerts</h2><p>Strong-signal popups while the app is open and visible.</p></div><span className="badge badge-blue">In-app only</span></div>
    <section className="card space-y-3"><h3 className="section-header">Strong signals only</h3><p>Popups are enabled automatically across all screens. They require a score of at least 70/100, a fresh quote and valid risk levels during market hours.</p><p>Each stock and direction appears once per trading day. There are no background notifications, messaging subscriptions or Firebase setup requirements for these popups.</p><p>Options alerts remain unavailable until verified option contract quotes are connected. A strong score is not a probability of profit.</p></section>
    <h3 className="section-header">Recent in-app alerts · 30 days</h3>
    {!alerts.length && <section className="card empty-state"><h3>No strong alerts yet</h3><p>Keep the app open with a working market-data connection. Qualifying signals will appear here automatically.</p></section>}
    {alerts.map(a => <article className="card space-y-3" key={a.id}><strong>{a.side} {a.symbol} · Score {Math.abs(a.score)}/100</strong><p>Signal: {formatIST(a.generatedAt)}</p><p>Quote: {formatIST(a.quoteTime)} · Valid until: {formatIST(a.expiresAt)}</p><p>Reference entry ₹{a.entry.toFixed(2)} · Stop ₹{a.stop.toFixed(2)} · Target ₹{a.target.toFixed(2)}</p><p>Recorded research alert. Check current prices before acting.</p></article>)}
  </div>;
}
