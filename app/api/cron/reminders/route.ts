import { timingSafeEqual } from "node:crypto";
import { sendExpenseReminders } from "@/lib/server/reminders";

// Called by the scheduler in vercel.json. Vercel sends `Authorization: Bearer
// $CRON_SECRET` when the CRON_SECRET env var is set.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET must be set");
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return Response.json(await sendExpenseReminders());
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
