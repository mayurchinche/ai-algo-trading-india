# Signal calibration and cost diagnostics

Local implementation, 26 September 2026. Not deployed. No profitability improvement established.

## Corrected score inflation

Removed the 1.3x multiplier that treated ATR above 3% of price as stronger directional trend. SMA alignment still determines the trend component; ATR still determines volatility-based reference stops/targets. The strong-score threshold and component weights are unchanged.

ATR is a volatility measure and is not directional: https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/atr . It is not a replacement for ADX. This is a calculation correction, not evidence of a trading edge.

New signals use policy strong-equity-observed-v3 so future results can be distinguished from v2. Earlier orders, balances and timestamps remain unchanged.

## Measured impact

A fixed before/after comparison used the archived eight-instrument dataset from the earlier research pass, covering 2024 onward. It examined 5,444 daily observations; 421 scores changed. Both versions produced two absolute-score >=70 observations. No observation crossed that threshold because of this correction.

This is a score-impact audit, not an intraday backtest or realized performance result. It uses end-of-day prices/volume, eight currently surviving instruments, and no order execution. It cannot establish higher profitability or validate the live screener's intraday universe. No threshold was optimized against these observations.

The reproducible script, source snapshots, dataset/source hashes and per-symbol results are in the task workspace outputs/signal-tuning directory. The existing partial-session-volume versus full-day-average comparison remains a limitation; no fabricated same-time historical volume curve or linear extrapolation was added.

## Cost-adjusted paper references

Each newly submitted paper order records its quantity, entry reference, estimated target/stop costs, net target/stop result and net reward/risk. Amendments record a new calculation in their own audit event. The original submission event remains unchanged.

The calculator reuses the existing simulator fee formula (40 INR plus 0.05% of entry/exit turnover) and the existing 0.05% adverse exit slippage assumption. These are simulator approximations, not a current broker tariff. Spread/depth-dependent impact and gaps are not captured by this estimate. NSE explains why actual impact depends on order size and available liquidity: https://www.nseindia.com/static/products-services/indices-impact-cost .

Opportunity cards disclose these estimates separately from closed-trade net results and flag nonpositive net target reward. This is diagnostic only: no new automatic cost-based admission threshold has been enabled without suitable execution validation. Existing orders without recorded economics show no fabricated estimate.

## Validation

116 automated tests, five database suites, production build and lint pass. Tests cover volatility invariance, long/short cost estimates, invalid reference levels, small-quantity costs exceeding gross reward, and auditable order economics without altering realized balance.

Next validation requires representative timestamped intraday observations, bid/ask or explicitly limited fill modelling, corporate-action checks and walk-forward comparisons after costs. Options/futures execution remains unavailable.
