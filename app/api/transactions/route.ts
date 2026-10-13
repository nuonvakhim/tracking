import { categoryIds } from "@/lib/categories";
import { HttpError, withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { amount, date, oneOf, readJson, text } from "@/lib/server/validate";
import { CURRENCIES, type Transaction, type TxType } from "@/lib/types";

const COLUMNS = "id, type, amount, currency, category, note, occurred_on, created_at";
const TYPES: readonly TxType[] = ["income", "expense"];

// GET /api/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD  (inclusive range)
export const GET = withUser(async (request, user) => {
  const params = new URL(request.url).searchParams;
  const from = date(params.get("from"));
  const to = date(params.get("to"));
  if (from > to) throw new HttpError(400, "`from` must be before `to`");

  const { data, error } = await db()
    .from("transactions")
    .select(COLUMNS)
    .eq("telegram_id", user.id)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  return Response.json({ transactions: (data ?? []).map(normalize) });
});

export const POST = withUser(async (request, user) => {
  const body = await readJson(request);
  const type = oneOf(body.type, TYPES);

  const { data, error } = await db()
    .from("transactions")
    .insert({
      telegram_id: user.id,
      type,
      amount: amount(body.amount),
      currency: oneOf(body.currency, CURRENCIES),
      category: oneOf(body.category, categoryIds(type)),
      note: text(body.note, { max: 200 }),
      occurred_on: date(body.occurred_on),
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;

  return Response.json({ transaction: normalize(data) }, { status: 201 });
});

function normalize(row: Record<string, unknown>): Transaction {
  return { ...(row as Transaction), amount: Number(row.amount) };
}
