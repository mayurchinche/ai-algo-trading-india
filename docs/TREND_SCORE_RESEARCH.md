# Trend score research (trend-score-v1)

Run 18 October 2026. Our own transparent model, not a copy of any vendor's indicator.

## Model

- `score = 5 + 2.5 × clamp((close − ZLEMA21) / (2 × ATR14), −1, 1) + 2.5 × clamp((ZLEMA21 − ZLEMA21[5 bars ago]) / ATR14, −1, 1)`, on completed daily bars only. ATR is Wilder's.
- Zones: 0 to below 4 bearish, 4 to below 7 neutral, 7 to 10 bullish.
- Signals: BUY when the score crosses from below 7 to 7 or more while not in a trend; SELL when it falls to 4 or less during a trend. Trend start / trend end on the dashboard mean a signal in the last 5 sessions.
- Code: `shared/trendScore.js`. Parameters were fixed before the replay and have not been changed since.

## Replay

- Code: `research/trendReplay.js`; runners `scripts/research/fetch-trend-dataset.mjs` and `scripts/research/run-trend-replay.mjs`.
- Data: NSE's NIFTY 50 constituent list on 18 Oct 2026 (SHA-256 `f5ba4027…44b3`) and 10 years of Yahoo daily bars for all 50 symbols. Dataset manifest SHA-256 `45ba9da42adbebb50e43e3cf6dfc1fc7b5c8e06538cb57677dc02787ea1f13a1`. Raw data and outputs are kept outside Git (`~/ai-algo-research/trend-daily-2026-10-18`, `trend-replay-2026-10-18b`).
- Execution: enter at the next session's open after a BUY close, exit at the next open after a SELL close. Assumed cost 0.25% per round trip (not a dated broker tariff). Trades still open at the end are reported separately.
- Pre-declared pass criteria: at least 100 closed trades; mean net trade return above 0 with t ≥ 2; the 20-session return after a BUY beats the average 20-session return in both halves of the period.

## Results

**Status: passed the pre-declared criteria, but the evidence is weak.**

| Measure | Result |
|---|---|
| Closed trades | 3,310 (14 still open) |
| Mean / median net trade return | +1.00% / −1.22% |
| Win rate | 41.3% |
| Mean holding | 16.6 sessions |
| t-statistic of mean net trade | 6.49 (optimistic: overlapping, correlated trades) |
| 20-session excess return after BUY | +0.44% first half, +0.09% second half |
| Beat buy-and-hold | 1 of 50 stocks; median shortfall about 210 percentage points over 10 years |
| Median time in market | 47% |
| Median maximum drawdown | 40% strategy, 54% buy-and-hold |

Mean net return by exit year:

| Year | Trades | Mean net | Win rate |
|---|---|---|---|
| 2017 | 314 | +1.27% | 44% |
| 2018 | 299 | +0.26% | 42% |
| 2019 | 334 | −0.25% | 40% |
| 2020 | 329 | +3.68% | 48% |
| 2021 | 343 | +2.87% | 47% |
| 2022 | 353 | +0.59% | 43% |
| 2023 | 321 | +1.78% | 46% |
| 2024 | 379 | +0.97% | 39% |
| 2025 | 372 | −0.87% | 32% |
| 2026 | 260 | −0.28% | 34% |

(2016 had 6 trades, mean −6.20%.)

## Interpretation

- Most trades lose; the positive mean comes from a minority of large trend moves, concentrated in 2020–2021.
- The signals cut drawdown but gave up most of the return of simply holding the stocks.
- Trades lost on average in 2025 and 2026, and the post-signal edge in the second half is close to zero.
- Survivorship bias (today's constituents applied to the past) favours both the strategy and buy-and-hold; dividends are excluded from both.

**Decision:** the dashboard shows scores, zones and signals as descriptions of trend state, with this result on every view. Signals do not feed paper or live orders. Revisit only with a point-in-time universe, dividend-adjusted data and an out-of-sample period after 18 Oct 2026.
