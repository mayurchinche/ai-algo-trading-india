# Shared opportunity feed

Implemented locally, 2026-09-25. Requires the pending five-portfolio release; not deployed.

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

Apply the pending 20260926_paper_portfolios.sql migration before deploying the server/frontend. It includes a partial per-account sequence index for opportunity events. Existing installed APKs keep the old user1/default route; rebuilding is required to display this UI on Android. No production mutation or new APK is included in this local phase.
