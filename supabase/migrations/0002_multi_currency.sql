-- Multi-currency: every amount remembers the currency it was entered in, and
-- the app converts to the user's display currency at the current USD/KHR rate.
-- Run after 0001_init.sql.

alter table public.transactions
  add column if not exists currency text not null default 'USD' check (currency in ('USD', 'KHR'));

alter table public.savings_goals
  add column if not exists currency text not null default 'USD' check (currency in ('USD', 'KHR'));

-- Before this migration, amounts were entered in the profile's display
-- currency, so that is what existing rows are in.
update public.transactions t
   set currency = p.currency
  from public.profiles p
 where p.telegram_id = t.telegram_id and t.currency <> p.currency;

update public.savings_goals g
   set currency = p.currency
  from public.profiles p
 where p.telegram_id = g.telegram_id and g.currency <> p.currency;

-- Savings entries are always in their goal's currency, so they need no column.

-- Totals are now returned per currency; the app converts them.
drop function if exists public.user_summary(bigint);

create function public.user_summary(p_telegram_id bigint)
returns table (currency text, total_income numeric, total_expense numeric, total_saved numeric)
language sql
stable
set search_path = ''
as $$
  with tx as (
    select t.currency,
           sum(t.amount) filter (where t.type = 'income')  as income,
           sum(t.amount) filter (where t.type = 'expense') as expense
      from public.transactions t
     where t.telegram_id = p_telegram_id
     group by t.currency
  ), saved as (
    select g.currency, sum(e.amount) as saved
      from public.savings_entries e
      join public.savings_goals g on g.id = e.goal_id
     where e.telegram_id = p_telegram_id
     group by g.currency
  )
  select coalesce(tx.currency, saved.currency),
         coalesce(tx.income, 0),
         coalesce(tx.expense, 0),
         coalesce(saved.saved, 0)
    from tx
    full join saved on saved.currency = tx.currency;
$$;

revoke execute on function public.user_summary(bigint) from public, anon, authenticated;
