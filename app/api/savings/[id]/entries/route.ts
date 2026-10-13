import { HttpError, withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { GOAL_COLUMNS, toGoal } from "@/lib/server/goals";
import { amount, date, id as uuid, readJson, text } from "@/lib/server/validate";

// POST { amount, note?, occurred_on } — amount is in the goal's currency;
// positive deposits, negative withdraws.
export const POST = withUser(async (request, user, ctx: RouteContext<"/api/savings/[id]/entries">) => {
  const goalId = uuid((await ctx.params).id);
  const body = await readJson(request);
  const value = amount(body.amount, { allowNegative: true });

  const goal = await loadGoal(goalId, user.id);
  if (goal.saved + value < 0) throw new HttpError(400, "Cannot withdraw more than you saved");

  const { error } = await db().from("savings_entries").insert({
    goal_id: goalId,
    telegram_id: user.id,
    amount: value,
    note: text(body.note, { max: 200 }),
    occurred_on: date(body.occurred_on),
  });
  if (error) throw error;

  return Response.json({ goal: await loadGoal(goalId, user.id) }, { status: 201 });
});

async function loadGoal(goalId: string, telegramId: number) {
  const { data, error } = await db()
    .from("savings_goals")
    .select(GOAL_COLUMNS)
    .eq("id", goalId)
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Not found");
  return toGoal(data);
}
