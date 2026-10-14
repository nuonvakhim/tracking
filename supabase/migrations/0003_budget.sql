-- Monthly spending budget, shown in the app as a rolling daily allowance.
-- Run after 0002_multi_currency.sql.
--
-- budget_amount is null when the user has no budget. budget_excluded lists
-- expense category ids that don't count toward it (fixed costs like bills).

alter table public.profiles
  add column if not exists budget_amount numeric(14, 2) check (budget_amount > 0),
  add column if not exists budget_currency text not null default 'USD' check (budget_currency in ('USD', 'KHR')),
  add column if not exists budget_excluded text[] not null default '{bills}';
