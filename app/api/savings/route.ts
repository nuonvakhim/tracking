import { withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { GOAL_COLUMNS, toGoal } from "@/lib/server/goals";
import { amount, oneOf, readJson, text } from "@/lib/server/validate";
import { CURRENCIES } from "@/lib/types";

export const GET = withUser(async (_request, user) => {
  const { data, error } = await db()
    .from("savings_goals")
    .select(GOAL_COLUMNS)
    .eq("telegram_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return Response.json({ goals: (data ?? []).map(toGoal) });
});

export const POST = withUser(async (request, user) => {
  const body = await readJson(request);

  const { data, error } = await db()
    .from("savings_goals")
    .insert({
      telegram_id: user.id,
      name: text(body.name, { max: 60, required: true }),
      emoji: text(body.emoji, { max: 16 }) ?? "🎯",
      currency: oneOf(body.currency, CURRENCIES),
      target_amount: amount(body.target_amount),
    })
    .select(GOAL_COLUMNS)
    .single();
  if (error) throw error;

  return Response.json({ goal: toGoal(data) }, { status: 201 });
});
