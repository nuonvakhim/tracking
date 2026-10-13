import { withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getRate } from "@/lib/server/rates";
import { oneOf, readJson } from "@/lib/server/validate";
import { CURRENCIES, type Summary } from "@/lib/types";

// Called on app start: creates the profile on first use and returns totals + rate.
export const GET = withUser(async (_request, user) => {
  const { data: profile, error } = await db()
    .from("profiles")
    .upsert(
      { telegram_id: user.id, first_name: user.first_name ?? null, username: user.username ?? null },
      { onConflict: "telegram_id" },
    )
    .select("telegram_id, first_name, currency")
    .single();
  if (error) throw error;

  const [summary, rate] = await Promise.all([getSummary(user.id), getRate()]);
  return Response.json({ profile, summary, rate });
});

export const PATCH = withUser(async (request, user) => {
  const body = await readJson(request);
  const currency = oneOf(body.currency, CURRENCIES);

  const { data: profile, error } = await db()
    .from("profiles")
    .update({ currency })
    .eq("telegram_id", user.id)
    .select("telegram_id, first_name, currency")
    .single();
  if (error) throw error;

  return Response.json({ profile });
});

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
