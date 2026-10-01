-- Supabase Cron -> authenticated Vercel endpoint. No credentials in cron.job text.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.paper_scheduler_dispatches (
 request_id bigint primary key,
 requested_at timestamptz not null default now()
);
alter table public.paper_scheduler_dispatches enable row level security;
revoke all on public.paper_scheduler_dispatches from public, anon, authenticated;

create or replace function public.dispatch_shared_paper_cycle()
returns bigint language plpgsql security definer set search_path='' as $$
declare
 local_time timestamp := now() at time zone 'Asia/Kolkata';
 scheduler_secret text;
 request_id bigint;
begin
 -- Weekday envelope only. NSE marketStatus still gates holidays and entries.
 if extract(isodow from local_time)>5 or local_time::time < time '09:15' or local_time::time > time '15:35:59' then return null; end if;
 select decrypted_secret into scheduler_secret from vault.decrypted_secrets where name='paper_scheduler_secret';
 if scheduler_secret is null or length(scheduler_secret)<32 then raise exception 'Paper scheduler secret missing'; end if;
 select net.http_post(
  url:='https://ai-algo-trading-india.vercel.app/api/scheduled-paper',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||scheduler_secret),
  body:='{}'::jsonb, timeout_milliseconds:=65000
 ) into request_id;
 insert into public.paper_scheduler_dispatches(request_id) values(request_id);
 delete from public.paper_scheduler_dispatches where requested_at<now()-interval '30 days';
 return request_id;
end;
$$;
revoke all on function public.dispatch_shared_paper_cycle() from public, anon, authenticated;

-- Install inactive: activate only after the secret and deployed endpoint pass validation.
do $$
declare job bigint;
begin
 select cron.schedule('shared-paper-minute','* 3-10 * * 1-5','select public.dispatch_shared_paper_cycle();') into job;
 perform cron.alter_job(job,active:=false);
end;
$$;
