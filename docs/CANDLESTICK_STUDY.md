# Do candlestick patterns and RSI < 30 give profitable short-term trades on NSE?

Studied on 24 Oct 2026 for the strategy plan. Script: `research/candlestickStudy.mjs` (Yahoo daily bars cached by
`research/overnightGapStudy.mjs`, NIFTY 50 and today's F&O stocks, 2016–2026; today's lists, so survivorship
flatters every row equally). Signals on the close, bought at the next open, stocks with ₹10 crore average daily
turnover. Cost: delivery round trip on ₹20,000 from the broker tariff plus 5 bps slippage per side, 0.399%.
Conditions are the published Chartink scans from the user's notes (piercing also in its textbook form: the scan
compares the close with half the prior body's size instead of its midpoint, so that condition is always true).

## Plan A — the user's sheet: 2% stop, 6% target, exit after 10 sessions

| Signal | Trades | Target hit | Net win | Net per trade | Net 2016–20 / 2021–26 |
|---|---|---|---|---|---|
| Any day (baseline) | 403,280 | 20.8% | 28.4% | −0.38% | −0.41 / −0.36 |
| Hammer | 6,952 | 20.2% | 28.9% | −0.37% | −0.32 / −0.39 |
| Positive hammer | 684 | 21.9% | 23.5% | −0.54% | −0.82 / −0.07 |
| Bullish marubozu | 7,601 | 20.5% | 28.2% | −0.41% | −0.44 / −0.40 |
| Bullish engulfing | 4,391 | 19.8% | 27.1% | −0.50% | −0.54 / −0.48 |
| Piercing (textbook) | 5,251 | 19.7% | 27.1% | −0.48% | −0.53 / −0.45 |
| Morning star (scan) | 995 | 22.1% | 27.8% | −0.35% | −0.70 / −0.18 |
| Inside day in uptrend (harami scan) | 19,284 | 21.4% | 29.0% | −0.33% | −0.37 / −0.32 |
| RSI14 < 30 | 14,593 | 21.0% | 26.4% | −0.47% | −0.61 / −0.38 |

No pattern reaches its target more often than a random day, and the claimed 70–75% accuracy is about three times
what a 2%/6% plan achieves on these stocks.

## Plan B — hold 5 sessions

Patterns sit at the baseline (any day above the 200-day average: −0.13% net). The one positive row, RSI14 < 30
while above the 200-day average (1,225 trades, +0.33% net, 56% winners), lost 1.02% per trade in 2016–20 and made
0.79% in 2021–26, so it is not consistent. RSI < 30 on its own, the ET "oversold" screen, lost 0.25% per trade.

## Decision

Candlestick scans are not added as trading signals. Short-term reversal in an uptrend stays first in Phase 3 of
the strategy plan, tested in its published forms on clean data with the walk-forward gate.
