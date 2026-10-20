import { formatIST } from '../services/tradingTime';
import { useState } from 'react';
import { useStockDiscovery } from '../hooks/useStockDiscovery';
import type { DiscoveredStock } from '../services/stockDiscovery';
import { OPTIONS_UNAVAILABLE } from '../services/optionsEngine';

// Factor scores run from −100 to +100; the bar grows from the centre line in the score's direction.
function FactorBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(-100, Math.min(100, value));
  return (
    <div className="factor-row">
      <span>{label}</span>
      <div className="diverging" role="img" aria-label={`${label} ${Math.round(v)}`}><span className={v >= 0 ? 'up' : 'down'} style={{ width: `${Math.abs(v) / 2}%` }} /></div>
      <b>{Math.round(v)}</b>
    </div>
  );
}

function SignalBadge({ signal }: { signal: DiscoveredStock['signal'] }) {
  const cls = signal === 'STRONG_BUY' || signal === 'BUY' ? 'badge-green'
    : signal === 'SELL' || signal === 'STRONG_SELL' ? 'badge-red' : 'badge-amber';
  return <span className={`badge ${cls}`}>{signal.replace('_', ' ')}</span>;
}

const inr = (n: number, d = 2) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: d });
const signed = (n: number, d = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;

function StockCard({ stock, variant }: { stock: DiscoveredStock; variant: 'short' | 'long' | 'smart' }) {
  const fo = stock.foAnalysis, ltp = stock.ltp;
  const fromLtp = (level: number) => ltp > 0 ? (level / ltp - 1) * 100 : 0;
  const score = Math.round(stock.overallScore);
  const scoreTone = stock.overallScore >= 70 ? 'positive' : stock.overallScore >= 50 ? 'text-[var(--amber)]' : 'faint';
  const first = stock.firstSignalAt
    ? `${formatIST(stock.firstSignalAt)}${stock.firstSignalPrice ? ` at ₹${stock.firstSignalPrice.toFixed(2)}` : ''}${stock.firstSignalScore !== undefined ? ` (score ${stock.firstSignalScore})` : ''}${stock.firstSignalSource === 'device' ? ' · this device' : ''}`
    : 'not reached score 50 in market hours today';
  return (
    <article className="card data-card">
      <div className="data-card-head">
        <div>
          <div className="data-card-title"><strong>{stock.symbol}</strong><SignalBadge signal={stock.signal} />{variant !== 'smart' && <span className="badge badge-neutral">Horizon unvalidated</span>}</div>
          <p className="data-card-sub">{stock.name} · {stock.exchange}</p>
        </div>
        <div className="score-figure"><strong className={scoreTone}>{score}</strong><span>Score</span></div>
      </div>

      <dl className="fact-grid cols-5">
        <div><dt>Last price</dt><dd>{inr(ltp)}</dd></div>
        <div><dt>Change</dt><dd className={stock.changePct >= 0 ? 'positive' : 'negative'}>{signed(stock.changePct, 2)}</dd></div>
        <div><dt>Target</dt><dd>{inr(fo.suggestedTarget, 0)}<small>{signed(fromLtp(fo.suggestedTarget))}</small></dd></div>
        <div><dt>Stop loss</dt><dd>{inr(fo.suggestedStopLoss, 0)}<small>{signed(fromLtp(fo.suggestedStopLoss))}</small></dd></div>
        <div><dt>Reward : risk</dt><dd>{fo.riskReward.toFixed(1)}</dd></div>
      </dl>

      {stock.eligible
        ? <p className="card-note">Research candidate · strategy unvalidated</p>
        : <p className="card-note warn"><strong>Blocked:</strong> {stock.blockedReasons.join('; ')}</p>}

      {variant === 'smart' && <p className="card-note">Volume <strong>{stock.volumeRatio.toFixed(1)}×</strong> average · {stock.volumeRatio >= 2 ? 'high relative volume; participants unknown' : stock.volumeRatio >= 1.5 ? 'elevated relative volume' : 'normal flow'}</p>}

      <div className="factor-list" aria-label="Factor scores, −100 to +100">
        <FactorBar label="Momentum" value={stock.scores.momentum} />
        <FactorBar label="Breakout" value={stock.scores.breakout} />
        <FactorBar label="Trend" value={stock.scores.trendFollowing} />
        <FactorBar label="Volume" value={stock.scores.smartMoney} />
        <FactorBar label="Mean reversion" value={stock.scores.meanReversion} />
      </div>

      {!!stock.strategies.length && <div className="tag-list">{stock.strategies.map((s, i) => <span key={i} className="tag">{s}</span>)}</div>}

      <ul className="bullet-list">{stock.reasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}</ul>

      <div className="inline-facts">
        <span>RSI <b>{stock.rsi.toFixed(1)}</b></span>
        <span>Trend <b>{stock.trend.replace('_', ' ').toLowerCase()}</b></span>
        <span>Support <b>{inr(fo.supportLevel, 0)}</b></span>
        <span>Resistance <b>{inr(fo.resistanceLevel, 0)}</b></span>
      </div>

      <details className="card-disclosure"><summary>{stock.reasons.length > 3 ? `${stock.reasons.length - 3} more reasons and timing` : 'Timing'}</summary><div>
        {stock.reasons.length > 3 && <ul className="bullet-list">{stock.reasons.slice(3).map((r, i) => <li key={i}>{r}</li>)}</ul>}
        {fo.optionStrategy && <p>F&amp;O idea: <strong>{fo.optionStrategy}</strong> — {fo.optionReason}</p>}
        <p>Analysis {formatIST(stock.generatedAt)} · quote {formatIST(stock.quoteTime)}</p>
        <p>First signal: {first}</p>
      </div></details>
    </article>
  );
}

export function SmartPicksPage() {
  const { stocks, loading, lastScan, error, rescan } = useStockDiscovery();
  const [view, setView] = useState<'short' | 'long' | 'smartmoney' | 'options'>('short');

  const shortTerm = stocks.filter(s => s.scores.momentum > 30 || s.scores.breakout > 30)
    .sort((a, b) => (b.scores.momentum + b.scores.breakout) - (a.scores.momentum + a.scores.breakout));
  const longTerm = stocks.filter(s => s.scores.trendFollowing > 30 && s.ltp > s.sma200)
    .sort((a, b) => b.scores.trendFollowing - a.scores.trendFollowing);
  const smartMoney = stocks.filter(s => s.scores.smartMoney > 30)
    .sort((a, b) => b.scores.smartMoney - a.scores.smartMoney);


  return (
    <div className="space-y-6">
      <div className="page-title"><div><h2>Watch ideas</h2><p>Stocks scanned for momentum, long-term trend and volume patterns. Scores and targets are unvalidated research hypotheses.</p></div>
        <button className="btn btn-secondary" onClick={rescan} disabled={loading}>{loading ? 'Scanning…' : 'Rescan'}</button></div>
      <div className="notice">Calculated equity research from provider observations. Scores and price targets are unvalidated hypotheses, not profit probabilities. Options are unavailable until verified contract data is connected.</div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="segment-selector !mb-0" aria-label="Idea type">
          <button aria-pressed={view === 'short'} onClick={() => setView('short')}>Short-term<small>{shortTerm.length}</small></button>
          <button aria-pressed={view === 'long'} onClick={() => setView('long')}>Long-term<small>{longTerm.length}</small></button>
          <button aria-pressed={view === 'smartmoney'} onClick={() => setView('smartmoney')}>Volume pattern<small>{smartMoney.length}</small></button>
          <button aria-pressed={view === 'options'} onClick={() => setView('options')}>Options F&amp;O<small>unavailable</small></button>
        </nav>
        <span className="text-xs faint">{lastScan ? `Last scan ${lastScan.toLocaleTimeString('en-IN')}` : 'Scanning…'} · provider research snapshots</span>
      </div>

      {/* Error state */}
      {error && (
        <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
          <div className="text-[12px] text-[var(--red)]">Discovery error: {error}</div>
          <button onClick={rescan} className="text-[11px] text-[var(--blue)] mt-1 hover:underline">Retry</button>
        </div>
      )}

      {/* Loading state */}
      {loading && stocks.length === 0 && (
        <div className="card text-center py-12">
          
          <div className="text-sm font-semibold text-[var(--text)]">Scanning NSE for opportunities…</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">Analyzing momentum, breakouts, trends & smart money flow</div>
        </div>
      )}

      {/* Short-term */}
      {view === 'short' && !loading && (
        <div className="space-y-6">
          <div className="section-header">
            <span>Momentum candidates</span>
            <span className="badge badge-neutral">Momentum + breakout</span>
            <span className="text-[11px] text-[var(--text-secondary)] ml-auto">{shortTerm.length} stocks found</span>
          </div>
          {shortTerm.length === 0 ? (
            <div className="card text-center py-8 text-[var(--text-secondary)] text-sm">No short-term opportunities detected in current scan</div>
          ) : (
            <div className="card-grid">
              {shortTerm.map(s => <StockCard key={s.symbol} stock={s} variant="short" />)}
            </div>
          )}
        </div>
      )}

      {/* Long-term */}
      {view === 'long' && !loading && (
        <div className="space-y-6">
          <div className="section-header">
            <span>Trend candidates (SMA200)</span>
            <span className="badge badge-neutral">Trend following</span>
            <span className="text-[11px] text-[var(--text-secondary)] ml-auto">{longTerm.length} stocks found</span>
          </div>
          {longTerm.length === 0 ? (
            <div className="card text-center py-8 text-[var(--text-secondary)] text-sm">No long-term opportunities above SMA200 detected</div>
          ) : (
            <div className="card-grid">
              {longTerm.map(s => <StockCard key={s.symbol} stock={s} variant="long" />)}
            </div>
          )}
        </div>
      )}

      {/* Volume Pattern */}
      {view === 'smartmoney' && !loading && (
        <div className="space-y-6">
          <div className="section-header">
            <span>Volume pattern flow</span>
            <span className="badge badge-neutral">Price + volume</span>
            <span className="text-[11px] text-[var(--text-secondary)] ml-auto">{smartMoney.length} stocks detected</span>
          </div>
          {smartMoney.length === 0 ? (
            <div className="card text-center py-8 text-[var(--text-secondary)] text-sm">No unusual smart money activity detected</div>
          ) : (
            <>
              {/* Summary table */}
              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th>LTP</th>
                      <th>Change</th>
                      <th>Vol Ratio</th>
                      <th>Signal</th>
                      <th>Smart Score</th>
                      <th>Pattern</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smartMoney.map(s => (
                      <tr key={s.symbol}>
                        <td className="font-medium">{s.symbol}</td>
                        <td className="font-mono">₹{s.ltp.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className={s.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>{s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%</td>
                        <td className="font-mono"><strong>{s.volumeRatio.toFixed(1)}x</strong></td>
                        <td><SignalBadge signal={s.signal} /></td>
                        <td className="font-mono">{Math.round(s.scores.smartMoney)}</td>
                        <td className="text-[11px]">{s.volumeRatio >= 2 ? 'High volume' : s.volumeRatio >= 1.5 ? 'Elevated volume' : 'Normal'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Detail cards */}
              <div className="card-grid">
                {smartMoney.map(s => <StockCard key={s.symbol} stock={s} variant="smart" />)}
              </div>
            </>
          )}
        </div>
      )}

      {view === 'options' && <section className="card" role="status"><h3>Verified options data required</h3><p>{OPTIONS_UNAVAILABLE}</p></section>}
    </div>
  );
}
