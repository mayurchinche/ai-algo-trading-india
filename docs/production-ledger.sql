-- Proposed production schema. Review/migrate before deploying a worker. Not wired into browser simulation.
create table if not exists public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  initial_capital numeric not null check(initial_capital > 0),
  archived_net_pnl numeric not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.trading_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id),
  idempotency_key text not null,
  trade_id uuid not null,
  kind text not null check(kind in ('SIGNAL','ORDER','FILL','EXIT','GAP','REJECTED')),
  exchange_at timestamptz,
  received_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  strategy_version text not null,
  payload jsonb not null,
  unique(account_id,idempotency_key)
);
create index if not exists trading_events_account_time on public.trading_events(account_id, recorded_at);
alter table public.trading_accounts enable row level security;
alter table public.trading_events enable row level security;
create policy account_owner_read on public.trading_accounts for select to authenticated using(user_id=auth.uid());
create policy event_owner_read on public.trading_events for select to authenticated using(exists(select 1 from public.trading_accounts a where a.id=account_id and a.user_id=auth.uid()));
-- No client writes. Backend service role writes in a transaction with locked account/position rows.
-- Add positions, balances, atomic append RPC, closed-trade archive/cleanup, backup and restore before use.
-- Never prune an open trade's events. Retain closed-trade events >=30 days after the final exit.
