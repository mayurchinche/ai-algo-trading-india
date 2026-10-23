import { useEffect, useState } from 'react';
import { fetchAccuracy, type AccuracyResponse, type LiveStats, type Verdict } from '../services/accuracy';
import { ScoreAccuracy } from './ScoreAccuracy';
import { GapFillPanel } from './TodayPage';
import { formatIST } from '../services/tradingTime';

const pc = (v: number | null | undefined) => v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const n2 = (v: number | null | undefined) => v === null || v === undefined ? '—' : v.toFixed(2);
const VERDICT: Record<Verdict, [string, string]> = {
 TOO_FEW_TRADES: ['Too few trades', 'badge-neutral'], NO_BACKTEST: ['No backtest', 'badge-neutral'], IN_LINE: ['In line', 'badge-green'],
 BELOW_BACKTEST: ['Below backtest', 'badge-red'], ABOVE_BACKTEST: ['Above backtest', 'badge-blue'],
};
const Badge = ({ s, min }: { s: LiveStats; min: number }) => <span className={`badge ${VERDICT[s.verdict][1]}`} title={s.verdict === 'TOO_FEW_TRADES' ? `A verdict needs ${min} closed trades` : s.z !== null ? `${s.z} standard errors from the backtest` : ''}>{s.verdict === 'TOO_FEW_TRADES' ? `${s.trades}/${min} trades` : VERDICT[s.verdict][0]}</span>;

// Is each strategy doing live what its backtest said? Validated rules, the aggressive book's setups and the
// Discover score, each next to the evidence that put it into trading.
export function AccuracyPage() {
 const [data, setData] = useState<AccuracyResponse>(); const [error, setError] = useState('');
 useEffect(() => { fetchAccuracy().then(setData).catch(e => setError(e instanceof Error ? e.message : 'Accuracy unavailable')); }, []);
 return <div className="space-y-6">
  <div className="page-title"><div><p className="eyebrow">Review</p><h2>Accuracy</h2><p>Live paper results next to the backtests that put each strategy into trading. Returns are the average per trade, after charges, as a share of the money put in. A live average is “in line” while it is within two standard errors of the backtest; with fewer than {data?.minTrades ?? 20} closed trades no verdict is given, because a handful of trades cannot tell a working strategy from a broken one.</p></div></div>
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {!!data?.unavailable.length && <p className="card-note warn">Not available right now: {data.unavailable.join(', ')}.</p>}
  {data && <section className="card grid gap-3">
   <div className="rule-item-head"><h3>Validated rules</h3><span className="caption">updated {formatIST(data.computedAt)}</span></div>
   <p className="caption">Backtest: the rule pooled over every stock it was validated on, 10 years of daily bars, broker charges and 5 bps slippage. Live: the single-trade paper runs opened automatically on its signals. Positions the book joined (bought while the rule already held the stock) are listed under each rule but kept out of the verdict, because their entry differs from the backtest’s.</p>
   {data.rules.length ? <div className="overflow-x-auto"><table className="data-table text-sm deals-table"><thead><tr><th>Rule</th><th className="text-right hide-sm">Stocks</th><th className="text-right hide-sm">Backtest trades</th><th className="text-right">Backtest</th><th className="text-right hide-sm">Backtest win</th><th className="text-right hide-sm">Live trades</th><th className="text-right">Live</th><th className="text-right hide-sm">Live win</th><th className="text-right hide-sm">Open</th><th>Verdict</th></tr></thead>
    <tbody>{data.rules.map(r => <tr key={r.id}><td>{r.name}<br /><small className="faint">{r.segment}{r.expiredBeforeEntry ? ` · ${r.expiredBeforeEntry} signal${r.expiredBeforeEntry > 1 ? 's' : ''} expired before entry` : ''}{r.entryRejected ? ` · ${r.entryRejected} entries rejected` : ''}{r.joined.trades || r.joined.open ? ` · joined: ${r.joined.open} open, ${r.joined.trades} closed${r.joined.avgPct !== null ? ` (${pc(r.joined.avgPct)})` : ''}` : ''}</small></td>
     <td className="text-right hide-sm">{r.validatedSymbols}</td><td className="text-right hide-sm">{r.backtest?.trades.toLocaleString('en-IN') ?? '—'}</td><td className="text-right">{pc(r.backtest?.avgPct)}</td><td className="text-right hide-sm">{r.backtest ? `${n2(r.backtest.winRatePct)}%` : '—'}</td>
     <td className="text-right hide-sm">{r.live.trades}</td><td className="text-right">{pc(r.live.avgPct)}</td><td className="text-right hide-sm">{r.live.winRatePct === null ? '—' : `${n2(r.live.winRatePct)}%`}</td><td className="text-right hide-sm">{r.open}</td><td><Badge s={r.live} min={data.minTrades} /></td></tr>)}</tbody></table></div>
    : <p className="text-sm muted">No rule has passed validation yet.</p>}
  </section>}
  {data && <section className="card grid gap-3">
   <div className="rule-item-head"><h3>Aggressive book</h3><span className="badge badge-amber">Experimental</span></div>
   <p className="caption">Each setup against the study that chose it{data.bookStartedAt ? `, since ${data.bookStartedAt.slice(0, 10)}` : ''}. Setups that are not backtested are measured live only.</p>
   <div className="overflow-x-auto"><table className="data-table text-sm deals-table"><thead><tr><th>Setup</th><th className="text-right">Expected</th><th className="text-right hide-sm">Live trades</th><th className="text-right">Live</th><th className="text-right hide-sm">Live win</th><th className="text-right hide-sm">Profit factor</th><th className="text-right hide-sm">Net ₹</th><th>Verdict</th></tr></thead>
    <tbody>{data.setups.map(s => <tr key={s.id}><td>{s.label}{s.open ? <small className="faint"> · {s.open} open</small> : null}<br /><small className="faint hide-sm">{s.expected.source}</small></td><td className="text-right">{pc(s.expected.netPct)}</td><td className="text-right hide-sm">{s.live.trades}</td><td className="text-right">{pc(s.live.avgPct)}</td><td className="text-right hide-sm">{s.live.winRatePct === null ? '—' : `${n2(s.live.winRatePct)}%`}</td><td className="text-right hide-sm">{n2(s.live.profitFactor)}</td><td className="text-right hide-sm">{s.net === null ? '—' : Math.round(s.net).toLocaleString('en-IN')}</td><td><Badge s={s.live} min={data.minTrades} /></td></tr>)}</tbody></table></div>
  </section>}
  {data?.gapFill && <GapFillPanel g={data.gapFill} />}
  <ScoreAccuracy />
 </div>;
}
