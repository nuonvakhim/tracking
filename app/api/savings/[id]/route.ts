import { HttpError, withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { id as uuid } from "@/lib/server/validate";

// Deleting a goal also deletes its entries (FK cascade), which returns that
// money to the available balance.
export const DELETE = withUser(async (_request, user, ctx: RouteContext<"/api/savings/[id]">) => {
  const id = uuid((await ctx.params).id);

  const { data, error } = await db()
    .from("savings_goals")
    .delete()
    .eq("id", id)
    .eq("telegram_id", user.id)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "Not found");

  return new Response(null, { status: 204 });
});
