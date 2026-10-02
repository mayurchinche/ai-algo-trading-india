-- Shared research only; no paper balances, orders or existing cron jobs are modified.
create table if not exists public.premarket_snapshots (
 session_date date not null,
 slot text not null check (slot in ('07:30','07:45','08:00','08:15','08:30','08:45','09:00','09:15')),
 published_at timestamptz not null default clock_timestamp(),
 report jsonb not null,
 primary key(session_date,slot)
);
alter table public.premarket_snapshots enable row level security;
revoke all on public.premarket_snapshots from public,anon,authenticated,service_role;
grant select on public.premarket_snapshots to service_role;
drop policy if exists premarket_server_read on public.premarket_snapshots;
create policy premarket_server_read on public.premarket_snapshots for select to service_role using (true);

create or replace function public.record_premarket_snapshot(p_date date,p_slot text,p_report jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 captured timestamptz := clock_timestamp();
 started timestamptz;
 local_started timestamp;
 minute integer;
 expected_slot text;
 saved public.premarket_snapshots;
begin
 if jsonb_typeof(p_report) <> 'object' or octet_length(p_report::text)>250000 or
    p_report->>'mode' is distinct from 'scheduled' or
    coalesce(p_report->>'status','') not in ('AVAILABLE','PARTIAL','NO_MATCHED_EVENTS','UNAVAILABLE') or
    jsonb_typeof(p_report->'candidates') is distinct from 'array' then raise exception 'Invalid research report'; end if;
 if jsonb_array_length(p_report->'candidates')>10 then raise exception 'Too many candidates'; end if;
 started := (p_report->>'startedAt')::timestamptz;
 if started is null or started < captured-interval '2 minutes' or started>captured+interval '5 seconds' then raise exception 'Cannot backdate research'; end if;
 local_started := started at time zone 'Asia/Kolkata';
 minute := extract(hour from local_started)::integer*60+extract(minute from local_started)::integer;
 expected_slot := lpad((minute/60)::text,2,'0')||':'||lpad(((minute%60)/15*15)::text,2,'0');
 if extract(isodow from local_started)>5 or minute<450 or minute>=556 or p_date is distinct from local_started::date or p_slot is distinct from expected_slot then raise exception 'Invalid research slot'; end if;
 insert into public.premarket_snapshots(session_date,slot,published_at,report)
 values(p_date,p_slot,captured,p_report||jsonb_build_object('publishedAt',captured,'beforeRegularOpen',(captured at time zone 'Asia/Kolkata')::time < time '09:15','late',minute%15>2))
 on conflict(session_date,slot) do nothing;
 select * into saved from public.premarket_snapshots where session_date=p_date and slot=p_slot;
 delete from public.premarket_snapshots where published_at<captured-interval '35 days';
 return to_jsonb(saved);
end;
$$;
revoke all on function public.record_premarket_snapshot(date,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_premarket_snapshot(date,text,jsonb) to service_role;

create table if not exists public.premarket_dispatches(request_id bigint primary key,requested_at timestamptz not null default now());
alter table public.premarket_dispatches enable row level security;
revoke all on public.premarket_dispatches from public,anon,authenticated;
create or replace function public.dispatch_premarket_research()
returns bigint language plpgsql security definer set search_path='' as $$
declare local_time timestamp := now() at time zone 'Asia/Kolkata'; scheduler_secret text; request_id bigint;
begin
 if extract(isodow from local_time)>5 or local_time::time<time '07:30' or local_time::time>time '09:15:59' then return null; end if;
 select decrypted_secret into scheduler_secret from vault.decrypted_secrets where name='paper_scheduler_secret';
 if scheduler_secret is null or length(scheduler_secret)<32 then raise exception 'Scheduler secret missing'; end if;
 select net.http_post(url:='https://ai-algo-trading-india.vercel.app/api/scheduled-premarket',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||scheduler_secret),body:='{}'::jsonb,timeout_milliseconds:=65000) into request_id;
 insert into public.premarket_dispatches values(request_id,now());
 delete from public.premarket_dispatches where requested_at<now()-interval '35 days';
 return request_id;
end;
$$;
revoke all on function public.dispatch_premarket_research() from public,anon,authenticated;
-- Existing pg_cron / pg_net and Vault installation are reused. Never disable an existing active job on reapply.
do $$ declare job bigint; begin
 if not exists(select 1 from cron.job where jobname='premarket-research') then
  select cron.schedule('premarket-research','*/15 2-3 * * 1-5','select public.dispatch_premarket_research();') into job;
  perform cron.alter_job(job,active:=false);
 end if;
end; $$;
