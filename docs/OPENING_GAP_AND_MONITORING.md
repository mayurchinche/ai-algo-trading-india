# Missing trades and opening-gap research — 2026-10-01

## Production evidence

Before this audit, production user1 revision 143 held no orders or signal events and lastCycleAt 2026-10-01T05:31:42.840Z (11:01 IST). Detailed scan diagnostics were absent. Therefore neither strategy failure nor absence of historical qualifying signals can be established from that ledger.

The preceding activation verified Supabase Cron active and authenticated HTTP 200 OUTSIDE_MONITORING_WINDOW. A normal production foreground cycle in this audit succeeded: revision 144, lastCycleAt 2026-10-01T18:06:28.400Z, MARKET_CLOSED, zero scored, zero orders. This verifies the current provider-status/read/commit path outside the market session, not a scheduled trading session or an entry/exit fill.

## Changes

Shared home, signals, alerts and paper views expose scan status, time, source, background attempt, daily evidence and developing candidates with rejection reasons. Historical market status is no longer displayed as currently open on Home. Failed screeners and historical fetches are counted separately from valid empty responses. The entry threshold remains 70; scores are not win probabilities.

Opening-gap watch is a shared server-produced research snapshot, collected when the market-status provider reports open, between 09:15 and 10:30 IST. It samples up to 12 liquid stocks from the current movers universe, ranked by absolute day change. This is not a whole-market or unbiased historical sample. It uses the prior completed daily close and the actual 09:15 open from one-minute bars. Five complete, contiguous, nonzero-volume opening bars are mandatory. Gaps between 1% and 5% are watched for a later complete candle close AND fresh quote beyond the opening range in the gap direction. Missing/future/incomplete candles cannot establish a setup. Snapshot timing and confirmation candle timing are shown separately.

This snapshot does not create strong alerts, orders, win rates or a retrospective gap ledger. Its filters are research hypotheses, not optimized or validated trading rules. Corporate-action checks, same-time volume, costs, spreads, sizing, stops and exit evaluation are required before automatic execution. Preserved snapshots are explicitly historical outside their freshness/window limits. Server collection and execution do not depend on rendering this component.

## Derivatives remain blocked

Options/futures have separate paper balances but no operational contract-level signals or execution models. The new readiness explanation lists feed, contract metadata, liquidity, margin, settlement, costs and replay/forward checks across segment pages. Do not map equity prices onto derivative fills or treat an empty derivatives list as a successful scan.

Official references checked:
- https://support.zerodha.com/category/trading-and-markets/general-kite/kite-api/articles/historical-data-and-live-market-data-payment-plan — free Personal API excludes live/historical market data.
- https://www.nseindia.com/static/market-data/nse-data-policy — data use/access must fit the provider agreement.

## Next validation gates

1. Observe actual market-session cron dispatch HTTP responses and persisted scheduler heartbeat. Inspect scan coverage and rejection counts before changing any strategy threshold.
2. Persist an as-observed opening-gap research cohort, then replay unseen sessions with complete entry/exit data and costs. Current movers membership must not be reused as an unbiased historical universe.
3. Connect an authorized derivatives feed and implement contract execution before unlocking derivatives.
4. Rebuild Android assets/APK for this UI; a web deployment alone does not update a bundled APK.
