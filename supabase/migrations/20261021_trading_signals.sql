-- Validated strategy signals and market intelligence (bulk/block deals, FII/DII flows). Server-only.
-- strategy_validations: latest validation verdict per library strategy and symbol (replaced on recompute).
create table if not exists public.strategy_validations (
 strategy_id text not null check(strategy_id ~ '^[a-z0-9-]{1,64}$'),
 symbol text not null check(symbol ~ '^[A-Z0-9&-]{1,30}$'),
 verdict text not null check(verdict in ('VALIDATED','UNPROVEN','REJECTED')),
 computed_at timestamptz not null,
 record jsonb not null,
 primary key(strategy_id,symbol)
);
-- strategy_signals: append-only; one row per strategy, symbol and decision bar.
create table if not exists public.strategy_signals (
 id text primary key check(id ~ '^[a-z0-9-]{1,64}:[A-Z0-9&-]{1,30}:[0-9]{10,14}$'),
 strategy_id text not null,
 symbol text not null,
 segment text not null check(segment in ('intraday','swing','short-term','long-term','futures','options')),
 bar_time timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 signal jsonb not null
);
create index if not exists strategy_signals_recent on public.strategy_signals(recorded_at desc);
-- market_deals: NSE bulk and block deals as published for each trading date.
create table if not exists public.market_deals (
 trade_date date not null,
 kind text not null check(kind in ('BULK','BLOCK')),
 symbol text not null check(symbol ~ '^[A-Z0-9&-]{1,30}$'),
 client text not null check(length(client) between 1 and 200),
 side text not null check(side in ('BUY','SELL')),
 quantity bigint not null check(quantity>0),
 price numeric not null check(price>0),
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(trade_date,kind,symbol,client,side,quantity,price)
);
create index if not exists market_deals_symbol on public.market_deals(symbol,trade_date desc);
-- market_flows: provisional FII/FPI and DII cash-market activity per date (₹ crore).
create table if not exists public.market_flows (
 trade_date date not null,
 category text not null check(category in ('FII/FPI','DII')),
 buy_value numeric not null,sell_value numeric not null,net_value numeric not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(trade_date,category)
);
do $$ declare t text; begin
 foreach t in array array['strategy_validations','strategy_signals','market_deals','market_flows'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to service_role',t);
  execute format('drop policy if exists %I on public.%I',t||'_read',t);
  execute format('create policy %I on public.%I for select to service_role using(true)',t||'_read',t);
 end loop;
end; $$;

create or replace function public.save_strategy_validations(p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>200 or octet_length(p_rows::text)>2000000 then raise exception 'Invalid strategy validations'; end if;
 insert into public.strategy_validations(strategy_id,symbol,verdict,computed_at,record)
  select r->>'strategyId',r->>'symbol',r->>'verdict',(r->>'computedAt')::timestamptz,r from jsonb_array_elements(p_rows) r
 on conflict(strategy_id,symbol) do update set verdict=excluded.verdict,computed_at=excluded.computed_at,record=excluded.record
  where excluded.computed_at>=public.strategy_validations.computed_at;
 get diagnostics n=row_count; return n;
end; $$;
-- Signals are recorded once; a retry of the same decision bar returns without change.
create or replace function public.record_strategy_signals(p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>500 or octet_length(p_rows::text)>2000000 then raise exception 'Invalid strategy signals'; end if;
 insert into public.strategy_signals(id,strategy_id,symbol,segment,bar_time,signal)
  select r->>'id',r->>'strategyId',r->>'symbol',r->>'segment',to_timestamp((r->>'barTime')::bigint/1000.0),r from jsonb_array_elements(p_rows) r
 on conflict(id) do nothing;
 get diagnostics n=row_count;
 delete from public.strategy_signals where recorded_at<now()-interval '400 days';
 return n;
end; $$;
create or replace function public.record_market_day(p_deals jsonb,p_flows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d integer; f integer;
begin
 if jsonb_typeof(p_deals) is distinct from 'array' or jsonb_typeof(p_flows) is distinct from 'array' or jsonb_array_length(p_deals)>5000 or jsonb_array_length(p_flows)>10 then raise exception 'Invalid market day'; end if;
 insert into public.market_deals(trade_date,kind,symbol,client,side,quantity,price)
  select (r->>'date')::date,r->>'kind',r->>'symbol',r->>'client',r->>'side',(r->>'quantity')::bigint,(r->>'price')::numeric from jsonb_array_elements(p_deals) r
 on conflict do nothing;
 get diagnostics d=row_count;
 insert into public.market_flows(trade_date,category,buy_value,sell_value,net_value)
  select (r->>'date')::date,r->>'category',(r->>'buy')::numeric,(r->>'sell')::numeric,(r->>'net')::numeric from jsonb_array_elements(p_flows) r
 on conflict(trade_date,category) do update set buy_value=excluded.buy_value,sell_value=excluded.sell_value,net_value=excluded.net_value,recorded_at=clock_timestamp();
 get diagnostics f=row_count;
 delete from public.market_deals where trade_date<current_date-730;
 return jsonb_build_object('deals',d,'flows',f);
end; $$;
do $$ declare fn text; begin
 foreach fn in array array['save_strategy_validations(jsonb)','record_strategy_signals(jsonb)','record_market_day(jsonb,jsonb)'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',fn);
  execute format('grant execute on function public.%s to service_role',fn);
 end loop;
end; $$;

-- Single-trade paper runs (one per signal) can be many at once; raise the active-run cap from 20 to 100.
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
 if (select count(*) from public.spec_paper_runs where status='ACTIVE')>=100 then raise exception 'Active spec paper run limit reached'; end if;
 insert into public.spec_paper_runs(id,spec,options,state) values(p_id,p_spec,p_options,p_state) returning * into saved;
 return to_jsonb(saved);
end; $$;

-- Scheduler: one dispatcher calls /api/signals with a job. Installed inactive; never disables an active job.
create table if not exists public.signal_dispatches(request_id bigint primary key,job text not null,requested_at timestamptz not null default now());
alter table public.signal_dispatches enable row level security;
revoke all on public.signal_dispatches from public,anon,authenticated;
create or replace function public.dispatch_signal_job(p_job text)
returns bigint language plpgsql security definer set search_path='' as $$
declare scheduler_secret text; request_id bigint;
begin
 if p_job not in ('validate','scan','market-day') then raise exception 'Unknown signal job'; end if;
 select decrypted_secret into scheduler_secret from vault.decrypted_secrets where name='paper_scheduler_secret';
 if scheduler_secret is null or length(scheduler_secret)<32 then raise exception 'Scheduler secret missing'; end if;
 select net.http_post(url:='https://ai-algo-trading-india.vercel.app/api/signals?job='||p_job,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||scheduler_secret),body:='{}'::jsonb,timeout_milliseconds:=65000) into request_id;
 insert into public.signal_dispatches values(request_id,p_job,now());
 delete from public.signal_dispatches where requested_at<now()-interval '35 days';
 return request_id;
end; $$;
revoke all on function public.dispatch_signal_job(text) from public,anon,authenticated;
-- UTC schedules: validation every 2 hours (each run refreshes the stalest strategy); scans every 15 minutes in
-- session and at 15:45 IST for daily bars; the market day (deals, flows) at 18:30 IST.
do $$ declare job bigint; spec text[]; begin
 foreach spec slice 1 in array array[['signal-validate','5 */2 * * *','validate'],['signal-scan','*/15 3-10 * * 1-5','scan'],['market-day','0 13 * * 1-5','market-day']] loop
  if not exists(select 1 from cron.job where jobname=spec[1]) then
   select cron.schedule(spec[1],spec[2],format('select public.dispatch_signal_job(%L);',spec[3])) into job;
   perform cron.alter_job(job_id:=job,active:=false);
  end if;
 end loop;
end; $$;
