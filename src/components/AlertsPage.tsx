import { useEffect, useState } from 'react';
import { SharedOpportunityFeed } from './SharedOpportunityFeed';
import { fetchSignals, type SignalsResponse } from '../services/signals';
import { navigateTo, openAnalysis } from '../services/specDraft';
import { formatIST } from '../services/tradingTime';

// Validated strategy signals of the last sessions, shown above the intraday strong-signal feed.
function ValidatedAlerts() {
 const [data, setData] = useState<SignalsResponse>(); const [error, setError] = useState('');
 useEffect(() => { let live = true; const load = () => fetchSignals().then(d => { if (live) { setData(d); setError(''); } }).catch(e => { if (live) setError(e instanceof Error ? e.message : 'Signals unavailable'); }); load(); const t = setInterval(load, 60000); return () => { live = false; clearInterval(t); }; }, []);
 const rows = (data?.signals ?? []).slice(0, 20), near = (data?.board?.rows ?? []).filter(r => r.state === 'NEAR_TRIGGER');
 return <section className="card space-y-2"><div className="page-title"><div><h2>Validated strategy alerts</h2><p>Signals from rules that passed validation after charges. Active ones are paper-traded automatically.</p></div><button className="btn btn-secondary" onClick={() => navigateTo('Signals')}>All signals</button></div>
  {error && <p className="notice">{error}</p>}
  {rows.length ? <div className="overflow-x-auto"><table className="data-table text-sm"><thead><tr><th>Stock</th><th>Strategy</th><th>Segment</th><th>Signal close</th><th className="text-right">Price</th><th>Status</th><th></th></tr></thead>
   <tbody>{rows.map(s => <tr key={s.id}><td className="font-semibold">{s.symbol}</td><td>{s.strategyName}</td><td>{s.segment}</td><td>{formatIST(new Date(s.barTime).toISOString()).split(' at ')[0]}</td><td className="text-right font-mono">{s.close.toFixed(2)}</td><td><span className={`badge ${s.status === 'ACTIVE' ? 'badge-green' : ''}`}>{s.status === 'ACTIVE' ? 'Active' : 'Expired'}</span></td><td><button className="btn btn-secondary" onClick={() => openAnalysis(s.symbol)}>Analyse</button></td></tr>)}</tbody></table></div> : data && <p className="text-sm">No validated signals in the last sessions.</p>}
  {!!near.length && <p className="text-sm"><strong>Near a trigger:</strong> {near.map(r => `${r.symbol} (${r.strategyName}, ${r.trigger!.distancePct.toFixed(1)}% away)`).join(' · ')}</p>}
 </section>;
}
export function AlertsPage({ onOpen }: { onOpen?: (id: string) => void }) {
 return <div className="space-y-4">
  <ValidatedAlerts />
  <section className="card"><h1>Intraday strong-signal alerts</h1><p>The server scanner checks the most active NSE stocks every minute in market hours and records a signal when its composite technical score reaches 70 of 100. A popup appears while the app is open. Popup dismissals are local to this app session. No background notifications.</p><p>The composite score is a research reference, not a validated strategy: it has not been shown to be profitable after charges.</p></section>
  <SharedOpportunityFeed onOpen={onOpen} title="Recorded strong signals" />
 </div>;
}
