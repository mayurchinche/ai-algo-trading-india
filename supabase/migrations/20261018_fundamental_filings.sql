-- Issuer-reported fundamentals from NSE XBRL financial filings. Insert-only: a restatement is a new
-- filing, and readers choose the latest revision published by their as-of time. Server-only access.
create table if not exists public.fundamental_filings (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 document_hash text not null unique check(document_hash ~ '^[a-f0-9]{64}$'),
 instrument_key text not null check(instrument_key ~ '^NSE_EQ\|INE[A-Z0-9]{9}$'),
 symbol text not null check(symbol ~ '^[A-Z0-9&-]{1,30}$'),
 scope text not null check(scope in ('Standalone','Consolidated')),
 published_at timestamptz not null,
 observed_at timestamptz not null check(observed_at>=published_at),
 created_at timestamptz not null default clock_timestamp(),
 filing jsonb not null
);
create index if not exists fundamental_filings_instrument on public.fundamental_filings(instrument_key,published_at desc);
alter table public.fundamental_filings enable row level security;
revoke all on public.fundamental_filings from public,anon,authenticated,service_role;
grant select on public.fundamental_filings to service_role;
drop policy if exists fundamental_filings_read on public.fundamental_filings;
create policy fundamental_filings_read on public.fundamental_filings for select to service_role using(true);

create or replace function public.record_fundamental_filing(p_filing jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.fundamental_filings; captured timestamptz:=clock_timestamp(); published timestamptz; observed timestamptz;
begin
 perform pg_advisory_xact_lock(26101801);
 if p_filing is null or jsonb_typeof(p_filing) is distinct from 'object' then raise exception 'Invalid fundamental filing'; end if;
 -- Retries and republished documents return the stored row unchanged.
 select * into saved from public.fundamental_filings where id=p_filing->>'id' or document_hash=p_filing->>'documentHash' order by created_at limit 1;
 if found then return to_jsonb(saved); end if;
 if octet_length(p_filing::text)>50000 or
  p_filing->>'policy' is distinct from 'fundamental-filing-v1' or p_filing->>'status' is distinct from 'EXTRACTED_REQUIRES_REVIEW' or
  coalesce(p_filing->>'id','') !~ '^[a-f0-9]{64}$' or coalesce(p_filing->>'documentHash','') !~ '^[a-f0-9]{64}$' or
  coalesce(p_filing->>'symbol','') !~ '^[A-Z0-9&-]{1,30}$' or coalesce(p_filing->>'instrumentKey','') !~ '^NSE_EQ\|INE[A-Z0-9]{9}$' or
  coalesce(p_filing->>'scope','') not in ('Standalone','Consolidated') or
  coalesce(p_filing->>'url','') !~ '^https://nsearchives\.nseindia\.com/corporate/' or
  (case when jsonb_typeof(p_filing->'periods')='array' then jsonb_array_length(p_filing->'periods') between 1 and 32 else false end) is not true
 then raise exception 'Invalid fundamental filing'; end if;
 begin published:=(p_filing->>'publishedAt')::timestamptz; observed:=(p_filing->>'observedAt')::timestamptz;
 exception when others then raise exception 'Invalid observation time'; end;
 if published is null or observed is null or published>observed or observed<captured-interval '6 minutes' or observed>captured+interval '5 seconds' then raise exception 'Invalid observation time'; end if;
 if (select count(*) from public.fundamental_filings)>=100000 then raise exception 'Fundamental filing limit reached'; end if;
 insert into public.fundamental_filings(id,document_hash,instrument_key,symbol,scope,published_at,observed_at,filing)
 values(p_filing->>'id',p_filing->>'documentHash',p_filing->>'instrumentKey',p_filing->>'symbol',p_filing->>'scope',published,observed,p_filing) returning * into saved;
 return to_jsonb(saved);
end; $$;
revoke all on function public.record_fundamental_filing(jsonb) from public,anon,authenticated;
grant execute on function public.record_fundamental_filing(jsonb) to service_role;

create table if not exists public.fundamental_dispatches(request_id bigint primary key,requested_at timestamptz not null default now());
alter table public.fundamental_dispatches enable row level security;
revoke all on public.fundamental_dispatches from public,anon,authenticated;
create or replace function public.dispatch_fundamental_ingest()
returns bigint language plpgsql security definer set search_path='' as $$
declare scheduler_secret text; request_id bigint;
begin
 select decrypted_secret into scheduler_secret from vault.decrypted_secrets where name='paper_scheduler_secret';
 if scheduler_secret is null or length(scheduler_secret)<32 then raise exception 'Scheduler secret missing'; end if;
 select net.http_post(url:='https://ai-algo-trading-india.vercel.app/api/fundamentals',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||scheduler_secret),body:='{}'::jsonb,timeout_milliseconds:=65000) into request_id;
 insert into public.fundamental_dispatches values(request_id,now());
 delete from public.fundamental_dispatches where requested_at<now()-interval '35 days';
 return request_id;
end;
$$;
revoke all on function public.dispatch_fundamental_ingest() from public,anon,authenticated;
-- Installed inactive; enable after the endpoint and secret are verified. Never disable an active job on reapply.
do $$ declare job bigint; begin
 if not exists(select 1 from cron.job where jobname='fundamental-filings') then
  select cron.schedule('fundamental-filings','*/30 * * * *','select public.dispatch_fundamental_ingest();') into job;
  perform cron.alter_job(job,active:=false);
 end if;
end; $$;
