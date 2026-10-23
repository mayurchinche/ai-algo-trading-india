import { useCallback, useEffect, useState } from 'react';
import { fetchToday, type TodayResponse, type TodayItem, type ItemKind, type Overnight, type SmartMoney, type SmartRow, type GapFill } from '../services/today';
import { openAnalysis, navigateTo } from '../services/specDraft';
import { formatIST } from '../services/tradingTime';

const inr = (n: number | null | undefined, d = 0) => n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: d })}`;
const signed = (n: number | null | undefined) => n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const tone = (n: number | null | undefined) => !n ? '' : n > 0 ? 'positive' : 'negative';
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
const KIND: Record<ItemKind, [string, string]> = {
 VALIDATED: ['Validated signal', 'badge-green'], AGGRESSIVE_OPEN: ['Aggressive · open', 'badge-blue'], OVERNIGHT: ['Gap up tomorrow', 'badge-amber'], WATCHING: ['Watching', 'badge-amber'],
 NEAR_TRIGGER: ['Near trigger', 'badge-neutral'], WAITING: ['Waiting', 'badge-neutral'], BLOCKED: ['Not taken', 'badge-neutral'], SKIPPED: ['Not taken', 'badge-neutral'], DISCOVER: ['Discover', 'badge-neutral'],
};
const GROUPS: [string, string, ItemKind[]][] = [
 ['all', 'All', []], ['act', 'Trading now', ['VALIDATED', 'AGGRESSIVE_OPEN', 'OVERNIGHT']], ['watch', 'Watch next', ['WATCHING', 'NEAR_TRIGGER', 'WAITING']], ['passed', 'Passed on', ['BLOCKED', 'SKIPPED', 'DISCOVER']],
];

function Figure({ i }: { i: TodayItem }) {
 if (i.kind === 'AGGRESSIVE_OPEN') return <span className={`today-figure ${tone(i.pnl)}`}>{inr(i.pnl)}<small>{signed(i.pnlPct)}</small></span>;
 if (i.kind === 'NEAR_TRIGGER') return <span className="today-figure">{i.distancePct?.toFixed(1)}%<small>to trigger</small></span>;
 if (i.score !== null && i.score !== undefined) return <span className="today-figure">{Math.abs(i.score)}<small>score</small></span>;
 if (i.price) return <span className="today-figure">{inr(i.price, 2)}<small>close</small></span>;
 return null;
}
// Tomorrow's gap: the overnight scan of the stocks with futures, qualifying stocks first, then the closest.
function OvernightPanel({ o }: { o: Overnight | null }) {
 return <section className="card grid gap-3">
  <div className="rule-item-head"><div><h3>Tomorrow’s gap</h3><p className="caption">Every stock with futures and ₹50 crore average daily turnover, scanned every minute from 10:00. Stocks that qualify by the close are bought as one futures lot between 15:15 and 15:25 and sold at the next open. Over 10 years such closes were followed by an average gap of +0.32% on NIFTY 50 stocks and +0.54% on other futures stocks (gap up 6 to 7 times in 10), roughly +0.15% and +0.37% after futures charges.</p></div></div>
  {!o ? <p className="text-sm muted">The scan starts at 10:00 IST on trading days.</p> : <>
   <div className="inline-facts"><span>Scanned <b>{o.scanned}</b></span><span>Qualifying <b>{o.qualifying}</b></span><span>NIFTY <b>{o.niftyUp === null ? 'unknown' : o.niftyUp ? 'up' : 'down'}</b></span><span>as of <b>{time(o.at)}</b></span></div>
   <div className="overflow-x-auto"><table className="data-table text-sm deals-table"><thead><tr><th>Stock</th><th className="text-right">Day</th><th className="text-right">Volume</th><th className="text-right hide-sm">Close in range</th><th>Status</th></tr></thead>
    <tbody>{o.rows.slice(0, 10).map(r => <tr key={r.symbol} onClick={() => openAnalysis(r.symbol)} style={{ cursor: 'pointer' }}><td className="font-semibold">{r.symbol}{r.newHigh ? <small className="faint"> · 20d high</small> : null}</td><td className={`text-right ${tone(r.retPct)}`}>{signed(r.retPct)}</td><td className="text-right">{r.volumeRatio ?? '—'}×</td><td className="text-right hide-sm">{r.closeLocation === null ? '—' : Math.round(r.closeLocation * 100) + '%'}</td>
     <td>{r.qualifies ? <span className="badge badge-amber">Qualifies</span> : <span className="text-xs muted">needs {r.needs.join(' and ')}</span>}</td></tr>)}</tbody></table></div>
  </>}
 </section>;
}
function Row({ i }: { i: TodayItem }) {
 const [label, badge] = KIND[i.kind];
 return <button className="today-row" onClick={() => openAnalysis(i.symbol)} aria-label={`Analyse ${i.symbol}`}>
  <span className="today-row-main">
   <span className="data-card-title"><strong>{i.symbol}</strong><span className={`badge ${i.side === 'BUY' ? 'badge-green' : 'badge-red'}`}>{i.side === 'BUY' ? 'Long' : 'Short'}</span><span className={`badge ${badge}`}>{label}</span></span>
   <span className="today-row-title">{i.title}{i.why ? <span className="faint"> · {i.why}</span> : null}</span>
   <span className="today-row-status">{i.status}{i.until ? ` · valid until ${formatIST(i.until)}` : ''}{i.firstSeenAt ? ` · first seen ${time(i.firstSeenAt)} at ₹${i.firstPrice}` : ''}</span>
   {!!i.smartMoney?.length && <span className="today-row-flags">{i.smartMoney.map(f => <span key={f.kind} className={f.kind.endsWith('BUYING') ? 'positive' : 'negative'}>{f.text}</span>)}</span>}
  </span>
  <Figure i={i} />
 </button>;
}

// Public takeover-rule filings (open-market trades by promoters and investors holding 5% or more) and pledged
// promoter shares. Filings follow the trades by days; shown as context, not as a trade rule.
function SmartMoneyPanel({ s }: { s: SmartMoney }) {
 const list = (title: string, rows: SmartRow[], value: (r: SmartRow) => string, note: (r: SmartRow) => string) => <div className="grid gap-1 content-start">
  <p className="section-label">{title}</p>
  {rows.length ? rows.slice(0, 8).map(r => <button key={r.symbol} className="smart-row" onClick={() => openAnalysis(r.symbol)}><span><strong>{r.symbol}</strong> <span className="faint">{note(r)}</span></span><b>{value(r)}</b></button>)
   : <p className="text-sm muted">None filed.</p>}
 </div>;
 const pct = (n: number) => `${n > 0 ? '+' : ''}${n}%`;
 return <section className="card grid gap-3">
  <div><h3>Smart money: promoter and investor filings</h3><p className="caption">Open-market buying and selling disclosed under SEBI’s takeover rules since {s.since} (promoters, and investors holding 5% or more), netted per stock as a share of the company, and promoter shares pledged in the latest shareholding filing. Filings arrive days after the trades and are context, not a validated trade rule. Updated {formatIST(s.at)}.</p></div>
  {!!s.failures.length && <p className="card-note warn">Not available: {s.failures.map(f => `${f.source} (${f.reason.replaceAll('_', ' ').toLowerCase()})`).join(', ')}.</p>}
  <div className="smart-grid">
   {list('Promoters buying', s.promoterBuying, r => pct(r.promoterNetPct), r => `${r.promoterBuys} filing${r.promoterBuys === 1 ? '' : 's'}`)}
   {list('Promoters selling', s.promoterSelling, r => pct(r.promoterNetPct), r => `${r.promoterSells} filing${r.promoterSells === 1 ? '' : 's'}`)}
   {list('Investors buying', s.investorBuying, r => pct(r.outsiderNetPct), r => r.outsiders.join(', '))}
   {list('Most pledged', s.pledged, r => `${r.pledgedPct}%`, () => 'of promoter shares')}
  </div>
 </section>;
}

// Gap-down fill test: the same picks bought at the pre-open auction price and at the first live minute.
export function GapFillPanel({ g }: { g: GapFill }) {
 const d = g.today?.decision, row = (label: string, s: GapFill['auction']) => <tr><td>{label}</td><td className="text-right">{s.trades}</td><td className="text-right">{s.winRatePct === null ? '—' : `${s.winRatePct}%`}</td><td className={`text-right ${tone(s.avgTradePct)}`}>{signed(s.avgTradePct)}</td><td className={`text-right ${tone(s.net)}`}>{inr(s.net)}</td></tr>;
 return <section className="card grid gap-3">
  <div className="rule-item-head"><h3>Gap-down fill test</h3><span className="badge badge-amber">Experiment</span></div>
  <p className="caption">At 09:15, stocks opening 2–6% below yesterday’s close (above their 200-day average, ₹10 crore daily value) are bought with ₹{(g.policy.capital / 1e5).toFixed(0)} lakh: once at the pre-open auction price, once at the first live minute; 1.5% stop, sold at 15:15. The backtest made {signed(g.policy.backtest.avgTradePct)} a trade only with auction fills; this measures whether that holds live.</p>
  <p className="text-sm">{!d ? 'Decides at 09:15 on trading days.' : d.status === 'DECIDED' ? `Today: ${d.candidates} gapped down; bought ${d.entered?.length ? d.entered.join(', ') : 'none'}.` : `Today: ${d.status.replaceAll('_', ' ').toLowerCase()}${d.reason ? ` — ${d.reason}` : ''}.`}</p>
  {!!g.open.length && <div className="grid gap-1">{g.open.map(p => <div key={p.id} className="inline-facts"><b>{p.symbol}</b><span>gap {signed(p.gapPct)}</span><span>{p.qty} @ auction ₹{p.auction.entry}</span>{p.live.entry ? <span>live ₹{p.live.entry} ({signed(p.live.lateByPct)})</span> : <span>no live quote</span>}</div>)}</div>}
  <table className="data-table text-sm"><thead><tr><th>Fill</th><th className="text-right">Trades</th><th className="text-right">Win</th><th className="text-right">Avg trade</th><th className="text-right">Net</th></tr></thead>
   <tbody>{row('Auction (backtested)', g.auction)}{row('Live first minute', g.live)}<tr><td className="faint">Backtest 2022–26</td><td /><td className="text-right faint">{g.policy.backtest.winRatePct}%</td><td className="text-right faint">{signed(g.policy.backtest.avgTradePct)}</td><td /></tr></tbody></table>
  {g.avgLateByPct !== null && <p className="caption">Live fills averaged {signed(g.avgLateByPct)} versus the auction price.</p>}
 </section>;
}

export function TodayPage() {
 const [data, setData] = useState<TodayResponse>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [group, setGroup] = useState('all');
 const load = useCallback(() => { setLoading(true); fetchToday().then(d => { setData(d); setError(''); }).catch(e => setError(e instanceof Error ? e.message : 'Today unavailable')).finally(() => setLoading(false)); }, []);
 useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
 const b = data?.book, kinds = GROUPS.find(g => g[0] === group)![2];
 const items = (data?.items ?? []).filter(i => !kinds.length || kinds.includes(i.kind));
 const count = (k: ItemKind[]) => (data?.items ?? []).filter(i => k.includes(i.kind)).length;
 const tick = data?.automation?.lastTickAt, live = tick ? Date.now() - Date.parse(tick) < 180000 : false;
 const validated = (data?.coverage ?? []).reduce((a, c) => a + c.validated, 0), rules = (data?.coverage ?? []).reduce((a, c) => a + c.rules, 0);
 return <div className="space-y-6">
  <div className="page-title"><div><p className="eyebrow">Session</p><h2>Today</h2><p>Everything that could become a trade right now, what each paper book is doing about it, and why ideas were passed on. Validated signals trade in the validated book; unproven high-potential setups trade in the separate aggressive book so their live record can be measured.</p></div>
   <button className="btn btn-secondary" disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button></div>
  {error && <section className="card" role="status"><p>{error}</p></section>}
  {!!data?.unavailable.length && <p className="card-note warn">Not available right now: {data.unavailable.join(', ')}.</p>}
  {data && <dl className="today-tiles">
   <div className="metric-tile"><dt>Aggressive book today</dt><dd className={tone(b?.today.pnl)}>{inr(b?.today.pnl)}</dd><small>{b ? `${inr(b.today.realized)} realized · ${inr(b.today.openPnl)} open` : 'starts at the next market minute'}</small></div>
   <div className="metric-tile"><dt>Open positions</dt><dd>{b?.open.length ?? 0} / {b?.policy.maxOpen ?? 5}</dd><small>{b?.today.stopped ? 'Daily loss stop reached' : `${b?.today.trades ?? 0} closed today`}</small></div>
   <div className="metric-tile"><dt>Validated signals active</dt><dd>{count(['VALIDATED'])}</dd><small>{data.held.length} validated positions held</small></div>
   <div className="metric-tile"><dt>Rules validated</dt><dd>{validated} / {rules}</dd><small>{(data.coverage ?? []).filter(c => c.validated).map(c => c.label).join(', ') || 'none yet'}</small></div>
   <div className="metric-tile"><dt>Automation</dt><dd className={live ? 'positive' : ''}>{live ? 'Running' : 'Idle'}</dd><small>{tick ? `last tick ${formatIST(tick)}` : 'no tick recorded'}</small></div>
  </dl>}
  {data && <div className="today-layout">
   <section className="card grid gap-3">
    <div className="rule-item-head"><h3>Opportunities</h3><span className="caption">updated {formatIST(data.computedAt)}</span></div>
    <nav className="segment-selector" aria-label="Filter">{GROUPS.map(([id, label, k]) => <button key={id} aria-pressed={group === id} onClick={() => setGroup(id)}>{label}<small>{k.length ? count(k) : data.items.length}</small></button>)}</nav>
    {items.length ? <div className="today-list">{items.map(i => <Row key={i.kind + i.symbol + (i.ruleId ?? i.setup ?? '')} i={i} />)}</div>
     : <p className="text-sm muted">Nothing in this group now. Outside market hours the board shows the last session’s state; the scanners run every minute from 09:15 to 15:30 IST.</p>}
   </section>
   <div className="grid gap-4 content-start">
    {data.gapFill && <GapFillPanel g={data.gapFill} />}
    <OvernightPanel o={b?.overnight ?? null} />
    <section className="card grid gap-3">
     <div className="rule-item-head"><h3>Aggressive book</h3><span className="badge badge-amber">Experimental</span></div>
     {b ? <>
      <p className="caption">{inr(b.policy.capitalPerTrade)} per intraday or delivery trade, one futures lot overnight (up to {b.policy.overnight.maxPositions}, lot value up to {inr(b.policy.overnight.maxNotional)}) · up to {b.policy.maxOpen} open · stops new entries after a {inr(b.policy.dailyLossStop)} day. Intraday: {b.policy.intraday.stopPct}% stop, {b.policy.intraday.targetPct}% target, squared off 15:15. Early breakouts: {b.policy.swing.stopPct}% stop, {b.policy.swing.targetPct}% target, up to {b.policy.swing.maxSessions} sessions.</p>
      {b.open.length ? <div className="grid gap-2">{b.open.map(p => <div key={p.id} className="book-pos"><div className="data-card-title"><strong>{p.symbol}</strong><span className="badge badge-neutral">{b.setups[p.setup]?.label ?? p.setup}</span></div>
       <div className="inline-facts"><span>{p.side} {p.qty} @ <b>{inr(p.entryPrice, 2)}</b></span><span>now <b>{inr(p.mark, 2)}</b></span><span>stop <b>{inr(p.stop, 2)}</b></span>{p.target !== null ? <span>target <b>{inr(p.target, 2)}</b></span> : <span>sells at the open on <b>{p.exitOn}</b></span>}{p.contract ? <span className="faint">{p.contract}</span> : null}<span className={tone(p.openPnl)}><b>{inr(p.openPnl)}</b> ({signed(p.openPct)})</span></div></div>)}</div>
       : <p className="text-sm muted">No open positions.</p>}
      {!!b.closedToday.length && <><p className="section-label">Closed today</p><div className="grid gap-1">{b.closedToday.map(c => <div key={c.id + c.exitAt} className="inline-facts"><b>{c.symbol}</b><span>{c.exitReason.replaceAll('_', ' ').toLowerCase()}</span><span className={tone(c.net)}><b>{inr(c.net)}</b> ({signed(c.netPct)})</span></div>)}</div></>}
      <p className="section-label">Setup scoreboard since {b.startedAt.slice(0, 10)}</p>
      {b.bySetup.length ? <table className="data-table text-sm"><thead><tr><th>Setup</th><th className="text-right">Trades</th><th className="text-right">Win rate</th><th className="text-right">Net</th></tr></thead>
       <tbody>{b.bySetup.map(s => <tr key={s.id}><td>{s.label}</td><td className="text-right">{s.trades}</td><td className="text-right">{s.winRate ?? '—'}%</td><td className={`text-right ${tone(s.net)}`}>{inr(s.net)}</td></tr>)}</tbody></table>
       : <p className="text-sm muted">No closed trades yet. Each setup needs a few weeks of trades before its record means much.</p>}
      <details className="card-disclosure"><summary>The setups</summary><div>{Object.entries(b.setups).map(([id, s]) => <p key={id}><strong>{s.label}</strong> ({s.product === 'equity-intraday' ? 'intraday' : s.product === 'futures' ? 'futures, overnight' : 'delivery'}): {s.rule}</p>)}<p>Fills use the live Upstox bid/ask with 5 bps slippage and the published broker charges. Stops and targets are checked once a minute, so a fast move can exit beyond the level.</p></div></details>
     </> : <p className="text-sm muted">The book starts at the next market minute.</p>}
    </section>
    <section className="card grid gap-2">
     <div className="rule-item-head"><h3>Validated book</h3><button className="btn-ghost" onClick={() => navigateTo('Signals')}>Signals →</button></div>
     <p className="caption">Validated rules hold {data.held.length} positions on daily closes. New validated signals open single-trade paper runs automatically.</p>
     <div className="tag-list">{data.coverage.map(c => <span key={c.id} className="tag">{c.label} {c.validated}/{c.rules}</span>)}</div>
    </section>
   </div>
  </div>}
  {data?.smartMoney && <SmartMoneyPanel s={data.smartMoney} />}
  {!!data?.deals.rows.length && <section className="card grid gap-3">
   <div><h3>Smart money: net bulk and block deals</h3><p className="caption">NSE disclosures for {data.deals.date}: each client’s deals in a stock netted, largest net positions first. {data.deals.roundTrips} clients that bought and sold about the same amount the same day (usually market makers) are left out. Public filings published after the session; who traded is as reported to the exchange.</p></div>
   <div className="overflow-x-auto"><table className="data-table text-sm deals-table"><thead><tr><th>Stock</th><th className="hide-sm">Deal</th><th>Client</th><th>Net</th><th className="text-right hide-sm">Net quantity</th><th className="text-right hide-sm">Avg price</th><th className="text-right">Net value</th></tr></thead>
    <tbody>{data.deals.rows.map((d, k) => <tr key={k} onClick={() => openAnalysis(d.symbol)} style={{ cursor: 'pointer' }}><td className="font-semibold">{d.symbol}</td><td className="hide-sm">{d.kind.toLowerCase().replace('+', ' + ')}</td><td>{d.client}</td><td className={d.side === 'BUY' ? 'positive' : 'negative'}>{d.side}</td><td className="text-right hide-sm">{d.quantity.toLocaleString('en-IN')}</td><td className="text-right hide-sm">{inr(d.price, 2)}</td><td className="text-right">{inr(d.value / 1e7, 2)} cr</td></tr>)}</tbody></table></div>
  </section>}
 </div>;
}
