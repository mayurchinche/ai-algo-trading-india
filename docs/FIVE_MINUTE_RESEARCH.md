# Five-minute research simulator

Local implementation, 26 September 2026. No production trading changes.

Run from repository root with compatible Node dependencies:

```
node scripts/research/run-five-minute.mjs <dataset-directory> <calendar.json> <new-output-directory>
```

Inputs are the checked free-data download manifest, original Yahoo responses with matching SHA256 hashes, and verified scheduled cash sessions. The runner writes a protocol exclusively before reading outcomes. It uses the same pure stock scorer and strong admission rules as the app, with as-of completed five-minute inputs. The universe is the prior eight-symbol survivor sample, not the historical live screener. Fees are the existing paper-costs-v1 approximation; no claim of exact historical brokerage charges.

Execution is a separate OHLC model. Entries occur strictly after eligibility at a five-minute open, with adverse slippage, whole-share sizing, risk/capital constraints and three submitted orders per day. The quote engine's two-minute TTL cannot be meaningfully replicated at this resolution: the candle model permits the next five-minute boundary only and discloses the changed execution convention. Delays0/30/60 seconds often resolve to the same boundary. No depth/participation model or exact exchange fill timestamp is claimed. Stop/target collisions are stop-first and flagged. Gaps use available opening price.15:25 exits use that bar's open if available. Missing bars with exposure create an unresolved position and block subsequent entries; full-account returns/drawdown become unavailable. Closed-trade statistics alone never describe unresolved exposure.

First run: 7–25 September2026,14 sessions,8 symbols,7,952 scored observations. Every observation scored below70; highest absolute score48. No admitted signals or trades for either10k/20k capital or any delay. Closed P&L0 reflects inactivity; win rate, expectancy and profit factor are null. This does not show the strategy is profitable, unprofitable or ineffective across the whole market. No thresholds were fitted to these outcomes.

Short-term/long-term remain POLICY_NOT_READY; options/futures remain CONTRACT_DATA_AND_POLICY_NOT_READY in the output. No returns from underlying stocks are used as derivative returns.

Artifacts include protocol/source and input hashes, per-symbol coverage/rejection diagnostics, orders, modelled exit intervals, unresolved states and marked equity points. Raw source data stays outside Git/APK. Future work needs broader point-in-time universe evidence, corporate-action validation, exact tariffs and better-resolution execution data before any production profitability claim.
