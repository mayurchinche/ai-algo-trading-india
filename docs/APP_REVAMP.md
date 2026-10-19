# App revamp: Analysis, Signals, Paper trading, IPO

Revamp done on 2026-10-19. The app had grown to 21 tabs, four paper-trading UIs on three ledgers, three views of the same browser scan and a second backtester. It is now organised around four things: **Analysis**, **Signals**, **Paper trading** and **IPO**, plus strategy tools.

## 1. What existed and what happened to it

| Before | Problem | Now |
|---|---|---|
| Overview, old Stock Analysis | Same browser scan of about 40 Yahoo screener names, scored by an unvalidated composite (no score ever reached the 70 threshold; see `FIVE_MINUTE_RESEARCH.md`). The browser re-ran it every 60 s on every tab. | Removed. Replaced by **Analysis** (any NSE stock) and **Signals** (validated rules). |
| Signals, Alerts, signal popup | One feed component shown three times; no push alerts were wired. | **Alerts** restored on request (2026-10-19): validated strategy alerts plus the intraday strong-signal feed and popup; the scheduler runs the alert scanner every minute again (needs `SHARED_PAPER_ENABLED=true`). |
| Trades (shared intraday account), segment selector + segment accounts, device journal | Four UIs, three ledgers; zero closed orders in production on 26 Sep 2026 (`PERFORMANCE_EVALUATION.md`). | Retired from the UI. **Paper trading** shows every run in every segment from one ledger. The server-side shared-paper engine and its `shared-paper-minute` cron job still exist; leave that job paused. |
| AI Discovery, Smart Picks | Same browser scan. | **Discover** and **Watch ideas** restored on request (2026-10-19) under Ideas; the browser scan now runs only while one of these pages is open. |
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

### Opening gaps (`/api/opening-gaps`)
NSE pre-open data for F&O stocks (09:00–09:08 IST). It covers every stock whose indicative open (IEP) is 1% or more from the previous close. For each one:
- **Pre-open orders:** the buy/sell imbalance.
- **Catalyst:** exchange announcements since the previous session.
- **52-week-high position.**
- **Peer score:** the NIFTY 50 scorecard composite.
- **Validated rules:** whether one is in a position, near a trigger or validated on that stock.
- **After 09:15:** whether the gap is extending, holding or filled, from the Upstox quote.

The validated gap rule is the daily gap-up continuation. A gap day that holds on high volume produces a next-session signal, which is paper-traded automatically. The intraday gap rules trade only once they pass validation.

### IPO
Unchanged.

## 3. Measured results of the library (local research run)

Run `node scripts/research/validate-library.mjs <daily dir> <15m dir>` on a stored dataset. The run of 2026-10-19 used Yahoo daily bars for 2016–2026 (NIFTY 50 constituents plus NIFTY and BANKNIFTY) and 60 days of 15-minute bars. The production gate uses Upstox data and may differ.

| Strategy | Segment | Trades | Win rate | Avg trade after charges | Profit factor | 1st / 2nd half avg | Gate | Stocks validated |
|---|---|---|---|---|---|---|---|---|
| VWAP trend breakout (15m) | Intraday | 1,835 | 32.5% | −0.235% | 0.44 | −0.21 / −0.26 | Fail | 0 |
| Supertrend flip (15m) | Intraday | 829 | 33.9% | −0.205% | 0.53 | −0.18 / −0.23 | Fail | 0 |
| Opening range breakout long (15m) | Intraday | 1,181 | 34.0% | −0.269% | 0.45 | −0.26 / −0.27 | Fail | 0 |
| Opening range breakout short (15m) | Intraday | 1,423 | 43.6% | −0.108% | 0.71 | −0.19 / −0.01 | Fail | 0 |
| Intraday momentum long (15m) | Intraday | 1,292 | 21.9% | −0.184% | 0.22 | −0.17 / −0.19 | Fail | 0 |
| Intraday momentum short (15m) | Intraday | 1,644 | 21.3% | −0.196% | 0.20 | −0.19 / −0.20 | Fail | 0 |
| Gap-and-go (15m) | Intraday | 55 | 43.6% | −0.146% | 0.67 | −0.15 / −0.15 | Fail | 0 |
| Gap-up fade (15m) | Intraday | 42 | 54.8% | +0.133% | 1.48 | +0.05 / +0.29 | Too few trades (unproven) | 0 |
| **Gap-up continuation (daily)** | Short term | 320 | 41.6% | +1.381% | 1.53 | +1.95 / +0.92 | **Pass** | 9 |
| RSI(2) pullback | Swing | 3,210 | 60.4% | +0.008% | 1.01 | +0.16 / −0.11 | Fail | 0 |
| EMA trend pullback | Swing | 676 | 46.0% | −0.303% | 0.83 | −0.27 / −0.33 | Fail | 0 |
| 20-day breakout (Turtle) | Short term | 2,077 | 39.6% | +1.007% | 1.35 | +1.68 / +0.33 | **Pass** | 36 |
| 200-day trend following | Long term | 714 | 19.0% | +2.307% | 2.25 | +4.69 / +0.63 | **Pass** | 26 |
| 52-week-high momentum | Long term | 287 | 41.5% | +12.87% | 3.42 | +14.19 / +11.53 | **Pass** | 4 |
| Futures Supertrend long | Futures | 1,619 | 31.4% | +0.342% | 1.16 | +0.42 / +0.28 | Fail (PF < 1.2) | 0 |
| Futures Supertrend short | Futures | 1,617 | 26.2% | −0.381% | 0.83 | +0.02 / −0.70 | Fail | 0 |
| Bull call / bear put spreads | Options | (validated through the futures rule) | | | | | Fail | 0 |
| Futures 20-day breakout, 25-day cap (one contract, no roll) | Futures | 2,871 | 41.8% | +0.371% | 1.15 | +0.79 / −0.06 | Fail (removed) | 0 |
| **Futures 20-day breakout, rolled monthly** | Futures | 2,176 | 40.5% | +1.124% | 1.41 | +1.81 / +0.43 | **Pass** | 40 |

What this means:
- **Intraday, cost split (60 days of 15-minute bars).** Every intraday trade pays about 0.083% in charges (brokerage, STT, exchange, stamp, GST) plus 0.1% assumed slippage (5 bps a side). Before slippage, the average trade was:

  | Rule | Average trade before slippage |
  |---|---|
  | ORB short | +0.075% |
  | Intraday momentum | about 0% |
  | ORB long | −0.09% |
  | VWAP breakout | −0.06% |

  None covers the charges alone, so the intraday failures come from a lack of edge, not from the cost model. The intraday rules (opening range breakout and intraday momentum, from Crabel 1990, Zarattini et al. 2023 and Gao et al. 2018) were added with fixed parameters chosen before testing.
- The futures breakout is the validated 20-day breakout rule traded through futures. Paper runs roll the position into the next contract two days before expiry (`rollLeg`); roll costs are charged in paper trading but not in the backtest, which uses the underlying price. The 25-day capped version failed, which shows the edge needs the full holding period.
- Options stay without signals: expired option prices are unavailable, so option rules can be validated only through their direction, and those directions failed.
- **Only the long-only trend and breakout rules on daily bars passed.** The intraday and swing rules lost money after charges, so those segments show no signals. This is the correct result, not a defect. Adding rules until something passes would overfit the history.
- **The edge weakened in the second half** for every passing rule. Expect lower returns than the full-history average.
- **Biases.** The universe is today’s NIFTY 50 applied to 2016 onward (survivorship bias). The decade was a rising market. Option spreads are validated only through their direction, because expired option prices are unavailable.
- **The forward test now runs automatically.** Every signal is paper-traded live with full charges, which gives an out-of-sample record. Judge the strategies on that record, not on the backtest.

## 4. Operations: fully automated

One scheduler drives everything. The existing pg_cron job `shared-paper-minute` (every minute, 09:15–15:35 IST on weekdays) calls `/api/scheduled-paper`. That endpoint now runs the **automation tick** (`server/automation.js`), not the retired intraday engine:

| When (IST) | Job |
|---|---|
| Every minute | Paper runs: stops and targets on 1-minute candles, square-off, decisions and fills at the live book |
| 09:16 and 09:31 | Bulk/block deals and FII/DII flows for the previous session, then the daily-strategy signal scan. Daily signals use the previous close and are paper-traded in today’s session. |
| Every 15 minutes | Intraday-strategy signal scan |
| Every 5 minutes | Strategy validation, one strategy per run, when one is missing or older than six days |
| Every 30 minutes | New NSE financial filings |

New signals open single-trade paper runs automatically (₹1 lakh each, at least ₹3 lakh for futures). Each run stops by itself after its trade closes, after its entry is rejected, or when its signal bar passes without an entry.

Every tick writes a heartbeat to `app_data` (`scheduler_status`). The Signals and Paper trading pages show when each job last ran and what it did.

Settings (Vercel environment):
- `AUTOMATION_ENABLED=false`: pauses everything.
- `SIGNAL_AUTO_PAPER=false`: stops automatic paper runs.
- `SIGNAL_PAPER_CAPITAL`: capital per automatic run.

The separate `spec-paper-cycle`, `signal-*` and `market-day` cron jobs from the migrations are not needed while the tick runs. Leave them inactive.

## 5. Remaining cleanup
- The legacy shared-paper server engine (`server/paperEngine.js`, `sharedPaper*.js`, `segmentPaper*.js`, `server/scheduledPaper.js`, `api/shared-paper.ts`); the scheduler endpoint no longer calls it and the browser scanner services it imports (`src/services/stockDiscovery.ts`, `discoveryScoring.ts`) are still used by Research portfolios and their tests. Remove them after Portfolios moves to the signal ledger.
- `src/services/backtestEngine.ts`, `signalHistory.ts` and `foregroundAlerts.ts` are referenced only by older tests (`tests/trading.test.ts`, `tests/indicators.test.ts`).
- No validated intraday or swing rule exists yet. New candidates must be fixed in advance from a published source, then pass the same gate. Thresholds must not be tuned after seeing results.
