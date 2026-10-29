-- Daily Telegram reminder for users who haven't logged an expense today.
-- Run after 0003_budget.sql.
--
-- timezone is an IANA name the app reports on every start; the reminder is
-- skipped until it is known. reminder_last_sent is the user's local date of the
-- last reminder, so it is sent at most once a day.

alter table public.profiles
  add column if not exists timezone text,
  add column if not exists reminders boolean not null default true,
  add column if not exists reminder_last_sent date;

-- The budget alert code in the app also reads these. 0003_budget.sql didn't
-- create them, so make sure they exist.
alter table public.profiles
  add column if not exists budget_alerts boolean not null default true,
  add column if not exists budget_alert_month text,
  add column if not exists budget_alert_level integer not null default 0;
