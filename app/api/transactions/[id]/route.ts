import { HttpError, withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { id as uuid } from "@/lib/server/validate";

export const DELETE = withUser(async (_request, user, ctx: RouteContext<"/api/transactions/[id]">) => {
  const id = uuid((await ctx.params).id);

  const { data, error } = await db()
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("telegram_id", user.id)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "Not found");

  return new Response(null, { status: 204 });
});
