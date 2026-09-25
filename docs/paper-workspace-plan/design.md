# Broker-style paper trading design

## Recorded journey
Signal at 09:45:00 IST → order submitted at 09:46:00 → source quote at 09:46:04 → fill processed at 09:46:05. The 09:45 signal price and quote at exactly submission time cannot fill the later order. Exit request and exit fill are separate events. Regression tests cover this chronology. Current automatic mode submits when a qualifying signal is processed; v1.3.0 adds an optional minimum 30/60-second reaction delay, or manual review. Delay starts when the app queues the signal and is serviced by the next foreground scan; expired signals never submit.

Orders shows all recorded submissions; Positions shows remaining exposure including pending exits; Closed trades shows completed/cancelled orders. Per-order valuation includes partial exit proceeds, remaining marked exposure, estimated charges and net P&L. Stale/future/missing marks show unavailable valuation. No fake prices or reconstructed missed trades.

## Product-specific activation requirements
| Product | Requirements |
|---|---|
| Intraday | Existing next-observation market estimates, long/short exposure, cash reservation, entry cutoff and observed EOD exit. |
| Short-term delivery | Long-only holdings, settled/unsettled quantity, corporate actions/dividends, delivery charges, overnight stop/gap policy and multi-day signal horizon. |
| Futures | Exchange contract, current lot/tick size, expiry, bid/ask, margin reservation, daily MTM, rollover and settlement. |
| Options | Expiry/strike/call-put, quoted premium/depth, current lot size, premium debit versus short-option margin, spread/liquidity gates and expiry/assignment settlement. Greeks require verified inputs. |

One capital ledger must fund all products; selecting a view must not create separate ₹20,000 balances. Existing untyped orders retain their equity-intraday interpretation. Product support must be enforced in the engine, not only with disabled buttons. Never substitute the underlying equity price for a futures or options quote.

## Next slice: tickets and intentional delay
Persist manual/automatic preference, retaining automatic intraday as default. A signal-linked ticket captures instrument, product, side, quantity, market/limit/stop, validity, signal age and quote age. Revalidate session, signal expiry, instrument and funds at submission. A delayed automatic intent needs immutable first observation and due time; repeated scans cannot reset its clock. Revalidate at due time and record rejection/expiry reasons. Delay is distinct from provider/network/fill latency.

Cancellation and modification apply only to unfilled quantity. Executed fills remain immutable. A stop trigger does not imply immediate execution; non-marketable limit orders remain pending. Test duplicate taps, restarts, concurrent scans, partial cancellation, gaps, cutoff, stale quotes and insufficient funds before activation.

## Strategy research and promotion
Opening-range breakout with liquidity filters, VWAP trend pullback and multi-day trend/momentum are hypotheses to test, not proven profitable features. Mean reversion needs a separate regime filter. Do not derive an options recommendation from an equity score alone: spread, expiry, volatility and premium risk matter independently.

Record strategy/version and reasons at signal time. Compare a simple benchmark and no-trade baseline. Use chronological training and untouched evaluation windows, walk-forward validation and then forward paper evaluation. Include fees, spread, adverse slippage and reaction delay sensitivity. Report net expectancy, payoff ratio, drawdown, turnover, exposure, sample size and uncertainty by strategy/product/regime. Show all historical trades separately from trustworthy evaluation cohorts; never delete excluded legacy/gapped trades from cash/history. Win rate alone and selected backtests are insufficient promotion gates. Top-1% profitability cannot be promised.

## Data and operation dependencies
Current monitoring remains device-local and foreground-only. Continuous background execution needs durable backend ownership and an always-on worker. Existing cloud API authentication must not be disabled to create a shared anonymous account. Contract-specific live market-data access is required before activating derivatives. A provider and its read-only API access have not yet been selected.

## Primary sources
- https://kite.trade/docs/connect/v3/orders/ — orders, fills, order types and distinct timestamps.
- https://kite.trade/docs/connect/v3/portfolio/ — positions and holdings.
- https://zerodha.com/varsity/module/trading-systems/ — systematic strategy research.
- https://zerodha.com/varsity/module/risk-management/ — risk and position sizing.

Use the app's own branding and clear simulation labels. This is neither an affiliated Zerodha app nor an exact exchange-fill replica.

## v1.3.0 continuation delivered
- Persisted AUTOMATIC/MANUAL settings; default automatic without added delay preserves the earlier behavior. Changing settings cancels queued intents and leaves submitted orders alone.
- Immutable queued signal time, due time, expiry, approval timestamp, order type, requested quantity and scanner policy/reasons/components.
- Market, limit and stop-entry tickets. Limits include adverse slippage in the eligibility check, so fills never cross the limit. A stop-entry trigger produces an event and needs a later quote for a fill. Protective stops remain separate.
- Manual approval requests a foreground scan; it is not a fill guarantee. Quote, session, risk allowance and daily limits are rechecked on submission; explicit rejection reasons are exported. A ticket cannot increase the strategy's risk budget.
- Cancel unfilled entry quantity without closing already-filled exposure. Validity supports two-minute expiry, intraday DAY until 15:15 IST, and first-eligible-quote IOC. Unfilled/untriggered limit/stop orders allow price changes and quantity reductions subject to original risk/capital limits; fills require post-amendment source timestamps. Stop-IOC is rejected.
- Descriptive strategy evidence groups by policy, execution mode, delay and order type; legacy/gapped/incomplete records remain in money/history but are excluded from evaluation. No automatic strategy promotion or untouched-data validation is claimed.

## Remaining dependencies
Delivery holdings require a verified settlement calendar and corporate-action feed before product activation. Derivatives require the user's provider choice, read-only contract quote entitlement, current instrument master and margin/settlement model. No credentials are requested through chat. Continuous monitoring requires a hosted worker and durable account/device ownership. These are not simulated with equity quotes or bypassed through anonymous shared cloud access.
