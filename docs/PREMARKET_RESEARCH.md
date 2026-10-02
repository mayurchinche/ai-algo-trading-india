# Pre-market research — first implementation

## Available
The Pre-market navigation entry is shared by all trading segments. It reads centrally stored dated research snapshots, defaults to the 08:45 slot when available, exports evidence JSON and offers an explicitly unsaved current preview. Browser/app rendering never creates a historical report. Existing paper balances, signals, execution thresholds and orders are unchanged.

Sources: Upstox public NSE instrument master (normal EQ entries only), plus three Google News RSS queries (company, earnings and market). This is a source sample, not exhaustive market coverage. Multiword company aliases are matched conservatively; multi-company ambiguity is excluded. Dated evergreen financial directories, price-only pages and generic stock roundups are excluded. Headline event categories are ordered by category coverage and recency, not predicted profit. Original filings, investor identities, materiality, financials, prices and liquidity remain unverified. No bullish/bearish direction, entry or stop is invented. Current preview data is cached up to five minutes; instrument metadata up to six hours.

## Backend contract
- GET /api/premarket?date=YYYY-MM-DD: shared stored reports and recent dates; never silently falls back to a local/device ledger or live-generated historical data.
- GET /api/premarket?preview=1: current unsaved observations; never backdates them.
- POST /api/scheduled-premarket: accepts only an empty body and existing server-only PAPER_SCHEDULER_SECRET bearer token. Uses its own clock and fixed sources, not caller-supplied prices, dates or candidates. Weekday window 07:30–09:15 IST. Failures are recorded as UNAVAILABLE, not an empty successful shortlist.
- public.record_premarket_snapshot: service-role RPC, validates recent start time and derived IST slot/date. First insert wins. DB-generated publication time and before-open flag take precedence. Retains 35 days. Client roles cannot read/write tables or invoke the scheduler.

Pre-open depth and holiday/session eligibility are not yet connected. Weekday research may run on holidays and must not be interpreted as an eligible trading session. Options/futures get underlying-company research only; execution remains disabled.

## Deployment
1. Deploy code and apply supabase/migrations/20261002_premarket_research.sql to the existing project. It reuses pg_cron, pg_net and the existing Vault paper_scheduler_secret; no new secret is needed. It does not alter the existing paper scheduler.
2. Inspect public.premarket_snapshots privileges, and validate the new authenticated endpoint using the existing server credential without revealing it. An outside-window response validates authentication only, not collection.
3. Activate the installed inactive job after validation:
   select cron.alter_job((select jobid from cron.job where jobname='premarket-research'), active := true);
4. Verify cron.job active state, public.premarket_dispatches request IDs, corresponding net._http_response status, and actual premarket_snapshots rows during the next research window. Dispatch HTTP200 alone is not proof of persistence. Inspect report.status and sourceHealth as well.

UTC cron: */15 2-3 * * 1-5; SQL guards ensure only 07:30–09:15 IST. No missed interval is recreated with later data. A failed immutable slot remains failed; the next slot may succeed. Failure/retry history and 08:45 publication are visible independently.

## Validation
Unit tests cover cutoffs, source failure, conservative mapping, ambiguity, directory exclusions, authorization and duplicates. PGlite integration checks immutable records, authoritative publication fields, backdating rejection, denied client privileges and preservation of an already-active cron job on migration reapply. Real previews have been tested with public sources; this does not establish profitability or verify a future scheduled run. Installed APKs need a rebuild for the new navigation.
