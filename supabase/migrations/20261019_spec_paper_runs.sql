-- Forward paper runs of strategy specs for the shared user1 account. Paper only: no broker path exists.
-- State is written only through save_spec_paper_state with an expected version, so two scheduler cycles
-- can never overwrite each other.
create table if not exists public.spec_paper_runs (
 id uuid primary key,
 account_id text not null default 'user1' check(account_id='user1'),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','STOPPED')),
 version integer not null default 0 check(version>=0),
 spec jsonb not null,
 options jsonb not null,
 state jsonb not null
);
create index if not exists spec_paper_runs_status on public.spec_paper_runs(status,created_at desc);
alter table public.spec_paper_runs enable row level security;
revoke all on public.spec_paper_runs from public,anon,authenticated,service_role;
grant select on public.spec_paper_runs to service_role;
drop policy if exists spec_paper_runs_read on public.spec_paper_runs;
create policy spec_paper_runs_read on public.spec_paper_runs for select to service_role using(true);

create or replace function public.create_spec_paper_run(p_id uuid,p_spec jsonb,p_options jsonb,p_state jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.spec_paper_runs;
begin
 perform pg_advisory_xact_lock(26101901);
 select * into saved from public.spec_paper_runs where id=p_id;
 if found then return to_jsonb(saved); end if;
 if p_id is null or jsonb_typeof(p_spec) is distinct from 'object' or (p_spec->>'schemaVersion') is distinct from '1' or
  jsonb_typeof(p_options) is distinct from 'object' or jsonb_typeof(p_state) is distinct from 'object' or
  octet_length(p_spec::text)>50000 or octet_length(p_options::text)>2000 or octet_length(p_state::text)>200000 then raise exception 'Invalid spec paper run'; end if;
 if (select count(*) from public.spec_paper_runs where status='ACTIVE')>=20 then raise exception 'Active spec paper run limit reached'; end if;
 insert into public.spec_paper_runs(id,spec,options,state) values(p_id,p_spec,p_options,p_state) returning * into saved;
 return to_jsonb(saved);
end; $$;
revoke all on function public.create_spec_paper_run(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_spec_paper_run(uuid,jsonb,jsonb,jsonb) to service_role;

-- Returns null when the expected version is stale; the caller must re-read.
create or replace function public.save_spec_paper_state(p_id uuid,p_expected_version integer,p_state jsonb,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.spec_paper_runs;
begin
 if jsonb_typeof(p_state) is distinct from 'object' or octet_length(p_state::text)>200000 or p_status not in ('ACTIVE','STOPPED') then raise exception 'Invalid spec paper state'; end if;
 update public.spec_paper_runs set state=p_state,status=p_status,version=version+1,updated_at=clock_timestamp()
  where id=p_id and version=p_expected_version and status='ACTIVE' returning * into saved;
 if not found then return null; end if;
 return to_jsonb(saved);
end; $$;
revoke all on function public.save_spec_paper_state(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_spec_paper_state(uuid,integer,jsonb,text) to service_role;

create table if not exists public.spec_paper_dispatches(request_id bigint primary key,requested_at timestamptz not null default now());
alter table public.spec_paper_dispatches enable row level security;
revoke all on public.spec_paper_dispatches from public,anon,authenticated;
create or replace function public.dispatch_spec_paper_cycle()
returns bigint language plpgsql security definer set search_path='' as $$
declare local_time timestamp := now() at time zone 'Asia/Kolkata'; scheduler_secret text; request_id bigint;
begin
 if extract(isodow from local_time)>5 or local_time::time<time '09:15' or local_time::time>time '15:35' then return null; end if;
 select decrypted_secret into scheduler_secret from vault.decrypted_secrets where name='paper_scheduler_secret';
 if scheduler_secret is null or length(scheduler_secret)<32 then raise exception 'Scheduler secret missing'; end if;
 select net.http_post(url:='https://ai-algo-trading-india.vercel.app/api/spec-paper-cycle',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||scheduler_secret),body:='{}'::jsonb,timeout_milliseconds:=65000) into request_id;
 insert into public.spec_paper_dispatches values(request_id,now());
 delete from public.spec_paper_dispatches where requested_at<now()-interval '35 days';
 return request_id;
end;
$$;
revoke all on function public.dispatch_spec_paper_cycle() from public,anon,authenticated;
-- Installed inactive; enable after verifying one manual cycle. Never disable an active job on reapply.
do $$ declare job bigint; begin
 if not exists(select 1 from cron.job where jobname='spec-paper-cycle') then
  select cron.schedule('spec-paper-cycle','*/5 3-10 * * 1-5','select public.dispatch_spec_paper_cycle();') into job;
  perform cron.alter_job(job,active:=false);
 end if;
end; $$;
