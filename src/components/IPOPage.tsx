import { formatIST } from '../services/tradingTime';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchLiveIPOs, getLastIPOFetchError, type IPOData } from '../services/ipoService';

function ScoreBadge({ score, recommendation }: { score: number | null; recommendation: string }) {
  if (score === null) return <span className="badge badge-amber">Insufficient data</span>;
  const tone = score >= 70 ? 'badge-green' : score >= 50 ? 'badge-blue' : score >= 35 ? 'badge-amber' : 'badge-red';
  return (
    <div className="ipo-score flex items-center gap-2">
      <div className={`badge ${tone} w-10 h-10 shrink-0 !p-0 justify-center !rounded-xl text-sm font-mono`}>
        {score}
      </div>
      <span className={`text-xs font-bold ${score >= 70 ? 'text-[var(--green)]' : score >= 50 ? 'text-[var(--blue)]' : score >= 35 ? 'text-[var(--amber)]' : 'text-[var(--red)]'}`}>
        {recommendation}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = { open: 'badge-green', upcoming: 'badge-blue', listed: 'badge-purple', closed: '', unknown: '' };
  return <span className={`badge ${tone[status] ?? ''} uppercase !text-[10px]`}>{status}</span>;
}

export function IPOPage() {
  const [ipos, setIpos] = useState<IPOData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'upcoming' | 'closed' | 'listed' | 'mainboard' | 'sme'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchLiveIPOs();
    setIpos(data);
    setFetchError(getLastIPOFetchError());
    setLastFetch(new Date());
    setLoading(false);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000); // refresh every 60s
    return () => clearInterval(timer);
  }, []);

  const filtered = ipos.filter(ipo => {
    if (filter === 'all') return true;
    if (filter === 'open') return ipo.status === 'open';
    if (filter === 'upcoming') return ipo.status === 'upcoming';
    if (filter === 'closed') return ipo.status === 'closed';
    if (filter === 'listed') return ipo.status === 'listed';
    if (filter === 'mainboard') return ipo.board === 'mainboard';
    if (filter === 'sme') return ipo.board === 'sme';
    return true;
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const filters = [
    { id: 'all', label: 'All IPOs', count: ipos.length },
    { id: 'open', label: 'Open', count: ipos.filter(i => i.status === 'open').length },
    { id: 'upcoming', label: 'Upcoming', count: ipos.filter(i => i.status === 'upcoming').length },
    { id: 'closed', label: 'Closed', count: ipos.filter(i => i.status === 'closed').length },
    { id: 'listed', label: 'Listed', count: ipos.filter(i => i.status === 'listed').length },
    { id: 'mainboard', label: 'Mainboard', count: ipos.filter(i => i.board === 'mainboard').length },
    { id: 'sme', label: 'SME', count: ipos.filter(i => i.board === 'sme').length },
  ];

  return (
    <div className="space-y-6">
      <div className="page-title"><div><h2>IPO analysis</h2><p>Mainboard and SME issues with grey-market premium, subscription and our research score. Third-party observations, not listing forecasts.</p></div>
       <button className="btn btn-secondary" onClick={load}>Refresh</button></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
       {([['Open now', ipos.filter(i => i.status === 'open').length], ['Upcoming', ipos.filter(i => i.status === 'upcoming').length], ['High research score', ipos.filter(i => i.recommendation === 'High research score').length], ['Total tracked', ipos.length]] as const).map(([label, n]) => <div key={label} className="metric-tile"><span className="text-xs muted">{label}</span><strong className="font-mono text-xl">{n}</strong></div>)}
       <div className="metric-tile"><span className="text-xs muted">Last fetch attempt</span><strong className="text-sm">{lastFetch ? lastFetch.toLocaleTimeString('en-IN') : '—'}</strong></div>
      </div>

      <section className="card space-y-2"><h3>IPO research only</h3><p>GMP is an unofficial third-party observation. The score is an unvalidated ranking, not a listing-gain forecast. Verify offer documents, lot size, category and mandate deadlines with your broker.</p><p>Broker applications are unavailable: no verified execution integration is connected. This app does not collect broker PINs, tokens or TOTP secrets.</p></section>

      {/* Filters */}
      <nav className="segment-selector" aria-label="IPO filter">
        {filters.map(f => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id as typeof filter)}>{f.label}<small>{f.count}</small></button>)}
      </nav>

      {/* Loading */}
      {loading && ipos.length === 0 && (
        <div className="card text-center py-12">
          
          <p className="text-sm font-semibold">Fetching IPO observations from InvestorGain...</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Provider-reported GMP, subscription and ratings snapshots</p>
        </div>
      )}

      {/* No data */}
      {!loading && ipos.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-3xl mb-3">⚠️</div>
          <p className="text-sm font-semibold">IPO data unavailable</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{fetchError || 'InvestorGain API may be temporarily unavailable. Data refreshes every 60s.'}</p>
        </div>
      )}

      {/* IPO Cards */}
      <div className="space-y-5">
        {filtered.map((ipo, idx) => (
          <motion.div
            key={ipo.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="card ipo-card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setExpanded(expanded === ipo.name ? null : ipo.name)}
          >
            <div className="ipo-card-heading">
              <div className="ipo-identity">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="ipo-company-name text-sm font-bold text-[var(--text)]">{ipo.name}</h3>
                  <StatusPill status={ipo.status} />
                  {ipo.board === 'sme' && <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">SME</span>}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-[var(--text-secondary)] flex-wrap">
                  {ipo.open_date && <span>{ipo.open_date}{ipo.close_date ? ` → ${ipo.close_date}` : ''}</span>}
                  {ipo.price && <span>₹{ipo.price}</span>}
                  {ipo.lot_size && <span>Lot: {ipo.lot_size}</span>}
                  {ipo.issue_size_cr && <span>₹{ipo.issue_size_cr}cr</span>}
                  {ipo.pe_ratio && <span>P/E: {ipo.pe_ratio.toFixed(1)}x</span>}
                </div>
              </div>
              <p className="ipo-source text-xs">{ipo.source} · Received: {formatIST(ipo.receivedAt)}</p>
              <ScoreBadge score={ipo.score} recommendation={ipo.recommendation} />
            </div>

            {/* GMP & Subscription */}
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              {ipo.gmp != null && (
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)]">GMP:</span>
                  <span className={`text-xs font-bold ${(ipo.gmp_pct || 0) > 30 ? 'text-[var(--green)]' : (ipo.gmp_pct || 0) > 10 ? 'text-[var(--blue)]' : 'text-[var(--text-secondary)]'}`}>
                    ₹{ipo.gmp} {ipo.gmp_pct != null && `(${ipo.gmp_pct.toFixed(1)}%)`}
                  </span>
                </div>
              )}
              {ipo.subscription_total != null && (
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)]">Sub:</span>
                  <span className="text-xs font-bold text-[var(--text)]">{ipo.subscription_total.toFixed(2)}x</span>
                  {ipo.subscription_qib != null && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      QIB {ipo.subscription_qib.toFixed(1)}x • NII {ipo.subscription_nii == null ? 'Unavailable' : ipo.subscription_nii.toFixed(1) + 'x'} • RII {ipo.subscription_rii == null ? 'Unavailable' : ipo.subscription_rii.toFixed(1) + 'x'}
                    </span>
                  )}
                  {ipo.subscription_updated && (
                    <span className="text-[9px] text-[var(--text-muted)] opacity-60">({ipo.subscription_updated})</span>
                  )}
                </div>
              )}
              {ipo.rating != null && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--text-muted)]">Rating:</span>
                  <span className="text-xs">{'🔥'.repeat(ipo.rating)}</span>
                </div>
              )}
              {ipo.listing_gain_pct != null && (
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)]">Listed:</span>
                  <span className={`text-xs font-bold ${ipo.listing_gain_pct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {ipo.listing_gain_pct >= 0 ? '+' : ''}{ipo.listing_gain_pct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {/* Expanded */}
            {expanded === ipo.name && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-4 pt-4 border-t border-[var(--border)] space-y-5"
              >
                {/* Live Subscription Breakdown */}
                {ipo.subscription_qib != null && (
                  <div>
                    <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-2">Reported subscription snapshot</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-3 rounded-xl bg-[var(--bg-alt)]">
                        <div className={`text-base font-bold ${(ipo.subscription_total || 0) > 1 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>
                          {ipo.subscription_total == null ? 'Unavailable' : ipo.subscription_total.toFixed(2) + 'x'}
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase mt-1">Total</div>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-[var(--bg-alt)]">
                        <div className={`text-base font-bold ${(ipo.subscription_qib || 0) > 1 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>
                          {ipo.subscription_qib == null ? 'Unavailable' : ipo.subscription_qib.toFixed(2) + 'x'}
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase mt-1">QIB</div>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-[var(--bg-alt)]">
                        <div className={`text-base font-bold ${(ipo.subscription_nii || 0) > 1 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>
                          {ipo.subscription_nii == null ? 'Unavailable' : ipo.subscription_nii.toFixed(2) + 'x'}
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase mt-1">NII</div>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-[var(--bg-alt)]">
                        <div className={`text-base font-bold ${(ipo.subscription_rii || 0) > 1 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>
                          {ipo.subscription_rii == null ? 'Unavailable' : ipo.subscription_rii.toFixed(2) + 'x'}
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase mt-1">Retail</div>
                      </div>
                      {ipo.subscription_shni != null && (
                        <div className="text-center p-3 rounded-xl bg-[var(--bg-alt)]">
                          <div className="text-base font-bold text-[var(--text)]">
                            {ipo.subscription_shni == null ? 'Unavailable' : ipo.subscription_shni.toFixed(2) + 'x'} / {ipo.subscription_bhni == null ? 'Unavailable' : ipo.subscription_bhni.toFixed(2) + 'x'}
                          </div>
                          <div className="text-[9px] text-[var(--text-muted)] uppercase mt-1">sHNI / bHNI</div>
                        </div>
                      )}
                    </div>
                    {ipo.subscription_updated && (
                      <p className="text-[9px] text-[var(--text-muted)] mt-2">Last updated: {ipo.subscription_updated}</p>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1.5">AI Analysis</h4>
                  <ul className="space-y-1">
                    {ipo.reasons.map((r, i) => (
                      <li key={i} className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                        <span className="text-blue-500 mt-0.5">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1.5">🎯 Allocation Tips</h4>
                  <ul className="space-y-1">
                    {ipo.allotment_tips.map((t, i) => (
                      <li key={i} className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">→</span> {t}
                      </li>
                    ))}
                  </ul>
                </div>
                {ipo.url && (
                  <a href={ipo.url} target="_blank" rel="noopener" className="text-[11px] text-[var(--blue)] hover:underline">
                    View full details on InvestorGain →
                  </a>
                )}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="text-[10px] text-[var(--text-muted)] text-center mt-6">
        Third-party observations from InvestorGain • Refreshes every 60s • GMP is grey market premium (unregulated & indicative only) • Not investment advice
      </div>
    </div>
  );
}
