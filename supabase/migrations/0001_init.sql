-- Telegram expense / income / savings tracker
-- Run this in the Supabase SQL editor (or with `supabase db push`).
--
-- Access model: the browser never talks to Supabase directly. All reads/writes
-- go through Next.js route handlers that verify Telegram initData and then use
-- the server-only secret key. RLS is enabled with NO policies, so the public
-- (anon / publishable) key cannot read or write any of these tables.

create table if not exists public.profiles (
  telegram_id bigint primary key,
  first_name  text,
  username    text,
  currency    text not null default 'USD' check (currency in ('USD', 'KHR')),
  created_at  timestamptz not null default now()
);

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.profiles (telegram_id) on delete cascade,
  type        text not null check (type in ('income', 'expense')),
  amount      numeric(14, 2) not null check (amount > 0),
  category    text not null,
  note        text check (char_length(note) <= 200),
  occurred_on date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (telegram_id, occurred_on desc, created_at desc);

create table if not exists public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  telegram_id   bigint not null references public.profiles (telegram_id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  emoji         text not null default '🎯',
  target_amount numeric(14, 2) not null check (target_amount > 0),
  created_at    timestamptz not null default now()
);

create index if not exists savings_goals_user_idx
  on public.savings_goals (telegram_id, created_at);

-- Positive amount = deposit into the goal, negative = withdrawal.
create table if not exists public.savings_entries (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references public.savings_goals (id) on delete cascade,
  telegram_id bigint not null references public.profiles (telegram_id) on delete cascade,
  amount      numeric(14, 2) not null check (amount <> 0),
  note        text check (char_length(note) <= 200),
  occurred_on date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists savings_entries_goal_idx on public.savings_entries (goal_id);
create index if not exists savings_entries_user_idx on public.savings_entries (telegram_id);

alter table public.profiles        enable row level security;
alter table public.transactions    enable row level security;
alter table public.savings_goals   enable row level security;
alter table public.savings_entries enable row level security;

-- All-time totals for the balance card, computed in the database.
create or replace function public.user_summary(p_telegram_id bigint)
returns table (total_income numeric, total_expense numeric, total_saved numeric)
language sql
stable
set search_path = ''
as $$
  select
    coalesce((select sum(amount) from public.transactions
              where telegram_id = p_telegram_id and type = 'income'), 0),
    coalesce((select sum(amount) from public.transactions
              where telegram_id = p_telegram_id and type = 'expense'), 0),
    coalesce((select sum(amount) from public.savings_entries
              where telegram_id = p_telegram_id), 0);
$$;

revoke execute on function public.user_summary(bigint) from public, anon, authenticated;
