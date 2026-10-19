import { useEffect, useState } from 'react';
import { fetchDiscovery, type DiscoveryResponse, type Observation } from '../services/discovery';
import { openAnalysis } from '../services/specDraft';
import { formatIST } from '../services/tradingTime';

const pc = (v: number | null | undefined) => v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
// Live accuracy of the Discover score from first sightings, next to the 10-year replay of the same score.
export function ScoreAccuracy() {
 const [data, setData] = useState<DiscoveryResponse>(); const [error, setError] = useState(''); const [study, setStudy] = useState<DiscoveryResponse['study']>();
 useEffect(() => { fetchDiscovery().then(d => { setData(d); setStudy(d.study); }).catch(e => { setError(e instanceof Error ? e.message : 'Unavailable'); if (e?.study) setStudy(e.study); }); }, []);
 return <details className="card space-y-2" open><summary><strong>Score accuracy</strong> · is a higher score worth more?</summary>
  {study && <><p className="text-sm"><strong>10-year replay</strong> ({study.stocks} NIFTY 500 stocks, {study.stockDays.toLocaleString('en-IN')} stock-days, outcomes from the next open): {study.finding}</p>
   <div className="overflow-x-auto"><table className="data-table text-sm"><thead><tr><th>Score band</th><th className="text-right">Times</th><th className="text-right">10-day return</th><th className="text-right">vs every stock-day</th><th className="text-right">Next-day intraday, after charges</th><th className="text-right">Target hit before stop</th></tr></thead>
    <tbody>{study.bands.map(b => <tr key={b.band}><td>{b.band}</td><td className="text-right">{b.n.toLocaleString('en-IN')}</td><td className="text-right">{pc(b.d10)}</td><td className="text-right">{pc(b.d10 - study.baseline10dPct)}</td><td className="text-right">{pc(b.nextDayIntradayNet)}</td><td className="text-right">{b.targetFirst.toFixed(1)}%</td></tr>)}</tbody></table></div></>}
  {data ? <><p className="text-sm"><strong>Live tracking</strong>: every stock reaching score {data.recordMinScore} in market hours is recorded with its first time and price; outcomes are measured from that price over {data.outcomeSessions} sessions. {data.trackedSignals} signals tracked in the last 120 days.</p>
   <div className="overflow-x-auto"><table className="data-table text-sm"><thead><tr><th>Side</th><th>First score</th><th className="text-right">Signals</th><th className="text-right">With outcome</th><th className="text-right">Same-day close</th><th className="text-right">Next day</th><th className="text-right">5 days</th><th className="text-right">10 days</th><th className="text-right">Up after 5 days</th><th className="text-right">Target before stop</th></tr></thead>
    <tbody>{data.accuracy.map(a => <tr key={a.side + a.band}><td>{a.side}</td><td>{a.band}</td><td className="text-right">{a.signals}</td><td className="text-right">{a.withOutcome}</td><td className="text-right">{pc(a.sessionClose)}</td><td className="text-right">{pc(a.d1)}</td><td className="text-right">{pc(a.d5)}</td><td className="text-right">{pc(a.d10)}</td><td className="text-right">{a.winD5 === null ? '—' : a.winD5.toFixed(0) + '%'}</td><td className="text-right">{a.targetFirst === null ? '—' : `${a.targetFirst.toFixed(0)}% of ${a.resolved}`}</td></tr>)}</tbody></table></div>
   <p className="text-xs">Returns are in the signal’s direction, before charges. A delivery round trip costs about 0.24% and an intraday one about 0.08%.</p></> : error && <p className="text-sm">{error}</p>}
 </details>;
}
// Today's first sightings at or above the watch level, earliest first.
export function WatchAlerts() {
 const [data, setData] = useState<DiscoveryResponse>(); const [error, setError] = useState('');
 useEffect(() => { let live = true; const load = () => fetchDiscovery().then(d => { if (live) setData(d); }).catch(e => { if (live) setError(e instanceof Error ? e.message : 'Unavailable'); }); load(); const t = setInterval(load, 60000); return () => { live = false; clearInterval(t); }; }, []);
 const rows: Observation[] = (data?.observations ?? []).filter(o => Math.abs(o.max_score) >= (data?.watchAlertScore ?? 60));
 return <section className="card space-y-2"><h2>Watch alerts · Discover score {data?.watchAlertScore ?? 60}+ today</h2>
  <p className="text-sm">The first time each stock reached the watch level today, recorded by the server scanner every minute in market hours. The 10-year replay shows scores of 60–69 are no more accurate than 50–59, so these are a watchlist, not trade signals; their outcomes are tracked under Score accuracy.</p>
  {error && <p className="text-sm">{error}</p>}
  {data && (rows.length ? <div className="overflow-x-auto"><table className="data-table text-sm"><thead><tr><th>First seen</th><th>Stock</th><th>Side</th><th className="text-right">Score (max)</th><th className="text-right">Price then</th><th className="text-right">Move then</th><th>Blocked by guards</th><th></th></tr></thead>
   <tbody>{rows.map(o => <tr key={o.id}><td>{formatIST(o.first_seen_at)}</td><td className="font-semibold">{o.symbol}</td><td>{o.side}</td><td className="text-right">{o.first_score} ({o.max_score})</td><td className="text-right font-mono">{Number(o.first_price).toFixed(2)}</td><td className="text-right">{pc(o.details.changePct)}</td><td>{o.details.blockedReasons.filter(b => !b.startsWith('Quote older')).join('; ') || '—'}</td><td><button className="btn btn-secondary" onClick={() => openAnalysis(o.symbol)}>Analyse</button></td></tr>)}</tbody></table></div> : <p className="text-sm">No stock reached score {data.watchAlertScore} today yet.</p>)}
 </section>;
}
