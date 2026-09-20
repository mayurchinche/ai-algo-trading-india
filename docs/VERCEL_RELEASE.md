# Vercel release and Android backend setup

## Root cause
The production deployment predates `/api/market`; requests to it return 404 although the old proxy can fetch market data. Previous Android previews had no `VITE_API_BASE_URL` and sent API requests to Capacitor's bundled localhost server.

## Release gate
1. Deploy this source as a Vercel preview (Vite framework, `npm ci`, `npm run build`, output `dist`). The root `api/` directory must deploy as functions; uploading `dist` alone is insufficient.
2. Run `npm run check:deployment -- https://PREVIEW_HOST`. Deployment Protection may require opening the preview or an authorized bypass before this read-only check can run. Do not disable protection solely for testing.
3. Review and merge/promote only after the API checks pass. Run the same command against `https://ai-algo-trading-india.vercel.app` after production deployment.
4. Copy `.env.mobile.example` to `.env.mobile`. Its public `VITE_API_BASE_URL` points to the production Vercel origin. Then run `npm run mobile:sync` and build Android.
5. Verify stock observations and original quote timestamps on Android. Closed-market history may appear; stale quotes must never trigger a trade or strong-signal popup.

## Required configuration
- Web market data and foreground alerts require no Firebase or Supabase credentials. Web requests are same-origin.
- Android requires the public HTTPS Vercel origin at build time. Builds now reject absent, placeholder or non-HTTPS addresses.
- The default CORS allowlist includes Android `https://localhost` and iOS `capacitor://localhost`. If overriding `MOBILE_ALLOWED_ORIGINS`, preserve the required origins.
- Optional IPO cron requires server-side `CRON_SECRET` and existing Supabase configuration. Background alert APIs/workers remain inactive unless separately configured; no Firebase setup is needed for foreground popups.
- Never put service-role credentials or provider secrets in `VITE_*` variables.

## Verification
`npm test`, `npm run lint`, `npm run build`, `npm run mobile:sync`, and `npm run check:deployment -- https://DEPLOYMENT_HOST`.
The deployment checker tests API version, Android CORS/preflight, equity/index history, quote timestamps, NSE session status and screener data. `/api/health` confirms the application API is deployed; it alone does not prove provider availability.

## Limitations
Yahoo/NSE research endpoints can rate-limit or become unavailable. Failures pause observations and surface errors; they do not become profitable signals. This release does not validate strategy profitability or enable live order execution. Market-hour alert behaviour needs a live-session check after deployment.
