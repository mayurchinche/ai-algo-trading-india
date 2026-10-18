# App revamp: Analysis, Signals, Paper trading, IPO

Revamp done on 2026-10-19. The app had grown to 21 tabs, four paper-trading UIs on three ledgers, three views of the same browser scan and a second backtester. It is now organised around four things: **Analysis**, **Signals**, **Paper trading** and **IPO**, plus strategy tools.

## 1. What existed and what happened to it

| Before | Problem | Now |
|---|---|---|
| Overview, AI Discovery, Smart Picks, old Stock Analysis | Same browser scan of about 40 Yahoo screener names, scored by an unvalidated composite (no score ever reached the 70 threshold; see `FIVE_MINUTE_RESEARCH.md`). The browser re-ran it every 60 s on every tab. | Removed. Replaced by **Analysis** (any NSE stock) and **Signals** (validated rules). |
| Signals, Alerts, signal popup | One feed component shown three times; no push alerts were wired. | Removed. **Signals** page with validation evidence. |
| Trades (shared intraday account), segment selector + segment accounts, device journal | Four UIs, three ledgers; zero closed orders in production on 26 Sep 2026 (`PERFORMANCE_EVALUATION.md`). | Retired from the UI. **Paper trading** shows every run in every segment from one ledger. The server-side shared-paper engine and its `shared-paper-minute` cron job still exist; leave that job paused. |
| Spec paper | Fills only at cycle times; no charges detail; events trimmed. | **Paper trading**: trades like live (below), permanent ledger. |
| Backtest page (`backtestEngine.ts`) | Second backtester with fixed rules. | Page removed. The Strategy lab (rule builder) backtests with the shared engine. `backtestEngine.ts` is still imported by older tests only. |
| Rule builder, Options wizard, Screener, Scorecards, Trend | Useful tools | Kept under **Strategy tools**. |
| Market news, Pre-market, Portfolios, Portfolio fit, Baskets, Metals | Secondary research | Kept under **More**. |
| IPO tracker | — | Kept as is. |

## 2. The four pillars

### Analysis (`/api/stock-analysis?symbol=`)
One report per NSE symbol (or NIFTY / BANKNIFTY), each section with its own status so one outage never fills another:
- **Quote** (Upstox full quote with depth) and **technicals** on two years of completed daily bars: returns, SMA/EMA, RSI, MACD, ATR, volatility and its percentile in the last year, Bollinger, Supertrend, 52-week range, pivots, 20/55-day support and resistance, volume ratio, average range and opening gap, trend score.
- **Fundamentals** from stored NSE XBRL filings (ROCE, ROE, debt/equity, P/E, PEG, market cap, growth) and **NIFTY 50 peer percentiles** from the scorecards.
- **News** (Google News, headline tone count) and **NSE corporate announcements**.
- **Bulk and block deals** (stored daily, plus today’s NSE files), **delivery %** (NSE full bhavcopy, last 10 sessions) and **FII/DII flows**.
- **Derivatives**: nearest future, lot size, basis; option chain summary (put-call OI ratio, max pain, ATM IV, highest call/put OI strikes).
- **SWOT** built by rules from those facts. Each item cites its basis. Thresholds are relative (peer percentile ≥70 / ≤30, the stock’s own volatility history, its own delivery average), never universal valuation cutoffs (`EVIDENCE_REQUIREMENTS.md`).
- **By segment** (intraday, swing, short term, long term, futures, options): the facts that matter for that horizon, plus each library strategy’s validation on this stock and where it stands today.

### Signals (`/api/signals`)
Signals come only from a **strategy library** (`shared/strategyLibrary.js`) of published rules with fixed parameters, after each passes a **validation gate** (`shared/strategyValidation.js`):
- Backtest with the shared engine: next-bar execution, 5 bps slippage, itemised broker tariff, about ₹1 lakh per trade.
- **Universe gate** (pooled over all NIFTY 50 stocks, plus indices for derivatives): at least 100 trades, profit factor ≥ 1.2, average trade ≥ 0.05% after charges, positive in both halves of the history.
- **Stock gate**: at least 8 trades on the stock, profit factor ≥ 1.1, positive average trade.
- Verdicts: VALIDATED, UNPROVEN (too few trades; missing evidence is not a loss) or REJECTED.

Jobs (pg_cron → `/api/signals?job=`):
- `validate`, every 2 h: refreshes the stalest strategy (10 years of daily bars, or 6 months of 15-minute bars).
- `scan`, every 15 min: runs every validated pair through the same engine a paper run uses, and records an entry decided on the last completed bar. Daily strategies are scanned after 15:35 IST and act in the next session.
- `market-day`, at 18:30 IST: records bulk/block deals and FII/DII flows.

Each new signal starts an automatic **single-trade paper run** with ₹1 lakh (`SIGNAL_AUTO_PAPER=false` turns this off; `SIGNAL_PAPER_CAPITAL` changes the amount). Users can also paper-trade a signal with their own capital. News, deals and fundamentals are shown alongside a signal but never change a validated rule, because they cannot be validated over the same history.

### Paper trading (`/api/spec-paper`)
Every run in every segment is executed the way a live order flow would be. No order reaches a broker.
- **Every minute**: resting SL-M and LIMIT orders are checked against the contract’s 1-minute candles since the last check; intraday positions are squared off on time; strategy P&L limits act at once.
- **Fills**: decisions on a completed bar execute in the same cycle at the live book. Market orders walk the visible 5-level depth. Entries need the broker margin quote (Upstox margin calculator) and enough paper funds.
- **Charges**: Zerodha’s published tariff, itemised (brokerage, STT, exchange, SEBI, stamp, GST, DP).
- **Record**: orders, trades with legs, entry and exit times and prices, gross P&L, charges, net P&L, MAE and MFE, kept in an append-only ledger (`spec_paper_events`) committed with the state. The page shows funds, performance (win rate, expectancy, profit factor, drawdown), positions, closed trades with per-leg detail, orders and rejected entries, and exports the full ledger as CSV or JSON.

### IPO
Unchanged.

## 3. Measured results of the library (local research run)

Run `node scripts/research/validate-library.mjs <daily dir> <15m dir>` on a stored dataset. The run of 2026-10-19 used Yahoo daily bars for 2016–2026 (NIFTY 50 constituents plus NIFTY and BANKNIFTY) and 60 days of 15-minute bars. The production gate uses Upstox data and may differ.

| Strategy | Segment | Trades | Win rate | Avg trade after charges | Profit factor | 1st / 2nd half avg | Gate | Stocks validated |
|---|---|---|---|---|---|---|---|---|
| VWAP trend breakout (15m) | Intraday | 1,835 | 32.5% | −0.235% | 0.44 | −0.21 / −0.26 | Fail | 0 |
| Supertrend flip (15m) | Intraday | 829 | 33.9% | −0.205% | 0.53 | −0.18 / −0.23 | Fail | 0 |
| RSI(2) pullback | Swing | 3,210 | 60.4% | +0.008% | 1.01 | +0.16 / −0.11 | Fail | 0 |
| EMA trend pullback | Swing | 676 | 46.0% | −0.303% | 0.83 | −0.27 / −0.33 | Fail | 0 |
| 20-day breakout (Turtle) | Short term | 2,077 | 39.6% | +1.007% | 1.35 | +1.68 / +0.33 | **Pass** | 36 |
| 200-day trend following | Long term | 714 | 19.0% | +2.307% | 2.25 | +4.69 / +0.63 | **Pass** | 26 |
| 52-week-high momentum | Long term | 287 | 41.5% | +12.87% | 3.42 | +14.19 / +11.53 | **Pass** | 4 |
| Futures Supertrend long | Futures | 1,619 | 31.4% | +0.342% | 1.16 | +0.42 / +0.28 | Fail (PF < 1.2) | 0 |
| Futures Supertrend short | Futures | 1,617 | 26.2% | −0.381% | 0.83 | +0.02 / −0.70 | Fail | 0 |
| Bull call / bear put spreads | Options | (validated through the futures rule) | | | | | Fail | 0 |

What this means:
- **Only the long-only trend and breakout rules on daily bars passed.** The intraday and swing rules lost money after charges, so those segments show no signals. This is the correct result, not a defect. Adding rules until something passes would overfit the history.
- **The edge weakened in the second half** for every passing rule. Expect lower returns than the full-history average.
- **Biases.** The universe is today’s NIFTY 50 applied to 2016 onward (survivorship bias). The decade was a rising market. Option spreads are validated only through their direction, because expired option prices are unavailable.
- **The forward test now runs automatically.** Every signal is paper-traded live with full charges, which gives an out-of-sample record. Judge the strategies on that record, not on the backtest.

## 4. Operations

1. Apply migrations in Supabase, in this order:
   - `20261020_spec_paper_ledger.sql`: event ledger, per-minute cycle.
   - `20261021_trading_signals.sql`: validations, signals, deals and flows, 100 active runs, jobs.
2. Make sure `UPSTOX_ANALYTICS_TOKEN` and `PAPER_SCHEDULER_SECRET` (Vercel, and `paper_scheduler_secret` in Vault) are set.
3. Run one job by hand, for example `curl -X POST -H "Authorization: Bearer $SECRET" https://ai-algo-trading-india.vercel.app/api/signals?job=validate`. Repeat it until every strategy is validated (one per call). Then enable the jobs:
   ```sql
   select cron.alter_job(jobid, active:=true) from cron.job where jobname in ('signal-validate','signal-scan','market-day','spec-paper-cycle');
   ```
4. Leave `shared-paper-minute` (the retired intraday engine) disabled.

## 5. Remaining cleanup
- The legacy shared-paper server engine (`server/paperEngine.js`, `sharedPaper*.js`, `segmentPaper*.js`, `api/shared-paper.ts`, `api/scheduled-paper.ts`) and the browser scanner services it imports (`src/services/stockDiscovery.ts`, `discoveryScoring.ts`) are still used by Research portfolios and their tests. Remove them after Portfolios moves to the signal ledger.
- `src/services/backtestEngine.ts`, `signalHistory.ts` and `foregroundAlerts.ts` are referenced only by older tests (`tests/trading.test.ts`, `tests/indicators.test.ts`).
- No validated intraday or swing rule exists yet. New candidates must be fixed in advance from a published source, then pass the same gate. Thresholds must not be tuned after seeing results.
