# Persistent paper trading

## Default: no sign-in required

The app uses a device-local paper account. Account balances, deposits, withdrawals, orders and timestamped audit events are saved together in `device_paper_account_v1`. Sign-up, Supabase authentication and a background worker are not required for this mode. The existing order engine and risk rules are shared with the optional server implementation.

Automatic monitoring runs only while the app is open and visible, approximately once a minute plus provider latency. Enable new entries in the Account screen. Closing the app stops monitoring; missing intervals are marked rather than reconstructed. There is no cross-device synchronization. Export the ledger before clearing app data or reinstalling; device storage can be lost and browser storage limits still apply. Events are retained without automatic age-based deletion.

On first use, an existing valid device journal is carried forward once, including retained archived P&L, without deleting the original. Corrupt account data is reported rather than silently reset. Device mutations use a browser lock and one atomic storage write. The server API retains its authentication and account-ownership restrictions; no anonymous access to server accounts has been enabled.

This is paper-only: no broker order API is called. Notifications remain foreground-only.

## Execution semantics

A signal produces a pending paper order, not an immediate fill at an earlier quote. The next fresh quote with source time strictly after the submission/last consumed quote may fill. Order time, quote time and processing time are separate ISO timestamps displayed in IST. Stop/target/manual/EOD conditions request an exit; the next eligible observation fills that exit. Prices incorporate adverse 5 bps slippage. Fees remain the explicit approximation of ₹40 plus 0.05% of entry-plus-exit turnover, not actual brokerage/tax statements.

The engine supports bid/ask and available-size partial fills when supplied. The included Yahoo adapter supplies LTP snapshots, not depth: its fills are labelled `LTP_ESTIMATE_LIQUIDITY_UNKNOWN`, with assumed full liquidity. It cannot reproduce exchange queues or exact tick crossings. Risk sizing is rechecked at fill time; stale, future, duplicate and pre-order quotes cannot execute. Missing intervals are recorded, never reconstructed. Pending entry remainders expire after two minutes, on pause or at the 15:15 IST entry cutoff. EOD exits are requested from 15:25 IST. If no eligible quote arrives, the position remains visibly unresolved; recovery uses the actual later observation and marks the monitoring gap.

Starting capital is ₹20,000; orders use at most ₹5,000 notional, 0.5% planned risk including estimated costs, 90% total capital allocation, three submitted entries per IST day and a 2% daily realized-plus-open-loss admission guard. These are configurable development policies in code, not optimal or guaranteed risk levels. Shorts reserve full notional; borrowability, circuit restrictions and actual fills still require a broker instrument/feed integration.

## Optional server mode: deployment required before activation

1. Apply `supabase/migrations/20260921_paper_accounts.sql` using the database owner. It creates new tables; it does not import, overwrite or delete existing local history. Review/apply the separate earlier app_data restriction as well.
2. Configure Supabase authentication and create the intended user through the Supabase administration interface. Supply public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` when building the app. The default device UI does not connect to this service; a separate authenticated account UI must be restored before using server mode. No anonymous shared server account is supported.
3. Deploy `/api/paper` and its server dependencies with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the existing allowed-origin configuration. Never place service-role secrets in `VITE_*` variables or the APK.
4. On an always-on Node host, install project dependencies and create an untracked `.env.worker` containing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `MARKET_API_ORIGIN=https://YOUR_DEPLOYED_HOST`. Run `npm run worker:paper`. The worker bundles the existing discovery and strong-signal policy; it scans approximately once a minute and monitors positions every five seconds plus provider latency. It does not use Firebase or the push worker.
5. Vercel hosts the API/UI; an ordinary serverless request or infrequent cron cannot host this continuous loop. Use a supervised always-on process with restart and log monitoring. A sleeping laptop stops monitoring.
6. Sign in, enable the paper account, and verify the worker timestamp, market state, entry, stop/target/manual exit and export during an open session. A late heartbeat or missing quote is shown explicitly. Pausing disables new entries; existing positions continue to be monitored while the worker is running.

The database retains all events (at least 30 days); automatic destructive pruning is deliberately not enabled. A future size-management job must preserve balances, open orders, daily deduplication and audit/export requirements. Browser reinstall does not remove the server account, but deployment, authentication and database backups are still required.

## Verification

`npm test` includes deterministic order/fill tests and PostgreSQL integration covering atomic commits, restart/retry deduplication, rollback and user isolation. `npm run build` and `npm run lint` verify the client. Live authentication, production migration, always-on hosting, exchange-open soak and phone tests require configured services and are not implied by local test success.

For tick-driven simulation, replace the snapshot adapter with a verified broker stream supplying exchange timestamps and depth into the same `advancePaper` interface. No broker-specific stream is claimed to be connected in this change.

## Historical balance and paper funding

The account never resets at midnight. Ledger balance equals initial capital plus deposits minus withdrawals plus all recorded net realized trade P&L. A deposit is capital, not trading profit. Open-position P&L (including partially exited position results pending final closure and estimated closing charges), reserved funds and estimated equity are displayed separately. Withdrawals cannot use reserved funds or unrealized profits; stale open marks pause withdrawal. These are conservative simulation rules, not an implementation of exchange settlement or a broker margin schedule.

Add/withdraw controls create timestamped ledger events atomically with the balance change. Client-generated transaction IDs make retries idempotent; concurrency conflicts reject stale updates. Inputs require positive amounts with at most two decimals. Future trade sizing uses the adjusted account capital and carried-forward results.

Before enabling new trades or adding funds, use **Import earlier paper journal** on the device holding the old local history. This imports closed trades, open positions and the retained archived P&L into an unused, paused account. Duplicate or malformed records reject the entire reconciliation. Old open positions remain marked as legacy/monitoring-gap observations; future exits use the actual new observation and are credited once. Original stored times are retained; missing historical signal/order timestamps are not invented. Local records remain available, and their local monitoring stops after successful import.

Import cannot overwrite an account that already has trading/funding activity or be applied twice. Historical data missing from the device or old export cannot be reconstructed. The default device adapter automatically performs this migration on first initialization when a previous journal exists. The manual import control is available for an unused account. The optional server API requires an explicitly authenticated import and never reads browser storage by itself.
