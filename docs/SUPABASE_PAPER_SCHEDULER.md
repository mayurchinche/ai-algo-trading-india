# Supabase-scheduled paper trading

Supabase Cron invokes the authenticated Vercel POST `/api/scheduled-paper` once per minute during the weekday 09:15–15:35 IST monitoring window. NSE market status remains the holiday/entry gate. Only the shared intraday account is executed; unsupported segments remain disabled. Existing web/Android ticks share the same database lease and revision checks.

This is a periodic public-quote simulation, not tick-by-tick execution. Delays, provider failures and gaps can prevent fills. Scheduler success is not proof that a trade qualified.

## Activation order

1. Deploy the API/UI changes through the project's Vercel pipeline. Configure server-only `PAPER_SCHEDULER_SECRET` with a newly generated random secret of at least 32 characters. Keep the existing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SHARED_PAPER_ENABLED settings. Never put the scheduler token in a VITE variable, Git or an APK.
2. Store the identical token in Supabase Vault with name `paper_scheduler_secret`, using its private dashboard secret entry. It is distinct from the database service-role credential.
3. Apply `supabase/migrations/20261001_paper_scheduler.sql` using the Supabase SQL editor or migration tooling. The migration installs the named job **inactive**. pg_cron and pg_net must be available; Supabase Vault must be enabled. Reapplying the migration pauses the job for revalidation.
4. Invoke the endpoint with an empty JSON body and `Authorization: Bearer <token>` from a trusted server-side client. Do not paste the populated command into shared logs. A 401 proves authentication rejection; a successful market-hours invocation must also update persisted scan diagnostics. An out-of-window response alone does not test database/provider access.
5. Enable after successful verification:

```sql
select cron.alter_job(jobid, active := true)
from cron.job where jobname = 'shared-paper-minute';
```

Pause without modifying balances or pausing foreground requests:

```sql
select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'shared-paper-minute';
```

A dedicated scheduler token is used so Vault does not transmit the Supabase service-role key to the HTTP endpoint. Unauthorized requests never access the database. Direct dispatch function execution is revoked from public/anon/authenticated roles. Cron runs as its administrative creator.

## Verification and troubleshooting

Close all apps for several cycles, then read `/api/shared-paper?segment=intraday`. Check `state.lastWorkerAttemptAt`, `state.lastScan.source = scheduler`, scan status and fresh lastCycleAt. Failed observations update the attempt diagnostics but not a successful-cycle timestamp. BUSY/THROTTLED means a foreground or other scheduled request owns the work; it is not evidence of a completed scan.

```sql
select jobname, schedule, active from cron.job where jobname='shared-paper-minute';
select requested_at, d.request_id, r.status_code, r.timed_out, r.error_msg
from public.paper_scheduler_dispatches d
left join net._http_response r on r.id=d.request_id
order by d.requested_at desc limit 20;
```

Dispatch IDs are retained for 30 days; pg_net response retention is shorter, so absent response rows do not imply success or failure. Cron's SQL success means the HTTP request was queued, not that Vercel returned success. Use HTTP status and persisted shared-account diagnostics together. Job errors appear in cron.job_run_details. No credentials are recorded in the dispatch table or cron command.

Production activation is a separate verification step. Running local tests does not enable this job or deploy the endpoint. This removes the need for a separate always-on server, subject to the deployed Supabase project's extension availability and Vercel usage/runtime limits.

References: https://supabase.com/docs/guides/functions/schedule-functions and https://supabase.com/docs/guides/database/extensions/pg_net
