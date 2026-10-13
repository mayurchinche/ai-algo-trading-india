-- Research mandates and immutable decision snapshots; never touches paper funds.
create table if not exists public.research_portfolios (
 id uuid primary key,
 account_id text not null default 'user1' check(account_id='user1'),
 created_at timestamptz not null default clock_timestamp(),
 report jsonb not null
);
alter table public.research_portfolios enable row level security;
revoke all on public.research_portfolios from public,anon,authenticated,service_role;
grant select on public.research_portfolios to service_role;
drop policy if exists research_portfolio_server_read on public.research_portfolios;
create policy research_portfolio_server_read on public.research_portfolios for select to service_role using(true);
create or replace function public.save_research_portfolio(p_id uuid,p_report jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.research_portfolios; captured timestamptz:=clock_timestamp();
begin
 -- Serialize creation to enforce the shared 50-plan cap, including concurrent requests.
 perform pg_advisory_xact_lock(26031004);
 select * into saved from public.research_portfolios where id=p_id;
 if found then return to_jsonb(saved); end if;
 if p_id is null or p_report is null or jsonb_typeof(p_report) is distinct from 'object' or octet_length(p_report::text)>1000000 or
 p_report->>'account' is distinct from 'user1' or p_report->>'policy' is distinct from 'evidence-portfolio-v1' or
 p_report->>'scope' is distinct from 'RESEARCH_PROPOSAL_NO_ORDERS' or coalesce(p_report->>'status','') not in ('UNALLOCATED','REVIEW_REQUIRED') or
 jsonb_typeof(p_report->'allocations') is distinct from 'array' or jsonb_typeof(p_report->'assessments') is distinct from 'array' or
 jsonb_typeof(p_report->'mandate') is distinct from 'object' or coalesce(p_report->>'snapshotHash','') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid portfolio report'; end if;
 if (p_report->>'asOf') is null or (p_report->>'asOf')::timestamptz < captured-interval '2 minutes' or (p_report->>'asOf')::timestamptz>captured+interval '5 seconds' then raise exception 'Invalid decision time'; end if;
 if (select count(*) from public.research_portfolios)>=50 then raise exception 'Shared research portfolio limit reached'; end if;
 insert into public.research_portfolios(id,report) values(p_id,p_report) returning * into saved;
 return to_jsonb(saved);
end; $$;
revoke all on function public.save_research_portfolio(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_research_portfolio(uuid,jsonb) to service_role;
