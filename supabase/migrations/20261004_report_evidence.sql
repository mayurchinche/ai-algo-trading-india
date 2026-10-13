-- Shared user1 research archive, separate from orders and money.
create table if not exists public.report_evidence (
 id uuid primary key,
 account_id text not null default 'user1' check(account_id='user1'),
 created_at timestamptz not null default clock_timestamp(),
 report jsonb not null
);
alter table public.report_evidence enable row level security;
revoke all on public.report_evidence from public,anon,authenticated,service_role;
grant select on public.report_evidence to service_role;
drop policy if exists report_evidence_read on public.report_evidence;
create policy report_evidence_read on public.report_evidence for select to service_role using(true);
create or replace function public.save_report_evidence(p_id uuid,p_report jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.report_evidence; captured timestamptz:=clock_timestamp();
begin
 perform pg_advisory_xact_lock(26031005);
 select * into saved from public.report_evidence where id=p_id;
 if found then return to_jsonb(saved); end if;
 if p_id is null or p_report is null or jsonb_typeof(p_report) is distinct from 'object' or octet_length(p_report::text)>100000 or
 p_report->>'policy' is distinct from 'report-passages-v1' or
 coalesce(p_report->>'status','') not in ('EXTRACTED_REQUIRES_REVIEW','OCR_OR_MANUAL_REVIEW_REQUIRED') or
 coalesce(p_report->>'documentHash','') !~ '^[a-f0-9]{64}$' or coalesce(p_report->>'id','') !~ '^[a-f0-9]{64}$' or
 coalesce(p_report->>'symbol','') !~ '^[A-Z0-9&-]{1,30}$' or coalesce(p_report->>'segment','') not in ('equities','sme') or
 jsonb_typeof(p_report->'topics') is distinct from 'array' then raise exception 'Invalid report evidence'; end if;
 if (p_report->>'observedAt') is null or (p_report->>'observedAt')::timestamptz<captured-interval '6 minutes' or (p_report->>'observedAt')::timestamptz>captured+interval '5 seconds' then raise exception 'Invalid observation time'; end if;
 if (select count(*) from public.report_evidence)>=200 then raise exception 'Shared report evidence limit reached'; end if;
 insert into public.report_evidence(id,report) values(p_id,p_report) returning * into saved;
 return to_jsonb(saved);
end; $$;
revoke all on function public.save_report_evidence(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_report_evidence(uuid,jsonb) to service_role;
