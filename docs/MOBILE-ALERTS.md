# Native mobile alerts — implementation and activation

The priority is an Android/iOS app receiving visible remote push alerts without an open WebView. This implementation creates Capacitor 8 Android/iOS projects, native registration/permission flows, an authenticated alert inbox, a persistent PostgreSQL outbox, Android FCM and iOS APNs senders, and an independently running signal worker. It is not deployed or connected to live push accounts yet.

## What the user receives

A strong research alert contains the symbol, direction, reference entry, stop, target, signal timestamp and a short validity window. Tapping it opens the saved signal in Alerts. The screen shows quote time, expiry, strategy version and contract details, with expired signals clearly marked as history. Alerts do not place trades.

Users explicitly enable their account preferences and register their phone. Equity and options have separate toggles, with a minimum absolute heuristic score of 70, 80 or 90. The score is not a calibrated profit probability. Device permission and backend opt-in are both required. Notification history is retained for 30 days; the UI currently shows the latest 100.

## Architecture

Backend worker -> existing corrected discovery -> strong-signal policy -> transactional inbox/outbox -> push dispatcher -> FCM (Android) / APNs (iOS) -> native notification -> authenticated inbox.

The worker is independent of browser/app lifecycle. Current scan cadence is one minute after each scan completes, dispatch cadence 15 seconds between worker cycles. This is research polling, not a tick-level broker strategy. Every send checks freshness again; TTL is at most two minutes from the source quote. Equity validity is capped at session close. One signal per symbol, direction, strategy version and IST session is queued, so repeated scans do not spam the same setup. A new same-direction setup later that day does not currently create another alert.

PostgreSQL row locks and job leases prevent concurrent workers claiming the same job. Failed sends retry up to three times before expiry; invalid tokens are disabled. Expired jobs are not sent. A crash after provider acceptance but before DB acknowledgement can retry: delivery is at-least-once, not exactly-once. Stable Android tags / APNs collapse IDs reduce duplicate display. Provider acceptance is recorded as **accepted**, never falsely labelled device-delivered. Notification taps record opened_at.

## Options safety gate

The existing options engine estimates premiums and probabilities from underlying prices. Those estimates cannot produce push alerts. The policy requires an actual contract identifier, CE/PE, future expiry, positive integer lot size, strike, timestamped bid/ask, <=5% spread and an entry matching the relevant premium side. The current worker emits equity signals only. A licensed options-data adapter and strategy producing validated contract payloads must be connected before options notifications will appear. Enabling the options toggle alone does not enable that missing data source.

## Activate the backend

1. Apply `supabase/migrations/20260918_mobile_alerts.sql` to the intended Supabase project. Do not use the old permissive `app_data` table for push data. The new tables use owner-read policies and server-only writes/token access. Test migrations against staging first.
2. Provision the user's Supabase Auth account. The app uses email OTP for existing users (`shouldCreateUser: false`). Configure the Supabase email template to include `{{ .Token }}`, and email delivery/rate limits. No accounts/emails were created or sent during development.
3. Deploy `/api/mobile-alerts`, `/api/market` and optional `/api/dispatch-alerts` on the HTTPS backend. Set server environment values from `.env.worker.example`. Restrict native CORS to the actual Capacitor origins; include the web-preview origin only if required.
4. Supply Android Firebase service-account credentials privately as `FIREBASE_SERVICE_ACCOUNT_JSON`. Supply the Apple .p8 key, key ID, team ID, final bundle ID and correct sandbox/production environment privately. None belongs in a VITE variable or client bundle.
5. Run `npm run worker:signals` on an always-on Node >=22.12 worker after creating the ignored `.env.worker` file. Supervise/restart it with the hosting platform. It does not execute broker orders or implement the continuous paper-trading backend. Do not use a daily Vercel Hobby cron for this minute-level loop.
6. Optional external dispatch: authenticated `POST /api/dispatch-alerts` with `Authorization: Bearer <PUSH_WORKER_SECRET>`. The worker also dispatches directly, so this endpoint is not required.

## Build the apps

`com.algotrader.research` is a development identifier. Confirm ownership/availability and the final product identity before store submission or registering production push credentials.

Use Node >=22.12. Copy `.env.mobile.example` to ignored `.env.mobile` and configure the real public API/Supabase values. Run `npm run mobile:sync` to build with mobile configuration and synchronize both native projects. Android needs the backend's native CORS configuration. Client API requests use the configured HTTPS origin, not a desktop proxy.

Android: register the package in Firebase, put its `google-services.json` in `android/app/` (gitignored), open `npm run mobile:android`, sync Gradle, build/install on a real phone. Use the matching Android SDK and JDK 21 supplied by recent Android Studio. Signing keys are not generated or committed. A build without Firebase/backend config is only a UI preview; push registration will fail explicitly.

iOS: install full Xcode, configure the development team and matching bundle identifier/provisioning, enable the Push Notifications capability, and open `npm run mobile:ios`. The AppDelegate has the Capacitor registration callbacks; entitlements select development for Debug and production for Release. Match the backend APNS_ENVIRONMENT to the signed build. The current machine's selected developer tools are Command Line Tools, so iOS compilation/signing is not verified.

Native service-worker registration is disabled. The app uses visible remote notifications, not unsupported silent/background JavaScript timers.

## Release checks still required

- Test signed builds on physical Android/iOS phones: foreground, background, terminated app, reboot, permission denial, token refresh, logout/user switch, loss of connectivity and expired notification taps.
- Confirm blocked/expired signals never send, options quotes are actual premiums, disabled preferences stop queued sends, and the inbox shows only the signed-in account.
- Observe dispatch latency, failed worker cycles, queue age and provider errors. Device notification delivery cannot be guaranteed: operating-system settings, Doze/Focus, app force-stop and connectivity can delay or suppress it.
- Complete Firebase/Apple setup, staging/live database migration, licensed feed selection, deployment and device acceptance tests. No App Store/Play Store release is implied by generated projects.

## References checked

- Official Capacitor push plugin: https://capacitorjs.com/docs/apis/push-notifications
- FCM lifespan/expiry: https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan
- APNs token authentication: https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns

## Verification completed in this change

- 28 unit/regression tests pass, including delivery retry/expiry/preference revocation and invalid-token cases with mocked providers.
- Local PostgreSQL integration passes: schema migration, opt-in filtering, idempotent enqueue, lease exclusion, row ownership, private tokens, service-only writes, expiry and 30-day cleanup.
- TypeScript/Vite mobile build and Capacitor Android/iOS asset/plugin synchronization pass.
- Lint completes with the existing MetalsPage effect-dependency warning.
- Alerts sign-in screen and bottom navigation inspected at 390px; page has no horizontal overflow.
- No live notifications, sign-in emails, account changes, database migrations or deployments were performed. No signed APK/AAB/IPA has been produced. Physical-device push and native compilation remain unverified.
