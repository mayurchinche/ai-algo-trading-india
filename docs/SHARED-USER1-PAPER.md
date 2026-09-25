# Shared paper account user1

## Status
Database migration applied to Supabase project `ndiqvhvcqhlyrkpcguzk` on 25 September 2026 through its SQL editor. Verified all three shared tables have RLS enabled and anonymous SELECT denied. No earlier backend paper tables existed. Production `SUPABASE_URL` and `SHARED_PAPER_ENABLED=true` saved in Vercel. The server-only service-role secret is saved as a Vercel Production Secret with user approval. Code deployment is pending this release; existing v1.4.0 APKs still use device storage. Android v1.5.0 (versionCode 6) has been built for the shared endpoint. Local checks: 101 tests, database integration, lint and mobile build passed. No historical import has been performed.

## Account behavior
Web and Android use the same backend-owned `user1` ledger, balance, orders, intents and events. There is no sign-in form or embedded shared password. This is a deliberately shared simulation: anyone using this endpoint can view/change its paper account. It is not a private authenticated account and must contain no real money or private account data. Existing authenticated `paper_accounts` and their RLS are unchanged.

Dedicated `shared_paper_*` tables deny direct access to anonymous and authenticated clients. Only the server service role accesses them. The API binds all requests to user1 and never accepts a caller-selected account. Credentials remain server-side. The client never falls back to local execution if the API fails.

A visible app asks the backend to monitor once a minute. The backend fetches provider quotes and computes candidates itself; clients cannot submit fabricated prices or fills. A database lease prevents concurrent observation cycles, revision checks discard stale results if another device changes the account, and request IDs make retries idempotent. Paper actions share the existing execution/risk engine. UI polling refreshes the ledger approximately every 15 seconds while viewing it. Closing all apps stops this foreground-triggered monitoring. The old authenticated worker does not operate on user1.

## Activate in this order
1. Back up existing data. Apply `supabase/migrations/20260925_shared_paper_user1.sql` in the intended Supabase project using the database owner. It adds dedicated tables; it does not delete, expose or import old/private rows.
2. Set server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SHARED_PAPER_ENABLED=true` in the Vercel project. Configure `MOBILE_ALLOWED_ORIGINS` for the intended web origins plus `https://localhost,capacitor://localhost`. Never put the service-role key in a VITE variable or APK. The API fails closed unless explicitly enabled.
3. Deploy the repository with the shared TypeScript API, database migration already applied, and normal Vite build. `/api/shared-paper` has a 60-second duration configuration. Provider failures preserve the ledger and report monitoring failure; actual provider latency/rate limits need an open-session test.
4. Check GET `/api/shared-paper` returns JSON with `account.name=user1`, `account.storage=shared-backend`, revision, balance and paginated events. Verify Android CORS preflight, too. There is no private user table login step.
5. Build web and Android from the same revision. Android `VITE_API_BASE_URL` must point to that Vercel origin. For local web testing against it, set the same public API base; otherwise Vite serves its local handler using process-level server settings.
6. Before new activity, export earlier device accounts from each device under Paper trades → Funds & balance ledger → Export earlier device account. Reconcile them explicitly: overlapping history must not be counted twice. Automatic import/merge is intentionally not implemented, and local records are not deleted. Existing private backend accounts likewise require a separately reviewed migration; they are not exposed by this change.
7. In two clients, verify a paper deposit appears once with the same revision/balance and order timeline, test pause/resume, and observe next-quote entry/exit during an open session. Export user1 and compare event IDs. Then publish the Android build. Do not describe local tests as proof of live synchronization.

## Verification
Automated tests cover shared reads, funding retry deduplication, conflicting actions, concurrent cycles, stale-cycle discard, next-quote execution, client network/schema failure, server-only provider IO, SQL transaction rollback, database lease ownership and denied direct client access. No destructive retention job is enabled. Options and futures remain unavailable.
