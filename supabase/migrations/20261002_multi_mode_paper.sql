-- Deploy inactive; activating a row authorizes paper simulation only. Never resets balances.
create table if not exists public.paper_segment_activation(account_id text primary key references public.shared_paper_accounts(id),activated boolean not null default false);
alter table public.paper_segment_activation enable row level security;
revoke all on public.paper_segment_activation from public,anon,authenticated;
create or replace function public.commit_shared_portfolio(p_account text,p_revision bigint,p_state jsonb,p_enabled boolean,p_events jsonb,p_request uuid default null,p_action jsonb default null)
returns text language plpgsql security definer set search_path=public as $$
declare prior jsonb;
begin
 if p_account not in ('user1','user1:short-term','user1:long-term','user1:options','user1:futures') then raise exception 'Unknown paper account'; end if;
 if p_account <> 'user1' and (p_enabled or jsonb_array_length(coalesce(p_state->'orders','[]'::jsonb)) > 0) then
  if not exists(select 1 from public.paper_segment_activation where account_id=p_account and activated) then raise exception 'Segment not activated in database'; end if;
  if p_state->>'segment' is distinct from split_part(p_account,':',2) then raise exception 'Segment state mismatch'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_state->'orders','[]'::jsonb)) o where o->>'product' is distinct from split_part(p_account,':',2)) then raise exception 'Cross-segment order'; end if;
 end if;
 perform 1 from shared_paper_accounts where id=p_account for update;
 if p_request is not null then
  select action into prior from shared_paper_requests where account_id=p_account and request_id=p_request;
  if found then
   if prior is distinct from p_action then raise exception 'Request ID reused with different action'; end if;
   return 'duplicate';
  end if;
 end if;
 update shared_paper_accounts set state=p_state,enabled=p_enabled,revision=revision+1,updated_at=now() where id=p_account and revision=p_revision;
 if not found then return 'conflict'; end if;
 insert into shared_paper_events(account_id,sequence,event)
 select p_account,(e->>'id')::bigint,e from jsonb_array_elements(p_events) e;
 if p_request is not null then insert into shared_paper_requests(account_id,request_id,action) values(p_account,p_request,p_action); end if;
 return 'saved';
end; $$;

revoke all on function public.commit_shared_portfolio(text,bigint,jsonb,boolean,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.commit_shared_portfolio(text,bigint,jsonb,boolean,jsonb,uuid,jsonb) to service_role;
