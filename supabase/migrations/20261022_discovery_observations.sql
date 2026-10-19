-- Discover score observations: the first time each stock reaches a recorded score level in a session, with
-- the details at that moment, then its later outcome. First-seen fields never change after insert, so live
-- accuracy can be measured from the time a signal was first visible. Server-only.
create table if not exists public.discovery_observations (
 id text primary key check(id ~ '^\d{4}-\d{2}-\d{2}:[A-Z0-9&-]{1,30}:(BUY|SELL)$'),
 session_date date not null,
 symbol text not null check(symbol ~ '^[A-Z0-9&-]{1,30}$'),
 side text not null check(side in ('BUY','SELL')),
 first_seen_at timestamptz not null,
 first_score integer not null check(first_score between -100 and 100),
 first_price numeric not null check(first_price>0),
 first_quote_time timestamptz,
 details jsonb not null,
 max_score integer not null,
 max_score_at timestamptz not null,
 last_seen_at timestamptz not null,
 seen_count integer not null default 1,
 outcome jsonb,
 outcome_at timestamptz,
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists discovery_observations_date on public.discovery_observations(session_date desc,first_seen_at);
create index if not exists discovery_observations_pending on public.discovery_observations(session_date) where outcome is null or (outcome->>'complete') is distinct from 'true';
alter table public.discovery_observations enable row level security;
revoke all on public.discovery_observations from public,anon,authenticated,service_role;
grant select on public.discovery_observations to service_role;
drop policy if exists discovery_observations_read on public.discovery_observations;
create policy discovery_observations_read on public.discovery_observations for select to service_role using(true);

-- Upsert from a scan: a new id stores the first observation; an existing id keeps its first-seen fields
-- and updates only the running maximum, last-seen time and count.
create or replace function public.record_discovery_observations(p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>500 or octet_length(p_rows::text)>3000000 then raise exception 'Invalid discovery observations'; end if;
 insert into public.discovery_observations(id,session_date,symbol,side,first_seen_at,first_score,first_price,first_quote_time,details,max_score,max_score_at,last_seen_at)
  select r->>'id',(r->>'sessionDate')::date,r->>'symbol',r->>'side',(r->>'seenAt')::timestamptz,(r->>'score')::integer,(r->>'price')::numeric,nullif(r->>'quoteTime','')::timestamptz,r->'details',
   (r->>'score')::integer,(r->>'seenAt')::timestamptz,(r->>'seenAt')::timestamptz from jsonb_array_elements(p_rows) r
 on conflict(id) do update set
  max_score=case when abs(excluded.max_score)>abs(public.discovery_observations.max_score) then excluded.max_score else public.discovery_observations.max_score end,
  max_score_at=case when abs(excluded.max_score)>abs(public.discovery_observations.max_score) then excluded.max_score_at else public.discovery_observations.max_score_at end,
  last_seen_at=greatest(public.discovery_observations.last_seen_at,excluded.last_seen_at),
  seen_count=public.discovery_observations.seen_count+1;
 get diagnostics n=row_count;
 delete from public.discovery_observations where session_date<current_date-400;
 return n;
end; $$;
create or replace function public.set_discovery_outcomes(p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>1000 then raise exception 'Invalid discovery outcomes'; end if;
 update public.discovery_observations o set outcome=r->'outcome',outcome_at=clock_timestamp() from jsonb_array_elements(p_rows) r where o.id=r->>'id' and jsonb_typeof(r->'outcome')='object';
 get diagnostics n=row_count; return n;
end; $$;
do $$ declare fn text; begin
 foreach fn in array array['record_discovery_observations(jsonb)','set_discovery_outcomes(jsonb)'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',fn);
  execute format('grant execute on function public.%s to service_role',fn);
 end loop;
end; $$;
