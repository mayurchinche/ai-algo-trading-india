import { useState } from 'react';
import { shortTermPicks, longTermPicks, smartMoneyInsights } from '../data/picksData';
import type { Pick } from '../data/picksData';

function PickCard({ pick, type }: { pick: Pick; type: 'short' | 'long' }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={type === 'short' ? 'pick-card-short' : 'pick-card-long'}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">{pick.symbol}</span>
            <span className={`badge ${pick.riskLevel === 'LOW' ? 'badge-green' : pick.riskLevel === 'MEDIUM' ? 'badge-amber' : 'badge-red'}`}>
              {pick.riskLevel} RISK
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{pick.name} • {pick.sector}</div>
        </div>
        <div className="score-circle" style={{ borderColor: pick.confidenceScore >= 85 ? 'var(--green)' : pick.confidenceScore >= 75 ? 'var(--gold)' : 'var(--blue)', color: pick.confidenceScore >= 85 ? 'var(--green)' : pick.confidenceScore >= 75 ? 'var(--gold)' : 'var(--blue)' }}>
          {pick.confidenceScore}
        </div>
      </div>

      {/* Price targets */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-[10px] text-[var(--text-secondary)]">CMP</div>
          <div className="text-sm font-bold font-mono">₹{pick.ltp.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-secondary)]">Target</div>
          <div className="text-sm font-bold font-mono text-[var(--green)]">₹{pick.targetPrice.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-secondary)]">Stop Loss</div>
          <div className="text-sm font-bold font-mono text-[var(--red)]">₹{pick.stopLoss.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-secondary)]">Expected Return</div>
          <div className={`text-sm font-bold ${type === 'short' ? 'text-gradient-green' : 'text-gradient-purple'}`}>+{pick.expectedReturn}%</div>
        </div>
      </div>

      {/* Timeframe & Strategies */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="badge badge-cyan">⏱ {pick.timeframe}</span>
        {pick.strategies.map((s, i) => (
          <span key={i} className="reason-tag">{s}</span>
        ))}
      </div>

      {/* Smart Money Signal */}
      <div className="p-2.5 rounded-lg bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)] mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-bold text-[var(--amber)]">🦊 SMART MONEY</span>
        </div>
        <p className="text-[11px] text-[var(--amber)]">{pick.smartMoneySignal}</p>
      </div>

      {/* Reasons (top 3 always shown) */}
      <div className="space-y-1.5 mb-3">
        {pick.reasons.slice(0, expanded ? undefined : 3).map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px]">
            <span className="text-[var(--green)] mt-0.5">✦</span>
            <span className="text-[var(--text)]">{r}</span>
          </div>
        ))}
        {pick.reasons.length > 3 && (
          <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-[var(--purple)] font-medium hover:underline">
            {expanded ? '▲ Show less' : `▼ +${pick.reasons.length - 3} more reasons`}
          </button>
        )}
      </div>

      {/* Institutional Activity */}
      <div className="grid grid-cols-2 gap-2 text-[10px] p-2.5 rounded-lg bg-[var(--bg-alt)]">
        <div><span className="text-[var(--text-secondary)]">FII:</span> <span className="text-[var(--text)] font-medium">{pick.institutionalActivity.fiiAction}</span></div>
        <div><span className="text-[var(--text-secondary)]">DII:</span> <span className="text-[var(--text)] font-medium">{pick.institutionalActivity.diiAction}</span></div>
        <div><span className="text-[var(--text-secondary)]">MF Holding:</span> <span className="text-[var(--text)] font-medium">{pick.institutionalActivity.mutualFundHolding}</span></div>
        <div><span className="text-[var(--text-secondary)]">Promoter:</span> <span className="text-[var(--text)] font-medium">{pick.institutionalActivity.promoterChange}</span></div>
      </div>

      {/* Technicals row */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-[var(--text-secondary)]">
        <span>RSI: <strong className="text-[var(--text)]">{pick.technicals.rsi}</strong></span>
        <span>Trend: <strong className="text-[var(--green)]">{pick.technicals.trend}</strong></span>
        <span>Support: <strong className="text-[var(--text)]">₹{pick.technicals.support.toLocaleString()}</strong></span>
        <span>Resistance: <strong className="text-[var(--text)]">₹{pick.technicals.resistance.toLocaleString()}</strong></span>
      </div>

      {/* Fundamentals (long-term only) */}
      {pick.fundamentals && (
        <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--text-secondary)]">
          <span>P/E: <strong className="text-[var(--text)]">{pick.fundamentals.pe}</strong></span>
          <span>RoE: <strong className="text-[var(--green)]">{pick.fundamentals.roe}%</strong></span>
          <span>D/E: <strong className="text-[var(--text)]">{pick.fundamentals.debtEquity}</strong></span>
          <span>Rev Growth: <strong className="text-[var(--green)]">{pick.fundamentals.revenueGrowth}%</strong></span>
          <span>Profit Growth: <strong className="text-[var(--green)]">{pick.fundamentals.profitGrowth}%</strong></span>
        </div>
      )}

      {/* Catalysts */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {pick.catalysts.map((c, i) => (
          <span key={i} className="badge badge-purple text-[9px]">⚡ {c}</span>
        ))}
      </div>
    </div>
  );
}

export function SmartPicksPage({ stocks: _stocks }: { stocks: import('../services/liveData').LiveStock[] }) {
  const [view, setView] = useState<'short' | 'long' | 'smartmoney'>('short');

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="card flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('short')} className={`btn-filter ${view === 'short' ? 'btn-filter-active-green' : 'btn-filter-inactive'}`}>
            🚀 Short-Term (10-15 Days)
          </button>
          <button onClick={() => setView('long')} className={`btn-filter ${view === 'long' ? 'btn-filter-active-purple' : 'btn-filter-inactive'}`}>
            💎 Long-Term (12-24 Months)
          </button>
          <button onClick={() => setView('smartmoney')} className={`btn-filter ${view === 'smartmoney' ? 'btn-filter-active-amber' : 'btn-filter-inactive'}`}>
            🦊 Smart Money (1% Insights)
          </button>
        </div>
        <div className="text-[11px] text-[var(--text-secondary)]">
          Last updated: 15 Aug 2026, 10:45 IST • AI + Multi-Strategy Analysis
        </div>
      </div>

      {/* Short-term picks */}
      {view === 'short' && (
        <div className="space-y-4">
          <div className="section-header">
            <span className="text-gradient-green">🚀 Short-Term Best Picks</span>
            <span className="badge badge-green">HIGH PROBABILITY</span>
            <span className="text-[11px] text-[var(--text-secondary)] ml-auto">Target: 8-11% in 10-15 trading days</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {shortTermPicks.map((pick) => (
              <PickCard key={pick.symbol} pick={pick} type="short" />
            ))}
          </div>
        </div>
      )}

      {/* Long-term picks */}
      {view === 'long' && (
        <div className="space-y-4">
          <div className="section-header">
            <span className="text-gradient-purple">💎 Long-Term Wealth Builders</span>
            <span className="badge badge-purple">COMPOUNDERS</span>
            <span className="text-[11px] text-[var(--text-secondary)] ml-auto">Target: 30-35% in 12-24 months</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {longTermPicks.map((pick) => (
              <PickCard key={pick.symbol} pick={pick} type="long" />
            ))}
          </div>
        </div>
      )}

      {/* Smart Money insights */}
      {view === 'smartmoney' && (
        <div className="space-y-4">
          <div className="section-header">
            <span className="text-gradient-gold">🦊 How the 1% Are Positioning</span>
            <span className="badge badge-amber">INSTITUTIONAL INTELLIGENCE</span>
          </div>

          {/* Insight cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {smartMoneyInsights.map((item, i) => (
              <div key={i} className="smart-money-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-xs font-bold text-[var(--amber)]">{item.category}</span>
                </div>
                <p className="text-[12px] text-[var(--text)] leading-relaxed">{item.insight}</p>
              </div>
            ))}
          </div>

          {/* The 1% strategy breakdown */}
          <div className="card">
            <h3 className="section-header text-gradient-gold">What Makes the Top 1% Different?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[var(--bg-alt)] border border-[var(--border)]">
                <div className="text-sm font-bold mb-2 text-[var(--amber)]">📐 Position Sizing</div>
                <ul className="space-y-1.5 text-[11px] text-[var(--text)]">
                  <li>• Never risk more than 2% per trade</li>
                  <li>• Concentrated: 8-12 positions max</li>
                  <li>• Scale in: 30% → 30% → 40% on confirmation</li>
                  <li>• Largest position = highest conviction</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-alt)] border border-[var(--border)]">
                <div className="text-sm font-bold mb-2 text-[var(--purple)]">🧠 Information Edge</div>
                <ul className="space-y-1.5 text-[11px] text-[var(--text)]">
                  <li>• Track FII/DII flows daily — not weekly</li>
                  <li>• Monitor bulk deals + insider buying</li>
                  <li>• Read management commentary, not analyst notes</li>
                  <li>• Sector rotation signals before price moves</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-alt)] border border-[var(--border)]">
                <div className="text-sm font-bold mb-2 text-[var(--green)]">⏳ Time Horizon</div>
                <ul className="space-y-1.5 text-[11px] text-[var(--text)]">
                  <li>• Short-term: ride momentum, strict SL</li>
                  <li>• Long-term: buy quality at fair price, hold</li>
                  <li>• Never average down without thesis revalidation</li>
                  <li>• Exit when thesis breaks, not when price drops</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Which stocks the 1% are buying now */}
          <div className="card">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Institutional Top Picks — August 2026</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Who's Buying</th>
                  <th>Action</th>
                  <th className="text-right">Amount (Cr)</th>
                  <th>Thesis</th>
                  <th>Timeframe</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="font-medium">RELIANCE</td><td className="text-[11px]">Blackrock, GIC, Vanguard</td><td><span className="badge badge-green">ACCUMULATE</span></td><td className="text-right font-mono">₹4,200</td><td className="text-[11px]">Jio + Retail dual engine</td><td className="text-[11px]">2-3 years</td></tr>
                <tr><td className="font-medium">HDFCBANK</td><td className="text-[11px]">Goldman Sachs, Morgan Stanley</td><td><span className="badge badge-green">BUY</span></td><td className="text-right font-mono">₹3,800</td><td className="text-[11px]">Post-merger value unlock</td><td className="text-[11px]">18 months</td></tr>
                <tr><td className="font-medium">SBIN</td><td className="text-[11px]">Govt of India (promoter), LIC</td><td><span className="badge badge-green">STRONG BUY</span></td><td className="text-right font-mono">₹2,400</td><td className="text-[11px]">PSU re-rating + NIM expansion</td><td className="text-[11px]">12 months</td></tr>
                <tr><td className="font-medium">TATAMOTORS</td><td className="text-[11px]">HDFC MF, SBI MF, Kotak MF</td><td><span className="badge badge-green">ACCUMULATE</span></td><td className="text-right font-mono">₹1,800</td><td className="text-[11px]">EV leadership + JLR margins</td><td className="text-[11px]">18-24 months</td></tr>
                <tr><td className="font-medium">INFY</td><td className="text-[11px]">Quant funds (contrarian)</td><td><span className="badge badge-amber">WAIT & BUY</span></td><td className="text-right font-mono">₹960</td><td className="text-[11px]">AI capex cycle beneficiary</td><td className="text-[11px]">24 months</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
