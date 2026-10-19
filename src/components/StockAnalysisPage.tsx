import { useEffect, useState } from 'react';
import { fetchAnalysis, type Analysis, type SwotItem, type Fact } from '../services/stockAnalysis';
import { paperTradeSignal } from '../services/signals';
import { navigateTo } from '../services/specDraft';
import { formatIST } from '../services/tradingTime';
import { NIFTY50_UNIVERSE } from '../../shared/universes';

const n2 = (v: number | null | undefined, d = 2) => v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: Math.min(d, 2) });
const pc = (v: number | null | undefined, d = 2) => v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
const cr = (v: number) => `₹${(v / 1e7).toFixed(2)} cr`;
const words = (s: string) => s.replaceAll('_', ' ').toLowerCase();
const tone = (v: number | null | undefined) => v === null || v === undefined ? '' : v > 0 ? 'text-[var(--green)]' : v < 0 ? 'text-[var(--red)]' : '';
const has = <T extends object>(x: T | { status: string }, key: keyof T): x is T => typeof x === 'object' && x !== null && key in x;
const SYMBOLS = [...NIFTY50_UNIVERSE.symbols, 'NIFTY', 'BANKNIFTY'];
const TABS = ['Overview', 'Technicals', 'Fundamentals', 'News & filings', 'Deals & flows', 'Derivatives', 'Strategies'] as const;

function Tile({ label, value, className = '' }: { label: string; value: string; className?: string }) {
 return <div className="metric-tile"><span className="text-xs text-[var(--text-muted)]">{label}</span><strong className={`font-mono ${className}`}>{value}</strong></div>;
}
function Swot({ title, items, kind }: { title: string; items: SwotItem[]; kind: string }) {
 return <div className={`card swot-${kind}`}><h4>{title} ({items.length})</h4>{items.length ? <ul className="text-sm list-disc pl-4">{items.map((i, k) => <li key={k}>{i.text}</li>)}</ul> : <p className="text-sm text-[var(--text-muted)]">Nothing found in the available facts.</p>}</div>;
}
const factValue = (f: Fact) => typeof f.value === 'number' ? `${n2(f.value)}${f.unit && f.unit !== '' ? (f.unit.startsWith('%') || f.unit === '×' ? '' : ' ') + f.unit : ''}` : f.value ?? '—';
const VERDICT: Record<string, string> = { VALIDATED: 'Validated', UNPROVEN: 'Too few trades', REJECTED: 'Not profitable', NOT_VALIDATED_YET: 'Pending' };
const STATE: Record<string, string> = { ENTRY_SIGNAL_TODAY: 'Entry signal at last close', EXIT_SIGNAL_TODAY: 'Exit signal at last close', IN_POSITION: 'In a position', WAITING: 'Waiting for setup', UNAVAILABLE: '—' };

function Overview({ a }: { a: Analysis }) {
 return <div className="space-y-4">
  <div className="grid md:grid-cols-2 gap-3"><Swot title="Strengths" items={a.swot.strengths} kind="s" /><Swot title="Weaknesses" items={a.swot.weaknesses} kind="w" /><Swot title="Opportunities" items={a.swot.opportunities} kind="o" /><Swot title="Threats" items={a.swot.threats} kind="t" /></div>
  <p className="text-xs">{a.swot.method}</p>
  <h3>By trading segment</h3>
  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{a.segments.map(s => <section key={s.id} className="card space-y-2"><h4>{s.label} <small className="text-[var(--text-muted)]">· {s.horizon}</small></h4>
   <table className="data-table text-sm"><tbody>{s.facts.map(f => <tr key={f.label}><td>{f.label}</td><td className="text-right font-mono">{factValue(f)}</td></tr>)}</tbody></table>
   {s.fundamentalsNote && <p className="text-xs">{s.fundamentalsNote}</p>}
   <ul className="text-xs space-y-1">{s.strategies.map(st => <li key={st.id}><strong>{st.name}</strong>: {VERDICT[st.verdict] ?? st.verdict}{st.stats ? ` · ${st.stats.trades} trades, ${pc(st.stats.expectancyPct)} per trade, PF ${n2(st.stats.profitFactor)}` : ''}{st.state ? ` · ${STATE[st.state] ?? st.state}${st.since ? ' since ' + st.since : ''}` : ''}</li>)}</ul>
  </section>)}</div>
 </div>;
}
function Technicals({ a }: { a: Analysis }) {
 const t = a.technicals;
 if (t.status !== 'OK') return <p>Price history unavailable{t.reason ? ` (${words(t.reason)})` : ''}.</p>;
 return <div className="space-y-4">
  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">{(['1w', '1m', '3m', '6m', '1y'] as const).map(k => <Tile key={k} label={`Return ${k}`} value={pc(t.returnsPct[k])} className={tone(t.returnsPct[k])} />)}</div>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
   <Tile label="SMA 20 / 50" value={`${n2(t.movingAverages.sma20)} / ${n2(t.movingAverages.sma50)}`} /><Tile label="SMA 200" value={`${n2(t.movingAverages.sma200)} ${t.movingAverages.sma200Rising === null ? '' : t.movingAverages.sma200Rising ? '↑' : '↓'}`} /><Tile label="RSI 14" value={n2(t.momentum.rsi14, 1)} /><Tile label="MACD / signal" value={`${n2(t.momentum.macd)} / ${n2(t.momentum.macdSignal)}`} />
   <Tile label="ATR 14" value={`${n2(t.volatility.atr14)} (${n2(t.volatility.atrPct)}%)`} /><Tile label="Volatility 20d (annualised)" value={`${n2(t.volatility.annualised20dPct, 1)}%`} /><Tile label="Vol. percentile of 1y" value={t.volatility.percentileOf1y === null ? '—' : `${t.volatility.percentileOf1y.toFixed(0)}`} /><Tile label="Supertrend" value={`${n2(t.bands.supertrend)} ${t.bands.supertrendDirection === 1 ? 'up' : t.bands.supertrendDirection === -1 ? 'down' : ''}`} />
   <Tile label="Bollinger band" value={`${n2(t.bands.bollingerLower)} – ${n2(t.bands.bollingerUpper)}`} /><Tile label="52-week range" value={`${n2(t.range.low52w)} – ${n2(t.range.high52w)}`} /><Tile label="Below 52w high" value={`${n2(t.range.belowHighPct)}%`} /><Tile label="Trend score" value={t.trendScore?.score !== undefined ? `${t.trendScore.score.toFixed(1)} ${t.trendScore.zone?.toLowerCase() ?? ''}` : '—'} />
   <Tile label="Pivot / R1 / S1" value={`${n2(t.levels.pivot)} / ${n2(t.levels.r1)} / ${n2(t.levels.s1)}`} /><Tile label="20-day support / resistance" value={`${n2(t.levels.support20d)} / ${n2(t.levels.resistance20d)}`} /><Tile label="55-day support / resistance" value={`${n2(t.levels.support55d)} / ${n2(t.levels.resistance55d)}`} /><Tile label="Volume vs 20-day avg" value={`${n2(t.volume.ratio)}×`} />
   <Tile label="Avg daily range" value={`${n2(t.volatility.avgDailyRangePct)}%`} /><Tile label="Avg opening gap" value={`${n2(t.volatility.avgOpeningGapPct)}%`} />
  </div>
  <p className="text-xs">Completed daily bars up to {t.asOf}. Levels are arithmetic reference points, not predictions.</p>
 </div>;
}
function Fundamentals({ a }: { a: Analysis }) {
 if (a.isIndex) return <p>Company fundamentals do not apply to an index.</p>;
 const scopes = a.fundamentals.scopes ? Object.entries(a.fundamentals.scopes) : [];
 return <div className="space-y-4">
  {a.scorecard && <div className="grid grid-cols-2 md:grid-cols-6 gap-2"><Tile label="Composite (NIFTY 50 percentile)" value={n2(a.scorecard.composite.score, 0)} />{a.scorecard.styles.map(s => <Tile key={s.id} label={s.label} value={s.status === 'SCORED' ? n2(s.score, 0) : 'n/a'} />)}</div>}
  {!!a.peerRanks.length && <table className="data-table text-sm"><thead><tr><th>Metric</th><th className="text-right">Value</th><th className="text-right">Percentile among {a.peerRanks[0].peers} peers</th></tr></thead><tbody>{a.peerRanks.map(r => <tr key={r.metric}><td>{r.label}</td><td className="text-right font-mono">{n2(r.value)}</td><td className="text-right font-mono">{r.percentile.toFixed(0)}</td></tr>)}</tbody></table>}
  {!scopes.length && <p>No stored NSE financial filings for this company{a.fundamentals.status ? ` (${words(a.fundamentals.status)})` : ''}.</p>}
  {scopes.map(([scope, s]) => <section key={scope} className="card space-y-2"><h4>{scope}{s.latestAnnualPeriod ? ` · year ${s.latestAnnualPeriod.start} to ${s.latestAnnualPeriod.end}` : ' · no annual period'}</h4>
   {s.format === 'BANKING' && <p className="text-sm">Bank results format: bank ratios (NIM, cost to income, NPAs, CET1) replace ROCE and debt/equity, and banks are not ranked against non-bank peers.</p>}
   <div className="grid grid-cols-2 md:grid-cols-6 gap-2">{s.ratios.map(r => <Tile key={r.key} label={r.label ?? r.key} value={r.value === null ? words(r.status) : n2(r.value)} />)}{s.marketCap && <Tile label="Market cap" value={s.marketCap.value === null ? words(s.marketCap.status) : cr(s.marketCap.value)} />}</div>
   <div className="grid grid-cols-2 md:grid-cols-6 gap-2">{s.growth.filter(g => g.valuePct !== null).map(g => <Tile key={g.key + g.years} label={`${g.key === 'revenue' ? 'Revenue' : g.key === 'totalProfit' ? 'Profit' : g.key} ${g.years}y`} value={pc(g.valuePct)} className={tone(g.valuePct)} />)}</div>
  </section>)}
  <p className="text-xs">Issuer-reported values from NSE XBRL filings; each ratio keeps its formula and source filing. Values marked unavailable are not estimated.</p>
 </div>;
}
function NewsFilings({ a }: { a: Analysis }) {
 return <div className="grid lg:grid-cols-2 gap-4">
  <section className="card space-y-2"><h4>News (7 days)</h4>{has(a.news, 'articles') ? <><p className="text-xs">{a.news.summary.method} Last 24h: {a.news.summary.counts.positive} positive, {a.news.summary.counts.negative} negative, {a.news.summary.counts.unclear} unclear.</p>
   <ul className="text-sm space-y-1">{a.news.articles.map((n, i) => <li key={i}><span className={n.tone === 'positive' ? 'text-[var(--green)]' : n.tone === 'negative' ? 'text-[var(--red)]' : ''}>●</span> {n.link ? <a href={n.link} target="_blank" rel="noreferrer">{n.title}</a> : n.title} <small className="text-[var(--text-muted)]">{n.source} · {formatIST(n.publishedAt)}</small></li>)}</ul></> : <p>News unavailable.</p>}</section>
  <section className="card space-y-2"><h4>NSE corporate announcements</h4>{Array.isArray(a.announcements) ? <ul className="text-sm space-y-2">{a.announcements.map((x, i) => <li key={i}><strong>{x.subject}</strong> <small className="text-[var(--text-muted)]">{x.time}</small><br /><span className="text-xs">{x.text}</span>{x.url && <> · <a href={x.url} target="_blank" rel="noreferrer">document</a></>}</li>)}</ul> : <p>{a.isIndex ? 'Not applicable to an index.' : 'Announcements unavailable.'}</p>}</section>
 </div>;
}
function DealsFlows({ a }: { a: Analysis }) {
 return <div className="space-y-4">
  <section className="card space-y-2"><h4>Bulk and block deals (12 months)</h4>{has(a.deals, 'rows') ? <><div className="grid grid-cols-2 md:grid-cols-4 gap-2"><Tile label="Deals" value={String(a.deals.count)} /><Tile label="Bought" value={cr(a.deals.buyValue)} /><Tile label="Sold" value={cr(a.deals.sellValue)} /><Tile label="Net" value={cr(a.deals.netValue)} className={tone(a.deals.netValue)} /></div>
   {a.deals.rows.length ? <div className="overflow-x-auto"><table className="data-table text-sm"><thead><tr><th>Date</th><th>Type</th><th>Client</th><th>Side</th><th className="text-right">Quantity</th><th className="text-right">Price</th><th className="text-right">Value</th></tr></thead><tbody>{a.deals.rows.map((d, i) => <tr key={i}><td>{d.date}</td><td>{d.kind.toLowerCase()}</td><td>{d.client}</td><td>{d.side}</td><td className="text-right">{d.quantity.toLocaleString('en-IN')}</td><td className="text-right">{n2(d.price)}</td><td className="text-right">{cr(d.quantity * d.price)}</td></tr>)}</tbody></table></div> : <p className="text-sm">No bulk or block deals recorded.</p>}
   <p className="text-xs">{a.deals.coverage}.</p></> : <p>{a.isIndex ? 'Not applicable to an index.' : 'Deals unavailable.'}</p>}</section>
  <section className="card space-y-2"><h4>Delivery (NSE bhavcopy)</h4>{has(a.delivery, 'history') ? <><p className="text-sm">Latest {a.delivery.latest.date}: {n2(a.delivery.latest.deliveryPct)}% delivered · {a.delivery.days}-day average {n2(a.delivery.average)}%</p>
   <table className="data-table text-sm"><thead><tr><th>Date</th><th className="text-right">Close</th><th className="text-right">Volume</th><th className="text-right">Delivery %</th></tr></thead><tbody>{a.delivery.history.map(d => <tr key={d.date}><td>{d.date}</td><td className="text-right">{n2(d.close)}</td><td className="text-right">{d.volume?.toLocaleString('en-IN') ?? '—'}</td><td className="text-right">{n2(d.deliveryPct)}</td></tr>)}</tbody></table></> : <p>{a.isIndex ? 'Not applicable to an index.' : 'Delivery data unavailable.'}</p>}</section>
  <section className="card space-y-2"><h4>FII / DII cash-market flows (₹ crore, provisional)</h4>{a.flows.length ? <table className="data-table text-sm"><thead><tr><th>Date</th><th>Category</th><th className="text-right">Buy</th><th className="text-right">Sell</th><th className="text-right">Net</th></tr></thead><tbody>{a.flows.map(f => <tr key={f.date + f.category}><td>{f.date}</td><td>{f.category}</td><td className="text-right">{n2(f.buy)}</td><td className="text-right">{n2(f.sell)}</td><td className={`text-right ${tone(f.net)}`}>{n2(f.net)}</td></tr>)}</tbody></table> : <p className="text-sm">No flows recorded yet (the market-day job records them after each session).</p>}</section>
 </div>;
}
function Derivatives({ a }: { a: Analysis }) {
 const c = a.optionChain;
 return <div className="space-y-4">
  {a.futures ? <div className="grid grid-cols-2 md:grid-cols-5 gap-2"><Tile label="Nearest future" value={a.futures.nearest.symbol} /><Tile label="Expiry" value={a.futures.nearest.expiry} /><Tile label="Lot size" value={String(a.futures.nearest.lotSize)} /><Tile label="Future price" value={n2(a.futures.nearest.price)} /><Tile label="Basis vs spot" value={pc(a.futures.nearest.basisPct, 3)} /></div> : <p>{a.symbol} has no futures or options (not in the NSE F&amp;O list).</p>}
  {has(c, 'expiry') && <><h4>Option chain · {c.expiry} · spot {n2(c.spot)}</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-2"><Tile label="Put-call OI ratio" value={n2(c.putCallOiRatio)} /><Tile label="Max pain" value={n2(c.maxPain, 0)} /><Tile label="ATM strike" value={n2(c.atmStrike, 0)} /><Tile label="ATM IV call / put" value={`${c.atmIv.CE === null ? '—' : (c.atmIv.CE * 100).toFixed(1)}% / ${c.atmIv.PE === null ? '—' : (c.atmIv.PE * 100).toFixed(1)}%`} />
   <Tile label="Highest call OI (resistance)" value={c.callOiWall.map(x => x.strike).join(', ')} /><Tile label="Highest put OI (support)" value={c.putOiWall.map(x => x.strike).join(', ')} /><Tile label="Lot size" value={n2(c.lotSize, 0)} /></div>
   <button className="btn btn-secondary" onClick={() => navigateTo('Options wizard')}>Build an option strategy</button></>}
  {a.futures && !has(c, 'expiry') && <p className="text-sm">Option chain unavailable right now.</p>}
 </div>;
}
function Strategies({ a }: { a: Analysis }) {
 const [state, setState] = useState('');
 return <div className="space-y-3">
  {a.signals.filter(s => s.status === 'ACTIVE').map(s => <div key={s.id} className="card"><p><strong>Active signal:</strong> {s.strategyName} ({s.segment}) at ₹{s.close.toFixed(2)} · valid until {formatIST(new Date(s.validUntil).toISOString())}</p><button className="btn btn-primary" onClick={() => paperTradeSignal(s.id, 100000).then(() => navigateTo('Paper trading')).catch(e => setState(e instanceof Error ? e.message : 'Failed'))}>Paper trade with ₹1 lakh</button>{state && <span className="text-sm"> {state}</span>}</div>)}
  <table className="data-table text-sm"><thead><tr><th>Strategy</th><th>Segment</th><th>Validation on {a.symbol}</th><th>Today</th></tr></thead><tbody>
   {a.segments.flatMap(seg => seg.strategies.map(st => <tr key={st.id}><td>{st.name}</td><td>{seg.label}</td><td>{VERDICT[st.verdict] ?? st.verdict}{st.stats ? ` · ${st.stats.trades} trades · win ${st.stats.winRate === null ? '—' : (st.stats.winRate * 100).toFixed(0) + '%'} · ${pc(st.stats.expectancyPct)}/trade · PF ${n2(st.stats.profitFactor)}${st.buyHoldPct !== null ? ` · buy & hold ${pc(st.buyHoldPct, 0)}` : ''}` : ''}</td><td>{st.state ? STATE[st.state] ?? st.state : '—'}</td></tr>))}
  </tbody></table>
  <p className="text-xs">Only validated strategies produce signals. “Today” replays the rule on daily history to show where it stands; it is not an order.</p>
 </div>;
}
export function StockAnalysisPage({ symbol, onSymbol }: { symbol?: string; onSymbol: (s: string) => void }) {
 const [input, setInput] = useState(symbol ?? ''); const [data, setData] = useState<Analysis>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [tab, setTab] = useState<typeof TABS[number]>('Overview');
 useEffect(() => {
  if (!symbol) return; let live = true; setInput(symbol); setLoading(true); setError('');
  fetchAnalysis(symbol).then(d => { if (live) setData(d); }).catch(e => { if (live) { setData(undefined); setError(e instanceof Error ? e.message : 'Analysis unavailable'); } }).finally(() => { if (live) setLoading(false); });
  return () => { live = false; };
 }, [symbol]);
 const q = data?.quote, t = data?.technicals;
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Stock analysis</h2><p>Technicals, fundamentals, SWOT, news, filings, bulk/block deals, delivery, FII/DII flows, derivatives and validated strategies for one stock, across every trading segment.</p></div></div>
  <form className="flex flex-wrap gap-2 items-center" onSubmit={e => { e.preventDefault(); const s = input.trim().toUpperCase(); if (s) onSymbol(s); }}>
   <input list="analysis-symbols" value={input} onChange={e => setInput(e.target.value.toUpperCase())} placeholder="NSE symbol, e.g. INFY" aria-label="NSE symbol" style={{ minWidth: 220 }} /><datalist id="analysis-symbols">{SYMBOLS.map(s => <option key={s} value={s} />)}</datalist>
   <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Analysing…' : 'Analyse'}</button>
  </form>
  {!symbol && <section className="card"><p className="text-sm">Choose a stock. NIFTY 50: </p><div className="flex flex-wrap gap-1">{SYMBOLS.map(s => <button key={s} className="btn btn-secondary" onClick={() => onSymbol(s)}>{s}</button>)}</div></section>}
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {loading && <div className="card workspace-loading" role="status"><span className="loading-line" /><span className="loading-line short" /><p>Collecting prices, filings, news and deals…</p></div>}
  {data && !loading && <>
   <section className="card space-y-2"><div className="page-title"><div><h2>{data.name} <small>({data.symbol})</small></h2><p>{data.industry ?? (data.isIndex ? 'Index' : '')} · analysed {formatIST(data.computedAt)}</p></div>
    <div className="text-right">{q && 'price' in q ? <><strong className="text-2xl font-mono">₹{n2(q.price)}</strong><p className="text-xs">bid {n2(q.bid)} · ask {n2(q.ask)} · spread {n2(q.spreadPct, 3)}% · {formatIST(q.timestamp)}</p></> : t?.status === 'OK' ? <><strong className="text-2xl font-mono">₹{n2(t.close)}</strong><p className="text-xs">last close {t.asOf} · {pc(t.change1dPct)}</p></> : null}</div></div>
    <div className="flex gap-2 flex-wrap">{data.signals.filter(s => s.status === 'ACTIVE').map(s => <span key={s.id} className="badge badge-green">Signal: {s.strategyName}</span>)}</div></section>
   <nav className="segment-selector" aria-label="Analysis sections">{TABS.map(x => <button key={x} aria-pressed={tab === x} onClick={() => setTab(x)}>{x}</button>)}</nav>
   {tab === 'Overview' && <Overview a={data} />}{tab === 'Technicals' && <Technicals a={data} />}{tab === 'Fundamentals' && <Fundamentals a={data} />}{tab === 'News & filings' && <NewsFilings a={data} />}{tab === 'Deals & flows' && <DealsFlows a={data} />}{tab === 'Derivatives' && <Derivatives a={data} />}{tab === 'Strategies' && <Strategies a={data} />}
   <details className="text-xs"><summary>Sources and limitations</summary><ul>{data.limitations.map(l => <li key={l}>{l}</li>)}</ul></details>
  </>}
 </div>;
}
