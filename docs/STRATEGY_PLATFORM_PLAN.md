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
  - `server/fundamentalsIngest.js` ingests new XML filings from the NSE financials feed (skips stored ones, 40 s budget, per-filing outcomes). Route `/api/fundamentals`: `GET ?instrumentKey=NSE_EQ|<ISIN>` derives; scheduler `POST` ingests.
  - `server/schedulerAuth.js` now owns the scheduler Bearer check used by the premarket, paper and fundamentals schedulers.
  - Tests: `tests/fundamentals.test.ts`, `tests/fundamentals-database.mjs`.

### Next

1. Before enabling the job: apply the migration, verify one manual `POST /api/fundamentals`, then activate `fundamental-filings` in pg_cron.
2. Growth and ratios need annual (Q4) filings. The rolling feed only holds recent filings, so values appear after the April–May results season unless history is backfilled from an archive source.
3. Trend indicator and dashboard (Phase 1, item 1).
