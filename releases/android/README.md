# Android test builds

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
