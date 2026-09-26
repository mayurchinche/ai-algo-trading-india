# Same-time volume diagnostic experiment

Research only. No production policy, paper balance, or live order path changed.

Run `node scripts/research/run-volume-variants.mjs <dataset-directory> <calendar.json> <new-output-directory>` with the same manifest/raw response format as the five-minute experiment. The runner freezes source hashes, data-manifest hash, rules and calendar before scoring; it never silently overwrites an existing protocol.

The volume denominator is the median cumulative volume through the same five-minute boundary across the latest 20 prior complete prefixes available at decision time. Current incomplete prefixes, fewer than 20 historical prefixes and zero medians are unavailable. It does not substitute this denominator for the average daily turnover liquidity guard. Warmup session membership comes from observed source bars, not an independently verified warmup calendar.

Fixed variants:
- Baseline: original shared scorer and strong-signal policy.
- Same-time composite: original weights and absolute 70 threshold, replacing volume-dependent components. These components consume the shared snapshot's rounded moving averages.
- Trend/momentum: equal-weight momentum and trend score, absolute 70 minimum, matching direction and same-time volume ratio at least 1.5.
- Mean-reversion: absolute reversion score at least 80, absolute trend score at most 40 and volume ratio at least 1.

Candidate policies retain daily liquidity/quote guards. Stops use the existing rounded two-ATR distance, with direction recalculated for each candidate and target at 1.5 times that distance. Daily indicator values use completed prior daily bars. Each candidate is deduplicated by variant, symbol, session and side. Thresholds are experimental hypotheses, not calibrated win probabilities.

## September 7–25, 2026 diagnostic

Eight surviving instruments, 14 sessions, 7,952 observations. The 60-day request returned five-minute bars from July 6. There were 7,840 valid same-time baselines and 112 zero medians; unavailable observations were excluded. September has already informed the hypotheses and is not untouched validation.

At the 60-second eligibility delay (rounded to the next observable five-minute open):

| Policy | Initial capital | Candidates | Closed | Unresolved | Net closed P&L |
|---|---:|---:|---:|---:|---:|
| Baseline | ₹10,000 / ₹20,000 | 0 | 0 | 0 | ₹0 |
| Same-time composite | ₹10,000 / ₹20,000 | 0 | 0 | 0 | ₹0 |
| Trend/momentum | ₹10,000 | 19 | 6 | 0 | −₹242.29 |
| Trend/momentum | ₹20,000 | 19 | 2 | 1 | −₹81.16 |
| Mean-reversion | ₹10,000 | 6 | 0 | 0 | ₹0 |
| Mean-reversion | ₹20,000 | 6 | 0 | 1 | ₹0 |

The six closed ₹10k trend trades had zero net wins under the existing approximate fee model. This is a tiny selected sample, not an estimate of future win probability. The model charges a flat ₹40 plus turnover fees per round trip; fees dominate one-unit positions and need date-effective broker-tariff validation before capital conclusions. Insufficient risk budgets rejected 13 of 19 trend candidates and all six mean-reversion candidates at ₹10k. Unresolved exposure blocks subsequent orders and makes full account return unavailable.

Other limitations: no historical screener membership, corporate-action adjustment consistency not verified, no observed bid/ask or exact minute fills, warmup calendar not independently verified. Short-term, long-term, options and futures remain unevaluated by this intraday experiment.

Decision: do not promote either new policy. Next: validate the fee/risk-sizing model and missing exit coverage, then freeze a prospective forward evaluation. Do not lower thresholds or add capital just to manufacture more trades.
