import { categoryIds } from "@/lib/categories";
import { HttpError, withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getRate } from "@/lib/server/rates";
import { amount, oneOf, readJson, timezone } from "@/lib/server/validate";
import { CURRENCIES, type Currency, type Profile, type Summary } from "@/lib/types";

const PROFILE_COLUMNS =
  "telegram_id, first_name, currency, reminders, budget_amount, budget_currency, budget_excluded, budget_alerts";

// Called on app start: creates the profile on first use and returns totals + rate.
export const GET = withUser(async (request, user) => {
  // The daily reminder needs the user's local date, which the server can't know.
  const tz = timezone(request.headers.get("x-timezone"));
  const { data: profile, error } = await db()
    .from("profiles")
    .upsert(
      {
        telegram_id: user.id,
        first_name: user.first_name ?? null,
        username: user.username ?? null,
        ...(tz && { timezone: tz }),
      },
      { onConflict: "telegram_id" },
    )
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;

  const [summary, rate] = await Promise.all([getSummary(user.id), getRate()]);
  return Response.json({ profile: toProfile(profile), summary, rate });
});

// Updates whichever of `currency`, `reminders` and `budget` the body contains.
export const PATCH = withUser(async (request, user) => {
  const body = await readJson(request);
  const update: Record<string, unknown> = {};
  if ("currency" in body) update.currency = oneOf(body.currency, CURRENCIES);
  if ("reminders" in body) {
    if (typeof body.reminders !== "boolean") throw new HttpError(400, "Invalid reminders");
    update.reminders = body.reminders;
  }
  if ("budget" in body) Object.assign(update, budgetColumns(body.budget));
  if (Object.keys(update).length === 0) throw new HttpError(400, "Nothing to update");

  const { data: profile, error } = await db()
    .from("profiles")
    .update(update)
    .eq("telegram_id", user.id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;

  return Response.json({ profile: toProfile(profile) });
});

/**
 * `budget: null` removes the budget; otherwise every Budget field is required.
 * Any change resets the alerts, so a new amount gets its own 80% / 100% messages.
 */
function budgetColumns(value: unknown) {
  const resetAlerts = { budget_alert_month: null, budget_alert_level: 0 };
  if (value === null) return { budget_amount: null, ...resetAlerts };
  if (!value || typeof value !== "object") throw new HttpError(400, "Invalid budget");
  const budget = value as Record<string, unknown>;
  if (!Array.isArray(budget.excluded) || typeof budget.alerts !== "boolean") {
    throw new HttpError(400, "Invalid budget");
  }

  const allowed = categoryIds("expense");
  const excluded = [...new Set(budget.excluded.map((id) => oneOf(id, allowed)))];
  if (excluded.length === allowed.length) {
    throw new HttpError(400, "At least one category must count toward the budget");
  }
  return {
    budget_amount: amount(budget.amount),
    budget_currency: oneOf(budget.currency, CURRENCIES),
    budget_excluded: excluded,
    budget_alerts: budget.alerts,
    ...resetAlerts,
  };
}

type ProfileRow = Omit<Profile, "budget"> & {
  budget_amount: number | string | null;
  budget_currency: Currency;
  budget_excluded: string[];
  budget_alerts: boolean;
};

function toProfile(row: unknown): Profile {
  const { budget_amount, budget_currency, budget_excluded, budget_alerts, ...profile } =
    row as ProfileRow;
  return {
    ...profile,
    budget:
      budget_amount == null
        ? null
        : {
            amount: Number(budget_amount),
            currency: budget_currency,
            excluded: budget_excluded,
            alerts: budget_alerts,
          },
  };
}

type SummaryRow = {
  currency: string;
  total_income: number | string;
  total_expense: number | string;
  total_saved: number | string;
};

async function getSummary(telegramId: number): Promise<Summary> {
  const { data, error } = await db().rpc("user_summary", { p_telegram_id: telegramId });
  if (error) throw error;

  const summary: Summary = {
    USD: { income: 0, expense: 0, saved: 0 },
    KHR: { income: 0, expense: 0, saved: 0 },
  };
  for (const row of (data ?? []) as SummaryRow[]) {
    const currency = row.currency as keyof Summary;
    if (!summary[currency]) continue;
    summary[currency] = {
      income: Number(row.total_income),
      expense: Number(row.total_expense),
      saved: Number(row.total_saved),
    };
  }
  return summary;
}
