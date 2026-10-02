# Multi-mode forward paper pilot

## Status and scope

The existing four non-intraday accounts were funding-only: the scheduler called intraday alone and the SQL commit function rejected all other orders. This implementation supplies isolated observation/execution/ledger paths and a shared UI. Intraday behavior and its existing ledger are preserved.

**Code availability is not production activation.** Activation requires the server secret, migration, per-account database gate and environment gate below. No broker orders can be sent by this adapter. Upstox calls use a fixed host and GET-only allowlist; provider error payloads and credentials are never returned to clients.

| Mode | Experimental entry rule | Execution model |
|---|---|---|
| Short term | Completed daily 20-bar upside breakout with 20/50 SMA trend | Cash-funded long holdings; 5% stop, 10% target, 20-calendar-day maximum |
| Long term | Completed daily 20-bar upside breakout with 20/200 SMA trend | Cash-funded long holdings; 10% stop, 25% target, 180-calendar-day maximum |
| Options | Completed 5-minute underlying breakout with 20/50 SMA trend | Buy nearest-expiry ATM index call/put in whole lots; 20% premium stop, 40% target; session exit |
| Futures | Same underlying direction filter | Index futures whole lots; full notional reservation; 0.5% stop, 1% target; session exit |

These are explicit unvalidated experimental settings, not top-percentile strategies or production market facts. The pilot equity universe is RELIANCE, HDFCBANK, ICICIBANK, INFY, TCS, ITC, LT and SBIN, mapped through the current instrument master. Derivative underlyings are Nifty 50 and Nifty Bank. This is not an all-market scanner. Historical bars exclude the unfinished bar and conflicting duplicates. Signals retain first-observation time and expire for entry after two minutes.

Every entry requires another observed quote after submission. Every triggered/manual exit requires another observed quote after the request. Quotes require a recent last trade and provider response timestamp, usable bid/ask and displayed sizes. Provider response time is not relabeled as exchange trade time. Repeated trade timestamps cannot be consumed twice. One-minute REST observations are not continuous market depth or tick-accurate exchange execution.

Risk: 0.5% equity per trade including estimated costs, three submissions/day, 2% daily net loss admission stop, position limits, no fractional lots, no short delivery and no option writing. Futures currently reserve full notional, so the ₹50,000 default generally cannot fund an index future. Rejections explain this; balances and contract sizes are never fabricated to manufacture activity.

## Known limits that prevent broker-equivalent claims

- Costs use `segment-conservative-allowance-v1`: ₹40 plus a declared turnover allowance, not actual Upstox invoiced charges. Compare modelled net outcomes accordingly.
- No live broker-margin integration, exchange tick-size normalization, freeze-quantity validation, expiry settlement or futures daily MTM settlement. Derivative pilot is intraday and avoids expiry-day entries. Unresolved expired exposure remains blocked for reconciliation, never closed with invented prices.
- Delivery corporate actions, dividends and settlement are not reconciled. Delivery results remain visible but carry an evaluation exclusion; they must not be marketed as validated win rates. Overnight carries are expected, while missed intraday intervals remain monitoring gaps.
- No forecasts, private investor identities, complete order-flow history or profit guarantee. No new background push notifications. Signals and their execution status are visible in each segment's UI.
- No historical paper fills are fabricated to fill empty accounts. Production proof requires observed market-hour cycles and source-timestamped orders/fills.

## Production activation

1. In Upstox Developer Apps → Analytics, generate/copy the free read-only Analytics Token. Set **UPSTOX_ANALYTICS_TOKEN** as a Production server environment secret in Vercel; never prefix it VITE_, put it in an APK, paste it in chat, or commit it.
2. Apply `supabase/migrations/20261002_multi_mode_paper.sql`. It is additive and installs inactive. It preserves all account balances/events.
3. Verify credentials and observed quote/contract schemas before enabling entries. The adapter is a pilot; the limitations above must be resolved before calling it a broker-equivalent simulator.
4. For each desired pilot account, call `ensure_shared_portfolio`, insert its activation row with `activated=true`, and retain the existing user1 ledger unchanged. Set **MULTI_MODE_PAPER_ENABLED=true** in Vercel and redeploy. This extends the authenticated existing scheduled endpoint to all five accounts. Each account is isolated; one failed provider does not suppress other cycles.
5. Enable each account in its paper UI. The database must already authorize that segment. Funding alone does not start execution. Existing shared scheduler secret is reused; no new scheduler credential.
6. Verify each segment's `lastWorkerAttemptAt`, scan status, rejection evidence and account-specific events during an open market. Missing credentials must show `UPSTOX_TOKEN_MISSING`, not no eligible signals. Never call tests or a deployment proof that actual paper trades occurred.

## Official sources checked 2026-10-02

- https://upstox.com/developer/api-documentation/analytics-token/
- https://upstox.com/developer/api-documentation/get-full-market-quote-v3/
- https://upstox.com/developer/api-documentation/instruments/
- https://upstox.com/developer/api-documentation/v3/get-historical-candle-data/
- https://upstox.com/developer/api-documentation/v3/get-intra-day-candle-data/
- https://upstox.com/developer/api-documentation/get-market-status/
