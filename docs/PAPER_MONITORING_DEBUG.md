# Shared paper monitoring audit — September 30, 2026

Production read-only evidence:
- Shared intraday user1 enabled, principal ₹20,000, zero orders and intents.
- Only ledger event: ENTRIES_ENABLED on September 25 at 17:53:26 UTC (23:23:26 IST), after Friday's market session. The shared-account schema defaults entries to disabled.
- Last recorded cycle was September 30, 07:52:45 UTC when inspected. No historical scan-rejection evidence was retained, so the empty ledger cannot establish last week's signal eligibility.
- Independent production-feed scan September 30, 08:01:31 UTC (13:31:31 IST): 22 scored stocks, maximum absolute score 56, no request failures. No signal met the absolute 70 requirement in that scan.

Root cause of unattended-monitoring gap: visible frontend invokes POST ticks; Vercel schedules only IPO work. Existing paper-worker reads legacy paper_accounts and commits legacy RPCs, not shared_paper_accounts/user1. It cannot advance the shared ledger.

Fix:
- Extract one leased cycle shared by API and new shared-paper-worker. Reuse identical observation, opportunity and execution policies and shared portfolio RPCs. Legacy worker remains separate.
- Persist latest scan status, counts and rejection reasons, last worker attempt, and daily summaries retained for 30 days. Provider failure records an unsuccessful attempt without fabricating a successful execution-cycle timestamp or fills.
- Surface diagnostic status and absence of recent worker heartbeat on the paper page.
- Regression tests cover shared backend visibility, concurrent lease exclusion, missing-feed behavior and retention.

## Deployment boundary

Local tests are not deployment evidence. New worker requires an always-on host; Vercel request functions do not host a continuous process. `.env.worker` is absent locally and the local frontend anon key is not a server service-role credential. No worker has been started, and no missed trade was backfilled.

On the selected host, install with the supported Node runtime, configure ignored server-only `.env.worker` with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SHARED_PAPER_ENABLED=true, then run `npm run worker:shared-paper` under its process supervisor. It builds the observation bundle before starting. The worker requests real provider data and writes only the shared intraday simulation. It creates no real broker orders or notifications. One-shot health check after configuration: build server then `node --env-file=.env.worker scripts/shared-paper-worker.mjs --once`.

Deploy frontend/API changes with the project’s normal Vercel pipeline. Verify persisted lastWorkerAttemptAt and lastScan.source=worker with all apps closed, then confirm existing Android/web clients see the same account revision. A failed provider attempt is not a healthy trading cycle. Public snapshots still cannot guarantee every stop crossing or exchange-like execution.
