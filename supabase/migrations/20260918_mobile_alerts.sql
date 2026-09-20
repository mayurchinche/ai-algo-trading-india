-- Private, persistent mobile inbox + outbox. Apply using an authenticated migration account.
begin;
create table public.mobile_alert_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false, equity_enabled boolean not null default true,
 options_enabled boolean not null default false, min_score integer not null default 70 check(min_score between 70 and 100)
);
create table public.mobile_push_devices (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 installation_id uuid not null, platform text not null check(platform in ('android','ios')),
 token text not null, enabled boolean not null default true, updated_at timestamptz not null default now(), unique(platform,token)
);
create table public.mobile_alerts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 signal_key text not null, payload jsonb not null, expires_at timestamptz not null,
 created_at timestamptz not null default now(), opened_at timestamptz, unique(user_id,signal_key)
);
create table public.mobile_push_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 alert_id uuid not null references public.mobile_alerts(id) on delete cascade,
 device_id uuid not null references public.mobile_push_devices(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sending','accepted','failed','expired','cancelled')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 lease_id uuid, lease_until timestamptz, accepted_at timestamptz, provider_receipt text, error_code text,
 unique(alert_id,device_id)
);
create index mobile_alerts_owner_time on public.mobile_alerts(user_id,created_at desc);
create index mobile_push_jobs_ready on public.mobile_push_jobs(status,next_attempt_at);
create index mobile_push_devices_owner on public.mobile_push_devices(user_id) where enabled;
alter table public.mobile_alert_preferences enable row level security;
alter table public.mobile_push_devices enable row level security;
alter table public.mobile_alerts enable row level security;
alter table public.mobile_push_jobs enable row level security;
create policy preferences_owner_read on public.mobile_alert_preferences for select to authenticated using(user_id=auth.uid());
create policy alerts_owner_read on public.mobile_alerts for select to authenticated using(user_id=auth.uid());
grant select on public.mobile_alert_preferences,public.mobile_alerts to authenticated;
grant all on public.mobile_alert_preferences,public.mobile_alerts,public.mobile_push_devices,public.mobile_push_jobs to service_role;
-- All writes and all device-token access go through authenticated server endpoints.
revoke all on public.mobile_push_devices, public.mobile_push_jobs from anon,authenticated;
revoke insert,update,delete on public.mobile_alert_preferences,public.mobile_alerts from anon,authenticated;

create function public.enqueue_mobile_alert(signal jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare added integer;
begin
 if (signal->>'expiresAt')::timestamptz <= now() then return 0; end if;
 with recipients as (
  insert into mobile_alerts(user_id,signal_key,payload,expires_at)
  select p.user_id,signal->>'id',signal,(signal->>'expiresAt')::timestamptz
  from mobile_alert_preferences p where p.enabled and abs((signal->>'score')::numeric)>=p.min_score
  and ((signal->>'assetClass'='EQUITY' and p.equity_enabled) or (signal->>'assetClass'='OPTIONS' and p.options_enabled))
  on conflict(user_id,signal_key) do nothing returning id,user_id
 )
 insert into mobile_push_jobs(user_id,alert_id,device_id)
 select r.user_id,r.id,d.id from recipients r join mobile_push_devices d on d.user_id=r.user_id and d.enabled
 on conflict(alert_id,device_id) do nothing;
 get diagnostics added=row_count;
 return added;
end $$;

create function public.claim_mobile_push_jobs() returns setof public.mobile_push_jobs
language plpgsql security definer set search_path=public as $$
begin
 update mobile_push_jobs j set status='expired' from mobile_alerts a
 where j.alert_id=a.id and a.expires_at<=now() and j.status in ('pending','sending');
 return query
 with selected as (
  select j.id from mobile_push_jobs j join mobile_alerts a on a.id=j.alert_id
  where a.expires_at>now() and j.attempts<3 and
  ((j.status='pending' and j.next_attempt_at<=now()) or (j.status='sending' and j.lease_until<now()))
  order by j.next_attempt_at for update of j skip locked limit 10
 ) update mobile_push_jobs j set status='sending', attempts=j.attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes'
 from selected s where j.id=s.id returning j.*;
end $$;

create function public.cleanup_mobile_alerts() returns void
language sql security definer set search_path=public as $$
 delete from mobile_alerts where created_at<now()-interval '30 days';
$$;
revoke all on function public.enqueue_mobile_alert(jsonb),public.claim_mobile_push_jobs(),public.cleanup_mobile_alerts() from public,anon,authenticated;
grant execute on function public.enqueue_mobile_alert(jsonb),public.claim_mobile_push_jobs(),public.cleanup_mobile_alerts() to service_role;
commit;
