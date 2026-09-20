import { getForegroundAlerts } from '../services/foregroundAlerts';
import { getDecisionJournal } from '../services/decisionJournal';
import { downloadJSON } from '../services/journalStorage';
import { formatIST } from '../services/tradingTime';
export function AlertsPage() {
  const alerts = getForegroundAlerts();
  const decisions = getDecisionJournal();
  return <div className="space-y-6">
    <div className="page-title"><div><p className="eyebrow">While you are here</p><h2>Signal alerts</h2><p>Strong-signal popups while the app is open and visible.</p></div><span className="badge badge-blue">In-app only</span></div>
    <section className="card space-y-3"><h3 className="section-header">Strong signals only</h3><p>Popups are enabled automatically across all screens. They require a score of at least 70/100, a fresh quote and valid risk levels before 15:15 IST during a confirmed open market session.</p><p>Each stock and direction appears once per trading day. Paper entries use these same signal rules, with additional account and daily limits. There are no background notifications, messaging subscriptions or Firebase setup requirements for these popups.</p><p>Options alerts remain unavailable until verified option contract quotes are connected. A strong score is not a probability of profit.</p></section>
    <section className="card space-y-3">
      <h3 className="section-header">Paper decision journal · 30 days</h3>
      <p>Accepted and skipped candidates, with reasons and observed IST times. Repeated outcomes are grouped by stock, direction and reason each day; the count records how often they occurred. Each trade keeps its own entry and exit events.</p>
      <p>Stored on this device. Export before clearing app data. Popups are research alerts; a paper account limit can prevent a corresponding entry.</p>
      <button className="btn btn-secondary" disabled={!decisions.length} onClick={() => downloadJSON('paper-decisions.json', decisions)}>Export all decisions (JSON)</button>
      {!decisions.length && <p>No scan decisions recorded yet.</p>}
      <p>Showing the 50 most recently observed groups of {decisions.length}. Export includes all retained groups.</p>
      {decisions.slice(0, 50).map(d => <article className="space-y-1 border-b border-white/10 py-3" key={d.id}>
        <strong>{d.symbol} · {d.side} · {d.reason.replaceAll('_', ' ')}</strong>
        <p>First observed: {formatIST(d.firstObservedAt)} · Last: {formatIST(d.lastObservedAt)}</p>
        <p>{d.observations} observation(s) · Score range {d.minScore} to {d.maxScore}</p>
        <p>First sample signal: {formatIST(d.signalTime)} · Quote: {formatIST(d.quoteTime)}</p>
        {!!d.blockedReasons?.length && <p>{d.blockedReasons.join(' · ')}</p>}
        {d.tradeId && <p>Paper trade: {d.tradeId}</p>}
      </article>)}
    </section>
    <h3 className="section-header">Recent in-app alerts · 30 days</h3>
    {!alerts.length && <section className="card empty-state"><h3>No strong alerts yet</h3><p>Keep the app open with a working market-data connection. Qualifying signals will appear here automatically.</p></section>}
    {alerts.map(a => <article className="card space-y-3" key={a.id}><strong>{a.side} {a.symbol} · Score {Math.abs(a.score)}/100</strong><p>Signal: {formatIST(a.generatedAt)}</p><p>Quote: {formatIST(a.quoteTime)} · Valid until: {formatIST(a.expiresAt)}</p><p>Reference entry ₹{a.entry.toFixed(2)} · Stop ₹{a.stop.toFixed(2)} · Target ₹{a.target.toFixed(2)}</p><p>Recorded research alert. Check current prices before acting.</p></article>)}
  </div>;
}
