import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TREND_MODEL, type TrendResult } from '../../shared/trendScore';
import { TREND_VALIDATION } from '../../shared/trendValidation';
import { NIFTY50_UNIVERSE } from '../../shared/universes';
import { displayScore, loadTrendRows, matchesTab, sortTrendRows, type TrendRow, type TrendTab } from '../services/trendDashboard';

const tabs: { id: TrendTab; label: string }[] = [{ id: 'ALL', label: 'All' }, { id: 'BULLISH', label: 'Bullish' }, { id: 'TREND_START', label: 'Trend start' }, { id: 'TREND_END', label: 'Trend end' }];
const zoneBadge = { BULLISH: 'badge-green', NEUTRAL: 'badge-amber', BEARISH: 'badge-red' } as const;
const unavailable = { INSUFFICIENT_HISTORY: 'Not enough completed history', DATA_UNAVAILABLE: 'Price history unavailable', INVALID_HISTORY: 'Provider history failed validation' } as const;

export function TrendValidationNotice() {
 const v = TREND_VALIDATION;
 return <section className="notice space-y-1" role="note">
  <p><strong>Research observation, not a recommendation.</strong> {v.summary}</p>
  <p className="text-sm">Replay {v.study} ({v.runOn}): {v.closedTrades.toLocaleString('en-IN')} closed trades, win rate {v.winRatePct.toFixed(1)}%, mean {v.meanNetTradePct.toFixed(2)}% / median {v.medianNetTradePct.toFixed(2)}% per trade after an assumed 0.25% round-trip cost. Beat buy-and-hold in {v.beatBuyAndHold.symbols} of {v.beatBuyAndHold.of} stocks; median max drawdown {v.medianMaxDrawdownPct.strategy.toFixed(0)}% versus {v.medianMaxDrawdownPct.buyAndHold.toFixed(0)}% for buy-and-hold. {v.recentYears.map(y => `${y.year}: ${y.meanNetPct.toFixed(2)}% mean over ${y.trades} trades`).join('; ')}. {v.universe}.</p>
 </section>;
}

export function TrendTable({ rows, tab, selected, onSelect }: { rows: TrendRow[]; tab: TrendTab; selected?: string; onSelect?: (symbol: string) => void }) {
 const visible = sortTrendRows(rows.filter(r => matchesTab(r, tab)));
 if (!visible.length) return <p className="py-8 text-sm text-[var(--text-muted)]">No instruments in this view.</p>;
 return <div className="overflow-x-auto"><table className="data-table">
  <thead><tr><th>Symbol</th><th className="text-right">Close</th><th className="text-center">Score</th><th className="text-center">Zone</th><th>Last signal</th><th className="text-right">Sessions since</th><th>Bar date</th></tr></thead>
  <tbody>{visible.map(row => {
   if (row.status !== 'SCORED' || row.trend.latest.status !== 'SCORED') return <tr key={row.symbol}><td className="font-semibold">{row.symbol}</td><td colSpan={6} className="text-[var(--text-muted)]">{unavailable[row.status as keyof typeof unavailable] ?? 'Unavailable'}</td></tr>;
   const l = row.trend.latest;
   return <tr key={row.symbol} aria-selected={selected === row.symbol} onClick={() => onSelect?.(row.symbol)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
    <td className="font-semibold">{row.symbol}</td>
    <td className="text-right font-mono">{l.close.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
    <td className="text-center font-mono">{displayScore(l.score)}</td>
    <td className="text-center"><span className={`badge ${zoneBadge[l.zone]}`}>{l.zone.toLowerCase()}</span></td>
    <td>{l.lastSignal ? `${l.lastSignal.type === 'BUY' ? 'Trend start' : 'Trend end'} · ${l.lastSignal.date}` : 'None in loaded history'}</td>
    <td className="text-right font-mono">{l.sessionsSinceSignal ?? '—'}</td>
    <td>{l.date}</td>
   </tr>;
  })}</tbody>
 </table></div>;
}

function TrendChart({ trend }: { trend: TrendResult }) {
 const data = trend.dates.map((date, i) => ({ date, close: trend.close[i], zlema: trend.zlema[i], score: trend.score[i] })).slice(-180);
 return <div className="grid md:grid-cols-2 gap-5">
  <ResponsiveContainer width="100%" height={220}><ComposedChart data={data}><XAxis dataKey="date" minTickGap={60} /><YAxis domain={['auto', 'auto']} /><Tooltip /><Line type="linear" dataKey="close" dot={false} stroke="#2563eb" name="Close" /><Line type="linear" dataKey="zlema" dot={false} stroke="#9333ea" name={`ZLEMA ${TREND_MODEL.zlemaLength}`} /></ComposedChart></ResponsiveContainer>
  <ResponsiveContainer width="100%" height={220}><ComposedChart data={data}><XAxis dataKey="date" minTickGap={60} /><YAxis domain={[0, 10]} /><Tooltip /><ReferenceLine y={TREND_MODEL.bullish} stroke="#16a34a" strokeDasharray="4 4" /><ReferenceLine y={TREND_MODEL.bearish} stroke="#dc2626" strokeDasharray="4 4" /><Line type="linear" dataKey="score" dot={false} stroke="#0f766e" name="Score" /></ComposedChart></ResponsiveContainer>
 </div>;
}

export function TrendDashboardPage() {
 const [rows, setRows] = useState<TrendRow[]>([]);
 const [tab, setTab] = useState<TrendTab>('ALL');
 const [selected, setSelected] = useState<string>();
 const [loading, setLoading] = useState(false);
 const run = useRef(0);
 const load = useCallback(async () => {
  const id = ++run.current; setLoading(true); setRows([]);
  try { await loadTrendRows(NIFTY50_UNIVERSE.symbols, row => { if (run.current === id) setRows(prev => [...prev.filter(r => r.symbol !== row.symbol), row]); }); }
  finally { if (run.current === id) setLoading(false); }
 }, []);
 // Unmounting invalidates in-flight loads so late rows are never applied.
 useEffect(() => { const loads = run; void load(); return () => { loads.current++; }; }, [load]);
 const counts = useMemo(() => Object.fromEntries(tabs.map(t => [t.id, rows.filter(r => matchesTab(r, t.id)).length])) as Record<TrendTab, number>, [rows]);
 const detail = rows.find(r => r.symbol === selected && r.status === 'SCORED');
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Trend score</h2><p>{TREND_MODEL.id} on completed daily bars for {NIFTY50_UNIVERSE.name} constituents (NSE list of {NIFTY50_UNIVERSE.asOf}). 0–4 bearish, 4–7 neutral, 7–10 bullish.</p></div><button className="btn btn-secondary" disabled={loading} onClick={() => void load()}>{loading ? `Loading ${rows.length}/${NIFTY50_UNIVERSE.symbols.length}…` : 'Refresh'}</button></div>
  <TrendValidationNotice />
  <details className="card research-method"><summary>How the score is calculated</summary><p className="text-sm">{TREND_MODEL.formula}. {TREND_MODEL.signals}. Trend start and trend end list signals from the last {TREND_MODEL.recentSessions} sessions. Yahoo daily history, latest completed session; not a live quote.</p></details>
  <section className="card space-y-3">
   <div className="tab-bar" role="group" aria-label="Trend view">{tabs.map(t => <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label} ({counts[t.id]})</button>)}</div>
   <TrendTable rows={rows} tab={tab} selected={selected} onSelect={setSelected} />
  </section>
  {detail?.status === 'SCORED' && <section className="card space-y-3"><h3>{detail.symbol} · last 180 sessions</h3><TrendChart trend={detail.trend} /></section>}
 </div>;
}
