import { getPaperTrades, getPaperTradeSummary } from '../services/paperTrading';
import { useStockDiscovery } from '../hooks/useStockDiscovery';
const money = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
export function OverviewPage() {
  useStockDiscovery();
  const summary = getPaperTradeSummary();
  const closed = getPaperTrades().filter(t => t.status !== 'OPEN');
  const strategies = [...new Set(closed.map(t => t.strategy))].map(name => {
    const trades = closed.filter(t => t.strategy === name);
    return { name, count: trades.length, net: trades.reduce((sum, t) => sum + (t.netPnl || 0), 0) };
  });
  return <div className="space-y-6"><div className="page-title"><div><p className="eyebrow">Measure before you scale</p><h2>Performance, from the ledger.</h2><p>Recorded paper executions using provider observations. Fills and costs are simulated; no real broker orders.</p></div></div>
    <div className="metric-grid">{[['Account equity', money(summary.accountEquity)], ['Recorded net P&L', money(summary.totalNetPnl)], ['Estimated charges', money(summary.totalBrokerage)], ['Evaluated trades', `${summary.evaluated} / ${summary.closedTrades}`]].map(([label, value]) => <div className="card metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="grid md:grid-cols-2 gap-5"><section className="card"><p className="eyebrow">Evidence quality</p><h3 className="text-xl font-semibold my-3">{summary.evaluated ? `${summary.winRate}% evaluated win rate` : 'Your evidence starts here'}</h3><p>{summary.excluded} closed trades excluded because their execution history is legacy, incomplete, or has monitoring gaps. Small samples cannot establish an edge.</p><p className="mt-4">Realized P&L from cleaned-up history: {money(summary.archivedNet)}. This remains part of account equity.</p></section><section className="card"><p className="eyebrow">Risk policy</p><h3 className="text-xl font-semibold my-3">Keep the downside visible</h3><p>₹20,000 starting capital · 0.5% planned risk per trade including estimated costs · 2% daily realized loss stop · 3 entries a day · No new entries after 15:15 IST.</p><p className="mt-4">Gaps can exceed the planned stop. F&O requires real contracts, lots, premiums, and margin data before simulation.</p></section></div>
    <section className="card"><h3 className="section-header">Recorded strategy results</h3>{!strategies.length ? <p>No closed trades yet. Results will appear as the journal grows.</p> : <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Strategy</th><th>Recorded exits</th><th>Net result</th></tr></thead><tbody>{strategies.map(s => <tr key={s.name}><td>{s.name}</td><td>{s.count}</td><td className={s.net >= 0 ? 'positive' : 'negative'}>{money(s.net)}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
