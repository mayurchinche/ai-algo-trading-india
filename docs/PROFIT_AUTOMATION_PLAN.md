# Profit automation plan: sector → stock → setup → trade (intraday + options)

## 1. Existing assets (inventory)

| Area | Where | Use in the pipeline |
|---|---|---|
| Sector/stock momentum | Discovery (`discoveryLedger.js`, DiscoveryPage), TrendDashboard, smartMoney | Steps 1–2: rank sectors and stocks |
| Screeners / rule builder | ScreenerPage, RuleBuilderPage, `shared/strategyLibrary.js` | Step 3 filters |
| TradingView / technical rating | TradingViewPanel, `stockAnalysis.js`, ExternalIndicatorReview | Step 3 confirmation |
| Fundamentals, filings, bulk deals | `fundamentals*.js`, `companyDisclosures.js`, `marketIntel.js` | Quality veto / event flags |
| News | `marketNews.js`, MarketNewsPage | Step 5 catalysts |
| Pre-market / opening gaps | `premarket.js`, `openingGaps.js`, `gapFillBook.js` | Step 5 intraday triggers |
| Signals, alerts, outcomes | `signalEngine.js`, `alertPolicy.js`, `accuracy.js` | Scoring, live-vs-backtest |
| Option chain (live) | `optionChain.js`, `upstoxReadOnly.js`, OptionsWizardPage | Step 7 |
| Paper engines | `paperEngine.js`, `aggressiveBook.js`, `specPaperRunner.js`, `portfolioCaps.js` | Execution, caps |
| History | NSE bhavcopy 2016→ (daily), F&O bhavcopy (EOD), Upstox 1-min equity 2022→ (140 stocks) | Backtests |

## 2. Why option data was "unavailable" (verified 24 Oct 2026)

| Endpoint | Result |
|---|---|
| `/v2/option/contract`, `/v2/option/chain` (live) | works |
| `/v2/expired-instruments/*` (historical expired options) | **401 UDAPI100058: "No segments for these users are active"** |
| historical candles for currently live option keys | pending (build was rate-limited) |

Cause: the Upstox account has no active segment (F&O not activated), so expired-contract history is refused.
Action for the user: re-activate F&O in the Upstox app/web (no trade is needed). Until then:
- EOD option history comes from NSE F&O bhavcopy (already cached, 2,821 days),
- intraday option data accrues forward: snapshot the live chain every 5 min (new job, paper only).

## 3. Daily pipeline (point-in-time, no look-ahead)

1. 08:55–09:08 pre-open: sector momentum (previous close ranks + pre-open indicative moves).
2. 09:08: stock list = momentum sectors ∩ liquid F&O names, gap/pre-open imbalance.
3. 09:15–09:30: screeners + technical rating + opening range confirm.
4. Rank, take ≤3 candidates (₹1,000 risk each, daily stop 1.5%).
5. Trigger = opening-range / VWAP break with news/bulk-deal flag; exit by target 0.5–1% / stop / 15:15.
6. Options: when the underlying trigger fires, buy defined-risk (ATM debit or spread) sized to ₹1,000 max loss.
7. Every decision logged with evidence; compared to backtest on the Accuracy page.

## 4. Validation rules (unchanged)
Fix parameters before testing, count every variant, deflated t-stat bar, locked holdout, costs and slippage included.
A sleeve goes live in paper only after it passes dev; real money only after 2–3 months of live paper agreement.
