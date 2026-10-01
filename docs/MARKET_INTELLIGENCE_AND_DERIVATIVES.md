# Market intelligence and derivative provider decision

## Implemented in this change
News & IPO intelligence appears in research navigation across all segments. GET /api/research?q= accepts bounded plain-text queries, fetches Google News RSS index metadata from a fixed host, validates XML, limits response bytes and time, excludes undated/future/over-seven-day articles and deduplicates titles/URLs. Each headline links to the original coverage via Google News and exposes publisher/publication time separately from retrieval time. No article bodies are stored. Cache is bounded to 50 searches and five minutes per server instance; it is not an audit ledger.

Headline tone is a deliberately limited keyword heuristic over a 24-hour sample. It is not overall market sentiment, a validated model, accuracy, probability of profit, or an automatic-entry input. Fewer than three fresh headlines or two publishers is insufficient evidence. Failures return unavailable, never neutral sentiment. No historical replay may use this current feed as historical knowledge.

Existing InvestorGain IPO observations are searchable alongside related headlines. GMP is unofficial; publication time remains unverified and retrieval does not prove freshness. No fake GMP, second-source confirmation or expected listing return is manufactured.

ET RSS was excluded because its public terms restrict redistribution/aggregation. GDELT was probed but returned HTTP429, so it is not used to manufacture a second confirming source.

## Provider decision, checked 2026-10-01
User prefers Dhan and requires no purchases. Official Dhan support states Data APIs cost INR499 plus tax monthly and the former trading-volume free promotion ended. Browser session redirected to login; existing account entitlement remains unverified. Upstox documents a free, read-only, one-year Analytics Token suitable for quote/history/option-chain access without static IP. Public Upstox NSE instrument metadata downloaded successfully, but metadata alone is not a live quote feed.

- https://dhan.co/support/platforms/dhanhq-api/is-the-dhanhq-data-api-subscription-free-if-i-execute-a-minimum-number-of-trades-every-month/
- https://dhan.co/support/platforms/dhanhq-api/how-can-i-check-the-status-of-my-data-api-subscription/
- https://upstox.com/developer/api-documentation/analytics-token/

## Derivative execution work remaining
1. Verify existing Dhan entitlement. If absent, connect the free Upstox Analytics Token with user-controlled credential setup. Keep credentials server-only, never VITE variables or APK assets.
2. Build and verify contract master normalization (ID, expiry, strike/type, lot and tick units), quote timestamps, depth/spread/liquidity, provider failures and stale-data gates.
3. Add contract-specific fees, fills at a later observed bid/ask, margin reservation, exits, expiry/settlement and ledger fields. Equity cash calculations cannot be reused unchanged. Start with bounded index exposure; no naked option writing or unmodelled physical settlement.
4. Extend atomic portfolio database gates, shared worker, signal selection, alert routing and mobile views together. Non-intraday execution is currently blocked at both code and SQL layers, not just UI.
5. Verify representative recorded sessions and forward entries/exits before enabling. Preserve current paper balances; insufficient margin must reject an order rather than silently increase funding.

The news release does not enable derivative signals or paper executions. APK must be rebuilt to include this UI; deploying web code does not update an installed APK.
