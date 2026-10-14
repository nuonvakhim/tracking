import { budgetStatus } from "@/lib/budget";
import { convert, formatMoney, monthKeyOf, monthLabel, monthRange } from "@/lib/format";
import type { Currency, Transaction } from "@/lib/types";
import { db } from "./db";
import { getRate } from "./rates";
import { sendMessage } from "./telegram";

const LEVELS = [100, 80] as const;
const HOUR_MS = 60 * 60 * 1000;

type BudgetRow = {
  budget_amount: number | string | null;
  budget_currency: Currency;
  budget_excluded: string[];
  budget_alerts: boolean;
  budget_alert_month: string | null;
  budget_alert_level: number;
};

/**
 * After a new expense, messages the user on Telegram the first time this month
 * that spending reaches 80% or 100% of their budget.
 */
export async function checkBudgetAlert(telegramId: number, tx: Transaction): Promise<void> {
  if (tx.type !== "expense") return;
  const month = monthKeyOf(tx.occurred_on);
  // Back-dated entries for an earlier month don't warrant an alert.
  if (!isCurrentMonthSomewhere(month)) return;

  const { data: profile, error } = await db()
    .from("profiles")
    .select(
      "budget_amount, budget_currency, budget_excluded, budget_alerts, budget_alert_month, budget_alert_level",
    )
    .eq("telegram_id", telegramId)
    .single<BudgetRow>();
  if (error) throw error;
  if (profile.budget_amount == null || !profile.budget_alerts) return;
  if (profile.budget_excluded.includes(tx.category)) return;

  const { from, to } = monthRange(month);
  const [{ data: rows, error: txError }, rate] = await Promise.all([
    db()
      .from("transactions")
      .select("amount, currency, category, occurred_on")
      .eq("telegram_id", telegramId)
      .eq("type", "expense")
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    getRate(),
  ]);
  if (txError) throw txError;

  const currency = profile.budget_currency;
  const budget = Number(profile.budget_amount);
  const excluded = new Set(profile.budget_excluded);
  const expenses = (rows ?? [])
    .filter((r) => !excluded.has(r.category))
    .map((r) => ({
      amount: convert(Number(r.amount), r.currency, currency, rate.khrPerUsd),
      occurred_on: r.occurred_on as string,
    }));

  // The server doesn't know the user's timezone; the new expense's date is the best guess for "today".
  const status = budgetStatus(budget, expenses, tx.occurred_on);
  const spent = budget - status.leftMonth;
  const level = LEVELS.find((l) => spent >= (budget * l) / 100);
  if (!level) return;

  // Record the alert before sending it, and only if no request got there
  // first, so two expenses saved at once can't both send it.
  const { data: claimed, error: claimError } = await db()
    .from("profiles")
    .update({ budget_alert_month: month, budget_alert_level: level })
    .eq("telegram_id", telegramId)
    .or(`budget_alert_month.is.null,budget_alert_month.neq.${month},budget_alert_level.lt.${level}`)
    .select("telegram_id");
  if (claimError) throw claimError;
  if (!claimed?.length) return;

  const fmt = (v: number) => formatMoney(v, currency);
  const monthName = monthLabel(month).split(" ")[0];
  const text =
    level === 100
      ? `🚨 You've gone over your ${monthName} budget: ${fmt(spent)} spent of ${fmt(budget)}.`
      : `⚠️ You've used ${Math.floor((spent / budget) * 100)}% of your ${monthName} budget: ` +
        `${fmt(spent)} of ${fmt(budget)}. ${fmt(status.leftMonth)} left for the next ` +
        `${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"}, ` +
        `about ${fmt(status.leftMonth / status.daysLeft)} a day.`;
  await sendMessage(telegramId, text);
}

/** True if `month` is the current month in some timezone (UTC−12 to UTC+14). */
function isCurrentMonthSomewhere(month: string): boolean {
  const now = Date.now();
  return [-12, 14].some((h) => new Date(now + h * HOUR_MS).toISOString().slice(0, 7) === month);
}
