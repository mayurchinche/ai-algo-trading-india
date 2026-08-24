import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchLiveIPOs, type IPOData } from '../services/ipoService';
import { getAutoApplySettings, saveAutoApplySettings, getIPOApplications, autoApplyForIPO, type AutoApplySettings, type BrokerConfig } from '../services/ipoAutoApply';

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
  const [filter, setFilter] = useState<'all' | 'open' | 'upcoming' | 'closed' | 'listed' | 'mainboard' | 'sme'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AutoApplySettings>(getAutoApplySettings());
  const [applications] = useState(getIPOApplications());
  const [applyStatus, setApplyStatus] = useState<Record<string, string>>({});

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
    if (filter === 'closed') return ipo.status === 'closed';
    if (filter === 'listed') return ipo.status === 'listed';
    if (filter === 'mainboard') return ipo.board === 'mainboard';
    if (filter === 'sme') return ipo.board === 'sme';
    return true;
  }).sort((a, b) => b.score - a.score);

  const filters = [
    { id: 'all', label: 'All IPOs', count: ipos.length },
    { id: 'open', label: '🟢 Open', count: ipos.filter(i => i.status === 'open').length },
    { id: 'upcoming', label: '🔵 Upcoming', count: ipos.filter(i => i.status === 'upcoming').length },
    { id: 'closed', label: '🟠 Closed', count: ipos.filter(i => i.status === 'closed').length },
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

      {/* Auto-Apply IPO Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">🤖 Auto-Apply IPO</h3>
            <span className={`badge text-[9px] ${settings.enabled && settings.broker ? 'badge-green' : 'badge-amber'}`}>
              {settings.enabled && settings.broker ? '✓ Active' : 'Not Configured'}
            </span>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className="text-xs text-[var(--blue)] font-semibold hover:underline">
            {showSettings ? 'Hide Settings' : '⚙ Configure'}
          </button>
        </div>

        {!showSettings && settings.enabled && settings.broker && (
          <p className="text-xs text-[var(--text-secondary)]">
            Auto-applying for IPOs with AI score ≥ {settings.minScore} via <b>{settings.broker.broker === 'dhan' ? 'Dhan' : settings.broker.broker === 'angel_one' ? 'Angel One' : settings.broker.broker}</b>.
            UPI mandate → <b>{settings.broker.upiId}</b>. Approve on your phone within 30 mins.
          </p>
        )}

        {!showSettings && !settings.broker && (
          <p className="text-xs text-[var(--text-muted)]">
            Configure your broker credentials below to auto-apply for recommended IPOs. You'll receive a UPI mandate request — just approve it on your phone.
          </p>
        )}

        {showSettings && (
          <div className="space-y-4 mt-4 p-4 rounded-xl bg-[var(--bg-alt)] border border-[var(--border)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">Broker</label>
                <select
                  value={settings.broker?.broker || ''}
                  onChange={e => {
                    const b = e.target.value as BrokerConfig['broker'];
                    setSettings({...settings, broker: settings.broker ? {...settings.broker, broker: b} : { broker: b, apiKey: '', clientId: '', upiId: '', password: '' }});
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
                >
                  <option value="">Select Broker</option>
                  <option value="dhan">Dhan (Recommended — Free API)</option>
                  <option value="angel_one">Angel One (SmartAPI)</option>
                  <option value="5paisa">5paisa</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">UPI ID (for mandate)</label>
                <input
                  type="text"
                  placeholder="yourname@upi"
                  value={settings.broker?.upiId || ''}
                  onChange={e => setSettings({...settings, broker: settings.broker ? {...settings.broker, upiId: e.target.value} : null})}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">
                  {settings.broker?.broker === 'dhan' ? 'Access Token' : 'API Key'}
                </label>
                <input
                  type="password"
                  placeholder={settings.broker?.broker === 'dhan' ? 'From Dhan developer portal' : 'From broker developer portal'}
                  value={settings.broker?.apiKey || ''}
                  onChange={e => setSettings({...settings, broker: settings.broker ? {...settings.broker, apiKey: e.target.value} : null})}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">
                  {settings.broker?.broker === 'dhan' ? 'Dhan Client ID' : 'Client ID'}
                </label>
                <input
                  type="text"
                  placeholder="Your demat client ID"
                  value={settings.broker?.clientId || ''}
                  onChange={e => setSettings({...settings, broker: settings.broker ? {...settings.broker, clientId: e.target.value} : null})}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
                />
              </div>
            </div>

            {/* Dhan auto-refresh fields (optional) */}
            {settings.broker?.broker === 'dhan' && (
              <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">🔄 Auto Token Refresh (Optional)</span>
                  {settings.broker.tokenExpiry && (
                    <span className={`badge text-[9px] ${new Date(settings.broker.tokenExpiry).getTime() > Date.now() ? 'badge-green' : 'badge-red'}`}>
                      {new Date(settings.broker.tokenExpiry).getTime() > Date.now()
                        ? `Valid until ${new Date(settings.broker.tokenExpiry).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                        : 'Expired — needs refresh'}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mb-3">
                  Provide your Dhan PIN + TOTP secret to auto-regenerate tokens. Without these, you'll need to paste a new token from Dhan portal every 24h.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">Dhan PIN (4-digit)</label>
                    <input
                      type="password"
                      placeholder="••••"
                      maxLength={4}
                      value={settings.broker?.password || ''}
                      onChange={e => setSettings({...settings, broker: settings.broker ? {...settings.broker, password: e.target.value} : null})}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">TOTP Secret</label>
                    <input
                      type="password"
                      placeholder="From authenticator app setup"
                      value={settings.broker?.totpSecret || ''}
                      onChange={e => setSettings({...settings, broker: settings.broker ? {...settings.broker, totpSecret: e.target.value} : null})}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">Min AI Score</label>
                <input
                  type="number"
                  min={0} max={100}
                  value={settings.minScore}
                  onChange={e => setSettings({...settings, minScore: +e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">Max Lots</label>
                <input
                  type="number"
                  min={1} max={15}
                  value={settings.maxLots}
                  onChange={e => setSettings({...settings, maxLots: +e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settings.autoApplyMainboard} onChange={e => setSettings({...settings, autoApplyMainboard: e.target.checked})} className="rounded" />
                <span className="text-xs">Mainboard</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settings.autoApplySME} onChange={e => setSettings({...settings, autoApplySME: e.target.checked})} className="rounded" />
                <span className="text-xs">SME</span>
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  const updated = {...settings, enabled: true};
                  setSettings(updated);
                  saveAutoApplySettings(updated);
                  setShowSettings(false);
                }}
                disabled={!settings.broker?.upiId || !settings.broker?.apiKey || !settings.broker?.clientId}
                className="px-4 py-2 rounded-lg bg-[var(--green)] text-white text-xs font-semibold disabled:opacity-40"
              >
                ✓ Enable Auto-Apply
              </button>
              {settings.enabled && (
                <button
                  onClick={() => {
                    const updated = {...settings, enabled: false};
                    setSettings(updated);
                    saveAutoApplySettings(updated);
                  }}
                  className="px-4 py-2 rounded-lg bg-[var(--red-bg)] text-[var(--red)] text-xs font-semibold"
                >
                  Disable
                </button>
              )}
              <span className="text-[10px] text-[var(--text-muted)]">Credentials stored locally only</span>
            </div>
          </div>
        )}

        {/* Token Expired Warning */}
        {settings.enabled && settings.broker?.broker === 'dhan' && applications.some(a => a.error?.includes('403')) && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-red-700 font-semibold">⚠️ Dhan token expired (HTTP 403)</p>
            <p className="text-[10px] text-red-600 mt-1">
              Generate a new token → <a href="https://api.dhan.co" target="_blank" rel="noopener" className="underline font-semibold">api.dhan.co</a> → paste it in Access Token above.
              {!settings.broker.password && <span className="block mt-1">💡 Tip: Add your PIN + TOTP secret above to enable auto-refresh.</span>}
            </p>
          </div>
        )}

        {/* Application History */}
        {applications.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <h4 className="text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-2">Recent Applications</h4>
            <div className="space-y-2">
              {applications.slice(-5).reverse().map(app => (
                <div key={app.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg)]">
                  <div>
                    <span className="text-xs font-semibold">{app.ipoName}</span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-2">{app.lots} lot @ ₹{app.bidPrice}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge text-[9px] ${app.status === 'PENDING_MANDATE' ? 'badge-amber' : app.status === 'APPLIED' || app.status === 'ALLOTTED' ? 'badge-green' : app.status === 'FAILED' ? 'badge-red' : 'badge-blue'}`}>
                      {app.status === 'PENDING_MANDATE' ? '⏳ Approve UPI' : app.status === 'APPLIED' ? '✓ Applied' : app.status === 'ALLOTTED' ? '🎉 Allotted' : app.status === 'FAILED' ? '✗ Failed' : app.status}
                    </span>
                    {app.error && <span className="text-[9px] text-[var(--red)] max-w-[200px] truncate" title={app.error}>({app.error})</span>}
                    <span className="text-[9px] text-[var(--text-muted)]">{new Date(app.appliedAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual Apply Button for Open IPOs */}
      {ipos.filter(i => i.status === 'open').length > 0 && settings.enabled && settings.broker && (
        <div className="card bg-[var(--green-bg)] border border-[var(--green-border)]">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-[var(--green)]">Open IPOs Ready to Apply</h4>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Click to manually trigger application for any open IPO below</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap mt-3">
            {ipos.filter(i => i.status === 'open' && i.score >= settings.minScore).map(ipo => (
              <button
                key={ipo.name}
                disabled={applyStatus[ipo.name] === 'applying' || applications.some(a => a.symbol === ipo.name && a.status !== 'FAILED')}
                onClick={async () => {
                  setApplyStatus(s => ({...s, [ipo.name]: 'applying'}));
                  await autoApplyForIPO({
                    name: ipo.name,
                    symbol: ipo.name,
                    price: ipo.price || 0,
                    lotSize: ipo.lot_size || 1,
                    score: ipo.score,
                    type: ipo.board as 'mainboard' | 'sme',
                  });
                  setApplyStatus(s => ({...s, [ipo.name]: 'done'}));
                }}
                className="px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--green-border)] text-xs font-semibold hover:shadow-md transition-all disabled:opacity-40"
              >
                {applyStatus[ipo.name] === 'applying' ? '⏳' : applyStatus[ipo.name] === 'done' ? '✓' : '🚀'} {ipo.name}
                <span className="text-[9px] text-[var(--text-muted)] ml-1">(Score: {ipo.score})</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
                  <span className="text-[10px] text-[var(--text-muted)]">Sub:</span>
                  <span className="text-xs font-bold text-purple-600">{ipo.subscription_total.toFixed(2)}x</span>
                  {ipo.subscription_qib != null && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      QIB {ipo.subscription_qib.toFixed(1)}x • NII {ipo.subscription_nii?.toFixed(1)}x • RII {ipo.subscription_rii?.toFixed(1)}x
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
                {/* Live Subscription Breakdown */}
                {ipo.subscription_qib != null && (
                  <div>
                    <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-2">📊 Live Subscription Status</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-3 rounded-xl bg-[var(--bg-alt)]">
                        <div className={`text-base font-bold ${(ipo.subscription_total || 0) > 1 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>
                          {ipo.subscription_total?.toFixed(2)}x
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase mt-1">Total</div>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-[var(--bg-alt)]">
                        <div className={`text-base font-bold ${(ipo.subscription_qib || 0) > 1 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>
                          {ipo.subscription_qib?.toFixed(2)}x
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase mt-1">QIB</div>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-[var(--bg-alt)]">
                        <div className={`text-base font-bold ${(ipo.subscription_nii || 0) > 1 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>
                          {ipo.subscription_nii?.toFixed(2)}x
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase mt-1">NII</div>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-[var(--bg-alt)]">
                        <div className={`text-base font-bold ${(ipo.subscription_rii || 0) > 1 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>
                          {ipo.subscription_rii?.toFixed(2)}x
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase mt-1">Retail</div>
                      </div>
                      {ipo.subscription_shni != null && (
                        <div className="text-center p-3 rounded-xl bg-[var(--bg-alt)]">
                          <div className="text-base font-bold text-[var(--text)]">
                            {ipo.subscription_shni?.toFixed(2)}x / {ipo.subscription_bhni?.toFixed(2)}x
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
        Live data from InvestorGain • Refreshes every 60s • GMP is grey market premium (unregulated & indicative only) • Not investment advice
      </div>
    </div>
  );
}
