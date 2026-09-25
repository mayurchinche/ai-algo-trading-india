import { ServerPaperPage } from './ServerPaperPage';
import { useState } from 'react';
import { useStockDiscovery } from '../hooks/useStockDiscovery';
import { getPaperTrades, getPaperTradeSummary, loadLedger, prunePaperTrades, MODEL_VERSION } from '../services/paperTrading';
import { downloadJSON } from '../services/journalStorage';
import { formatIST, istDate } from '../services/tradingTime';
const money = (n?: number) => n == null ? '—' : n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export function TradesPage({focusSignalId}:{focusSignalId?:string}) { return <><ServerPaperPage workspace focusSignalId={focusSignalId}/><details className="card"><summary>Earlier device journal (archive only)</summary><LegacyTradesPage/></details></>; }
function LegacyTradesPage() {
  const { loading, rescan } = useStockDiscovery();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [date, setDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const summary = getPaperTradeSummary();
  const trades = getPaperTrades().filter(t => t.symbol.toLowerCase().includes(search.toLowerCase()) && (status === 'ALL' || (status === 'OPEN' ? t.status === 'OPEN' : t.status !== 'OPEN')) && (!date || istDate(t.entryTime) === date)).sort((a, b) => b.entryTime.localeCompare(a.entryTime));
  async function cleanup() {
    if (!navigator.locks) return;
    await navigator.locks.request('paper-trading-scan', () => { const removed = prunePaperTrades(); setNotice(`${removed} closed trades older than 30 days removed. Account balance preserved.`); });
  }
  return <div className="space-y-6">
    <div className="page-title"><div><p className="eyebrow">Your trading record</p><h2>Paper journal</h2><p>Every decision has a timestamp. Every result has a trail.</p></div><button className="primary-button" onClick={() => downloadJSON(`paper-journal-${istDate()}.json`, loadLedger())}>Export journal ↓</button></div>
    <div className="metric-grid">
      {[['Account equity', money(summary.accountEquity)], ['Recorded net P&L', money(summary.totalNetPnl)], ['Evaluated win rate', summary.evaluated ? `${summary.winRate}%` : 'No sample'], ['Open positions', String(summary.openTrades)]].map(([label, value]) => <div className="card metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="notice">Browser simulation • Equity only • Runs while this app is open • 5 bps adverse slippage per fill + estimated costs. {summary.evaluated} evaluated / {summary.excluded} excluded closed trades. Gaps and legacy trades remain visible.</div>
    <div className="journal-toolbar"><label>Symbol<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol…" /></label><label>Entry date (IST)<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All trades</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option></select></label><button onClick={rescan} disabled={loading}>{loading ? 'Scanning…' : 'Refresh'}</button></div>
    {!trades.length && <div className="card empty-state"><span>◎</span><h3>No matching trades</h3><p>New entries require a confirmed open market, fresh quotes, valid risk levels, and sufficient capital.</p></div>}
    <div className="trade-list">{trades.map(t => <article className="card trade-card" key={t.id}>
      <div className="trade-heading"><div><b>{t.symbol}</b><span>{t.strategy} · {t.quantity} shares</span></div><span className={`badge ${t.side === 'BUY' ? 'badge-green' : 'badge-red'}`}>{t.side}</span><span className="badge badge-blue">{t.status.replaceAll('_', ' ')}</span><strong className={(t.netPnl || 0) < 0 ? 'negative' : 'positive'}>{t.status === 'OPEN' ? 'Open' : money(t.netPnl)}</strong></div>
      <div className="trade-details"><div><label>Entry observation</label><b>{money(t.entryPrice)}</b><time>{formatIST(t.entryTime)}</time></div><div><label>Exit observation</label><b>{money(t.exitPrice)}</b><time>{t.exitTime ? formatIST(t.exitTime) : 'Awaiting exit'}</time></div><div><label>Stop / target</label><b>{money(t.stopLoss)} / {money(t.target)}</b><span>Estimated costs: {money(t.brokerage)}</span></div></div>
      {(t.modelVersion !== MODEL_VERSION || t.monitoringGap || t.status === 'EXPIRED') && <p className="quality-note">{t.modelVersion !== MODEL_VERSION ? 'Earlier policy: retained in balance, excluded from current-policy evaluation.' : 'Monitoring gap: earlier threshold crossings are unknown.'} Excluded from evaluated win rate.</p>}
      <button className="text-button" onClick={() => setExpanded(expanded === t.id ? null : t.id)} aria-expanded={expanded === t.id}>{expanded === t.id ? 'Hide' : 'View'} audit trail</button>
      {expanded === t.id && <div className="audit-trail"><p>Signal: {formatIST(t.signalTime)} · ID: {t.signalId || 'Legacy / unavailable'}</p><p>Entry quote: {formatIST(t.entryQuoteTime)} · Exit quote: {formatIST(t.exitQuoteTime)}</p><p>Source: {t.source || 'Legacy / unknown'} · Model: {t.modelVersion || 'Legacy'}</p>{t.events?.map((event, i) => <p key={i}><b>{event.kind}</b> · {formatIST(event.at)} — {event.note}</p>)}</div>}
    </article>)}</div>
    <div className="journal-toolbar"><p>Keep at least 30 days after closing. Export before cleanup.</p><button onClick={cleanup}>Clean up older closed trades</button></div>{notice && <p role="status">{notice}</p>}
  </div>;
}
