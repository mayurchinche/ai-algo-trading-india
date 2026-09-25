# Shared opportunity feed

Implemented on 2026-09-25; five-portfolio backend and frontend deployed on 2026-09-26.

## Behaviour

- The existing server-owned foreground tick scans during confirmed open market sessions, even if paper entries are paused. Pausing still prevents orders.
- Qualifying strong candidates become immutable OPPORTUNITY_RECORDED ledger events in the same transaction as workflow/position updates. A revision conflict discards the entire cycle, including the opportunity index and events. The next successful scan can record it.
- One first observation per existing strategy signal ID (stock, direction, IST day, policy). Later scans cannot replace its time, price or expiry. Recorded fields include signal/quote/processing times, score, reference levels and strategy evidence.
- Expiry is the earliest of two minutes from signal time, two minutes from quote time, and 15:15 IST. Expired, malformed and weak observations are not recorded.
- A 30-day deduplication index in account state is bounded by time; ledger events are retained without destructive cleanup. Old device records are preserved in their original storage, not relabelled as shared history.
- GET /api/shared-paper?segment=intraday&feed=opportunities returns the latest 100 events and a descending sequence cursor. Passing before and the original until gives stable historical pagination while new events arrive. The existing account ID checks, server-only database privileges and segment allowlist apply.
- Home, Signals, Alerts and foreground popups use the shared feed. They no longer advertise device-local target-hit outcomes as shared performance. Actual paper P&L remains ledger-derived.
- Popups require a current open-market server cycle, no discovery error, an unexpired signal, visible app and selected Intraday segment. A per-session set suppresses repeat popups locally; dismissing on one device does not hide the shared record or dismiss it on another device.
- History remains visible when stale/closed but is labelled not actionable. Network/backend errors show unavailable rather than an empty successful feed. Complete retained signal history is exportable as JSON.

## Limits

There is still no always-on collector; scans are requested while an app is open. Discover/Watch ideas/Stock analysis remain separate research views. Shared history begins after deployment; no missing past signals are fabricated. Other segments stay disabled pending licensed data and validated execution models. This change does not validate a profitable strategy or broker-equivalent fills.

## Verification and deployment

107 automated tests, five SQL integration suites, production build and lint passed after the final changes. The local browser check confirmed that Signals renders the shared feed and clearly reports an unavailable backend without synthetic records. Tests cover first observation immutability, cutoff/expiry, paused entries, matching web/Android reads, stable pagination, cursor rejection and mutation rejection on the read-only feed, and expired reference quotes being rejected for both new signals and new orders.

Apply the pending 20260926_paper_portfolios.sql migration before deploying the server/frontend. It includes a partial per-account sequence index for opportunity events. Existing installed APKs keep the old user1/default route; rebuilding is required to display this UI on Android. The subsequent release is recorded below.

## Release status — 26 September 2026

Production SQL migration applied and verified: user1 remains at 20,000 INR, sequence 1, zero orders; four new RPCs deny anon execution and allow service_role. Source commit 3822669 is local. Android v1.6.0/versionCode 7 built and verified against the prior signing certificate. The user subsequently approved this exact release; commits 3822669 and 091e04c were pushed and Vercel deployment succeeded. No production funding transactions were performed.

### Live verification

Web and Android-origin responses match across all five accounts: intraday 20,000 INR (preserved), short term 20,000 INR, long term 20,000 INR, options 50,000 INR, futures 50,000 INR. Each new account has exactly one opening-capital event and no orders. Intraday capital, transfers, realized result, orders, sequence and event history match the pre-release baseline. Shared opportunity feeds currently contain zero records; the market is closed.

Android CORS/preflight, unknown-segment rejection, v1.6.0 frontend, equity/index histories and quote timestamps, NSE status, screener, metal observations and IPO reports passed live checks. APK published under releases/android/algotrader-shared-segments-v1.6.0.apk with the same signing certificate as v1.5.0. No physical-phone installation, new production funding adjustments or open-market execution test was performed. Short-term/long-term/options/futures execution remains disabled.
