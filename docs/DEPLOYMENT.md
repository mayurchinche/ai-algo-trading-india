# Run and deploy

Use Node 22.12 or newer. Run `npm ci`, `npm test`, `npm run build`, then `npm run dev` for local development.

Vercel: import this repository as Vite, build `npm run build`, output `dist`. The `/api/market` handler runs in the deployment and is shared with local Vite development. No local proxy process is needed for the deployed app. Research upstream failures are shown as errors; no stale quote is treated as live.

GitHub Pages can host the static UI but does not host `/api/*`. Use Vercel for the complete app. `VITE_API_BASE_URL` is available for a separate backend, which must explicitly allow the frontend origin via CORS; no wildcard credential CORS is configured.

The existing IPO cron now requires a server-side `CRON_SECRET`. Do not place that secret in a VITE variable. Its existing daily schedule is not a paper-trading scheduler.

Browser history lives under the site's origin. Switching deployment domains or devices does not transfer localStorage. Export existing journals before moving domains. Automatic anonymous Supabase sync is disabled because the existing policy shares all rows; see REPAIR-NOTES.md for the authenticated backend requirements.

The web manifest supports adding the app to an Android home screen on HTTPS. The service worker does not cache quotes, API responses, authentication or orders. It does not trade in the background. Native APK generation/signing is separate work.
