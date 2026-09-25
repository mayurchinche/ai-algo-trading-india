-- Additive migration: old user1 rows and RPCs remain usable by installed APKs.
alter table public.shared_paper_accounts drop constraint shared_paper_accounts_id_check;
alter table public.shared_paper_accounts add constraint shared_paper_accounts_id_check
 check(id in ('user1','user1:short-term','user1:long-term','user1:options','user1:futures'));
create function public.ensure_shared_portfolio(p_account text)
returns void language plpgsql security definer set search_path=public as $$
declare capital integer; inserted text; event jsonb;
begin
 capital := case p_account when 'user1' then 10000 when 'user1:short-term' then 20000 when 'user1:long-term' then 20000 when 'user1:options' then 50000 when 'user1:futures' then 50000 else null end;
 if capital is null then raise exception 'Unknown paper account'; end if;
 event := jsonb_build_object('id',1,'kind','OPENING_CAPITAL','at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'amount',capital,'balanceBefore',0,'balanceAfter',capital);
 insert into shared_paper_accounts(id,state) values(p_account,jsonb_build_object('version','durable-paper-v1','capital',capital,'transfers','[]'::jsonb,'realized',0,'sequence',1,'orders','[]'::jsonb,'lastCycleAt',null))
 on conflict(id) do nothing returning id into inserted;
 if inserted is not null then insert into shared_paper_events(account_id,sequence,event) values(p_account,1,event); end if;
end; $$;
revoke all on function public.ensure_shared_portfolio(text) from public,anon,authenticated;
grant execute on function public.ensure_shared_portfolio(text) to service_role;
create function public.commit_shared_portfolio(p_account text,p_revision bigint,p_state jsonb,p_enabled boolean,p_events jsonb,p_request uuid default null,p_action jsonb default null)
returns text language plpgsql security definer set search_path=public as $$
declare prior jsonb;
begin
 if p_account <> 'user1' and (p_enabled or jsonb_array_length(coalesce(p_state->'orders','[]'::jsonb)) > 0 or jsonb_array_length(coalesce(p_state->'intents','[]'::jsonb)) > 0) then raise exception 'Segment execution unavailable'; end if;
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
create function public.lease_shared_portfolio(p_account text,p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update shared_paper_accounts set lease_token=p_token,lease_until=now()+interval '90 seconds'
 where id=p_account and (lease_until is null or lease_until<now());
 return found;
end; $$;
create function public.release_shared_portfolio(p_account text,p_token uuid)
returns void language sql security definer set search_path=public as $$
 update shared_paper_accounts set lease_token=null,lease_until=null where id=p_account and lease_token=p_token;
$$;
revoke all on function public.commit_shared_portfolio(text,bigint,jsonb,boolean,jsonb,uuid,jsonb),public.lease_shared_portfolio(text,uuid),public.release_shared_portfolio(text,uuid) from public,anon,authenticated;
grant execute on function public.commit_shared_portfolio(text,bigint,jsonb,boolean,jsonb,uuid,jsonb),public.lease_shared_portfolio(text,uuid),public.release_shared_portfolio(text,uuid) to service_role;

-- Per-account chronological opportunity history without scanning fill/funding events.
create index shared_paper_opportunities_sequence on public.shared_paper_events(account_id,sequence desc) where event->>'kind'='OPPORTUNITY_RECORDED';
