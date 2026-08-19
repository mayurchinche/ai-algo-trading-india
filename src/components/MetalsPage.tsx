import { useState, useEffect } from 'react';
import { fetchLiveMetals, type LiveMetal } from '../services/metalsService';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const signalStyles: Record<string, string> = {
  'STRONG BUY': 'badge-green',
  'BUY': 'badge-blue',
  'HOLD': 'badge-amber',
  'SELL': 'badge-red',
  'STRONG SELL': 'badge-red',
};

const ALLOCATION: Record<string, { allocation: string; risk: string; horizon: string; bestFor: string }> = {
  Gold: { allocation: '10-15%', risk: 'Low', horizon: '1-5 years', bestFor: 'Inflation hedge, portfolio insurance' },
  Silver: { allocation: '5-8%', risk: 'Medium', horizon: '1-3 years', bestFor: 'Higher beta gold proxy + industrial growth' },
  Platinum: { allocation: '2-4%', risk: 'Medium-High', horizon: '2-5 years', bestFor: 'Hydrogen economy bet, contrarian value' },
  Copper: { allocation: '3-5%', risk: 'Medium', horizon: '1-3 years', bestFor: 'Energy transition, India infra play' },
  Palladium: { allocation: '0-2%', risk: 'High', horizon: 'N/A', bestFor: 'Speculative only — structural decline' },
};

export function MetalsPage() {
  const [metals, setMetals] = useState<LiveMetal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('Gold');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadMetals = async () => {
    setLoading(true);
    try {
      const data = await fetchLiveMetals();
      setMetals(data);
      setLastUpdated(new Date());
      if (data.length > 0 && !data.find(m => m.name === selected)) setSelected(data[0].name);
    } catch (e) { console.error('Failed to load metals:', e); }
    setLoading(false);
  };

  useEffect(() => { loadMetals(); }, []);

  const activeMetal = metals.find(m => m.name === selected);

  if (loading && metals.length === 0) {
    return <div className="card text-center py-16"><p className="text-sm text-[var(--text-secondary)]">Loading live metal prices from Yahoo Finance...</p></div>;
  }

  return (
    <div className="space-y-5">
      {/* Metal selector */}
      <div className="card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {metals.map((m) => (
            <button
              key={m.name}
              onClick={() => setSelected(m.name)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selected === m.name
                  ? 'bg-[var(--blue)] text-white shadow-lg shadow-blue-200'
                  : 'bg-[var(--bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-alt)] hover:text-[var(--text)]'
              }`}
              style={{ fontFamily: 'Poppins' }}
            >
              <span>{m.icon}</span>
              <span>{m.name}</span>
              <span className={`text-xs font-bold ${m.change24hPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'} ${selected === m.name ? '!text-white/80' : ''}`}>
                {m.change24hPct >= 0 ? '+' : ''}{m.change24hPct}%
              </span>
            </button>
          ))}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          Live prices • Gold/Silver: Indian retail (GoodReturns) • Others: COMEX converted
          {lastUpdated && <span className="ml-2">Updated: {lastUpdated.toLocaleTimeString('en-IN')}</span>}
        </div>
        <button onClick={loadMetals} disabled={loading} className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50">
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {metals.map((m) => (
          <div key={m.name} className={`card cursor-pointer transition-all ${selected === m.name ? 'ring-2 ring-[var(--blue)] shadow-lg' : ''}`} onClick={() => setSelected(m.name)}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{m.icon}</span>
              <span className="text-sm font-bold" style={{ fontFamily: 'Poppins' }}>{m.name}</span>
            </div>
            <div className="text-lg font-bold" style={{ fontFamily: 'Poppins' }}>
              ₹{m.pricePerGram.toLocaleString()}<span className="text-xs text-[var(--text-muted)] font-normal">/g</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-bold ${m.change24hPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                {m.change24hPct >= 0 ? '▲' : '▼'} {Math.abs(m.change24hPct)}%
              </span>
              <span className={`badge text-[9px] ${signalStyles[m.signal]}`}>{m.signal}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail section for selected metal */}
      {activeMetal ? (<div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Chart + Price details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Price chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ fontFamily: 'Poppins' }}>
                {activeMetal.icon} {activeMetal.name} — 30 Day Trend
              </h3>
              <div className="flex items-center gap-3">
                <span className={`badge ${signalStyles[activeMetal.signal]}`}>{activeMetal.signal}</span>
                <span className="text-xs text-[var(--text-muted)]">AI Score: <strong className={activeMetal.aiScore >= 75 ? 'text-[var(--green)]' : activeMetal.aiScore >= 50 ? 'text-[var(--amber)]' : 'text-[var(--red)]'}>{activeMetal.aiScore}/100</strong></span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={activeMetal?.priceHistory || []}>
                <defs>
                  <linearGradient id="gMetal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} domain={['dataMin - 50', 'dataMax + 50']} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 12 }} formatter={(v) => [`₹${Number(v).toLocaleString()}`, '']} />
                <Area type="monotone" dataKey="price" stroke="#2563EB" fill="url(#gMetal)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Performance table */}
          <div className="card">
            <h3 className="text-sm font-bold mb-3" style={{ fontFamily: 'Poppins' }}>Performance</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-[var(--bg)]">
                <div className="text-xs text-[var(--text-muted)] mb-1">24H Change</div>
                <div className={`text-base font-bold ${activeMetal.change24hPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`} style={{ fontFamily: 'Poppins' }}>
                  {activeMetal.change24hPct >= 0 ? '+' : ''}{activeMetal.change24hPct}%
                </div>
                <div className="text-xs text-[var(--text-muted)]">{activeMetal.change24h >= 0 ? '+' : ''}₹{activeMetal.change24h}/g</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg)]">
                <div className="text-xs text-[var(--text-muted)] mb-1">7 Days</div>
                <div className={`text-base font-bold ${activeMetal.change7dPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`} style={{ fontFamily: 'Poppins' }}>
                  {activeMetal.change7dPct >= 0 ? '+' : ''}{activeMetal.change7dPct}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg)]">
                <div className="text-xs text-[var(--text-muted)] mb-1">30 Days</div>
                <div className={`text-base font-bold ${activeMetal.change30dPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`} style={{ fontFamily: 'Poppins' }}>
                  {activeMetal.change30dPct >= 0 ? '+' : ''}{activeMetal.change30dPct}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg)]">
                <div className="text-xs text-[var(--text-muted)] mb-1">SMA 20</div>
                <div className="text-base font-bold" style={{ fontFamily: 'Poppins' }}>
                  ₹{activeMetal.sma20.toLocaleString()}/g
                </div>
              </div>
            </div>
          </div>

          {/* Why Buy/Sell - Detailed Reasons */}
          <div className={`card border-l-4 ${activeMetal.signal.includes('BUY') ? 'border-l-[var(--green)]' : activeMetal.signal === 'HOLD' ? 'border-l-[var(--amber)]' : 'border-l-[var(--red)]'}`}>
            <h3 className="text-sm font-bold mb-3" style={{ fontFamily: 'Poppins' }}>
              {activeMetal.signal.includes('BUY') ? '📈' : activeMetal.signal === 'HOLD' ? '⏸️' : '📉'} Why {activeMetal.signal}?
            </h3>
            <div className="space-y-2.5">
              {activeMetal.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 text-sm ${activeMetal.signal.includes('BUY') ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {i + 1}.
                  </span>
                  <span className="text-[var(--text)]">{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Key data + Investment thesis */}
        <div className="space-y-5">
          {/* Price details */}
          <div className="card">
            <h3 className="text-sm font-bold mb-3" style={{ fontFamily: 'Poppins' }}>
              {activeMetal.icon} {activeMetal.name} Price
            </h3>
            <div className="text-3xl font-bold mb-1" style={{ fontFamily: 'Poppins' }}>
              ₹{activeMetal.pricePerGram.toLocaleString()}<span className="text-sm text-[var(--text-muted)] font-normal">/gram</span>
            </div>
            <div className="text-sm text-[var(--text-secondary)] mb-1">
              ₹{activeMetal.pricePerOz.toLocaleString()}/troy oz • ${activeMetal.priceUSD}/oz
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mb-4">
              Source: {activeMetal.priceSource}
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[var(--border-light)]">
                <span className="text-[var(--text-secondary)]">Trend</span>
                <span className={`font-semibold ${activeMetal.trend === 'Uptrend' ? 'text-[var(--green)]' : activeMetal.trend === 'Downtrend' ? 'text-[var(--red)]' : 'text-[var(--amber)]'}`}>{activeMetal.trend}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-light)]">
                <span className="text-[var(--text-secondary)]">RSI</span>
                <span className={`font-semibold ${activeMetal.rsi > 70 ? 'text-[var(--red)]' : activeMetal.rsi < 30 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>{activeMetal.rsi}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-light)]">
                <span className="text-[var(--text-secondary)]">Support</span>
                <span className="font-semibold">₹{activeMetal.support.toLocaleString()}/g</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-light)]">
                <span className="text-[var(--text-secondary)]">Resistance</span>
                <span className="font-semibold">₹{activeMetal.resistance.toLocaleString()}/g</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-light)]">
                <span className="text-[var(--text-secondary)]">52W High</span>
                <span className="font-semibold">₹{activeMetal.high52w.toLocaleString()}/g</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[var(--text-secondary)]">52W Low</span>
                <span className="font-semibold">₹{activeMetal.low52w.toLocaleString()}/g</span>
              </div>
            </div>
          </div>

          {/* Investment thesis */}
          <div className="card bg-[var(--blue-bg)] border-[var(--blue-border)]">
            <h3 className="text-sm font-bold mb-2 text-[var(--blue)]" style={{ fontFamily: 'Poppins' }}>💡 Investment Thesis</h3>
            <p className="text-sm text-[var(--text)] leading-relaxed">{activeMetal.investmentThesis}</p>
          </div>

          {/* Best form to invest */}
          <div className="card bg-[var(--purple-bg)] border-[var(--purple-border)]">
            <h3 className="text-sm font-bold mb-2 text-[var(--purple)]" style={{ fontFamily: 'Poppins' }}>🏆 Best Way to Invest</h3>
            <p className="text-sm text-[var(--text)]">{activeMetal.bestForm}</p>
          </div>

          {/* AI Outlook */}
          <div className="card">
            <h3 className="text-sm font-bold mb-2" style={{ fontFamily: 'Poppins' }}>🤖 AI Outlook</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{activeMetal.investmentThesis}</p>
          </div>
        </div>
      </div>) : null}

      {/* Portfolio allocation recommendation */}
      <div className="card">
        <h3 className="text-base font-bold mb-4" style={{ fontFamily: 'Poppins' }}>📊 Recommended Metals Allocation</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Metal</th>
              <th>Allocation</th>
              <th>Risk Level</th>
              <th>Horizon</th>
              <th>Best For</th>
              <th>Current Signal</th>
            </tr>
          </thead>
          <tbody>
            {metals.map((m) => {
              const alloc = ALLOCATION[m.name] || { allocation: '0%', risk: 'High', horizon: 'N/A', bestFor: '' };
              return (
                <tr key={m.name}>
                  <td className="font-semibold">{m.icon} {m.name}</td>
                  <td><span className="font-bold text-[var(--blue)]">{alloc.allocation}</span></td>
                  <td>
                    <span className={`badge ${alloc.risk === 'Low' ? 'badge-green' : alloc.risk === 'Medium' ? 'badge-amber' : 'badge-red'}`}>
                      {alloc.risk}
                    </span>
                  </td>
                  <td className="text-[var(--text-secondary)]">{alloc.horizon}</td>
                  <td className="text-[var(--text-secondary)] text-xs">{alloc.bestFor}</td>
                  <td><span className={`badge ${signalStyles[m.signal]}`}>{m.signal}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
