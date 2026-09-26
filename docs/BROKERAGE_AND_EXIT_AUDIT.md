# Brokerage and exit-data audit — 2026-09-26

## Result

The legacy research cost model materially overstated small-order costs. A new opt-in research tariff and fee-aware sizing path is implemented. Live paper balances and production fees have not been changed. Complete historical exit data was NOT recovered. Forward-testing readiness remains false.

## Verified published tariff

Scope: resident-individual, ordinary NSE cash intraday equity/equity ETF, one entry order and one exit order. No delivery, derivatives, MTF, special account tariff or partial-order aggregation is implied.

- Brokerage: lower of ₹20 and 0.03% on each executed order.
- STT: 0.025% on the sell turnover; stamp duty: 0.003% on buy turnover. Correct sides apply to short trades too.
- NSE charges from March 1, 2026: ₹306.99 exchange plus ₹0.01 IPFT per crore, both sides. This splits the displayed 0.00307% combined rate rather than counting IPFT twice.
- SEBI: ₹10 per crore, both sides; GST: 18% on brokerage, exchange, IPFT, SEBI and applicable assisted charges.
- Broker-assisted square-off: optional ₹50 plus GST. A strategy's own planned exit does not incur this extra service fee by default.

Sources checked September 26, 2026:
- https://zerodha.com/charges
- https://nsearchives.nseindia.com/content/circulars/FA73061.pdf
- https://support.zerodha.com/category/account-opening/resident-individual/ri-charges/articles/stt-etfs

This is a published-tariff estimate, not an actual contract-note reconciliation. Per-trade accrued STT differs from broker aggregation/whole-rupee rounding; components retain unrounded values and round-trip totals round to paise. Exchange effective date is verified; the broker page is a current snapshot, not an archived daily tariff. The implementation rejects dates outside March 1–September 26, 2026 so it cannot silently become a future tariff. Review the snapshot before forward use.

## Cost-only comparison (same trades, same quantities)

For the original ₹10k trend run's six completed trades:
- Old total fees: ₹241.60; revised estimate: ₹1.69.
- Old net loss: ₹242.29; revised net loss: ₹2.38.
- Net wins: 1/6. This selected, tiny diagnostic sample is not a future win-rate estimate.

This does not retroactively make the old order selection fee-correct: the old model rejected other signals. A separate replay recalculates quantity using stop slippage and fees within the same 0.5% risk, 90% cash and ₹5k order-notional limits. It uses frozen candidate signals, without retuning thresholds.

| Variant | Capital | Closed | Unresolved | Closed-only net P&L |
|---|---:|---:|---:|---:|
| Trend | ₹10,000 | 2 | 1 | −₹1.20 |
| Trend | ₹20,000 | 2 | 1 | −₹2.39 |
| Reversion | ₹10,000 | 0 | 1 | ₹0 |
| Reversion | ₹20,000 | 0 | 1 | ₹0 |

Full account returns are unavailable for all four active scenarios. Baseline and volume-only composite still have zero signals. Results are diagnostic, not untouched validation.

## Exit-data recovery

Targeted public Yahoo chart requests used explicit session start/end dates for HDFCBANK September 10 and ICICIBANK September 16, at both 1m and 5m resolutions. All returned HTTP 200, but null closing candles persisted:
- HDFCBANK: 15 invalid minute rows; 3 invalid five-minute rows, including 15:15, 15:20 and 15:25.
- ICICIBANK: 14 invalid minute rows; 2 invalid five-minute rows, including 15:20 and 15:25. A populated 15:15 five-minute candle therefore must not imply five complete one-minute observations.
- A separate 15:30 zero-volume row is not a valid intraday fill or evidence of the missing path.

Raw responses, request URLs, retrieval times and SHA256 hashes are retained in workspace `outputs/exit-cost-audit/`. No null bars were interpolated, no daily close was substituted, and no unresolved trade was classified as a win/loss. Fetch success does not mean execution-data completeness.

## Readiness gate

Before forward evaluation: review/extend the dated tariff snapshot, secure a feed recording complete sessions with auditable timestamps, verify instrument/corporate-action continuity, and reconcile representative charges with a broker calculator/contract note. Historical trade validation needs a legitimate alternative minute source or exported data for the missing intervals; repeating the same public chart query did not supply it. Existing public API catalogue entries requiring broker authentication cannot be treated as anonymous data access.

No strategy is promoted. No paid subscription, account connection, deployment or live order was initiated.

Reproduce: `node scripts/research/audit-costs.mjs <prior-results.json> <dataset-directory> <new-output-directory>` from repository root. The protocol is written exclusively before replay and hashes the prior results, raw-data manifest and fee/execution source files.
