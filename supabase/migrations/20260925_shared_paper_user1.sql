-- Dedicated shared simulation; never exposes private authenticated paper_accounts.
create table public.shared_paper_accounts (
 id text primary key check (id = 'user1'), enabled boolean not null default false,
 revision bigint not null default 0, state jsonb not null,
 lease_token uuid, lease_until timestamptz,
 updated_at timestamptz not null default now()
);
create table public.shared_paper_events (
 account_id text not null references public.shared_paper_accounts(id),
 sequence bigint not null, event jsonb not null,
 primary key(account_id, sequence)
);
create table public.shared_paper_requests (
 account_id text not null references public.shared_paper_accounts(id),
 request_id uuid not null, action jsonb not null, at timestamptz not null default now(),
 primary key(account_id, request_id)
);
alter table public.shared_paper_accounts enable row level security;
alter table public.shared_paper_events enable row level security;
alter table public.shared_paper_requests enable row level security;
revoke all on public.shared_paper_accounts,public.shared_paper_events,public.shared_paper_requests from anon,authenticated;
grant select,insert,update on public.shared_paper_accounts to service_role;
grant select,insert on public.shared_paper_events,public.shared_paper_requests to service_role;
create function public.commit_shared_paper(p_revision bigint,p_state jsonb,p_enabled boolean,p_events jsonb,p_request uuid default null,p_action jsonb default null)
returns text language plpgsql security definer set search_path=public as $$
declare prior jsonb;
begin
 perform 1 from shared_paper_accounts where id='user1' for update;
 if p_request is not null then
  select action into prior from shared_paper_requests where account_id='user1' and request_id=p_request;
  if found then
   if prior is distinct from p_action then raise exception 'Request ID reused with different action'; end if;
   return 'duplicate';
  end if;
 end if;
 update shared_paper_accounts set state=p_state,enabled=p_enabled,revision=revision+1,updated_at=now() where id='user1' and revision=p_revision;
 if not found then return 'conflict'; end if;
 insert into shared_paper_events(account_id,sequence,event)
 select 'user1',(e->>'id')::bigint,e from jsonb_array_elements(p_events) e;
 if p_request is not null then insert into shared_paper_requests(account_id,request_id,action) values('user1',p_request,p_action); end if;
 return 'saved';
end; $$;
create function public.lease_shared_paper(p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update shared_paper_accounts set lease_token=p_token,lease_until=now()+interval '90 seconds'
 where id='user1' and (lease_until is null or lease_until<now());
 return found;
end; $$;
create function public.release_shared_paper(p_token uuid)
returns void language sql security definer set search_path=public as $$
 update shared_paper_accounts set lease_token=null,lease_until=null where id='user1' and lease_token=p_token;
$$;
revoke all on function public.commit_shared_paper(bigint,jsonb,boolean,jsonb,uuid,jsonb),public.lease_shared_paper(uuid),public.release_shared_paper(uuid) from public,anon,authenticated;
grant execute on function public.commit_shared_paper(bigint,jsonb,boolean,jsonb,uuid,jsonb),public.lease_shared_paper(uuid),public.release_shared_paper(uuid) to service_role;
-- All events retained; no destructive cleanup or import of private user rows.
