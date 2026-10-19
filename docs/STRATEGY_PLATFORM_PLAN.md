# Strategy platform plan

Written 18 October 2026. Plan for adding Tradetron-style strategy building and SuperInvesting-style research to this app. Phase 0 has started; see [Status](#status).

## Sources and limits

- **Tradetron:** public product pages only (home, `/pages/features`, `/option-wizard`, `/keyword-documentation`, `/backtest`).
- **SuperInvesting:** the public web bundle (`/_expo/static/js/web/index-*.js`), plus two public config lists (`PROMPT_LIBRARY`, `STOX_AI_STARTERS`) and one trend-indicator response for RELIANCE that the app loads without logging in. No authenticated or paid content was accessed.
- **Not visible:** the scoring, trend and backtest engines of both companies run on their servers. Only what their screens and responses show was observed. Formulas marked *inferred* are our reconstruction.
- **Build our own, don't copy theirs:**
  - SuperInvesting's terms forbid scraping, reverse engineering or reselling its data and verdicts. We must not call its APIs, reuse its prompt text or copy its scores.
  - Public investing frameworks (Buffett value, Lynch GARP, CANSLIM, 100-bagger) may be reimplemented with our own transparent rules and an "inspired by, not endorsed by" disclaimer.

## What Tradetron offers

| Area | Observed features |
|---|---|
| **Ways to build** | Plain-English building through Claude/ChatGPT (via MCP), with an AI check that compares the request against what the strategy does before go-live. |
| | A drag-and-drop builder with 214 keywords in 16 groups (indicators, Greeks, strike and expiry pickers, time, candle patterns, Heikin-Ashi/Renko, values frozen at entry, strategy P&L and position state). |
| | Python blocks for custom logic. |
| **Options Wizard** | Preset structures: covered call, protective put, straddle, strangle, iron condor, butterfly, collar, jade lizard, calendar, ratio. |
| | Per leg: CE/PE, ATM/ITM/OTM, current/next week or month. Target, stop-loss and trailing stop per leg in % or points. |
| | Entry time and weekdays. Strategy-level profit/loss exit (% of capital or amount), strategy trailing stop, exit on expiry day or after N days. |
| **Stockbag** | Portfolios weighted equal, by market cap, or by momentum/value. Rebalanced on a schedule or when weights drift past a threshold. |
| **Backtest** | Event-driven: steps through every minute in order and carries state. Real 1-minute option prices and OI since 2020. |
| | Gross vs net after costs, with an adjustable cost slider. CAGR, Sharpe, Sortino, Calmar, MAE/MFE, a 2,000-path Monte-Carlo test. |
| | **A–F grade:** starts at 100 and loses points for drawdown, one-month profit concentration (penalty from about 35%), win rate and net Sharpe. Also flags likely overfitting. |
| **Running live** | "Live Offline" paper mode, then 100+ brokers. Splits large orders into tranches. |
| | Health score, WhatsApp/Telegram alerts, daily broker reconciliation, plain-English trade explanations, and a marketplace verified on live performance. |

## What SuperInvesting offers

**Investor-style AI scores.** Exact persona IDs and column names from the bundle:

| ID | Style | Column |
|---|---|---|
| `warren-buffett-1` | Value | WB Score |
| `peter-lynch-1` | GARP | PL Score |
| `rakesh-jhunjhunwala-1` | India growth | RJ Score |
| `100-bagger` | Compounder | 100B Score |
| `canslim-1` | CANSLIM | CANSLIM Score |
| `growth-focused` | Locked / unreleased | — |

- These combine into a "Super Investing AI Score" (`siScore`).
- Each stock page shows per-style verdicts with plus/minus labels, a news sentiment score, analyst recommendations, a news timeline, peers, and the baskets holding the stock.

**Magic Trend.** The dashboard has tabs All / Bullish / Trend Start / Trend End, plus days since signal. It scores 0–4 bearish, 4–7 neutral, 7–10 bullish.
- The observed response fields are `dates, close, score, zlema, volatility, atr14, signals[{index, type, score}]`.
- *Inferred:* a zero-lag EMA (ZLEMA) trend with an ATR volatility band. Buy signals fire around score ≥ 7 and sell signals around ≤ 4.

**Screener columns:**
- Price and returns: price, market cap, 1M/6M/1Y/3Y/5Y return, % off 52-week high/low.
- AI scores: the scores listed above.
- Fundamentals: P/E, PEG, ROCE, ROE, Debt/Equity.
- Growth: sales and profit growth over 1, 3 and 5 years.

**Risk profile and portfolio fit.** This runs in the browser, so it was observed exactly.
- Score: weighted answers — age 15, goal 25, horizon 20, reaction to a 30% crash 15, expected return 25.
- The total is multiplied by how much the family depends on the money: 1, 0.85 or 0.6.
- Six contradiction checks, for example "panic seller who expects high returns".

| Investor type | Score | Large/Mid/Small target % | Max single stock | Max top 5 | Max single sector | Max top 3 sectors | Stocks | Min sectors |
|---|---|---|---|---|---|---|---|---|
| Capital Protector | 0–24 | 80/15/5 | 8 | 35 | 20 | 50 | 15–25 | 6 |
| Stability Seeker | 25–37 | 60/25/15 | 10 | 40 | 22 | 55 | 12–20 | 5 |
| Steady Compounder | 38–53 | 45/35/20 | 12 | 45 | 25 | 60 | 12–18 | 5 |
| Growth Architect | 54–70 | 30/40/30 | 15 | 50 | 28 | 65 | 10–18 | 4 |
| Alpha Hunter | 71–100 | 15/40/45 | 18 | 55 | 30 | 70 | 8–15 | 4 |

The fit score weighs diversification, concentration, quality (always 50%) and structure. The non-quality weights differ by investor type.

**Other features:**
- **AI Baskets:** returns compared to NIFTY and a 7% FD line (the FD rate is hard-coded at 7%/365 per day), plus a model portfolio.
- **Portfolio:** sync through the smallcase gateway, or CSV/XLSX upload.
- **AI chat with tool-calling sub-agents:** Comparison, Browser, Persona, Portfolio, Screener, Sector and Research. Built on the Vercel AI SDK.
- **Prompt library:** four groups — Stock Discovery, Fundamental Financial Metrics, Investing Frameworks, Sectoral Analysis.

## Gaps in this app

| Capability | Current state | Missing |
|---|---|---|
| Strategy definition | Hard-coded functions | Declarative spec, builder, registry |
| Indicators | 6, previously duplicated in two files | Most of the catalogue; Greeks |
| Options | Pilot that only buys ATM index options; off by default | Option chain, IV/Greeks, multi-leg, wizard |
| Risk exits | Fixed stop/target; daily loss limit only blocks new entries | Trailing stop, re-entry, P&L-based forced exit, tranching |
| Backtest | One symbol, daily bars, long-only | Minute-level event-driven engine, options, Monte-Carlo, grade, cost slider |
| Paper trading ("Live Offline") | Strong event ledger and fill model | Reuse as-is |
| Live execution | None | Broker order adapter, SEBI retail-algo compliance |
| Research scores | Rule-based composite only | Investor-style scores, trend indicator, risk profile, portfolio fit, baskets |

## Phases

### Phase 0 — Foundations

1. **Shared indicator library** (`shared/indicators.js`).
   - Series in, series out. NaN during warm-up. Inputs are validated.
   - Legacy variants (Cutler RSI, simple ATR, EMA seeded with the first value) are explicit options.
2. **Strategy spec v1** (`shared/strategySpec.js`) and condition evaluator (`shared/strategyConditions.js`).
3. **Fundamentals store:** a Supabase table of filings captured through `server/financialStatements.js`, with ROCE, ROE, D/E, P/E, PEG and 1/3/5-year sales and profit growth derived on read. Includes source filing and as-of date. Ratios whose inputs are not extracted stay unavailable.

### Phase 1 — Research layer

1. **Trend indicator:** ZLEMA ± ATR band mapped to a 0–10 score, with buy/sell signals.
   - Indicator Dashboard with All / Bullish / Trend Start / Trend End and days since signal.
   - Validate it with `research/` replay before showing signals.
2. **Investor-style scorecards** (`server/personaScores/`): transparent 0–100 rules for value, GARP, India growth, compounder and CANSLIM, plus a composite score. Each score lists its inputs and any missing data.
3. **Screener:** column picker using the four groups above, sorting, CSV export.
4. **Risk profile and portfolio fit:** extend the `server/researchPortfolio.js` mandates; add CSV/XLSX holdings import.
5. **Baskets:** saved screens with daily returns compared to NIFTY and an FD line.

### Phase 2 — Strategy builder

1. **Options data:** Upstox option chain (read-only), Black-Scholes IV and Greeks, strike pickers by ATM offset, premium or delta.
2. **Options Wizard:** preset structures that generate a strategy spec.
3. **Rule builder UI:** a condition-tree editor over the indicator catalogue.
4. **Event-driven backtester:**
   - Extend `research/fiveMinuteExecution.js` and `research/asOfMarket.ts` to run on specs.
   - Costs from `research/zerodhaCosts.js`.
   - Metrics, Monte-Carlo bootstrap, A–F grade with overfitting flags, cost slider.
5. **Paper engine** (`server/paperEngine.js`, `server/segmentPaperEngine.js`): trailing stop, re-entry, forced exit on strategy-level loss, multi-leg, tranching.

### Phase 3 — Live execution and operations (needs a separate decision)

1. Broker order adapter behind a feature flag, with a kill switch and daily reconciliation.
2. SEBI retail-algo framework requirements: orders through the broker's API, algo ID tagging, static IP, order-rate limits.
3. Telegram alerts, net P&L after charges, plain-English trade explanations from `server/decisionEvidence.js`, health score.

### Phase 4 — AI layer (optional)

1. Plain-English request → strategy spec, with an AI check comparing the request against what the strategy does.
2. Grounded research chat with tool-calling agents, and a prompt library.
3. An MCP server exposing this app's tools.

## Constraints

- **Regulation:**
  - Selling model portfolios, baskets or recommendations generally needs SEBI Research Analyst or Investment Adviser registration.
  - Live retail algos fall under the SEBI retail-algo framework.
- **Data:** options backtesting needs licensed 1-minute history of expired contracts. Kite's historical API does not cover expired options. Upstox's expired-instrument coverage is unverified.
- **Evidence:** keep the existing evidence-first rules. Signals stay paper-only until there is cost-adjusted historical and forward evidence.

## Status

### Done

- **`shared/indicators.js`**
  - Indicators: SMA, EMA (standard or legacy seed), RMA, RSI (Wilder or Cutler), MACD, true range, ATR (Wilder or simple), Bollinger, stdev, highest, lowest, Donchian, ZLEMA, Supertrend, session VWAP, crossover, crossunder.
  - Replaces the duplicated indicator code in `src/services/discoveryScoring.ts` and `src/services/backtestEngine.ts`.
  - `evaluateDiscoverySnapshot` now returns `null` for mismatched or non-finite series instead of producing NaN scores.
- **Results unchanged:**
  - The discovery golden test passes unchanged.
  - New `tests/fixtures/backtest-golden.json` was captured from the previous engine. It covers all five backtest strategies, and the migrated backtest reproduces it exactly.
  - Indicator series are now computed once per run instead of for every bar. On a synthetic 1,250-bar series the backtest takes 2.9 ms per run, down from 5.4 ms (warm, 5-run average, local machine).
- **Strategy spec v1 and evaluator**
  - `shared/strategySpec.js`: `parseStrategySpec` returns a frozen spec or every issue with its JSON path.
  - `shared/strategyConditions.js`: `computeStrategySeries` and three-valued `evaluateCondition`.
- **Tests:** `tests/indicators.test.ts` and `tests/strategy-spec.test.ts`.
- **Fundamentals store**
  - Migration `supabase/migrations/20261018_fundamental_filings.sql`: insert-only, server-only `fundamental_filings` table; idempotent `record_fundamental_filing` RPC (retry by filing ID or document hash returns the stored row; no backdated observations); `dispatch_fundamental_ingest` pg_cron job every 30 minutes, installed inactive.
  - `server/fundamentals.js`: `toFundamentalFiling` stores only issuer-reported facts and keeps every other parser status. `deriveFundamentals` uses the latest revision published by `asOf`, and computes 1-year change and 3/5-year CAGR for revenue, continuing profit and profit for the period from exact annual periods.
  - Ratios (formula version `fundamental-ratios-v2`), each listing every input with its source filing, period or year-end date:
    - ROCE = (profit before tax + finance costs) / (total assets − current liabilities) at year end.
    - ROE = profit for period / average of opening and closing equity.
    - D/E = (non-current + current borrowings) / equity at year end.
    - P/E = previous trading day's close (Upstox daily candle, at most 10 days old) / latest annual basic EPS.
    - PEG = P/E / 3-year profit CAGR.
    - Missing inputs, non-positive denominators, EPS or growth, and unusable prices leave a ratio unavailable with the reason.
  - Parser (`server/financialStatements.js`) now also reads profit before tax, finance costs, basic EPS (currency-per-share unit) and year-end balance-sheet positions from instant contexts.
  - **Parser fix:** live NSE integrated filings repeat the reporting scope and audit declaration for each reported period. The previous parser required a single fact and so rejected every live filing; checked against 20 filings in the 17 Oct 2026 feed, all 12 Ind AS filings now parse with every fact present. This also affects the disclosure inbox and the research-portfolio financial snapshot.
  - Banking-format filings are classified `UNSUPPORTED_FINANCIAL_FORMAT` and not stored.
  - **Backfill** (`server/fundamentalsBackfill.js`, `npm run fundamentals:backfill -- --nifty50`, or `--dry-run`): reads NSE's per-company integrated-filing index and records the annual (quarter ending 31 March) Ind AS filings.
    - Identity is the ISIN from NSE's constituent list. Filings under a former or mistyped symbol (TATAMOTORS for TMPV, BAJAJAUTO for BAJAJ-AUTO) are recorded with `filedSymbol`. Growth and ratios whose inputs span different filed symbols carry `FILED_SYMBOL_CHANGED`, because demergers and renames are not adjusted.
    - Pre-integrated NSE XBRL is excluded: INFY's FY2024 file labels full-year facts with a January–March context. The parser now rejects any context whose dates contradict the filing's declared reporting period.
    - Financial documents may be up to 16 MB (annual standalone filings with related-party schedules reach about 10 MB; a 9.8 MB filing parses in about 0.3 s with 60 MB heap). Feeds and indexes stay at 1 MB.
    - Dry run on the NIFTY 50 (18 Oct 2026): ROCE, ROE, D/E and 1-year growth for FY2026 for 37 of 50 companies. 13 banks, NBFCs and insurers are unsupported. Two ADANIENT links return NSE error pages. LT's FY2025 filing has no Ind AS equity total, so its ROE is unavailable. 96 s, 11.6 s CPU, 353 MB peak RSS.
  - `server/fundamentalsIngest.js` ingests new XML filings from the NSE financials feed (skips stored ones, 40 s budget, per-filing outcomes). Route `/api/fundamentals`: `GET ?instrumentKey=NSE_EQ|<ISIN>` derives; scheduler `POST` ingests.
  - `server/schedulerAuth.js` now owns the scheduler Bearer check used by the premarket, paper and fundamentals schedulers.
  - Tests: `tests/fundamentals.test.ts`, `tests/fundamentals-database.mjs`.

- **Trend score and dashboard (Phase 1, item 1)**
  - `shared/trendScore.js`: our own `trend-score-v1` (ZLEMA21 position and slope in ATR14 units, 0–10) with hysteresis BUY/SELL signals on completed daily bars.
  - Replay: `research/trendReplay.js` with `scripts/research/fetch-trend-dataset.mjs` and `run-trend-replay.mjs`. It passed its pre-declared criteria on 10 years of NIFTY 50 data, but most trades lost, it trailed buy-and-hold in 49 of 50 stocks, and trades lost on average in 2025–2026. See `docs/TREND_SCORE_RESEARCH.md`.
  - Dashboard: **Trend score** tab (`src/components/TrendDashboardPage.tsx`) with All / Bullish / Trend start / Trend end, sessions since signal and a price/score chart for the NIFTY 50 list of 18 Oct 2026. Every view shows the replay result; signals are not connected to paper or live orders.
  - Tests: `tests/trend-score.test.ts`, `tests/trend-dashboard.test.ts`.

- **Investor-style scorecards (Phase 1, item 2)**
  - `server/scorecards.js` (`style-scorecards-v1`): our own rules for five styles — Value, GARP, Growth, Compounder, Earnings and price momentum — each a weighted mean of criteria. Each criterion is a mid-rank percentile among companies whose latest annual period ends on the same date; no universal cutoffs (per `docs/EVIDENCE_REQUIREMENTS.md`).
  - A criterion needs at least 10 peers with data; a style needs two-thirds of its weight ranked; the composite needs three scored styles. Every unscored item names what is missing; inputs spanning a symbol change carry `FILED_SYMBOL_CHANGED`.
  - Price criteria (12-month return, distance below the 52-week high) use one year of Upstox daily bars. Windows with a daily move above 35% are excluded as possible unadjusted corporate actions.
  - Route `/api/scorecards?universe=NIFTY50` (10-minute cache), **Scorecards** tab with sortable styles and a per-criterion breakdown with source filings.
  - Live end-to-end check (18 Oct 2026, backfill into memory, no Upstox token): 39 of 50 companies have a supported annual filing; only Value is scored (38 companies), because GARP, Growth and Compounder need 3- or 5-year history and Momentum needs prices. No composite is scored yet. Scoring took 30 ms; the response is 354 KB.
  - Tests: `tests/scorecards.test.ts`.
- **Screener (Phase 1, item 3)**
  - **Screener** tab (`src/components/ScreenerPage.tsx`) over the same `/api/scorecards` data: 20 columns in the four groups (price and returns, scores, fundamentals, growth), a column picker remembered in the browser, sorting with unavailable values always last, symbol/ISIN search, and CSV export of the current view.
  - `src/services/screener.ts` owns every column's label, unit and value for both the table and the CSV. CSV blanks are unavailable values, numbers stay numeric, and text that a spreadsheet would run as a formula is prefixed with an apostrophe.
  - Market cap (₹ crore) = previous close × filed paid-up equity capital ÷ face value from the latest reported period, at most 200 days old (`SHARES_STALE` otherwise). Checked on live filings: TCS 3.62bn, Reliance 13.53bn and ITC 12.53bn shares; INFY's 4.05bn is net of treasury shares in its consolidated filing. Not adjusted for splits, bonuses or buybacks after that period.
  - Tests: `tests/screener.test.ts`.
- **Risk profile and portfolio fit (Phase 1, item 4)**
  - `shared/riskProfile.js` (`risk-profile-v1`): our own four-question self-assessment (horizon, reaction to a 30% fall, reliance on the money, experience). The profile — Conservative, Balanced or Growth — is the most cautious answer, never an average; answers two levels apart are shown as tensions. Not SuperInvesting's questionnaire or table, and not a regulatory suitability assessment.
  - Each profile sets limits (largest holding, top five, largest sector, minimum holdings) and research-portfolio mandate defaults; the **Portfolios** form can apply them ("Use its limits"), and every profile's mandate passes `validateMandate`.
  - `shared/holdingsImport.js`: RFC 4180 CSV import with listed header aliases (for example Instrument / Qty. / Avg. cost), symbol or ISIN, merged repeats and per-line skip reasons. XLSX is not read: save as CSV.
  - `shared/portfolioFit.js` (`portfolio-fit-v1`): each check is PASS, BREACH or UNKNOWN. Weight checks need every holding priced; a sector pass needs room for all unclassified holdings, while a proven sector breach is reported regardless. Quality is reported as coverage (supported filings, Value-score coverage and weighted Value score), not a fit score.
  - Sectors come from NSE's industry column in the same NIFTY 50 constituent file (now in `shared/universes.js`); other holdings are unclassified. Prices are the latest completed Yahoo daily close, at most 10 days old.
  - **Portfolio fit** tab. Answers are kept in the browser; the holdings file is read in the browser and never uploaded or saved.
  - Tests: `tests/portfolio-fit.test.ts`.

- **Baskets (Phase 1, item 5)**
  - `shared/basketPerformance.js`: equal-weight buy-and-hold from the first session on or after the start date, against NIFTY 50 and a compounding FD line at a user-set rate. Members without a start-date close are excluded and named; missing later closes carry forward and are counted.
  - **Baskets** tab: screens over screener columns (missing values never pass), saved with their members and date in the browser. Returns since creation are shown first; a past-year view with today's members is labelled as hindsight.
- **Options data (Phase 2, item 1)**
  - `shared/optionsMath.js`: Black-Scholes-Merton price, Greeks, arbitrage bounds and bisection IV, checked against textbook values.
  - `shared/optionChain.js` and `/api/option-chain`: the Upstox put/call chain (read-only path added to the adapter), model IV from the two-sided mid with provider Greeks kept separately, lot sizes from the instrument master, and strike selection by ATM offset, premium or delta. The chain has no per-contract timestamps; that is stated.
- **Options Wizard (Phase 2, item 2)**: twelve standard structures generate validated specs; legs resolve on the live chain; payoff at the first expiry (later legs by Black-Scholes) with bounded or unbounded max profit and loss, breakevens and net Greeks. Futures legs are priced at spot.
- **Rule builder (Phase 2, item 3)**: templates, indicator catalogue, nested ALL/ANY/NOT condition trees, legs with stop, target and trailing stop, strategy risk, live validation with JSON paths and JSON editing.
- **Spec backtester (Phase 2, item 4)**
  - `shared/specEngine.js`: one JSON-serialisable engine shared with paper runs. Completed-bar decisions fill at the next open; stops fill at the level or a worse gap; stop assumed first in ambiguous bars; trailing stop tightens by `step` for every `trigger` of favourable move; strategy max loss, target, holding limit and exit condition; edge-triggered entries with intraday re-entry after a matching exit; square-off including a missed square-off bar; child orders above a size limit; MAE and MFE.
  - `shared/backtestMetrics.js`: CAGR, Sharpe, Sortino, Calmar, profit factor, a seeded 2,000-path Monte-Carlo, an early/late split, an A–F grade from documented deductions, and overfitting flags (few trades, profit concentration, cost sensitivity, many parameters, instability, high loss probability). The cost and slippage sliders recalculate without refetching.
  - Option legs are refused: historical prices of expired contracts are not available. Real-data check (10 years of daily bars): the three templates run in 20–91 ms and grade C–F.
- **Spec paper runs (Phase 2, item 5)**: migration `20261019_spec_paper_runs.sql` (versioned saves, inactive 5-minute dispatch); the scheduler steps each run once per cycle on its latest completed Upstox bar. Contracts are resolved live (option strikes on the chain), multi-leg entries are all-or-nothing, fills use the live bid or ask, and missed bars, missing quotes and unresolved contracts are recorded. **Strategy paper runs** tab; **Start paper run** in the rule builder. The existing intraday and segment paper engines are unchanged.

### Phase 3 and 4 status

- **Phase 3 (paper trading that behaves like live) is done; there are still no live orders.** On 2026-10-19 the scope was set to paper only.
  - **Engine and fills:** `spec-engine-v2` keeps order records and walks 5-level depth for fills.
  - **Charges and margin:** itemised Zerodha tariff (`shared/brokerCharges.js`) and a margin-calculator check (`server/upstoxMargin.js`).
  - **Monitoring:** resting SL-M and LIMIT orders are checked on 1-minute candles every minute.
  - **Records:** trade records and an append-only ledger (`20261020_spec_paper_ledger.sql`).
  - Details are in `APP_REVAMP.md`.
- **App revamp and validated signals:** see `APP_REVAMP.md`.
  - Analysis, Signals and Paper trading pages.
  - Strategy library with a validation gate; daily signal scan with automatic single-trade paper runs.
  - Bulk/block deals, delivery and FII/DII capture.
- **Investing section (19 Oct):** SuperInvesting-style research built from our own rules: per-style plus/minus verdicts, a rule-based research assistant with an example library (own wording), screener, trend, baskets and portfolio fit (CSV and Excel) on one page; bank and NBFC filings; older annual results. Details in `APP_REVAMP.md`.
- **Phase 4 (AI layer) is not started.** No paid LLM provider is available. The Investing assistant is rule-based, not a model. Recommended path:
  - A deterministic plain-English → spec parser, validated by `parseStrategySpec`.
  - Optionally, a local or free-tier model behind a provider-neutral interface.
  - A model never supplies numbers that the parser does not validate.

### Next

1. Apply `20261020_spec_paper_ledger.sql` and `20261021_trading_signals.sql`, run `POST /api/signals?job=validate` until every strategy has a verdict, then enable `signal-validate`, `signal-scan`, `market-day` and `spec-paper-cycle` in pg_cron. Keep `shared-paper-minute` disabled.
2. Before enabling the fundamentals job: apply the migration, verify one manual `POST /api/fundamentals`, then activate `fundamental-filings` in pg_cron. Run `npm run fundamentals:backfill -- --nifty50` afterwards.
3. Verify the option-chain, margin and depth responses with a real Upstox token (their shapes come from Upstox documentation and have not been observed live here).
4. Review the forward record of the automatic signal paper runs after at least 30 closed trades per strategy before trusting any strategy with money.
5. Retire the legacy shared-paper engine once Research portfolios no longer read its segment signals.
