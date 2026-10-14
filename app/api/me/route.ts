import { categoryIds } from "@/lib/categories";
import { HttpError, withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getRate } from "@/lib/server/rates";
import { amount, oneOf, readJson } from "@/lib/server/validate";
import { CURRENCIES, type Currency, type Profile, type Summary } from "@/lib/types";

const PROFILE_COLUMNS =
  "telegram_id, first_name, currency, budget_amount, budget_currency, budget_excluded";

// Called on app start: creates the profile on first use and returns totals + rate.
export const GET = withUser(async (_request, user) => {
  const { data: profile, error } = await db()
    .from("profiles")
    .upsert(
      { telegram_id: user.id, first_name: user.first_name ?? null, username: user.username ?? null },
      { onConflict: "telegram_id" },
    )
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;

  const [summary, rate] = await Promise.all([getSummary(user.id), getRate()]);
  return Response.json({ profile: toProfile(profile), summary, rate });
});

// Updates whichever of `currency` and `budget` the body contains.
export const PATCH = withUser(async (request, user) => {
  const body = await readJson(request);
  const update: Record<string, unknown> = {};
  if ("currency" in body) update.currency = oneOf(body.currency, CURRENCIES);
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

/** `budget: null` removes the budget; otherwise amount, currency and excluded are all required. */
function budgetColumns(value: unknown) {
  if (value === null) return { budget_amount: null };
  if (!value || typeof value !== "object") throw new HttpError(400, "Invalid budget");
  const budget = value as Record<string, unknown>;
  if (!Array.isArray(budget.excluded)) throw new HttpError(400, "Invalid budget");

  const allowed = categoryIds("expense");
  const excluded = [...new Set(budget.excluded.map((id) => oneOf(id, allowed)))];
  if (excluded.length === allowed.length) {
    throw new HttpError(400, "At least one category must count toward the budget");
  }
  return {
    budget_amount: amount(budget.amount),
    budget_currency: oneOf(budget.currency, CURRENCIES),
    budget_excluded: excluded,
  };
}

type ProfileRow = Omit<Profile, "budget"> & {
  budget_amount: number | string | null;
  budget_currency: Currency;
  budget_excluded: string[];
};

function toProfile(row: unknown): Profile {
  const { budget_amount, budget_currency, budget_excluded, ...profile } = row as ProfileRow;
  return {
    ...profile,
    budget:
      budget_amount == null
        ? null
        : { amount: Number(budget_amount), currency: budget_currency, excluded: budget_excluded },
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
