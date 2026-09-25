# Android test builds

## Prepared: v1.6.0 — five shared accounts and shared signals

[Android v1.6.0 APK](./algotrader-shared-segments-v1.6.0.apk?raw=true)

VersionCode 7; signed with the same debug certificate as v1.5.0. Install as an update without clearing app data. Includes five segment views, independent shared funding ledgers and backend-recorded intraday opportunities for Home, Signals, Alerts and foreground popups. The existing intraday balance/history is preserved. Short term, long term, options and futures remain funding-only until their execution models and data are validated.

The Supabase migration was applied on 26 September 2026. Application deployment and APK publication await explicit release approval; this APK requires the new backend release. 107 tests, five database suites, lint, mobile build, Capacitor sync and assembleDebug passed. APK package/version/API URL and matching signing certificate verified. Physical-device installation and open-session trading remain unverified.

SHA-256: `f847c47c6d6d6dfbdb1be919bba4e682f6bebe92348a7a6e3edb37af14c34bf4`

## Previous: v1.5.0 — shared user1 paper account

[Download Android v1.5.0](./algotrader-shared-user1-v1.5.0.apk?raw=true)

Install as an update without clearing app data. VersionCode 6, footer v1.5.0. Web and Android use the same backend-owned user1 paper balance, orders and timestamped events without a login form. The matching shared API and database are deployed; live web/Android-origin reads and CORS passed on 25 September 2026. Previous device history is preserved for export in Funds & balance ledger; it is not automatically merged into user1.

This is a shared simulator: everyone can view/change the same account. No real broker orders. Monitoring runs while a client is visible; options and futures remain unavailable. Provider failures do not switch to local execution. 101 tests plus database integration, lint, TypeScript/mobile build, Capacitor sync and Android assembleDebug passed. Debug-signed test APK; physical-phone installation and open-session trading remain unverified.

SHA-256: `c7c339090aaaaca5a0a0c6334a67d8b8488369f8c47392f8c17a6d6b3aa010db`

## Previous: v1.4.0 — trading home, opportunity cards and timelines

[Download Android v1.4.0](./algotrader-trading-home-v1.4.0.apk?raw=true)

Install as an update without clearing app data. VersionCode 5, footer v1.4.0. Home shows ledger balance, current position P&L estimates, today's closed-trade net result by IST exit date, open positions and recent outcomes. Opportunity cards show actual signal/quote timestamps, recorded reasons, freshness/session status and gross reward/risk; open the linked signal controls in Paper trades. No new selection strategy or profitability claim is introduced.

Select a recorded trade to see its timeline: signal workflow, approvals, submission, amendments, partial fills and exit events where recorded. Source quote time remains separate from processing time. Missing data and monitoring gaps remain visible. The same timeline is available from the Paper trades audit trail. Options and futures remain visibly unavailable until verified contract feeds and execution models are ready.

93 regression tests plus database checks passed. Lint, TypeScript/mobile build, Capacitor sync and Android assembleDebug passed. Home/cards checked at phone widths; isolated timeline fixture verified at 320px without modifying user storage. APK contents/version verified. Debug-signed test build; no physical-device installation, open-session soak test or deployment performed. Requires the existing Vercel market-data backend.

SHA-256: `338f4879a235b69d37692973ff15f48cb5f176f3947e0b491d971fb609ad6019`

## Previous: v1.3.0 — signal tickets and order controls

[Download Android v1.3.0](./algotrader-paper-orders-v1.3.0.apk?raw=true)

Install as an update without clearing app data. VersionCode 4, footer v1.3.0. Open Paper trades → Signal → order. Choose automatic execution with no added delay, at least 30s or 60s, or review each signal manually. Manual tickets support market, limit and stop-entry orders with quantity, TTL2/DAY/IOC validity; stop-IOC is unsupported. DAY means the app intraday cutoff at 15:15 IST. Delays are serviced on the next foreground scan.

Pending limit/stop orders can be amended before a fill/trigger; quantity may only stay the same or decrease. Cancel unfilled quantity without closing existing exposure. New orders record strategy reasons, policy and execution settings for descriptive evidence; this is not validated profitability. Options, futures, delivery holdings and always-on background monitoring remain unavailable. No broker order is sent.

90 regression tests plus database checks passed; lint, mobile build and Android build passed. Isolated ticket UI tested at 360px without writing to user storage. Debug-signed test build; no physical-phone installation or open-session soak test performed.

SHA-256: `b10e49fa69d420770b34321226716bec015f6b3f574c8be3b4356746b5387778`

## Previous: v1.2.0 — IPO layout and paper workspace

[Download Android v1.2.0](./algotrader-paper-workspace-v1.2.0.apk?raw=true)

Install as an update without uninstalling or clearing app data. Footer: **v1.2.0**; Android versionCode 3. Fixes narrow-screen IPO name/source/score overlap. Paper trades now has Orders, Positions and Closed trades with individual P&L estimates and signal/order/entry/exit timestamps. Short-term, futures and options views explicitly remain planned; they do not create unsupported fills. Device monitoring is still foreground-only and no sign-in is required.

77 tests plus database checks, lint, web/mobile builds passed. Live IPO cards were checked at 320/360px. Debug-signed test APK; physical-device installation and open-session forward trading not verified. See [phased plan](../../docs/paper-workspace-plan/task_plan.md).

SHA-256: `5a7355f6b474173bc3a73571b9d610d4ab080a1267b41e66dd2ca0ebe0efcbf9`

## Previous: v1.1.0 — no login, direct Paper trades

[Download the current Android APK](./algotrader-paper-trades-v1.1.0.apk?raw=true)

Install this APK as an update to the existing app. Do not uninstall or clear storage: paper history lives on the device. The footer must show **v1.1.0**. Open **Paper trades** in the bottom navigation; no email or password is required. If no orders exist, the screen explains how automatic paper trading starts. Account balances, simulated funding and timestamped history are available without a server account. Monitoring runs only while the app is open and visible.

Debug-signed Android test build, versionCode 2. Build and packaged JavaScript verified; installation on a physical phone has not been verified. Older APKs below are historical and may still require login.

SHA-256: `1b7b9d4a6dd3a65f1d89e4af765379b79945efb52c02e142365823fb99b5057c`

## Strong-signal policy update — 20 September 2026

[Download the updated APK](./algotrader-strong-signals-2026-09-20.apk?raw=true)

This debug-signed phone-test build uses the deployed Vercel backend. It adds shared 70/100 strong-signal admission, aligned signal timestamps, and a 30-day paper decision journal under Alerts. Repeated skips are grouped with first/last observed times and counts. Paper account limits still apply separately from research popups. Old trades and account balance are preserved; older-policy trades are excluded from the new policy evaluation.

Backend health, Android CORS/preflight, history, quote timestamps, NSE status and screener passed live checks on 20 September. The market was closed; this is not an open-session trading validation. No device was connected for an installation test.

SHA-256: `d053905982b809bfe68803c88a0da83c2a617302d4f11e2ed4d035afdc041875`

## Previous backend test build

[Download the APK](./algotrader-backend-release-candidate.apk?raw=true)

On GitHub, use the link above or open the APK and select **Download raw file**. Transfer it to your Android phone, open it, and allow installation from that source if prompted.

- Built on 19 September 2026; debug-signed release candidate, not a Play Store production release.
- Uses Capacitor. Expo Go is not required.
- Configured backend: https://ai-algo-trading-india.vercel.app
- Market data requires the matching Vercel backend to be deployed and available. This APK does not include the server.
- Strong-signal popups run only while the app is open and visible.

SHA-256: `edd3f60cb314618866a81294e68e910d2bf5282905d14df9a855959f37044b81`

## Production-data audit build — 20 September 2026

`algotrader-observed-data-2026-09-20.apk` is a debug-signed verification build containing observed-data hardening. SHA-256: `9087a59cc0f3d8d00ff9d80c9ae2601a76a66ed4caf6f3846b43e1bb1c01a1ce`. Options and IPO order execution are intentionally unavailable. It uses the existing Vercel data backend; the backend policy upgrade and database migration have NOT been deployed. It is not a signed production release and has not been tested on a connected phone.

## Persistent paper account verification build

`algotrader-persistent-paper-2026-09-20.apk` — SHA256 `75732d5c5361eb35fd8e8bd0afd17f931b16f42f0c21fece208d99cdf83ffe6a`. Debug-signed; requires authenticated paper API/database and an always-on worker to activate. It does not activate the production backend or a broker stream. See `docs/PERSISTENT-PAPER-TRADING.md`.

## Cumulative balance and funding verification build

`algotrader-paper-balance-2026-09-20.apk` — SHA256 `b1c8e36e0162f12cebdbcc784bd5d10c683576084573a76715cca16632560d6d`. Debug test APK: simulated deposits/withdrawals, cumulative account metrics and one-time local journal reconciliation. Requires the persistent paper API/database/worker activation; installing alone does not deploy the backend or import history.

## Workspace UI verification build

`algotrader-workspace-ui-2026-09-20.apk` — SHA256 `e124ac1dac21f421eef37b0556e536c0083a56c82d3a8eb9f2dd0be51f2ca6a8`. Redesigned mobile/desktop navigation, account styling and searchable research cards with lazy page loading. Debug-signed; backend activation is still required.
