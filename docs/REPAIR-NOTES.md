# Trading audit and repair — 18 September 2026

## What was wrong

- Discovery requested three months of history while displaying a 200-day SMA. Insufficient history substituted the final close, making trend signals misleading.
- High, low and close nulls were removed independently, misaligning ATR candles.
- MACD's signal EMA was restarted over only nine values.
- Volume-only “smart money” scoring was biased bullish and institutional claims were unsupported.
- SELL signals reused BUY stop-loss/target geometry.
- Paper entries did not increment deployed capital within a batch; minimum quantity one could exceed the allocation.
- F&O-eligible stocks were simulated at their equity price and called derivative trades, without a contract, lot size, expiry or margin.
- Multiple pages independently mounted trading loops. Newly opened trades were immediately checked against the entry snapshot.
- Exits monitored only today's discoveries. Positions dropped from the screener were forgotten.
- UTC dates and device-local market hours were mixed. A next-day quote was labelled an EOD exit.
- History capped at 200 trades/500 signals instead of retaining a time window.
- Overview manufactured results using yesterday's close and today's selected stocks, not executions.
- Backtests entered at the signal close, preferred target when both barriers hit, ignored requested dates/strategies, omitted costs, and used a fixed capital denominator.
- Generic gateway used unsafe domain suffix matching and shared caching for authenticated responses.
- Supabase schema grants all operations to everyone, while sync uses globally shared record IDs. Automatic uploading of settings/records was removed from app startup; existing remote policy/data was not changed.

These defects can make performance appear better than it is. They do not establish the specific cause of the user's KWIL/BAJAJHIND losses. Exact original signal snapshots and broker fills are needed for that attribution. Previously discarded history cannot be reconstructed honestly.

## Implemented

- Versioned ledger, immutable signal references, separate observation/quote timestamps, IST display including seconds, entry/exit audit events, estimated costs, slippage and monitoring-gap flags.
- Legacy records are preserved. Closed records stay until explicit cleanup after 30 days from exit; open records are never removed. Archived P&L remains in account equity.
- Filters by symbol, entry date and open/closed status; JSON export and per-trade audit trails.
- Capital reservation per entry, equity-only simulation, daily limits, risk sizing and daily realized-loss stop. Stale/missing quotes and unknown market status block entries.
- One root-level scanner and cross-tab writer lock. Open positions are quoted even when absent from the screener. A recovered next-day position is EXPIRED, not falsely backdated.
- Two years of aligned, completed candles; genuine 200-bar warm-up; correct sell-side levels and MACD signal line. Price/turnover/extreme-move guards are conservative research filters, not calibrated proof of profitability.
- Actual ledger-based Overview; legacy/gapped executions excluded from evaluated win rate. Options estimates explicitly labelled unvalidated.
- Long-only historical study uses previous-bar signals and next open, gap-aware stop-first fills, costs, slippage, date/strategy filters, capital-aware position sizing, daily equity Sharpe and drawdown. Per-strategy attribution is part of a priority portfolio, not five independent tests.
- Application-owned read endpoint for Yahoo/NSE; same handler for Vite and Vercel; no stale caching. Legacy non-market gateway hardened but retained for existing integrations.
- Mobile layout, bottom navigation, keyboard-focus styles, reduced-motion support, web manifest and network-only service worker. No claim of native APK or background execution.

## Not complete / deployment dependencies

1. **Continuous paper trading:** browser timers stop when the app is closed or suspended. A durable single-writer backend worker plus broker feed is required. Polling LTP cannot reconstruct exact intrabar barrier crossings. Persist exchange time, receipt time, processing time and feed sequence separately; flag gaps and backfill candles/ticks with explicit ambiguity rules.
2. **Cloud database:** current local persistence is browser-specific and can be cleared/evicted. Do not enable the legacy anonymous shared sync. Implement authenticated accounts with row ownership, an append-only event table, transactionally updated positions, idempotency keys and backups. SQL schema proposal is in `production-ledger.sql`; it is not applied and is not a functioning backend by itself.
3. **Provider:** `public-apis` is a catalogue, not an entitlement to NSE real-time data. Yahoo/NSE website endpoints can fail or delay data. Confirm the user's broker/data subscription and credentials before replacing the research feed with licensed quotes. Keep secrets server-side.
4. **Deployment:** confirm production URL, hosting plan and account access. Vercel can host application API functions. GitHub Pages cannot run them. No code has been pushed or deployed as part of this repair.
5. **Strategy validation:** the live composite score and historical individual rules are different strategies. Run the exact versioned live decision function on point-in-time data with walk-forward train/validation/untouched test periods, corporate actions, delistings, transaction costs, circuit limits and liquidity constraints. Compare against buy-and-hold and simple baselines. Report net expectancy, drawdown, turnover, sample size and uncertainty, not just win rate. Finish a forward paper period before claiming an edge.
6. **Android:** installable web app first. Validate installation on an actual Android device after HTTPS deployment; native signing, APK/AAB and Play Store release are not included.

## Data/hosting references checked

- Dhan live feed: https://dhanhq.co/docs/v2/live-market-feed/
- Kite exchange timestamps: https://kite.trade/docs/connect/v3/websocket/
- Kite historical candles: https://kite.trade/docs/connect/v3/historical/
- Vercel Cron plan limits: https://vercel.com/docs/cron-jobs/usage-and-pricing (Hobby once daily; unsuitable for continuous trading).

## Validation

Run Node >=22.12, `npm ci`, `npm test`, `npm run build`, `npm run lint`.
Regression fixtures are synthetic and test correctness, not profitability. Live strategy accuracy has not been established.

Verified locally: 17/17 regression tests passed, TypeScript/Vite production build passed, `git diff --check` passed. Lint completed with one pre-existing missing-effect-dependency warning in MetalsPage. Build reports a large main bundle and a mixed static/dynamic notification import. Desktop and 390px mobile layouts were inspected in the browser; journal navigation and fields were visible. Live Yahoo/NSE research requests returned data during the preview, but this does not validate feed reliability during a trading session.
