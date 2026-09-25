# Five-segment paper account foundation

Implemented locally on 2026-09-25. Not deployed; no replacement APK published.

## Scope

The global selector covers Home, Paper trades, Alerts, Discover, Watch ideas, Stock analysis, Signals and Strategy lab. IPOs and Metals remain general research views, not segment-specific strategies.

| Segment | Shared backend ID | New account opening paper capital | Execution |
| --- | --- | ---: | --- |
| Intraday | user1 | 10,000 INR | Existing simulation |
| Short term | user1:short-term | 20,000 INR | Disabled |
| Long term | user1:long-term | 20,000 INR | Disabled |
| Options | user1:options | 50,000 INR | Disabled |
| Futures | user1:futures | 50,000 INR | Disabled |

These are simulation starting budgets, not minimum capital for profitability. Existing user1 capital, orders, events, transfers, revisions and realized results remain untouched. Accounts are provisioned when first requested. New opening balances have a timestamped OPENING_CAPITAL event; repeated provisioning cannot add capital again.

The four new accounts support backend deposits/withdrawals, accounting, timestamped funding history and a complete paginated JSON ledger export. Each web/Android request specifies its segment; the client checks the returned account ID and segment. Retry IDs, revision checks, execution leases and event queries are account-specific. Default API requests and older clients continue to use intraday user1.

The common selector remounts account content on segment changes so an outstanding response cannot put another segment's balance on screen. Unsupported signals/analysis/alerts/backtests show readiness information, not repackaged intraday results. Intraday foreground monitoring continues while any segment is selected and is explicitly labelled. Intraday popups are displayed only when intraday is selected.

No options, futures, delivery or overnight engine was enabled. API requests attempting to tick or configure execution on these accounts are rejected. The new commit RPC additionally rejects enabled execution or orders/intents on unsupported accounts. Funding stays paper-only.

## Verification

- 103 automated tests passed, including independent balances, shared request IDs across accounts, network retry keys, wrong-account response rejection, overdraw protection and unsupported execution.
- Five database suites passed with PGlite, including additive migration preservation, one-time opening events, per-account leases/idempotency, atomic rollback and denied anonymous/authenticated direct access.
- TypeScript/Vite production build, oxlint and diff whitespace checks passed.
- Local browser: selected Options account and Options Signals; unavailable balance does not become zero and funding stays disabled on backend failure. Selector wraps at 390px viewport width.
- No physical Android device check, production migration, live funding mutation or APK release performed.

## Deployment order

1. Apply `supabase/migrations/20260926_paper_portfolios.sql` to the existing Supabase project after the original shared-user1 migration. Back up/snapshot the existing database before release per operational practice. Do not reset or replace the user1 row.
2. Deploy the tested server/frontend revision together. The server now requires ensure_shared_portfolio, commit_shared_portfolio, lease_shared_portfolio and release_shared_portfolio; deploying it before SQL would make the shared API unavailable.
3. Check all five GET views from web and Android origins. Verify existing intraday totals against the pre-release snapshot and one opening event per new account. Opening a new account creates its initial paper row and event.
4. Perform explicitly approved production funding/retry checks, then rebuild/version the Android APK against the deployed API and verify on a physical device.

Old RPCs remain in place for compatibility. Application rollback to the previous server/frontend is possible without dropping accounts or deleting their ledger history. Keep the additive schema and all events during rollback.

## Remaining phases

- Shared opportunity recording now powers Home, Signals, Alerts and popups (see SHARED_OPPORTUNITIES.md). Discover/Watch ideas/Stock analysis still run separate research scans; they do not create shared records.
- Licensed/authorized market data for intended simulation and display use. Kite Connect subscription alone does not settle usage rights.
- Contract master/expiry/lot sizes, bid/ask freshness, options premium costs and futures margin/MTM models.
- Delivery/overnight execution, corporate actions, settlement and per-segment costs.
- Recorded-data walk-forward evaluation with realistic delays/costs and out-of-sample promotion gates. No new profitability claim or strategy promotion was made here.
- Strategy-specific signal, analysis, alert and performance views after validation; the current new-segment views intentionally remain unavailable.
