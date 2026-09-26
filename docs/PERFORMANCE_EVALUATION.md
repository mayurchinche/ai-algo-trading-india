# Measuring paper performance

Implemented locally on 26 September 2026. No live execution settings, balances or deployment changed.

## Current evidence

A read-only production snapshot on 26 September found zero closed orders in each shared account: intraday, short-term, long-term, options and futures. Win rate, expectancy and profit factor are unavailable. This is not a zero percent win rate and does not establish profitability.

The daily strategy backtester is exploratory and is not the live composite scanner. The earlier eight-instrument score audit is not an execution backtest. Neither should be reported as the current strategy's win rate.

## Reproducible forward report

From the repository root:

```
node scripts/research/paper-performance.mjs https://ai-algo-trading-india.vercel.app /tmp/paper-performance.json
```

This reads five existing shared accounts using GET only. It does not run a trading cycle or alter funds or settings. The API may idempotently ensure an account exists. A provider, HTTP or malformed-snapshot error fails the command; output is written only when every account succeeds. Accounts are read sequentially, with their individual revisions, not as one database transaction.

The evaluator reports net winning/losing/breakeven trades, win rate, a Wilson 95% interval, net expectancy per trade, profit factor and closed-trade drawdown in rupees. Zero observations return null. Profit factor is undefined when there are no losing trades, not an invented infinity. The interval describes the observed win proportion, assumes independent outcomes, and is not a probability of future profitability.

Eligibility requires a closed, completely filled order; valid ordered signal/submission/source-quote/processing timestamps; explicit monitoring continuity; and consistent gross P&L, fees and net P&L. Excluded orders are listed with reasons. Their ledger impact is preserved. Cohorts are separated using the recorded signal-policy suffix; unknown policies remain unversioned.

The report covers retained orders only. The difference between ledger realized P&L and retained closed-order P&L is disclosed without inventing historical trades. Closed-trade drawdown omits interim unrealized losses and is not account equity maximum drawdown. Deposits and withdrawals are not trading profits. Paper charges and fills remain simulator approximations.

## Execution replay

```
node scripts/research/replay-paper.mjs /path/to/observations.json /tmp/replay-report.json
```

Input schema:

- `schema`: `paper-observations-v1`
- `source`: description of the actual capture source and coverage
- `initialCapital`: positive account capital in rupees
- `cycles`: nonempty chronological array of inputs accepted by `advanceWorkflow`, each with numeric epoch-millisecond `now`, arrays `quotes` and `candidates`, and boolean `marketOpen` and `acceptEntries`
- Quotes carry symbol, positive price, source and ISO source timestamp, with optional observed bid/ask and sizes. Candidates carry the original signal ID, signal timestamp, symbol, direction, score and risk levels required by the existing engine.

The command reuses `advanceWorkflow` and `advancePaper` for automatic execution at delays 0, 30 and 60 seconds. It records input and engine-source SHA256 hashes, order state, events and evaluation per scenario. No broker or database calls occur. Input timestamps cannot be in the future relative to their cycle; cycles cannot repeat or go backwards. The engine's existing freshness, quantity, spread, cost, stop, session and gap rules apply. It does not interpolate missing observations or force-close positions at the end.

This is **execution replay, not complete strategy validation**. Candidates are supplied, not independently regenerated from the historical universe. Source labels/hashes make inputs reproducible but do not authenticate them. Test fixtures are explicitly synthetic and never evidence of profitability. No representative live capture is available in this task, so no strategy win rate is claimed from this harness.

## Data needed before a strategy claim

Kite historical data consists of timestamped OHLC, volume and optional OI candles: https://kite.trade/docs/connect/v3/historical/ . Full quote snapshots separately include market depth: https://kite.trade/docs/connect/v3/market-quotes/ . Historical candles must not be presented as observed historical bid/ask execution.

Next evidence must include a representative point-in-time universe, timestamped scanner inputs and outputs, corporate-action checks, market-session state, and quote arrival/source times with depth where available. Freeze policy and evaluation dates before measuring forward results. Compare delay scenarios on identical inputs; do not choose a threshold based on the same sample used to report results. Track rejections, unresolved trades and coverage alongside returns. Full equity drawdown requires timestamped valuations including open exposure and cash-flow adjustment, which this closed-trade evaluator deliberately does not claim to provide.

Short-term, long-term, options and futures remain unavailable for execution under the existing segment configuration; the evaluator does not enable them. Any future adapters need their own data and validation.
