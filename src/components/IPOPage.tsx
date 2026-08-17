import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchLiveIPOs, type IPOData } from '../services/ipoService';

function ScoreBadge({ score, recommendation }: { score: number; recommendation: string }) {
  const color = score >= 70 ? 'from-green-500 to-emerald-600' : score >= 50 ? 'from-blue-500 to-indigo-600' : score >= 35 ? 'from-amber-500 to-orange-600' : 'from-red-500 to-rose-600';
  return (
    <div className="flex items-center gap-2">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
        {score}
      </div>
      <span className={`text-xs font-bold ${score >= 70 ? 'text-[var(--green)]' : score >= 50 ? 'text-[var(--blue)]' : score >= 35 ? 'text-amber-500' : 'text-[var(--red)]'}`}>
        {recommendation}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-green-100 text-green-700 border-green-200',
    upcoming: 'bg-blue-100 text-blue-700 border-blue-200',
    listed: 'bg-purple-100 text-purple-700 border-purple-200',
    closed: 'bg-gray-100 text-gray-600 border-gray-200',
    unknown: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const icons: Record<string, string> = { open: '🟢', upcoming: '🔵', listed: '🟣', closed: '⚪', unknown: '⚪' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[status] || styles.unknown}`}>
      {icons[status] || '⚪'} {status}
    </span>
  );
}

export function IPOPage() {
  const [ipos, setIpos] = useState<IPOData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'upcoming' | 'listed' | 'mainboard' | 'sme'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchLiveIPOs();
    setIpos(data);
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
    if (filter === 'listed') return ipo.status === 'listed';
    if (filter === 'mainboard') return ipo.board === 'mainboard';
    if (filter === 'sme') return ipo.board === 'sme';
    return true;
  }).sort((a, b) => b.score - a.score);

  const filters = [
    { id: 'all', label: 'All IPOs', count: ipos.length },
    { id: 'open', label: '🟢 Open', count: ipos.filter(i => i.status === 'open').length },
    { id: 'upcoming', label: '🔵 Upcoming', count: ipos.filter(i => i.status === 'upcoming').length },
    { id: 'listed', label: '🟣 Listed', count: ipos.filter(i => i.status === 'listed').length },
    { id: 'mainboard', label: 'Mainboard', count: ipos.filter(i => i.board === 'mainboard').length },
    { id: 'sme', label: 'SME', count: ipos.filter(i => i.board === 'sme').length },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
        <div className="card text-center">
          <div className="text-2xl font-bold text-[var(--green)]" style={{ fontFamily: 'Poppins' }}>{ipos.filter(i => i.status === 'open').length}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Open Now</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-[var(--blue)]" style={{ fontFamily: 'Poppins' }}>{ipos.filter(i => i.status === 'upcoming').length}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Upcoming</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-600" style={{ fontFamily: 'Poppins' }}>{ipos.filter(i => i.score >= 70).length}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Strong Apply</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-[var(--text)]" style={{ fontFamily: 'Poppins' }}>{ipos.length}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Total Tracked</div>
        </div>
        <div className="card text-center">
          <div className="text-[11px] text-[var(--text-secondary)]">
            {lastFetch ? `Updated ${lastFetch.toLocaleTimeString('en-IN')}` : '—'}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Live Data</div>
        </div>
      </div>

      {/* Tips */}
      <div className="card bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-l-amber-400">
        <h3 className="text-xs font-bold text-amber-700 mb-1">💡 Top 1% IPO Allocation Tips</h3>
        <ul className="text-[11px] text-amber-800 space-y-0.5">
          <li>• Apply via <b>multiple demat accounts</b> (family members) — each gets independent lottery chance</li>
          <li>• Always apply at <b>cut-off price</b> for mainboard IPOs</li>
          <li>• For SME IPOs, apply in <b>exactly 1 lot</b> — same allotment probability as multiple lots</li>
          <li>• Approve UPI mandate <b>within 30 minutes</b> — delayed mandates get rejected</li>
          <li>• Monitor <b>Day 2 subscription data</b> — QIB &gt;10x is strongest bullish signal</li>
        </ul>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              filter === f.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50'
            }`}
          >
            {f.label} <span className="ml-1 opacity-60">({f.count})</span>
          </button>
        ))}
        <button onClick={load} className="ml-auto text-[11px] text-[var(--blue)] hover:underline font-medium">
          🔄 Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && ipos.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-sm font-semibold">Fetching live IPO data from InvestorGain...</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">GMP, subscription, ratings — all real-time</p>
        </div>
      )}

      {/* No data */}
      {!loading && ipos.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-3xl mb-3">⚠️</div>
          <p className="text-sm font-semibold">Could not fetch live IPO data</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">InvestorGain API may be temporarily unavailable. Data refreshes every 60s.</p>
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
            className="card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setExpanded(expanded === ipo.name ? null : ipo.name)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-sm font-bold text-[var(--text)]">{ipo.name}</h3>
                  <StatusPill status={ipo.status} />
                  {ipo.board === 'sme' && <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">SME</span>}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-[var(--text-secondary)] flex-wrap">
                  {ipo.open_date && <span>📅 {ipo.open_date}{ipo.close_date ? ` → ${ipo.close_date}` : ''}</span>}
                  {ipo.price && <span>💰 ₹{ipo.price}</span>}
                  {ipo.lot_size && <span>📦 Lot: {ipo.lot_size}</span>}
                  {ipo.issue_size_cr && <span>📊 ₹{ipo.issue_size_cr}cr</span>}
                  {ipo.pe_ratio && <span>P/E: {ipo.pe_ratio.toFixed(1)}x</span>}
                </div>
              </div>
              <ScoreBadge score={ipo.score} recommendation={ipo.recommendation} />
            </div>

            {/* GMP & Subscription */}
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              {ipo.gmp != null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--text-muted)]">GMP:</span>
                  <span className={`text-xs font-bold ${(ipo.gmp_pct || 0) > 30 ? 'text-[var(--green)]' : (ipo.gmp_pct || 0) > 10 ? 'text-[var(--blue)]' : 'text-[var(--text-secondary)]'}`}>
                    ₹{ipo.gmp} {ipo.gmp_pct != null && `(${ipo.gmp_pct.toFixed(1)}%)`}
                  </span>
                </div>
              )}
              {ipo.subscription_total != null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--text-muted)]">Subscription:</span>
                  <span className="text-xs font-bold text-purple-600">{ipo.subscription_total.toFixed(1)}x</span>
                </div>
              )}
              {ipo.rating != null && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--text-muted)]">Rating:</span>
                  <span className="text-xs">{'🔥'.repeat(ipo.rating)}</span>
                </div>
              )}
              {ipo.listing_gain_pct != null && (
                <div className="flex items-center gap-1.5">
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
        Live data from InvestorGain • Refreshes every 60s • GMP is grey market premium (unregulated & indicative only) • Not investment advice
      </div>
    </div>
  );
}
