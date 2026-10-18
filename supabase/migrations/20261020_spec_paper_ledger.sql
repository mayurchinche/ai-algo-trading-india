-- Permanent, append-only event ledger for spec paper runs (orders, fills, trade records, rejections), committed
-- in the same transaction as the run state so the ledger and the state never disagree. Paper only.
create table if not exists public.spec_paper_events (
 run_id uuid not null references public.spec_paper_runs(id),
 seq integer not null check(seq>0),
 recorded_at timestamptz not null default clock_timestamp(),
 kind text not null check(length(kind) between 1 and 64),
 event jsonb not null,
 primary key(run_id,seq)
);
alter table public.spec_paper_events enable row level security;
revoke all on public.spec_paper_events from public,anon,authenticated,service_role;
grant select on public.spec_paper_events to service_role;
drop policy if exists spec_paper_events_read on public.spec_paper_events;
create policy spec_paper_events_read on public.spec_paper_events for select to service_role using(true);

-- Saves the run state with an expected version and appends the cycle's events with contiguous sequence
-- numbers. Returns null when the version is stale (nothing is written).
create or replace function public.commit_spec_paper_cycle(p_id uuid,p_expected_version integer,p_state jsonb,p_status text,p_events jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.spec_paper_runs; next_seq integer;
begin
 if jsonb_typeof(p_state) is distinct from 'object' or octet_length(p_state::text)>1000000 or p_status not in ('ACTIVE','STOPPED')
  or jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)>1000 or octet_length(p_events::text)>2000000
  or exists(select 1 from jsonb_array_elements(p_events) e where jsonb_typeof(e) is distinct from 'object' or jsonb_typeof(e->'kind') is distinct from 'string' or length(e->>'kind') not between 1 and 64)
 then raise exception 'Invalid spec paper cycle'; end if;
 update public.spec_paper_runs set state=p_state,status=p_status,version=version+1,updated_at=clock_timestamp()
  where id=p_id and version=p_expected_version and status='ACTIVE' returning * into saved;
 if not found then return null; end if;
 select coalesce(max(seq),0)+1 into next_seq from public.spec_paper_events where run_id=p_id;
 insert into public.spec_paper_events(run_id,seq,kind,event)
  select p_id,next_seq+ord-1,e->>'kind',e from jsonb_array_elements(p_events) with ordinality as t(e,ord);
 return to_jsonb(saved);
end; $$;
revoke all on function public.commit_spec_paper_cycle(uuid,integer,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.commit_spec_paper_cycle(uuid,integer,jsonb,text,jsonb) to service_role;

-- Stops between cycles are monitored every minute (resting stop/target orders, square-off). Keeps the job's
-- active flag as it is.
do $$ declare job bigint; begin
 select jobid into job from cron.job where jobname='spec-paper-cycle';
 if job is not null then perform cron.alter_job(job_id:=job,schedule:='* 3-10 * * 1-5'); end if;
end; $$;
