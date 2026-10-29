import { db } from "./db";
import { sendMessage } from "./telegram";

/** Local hour (0-23) from which a reminder may be sent. */
const REMINDER_HOUR = 20;
const PAGE_SIZE = 500;
const CONCURRENCY = 10;

type ReminderRow = {
  telegram_id: number;
  first_name: string | null;
  timezone: string;
  reminder_last_sent: string | null;
};

/**
 * Messages every user who has reminders on, whose local time is past
 * REMINDER_HOUR, and who hasn't logged an expense today. Meant to run from a
 * scheduler (hourly or daily); each user gets at most one message per local day.
 */
export async function sendExpenseReminders(
  now = new Date(),
): Promise<{ checked: number; sent: number; failed: number }> {
  let checked = 0;
  let sent = 0;
  let failed = 0;

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db()
      .from("profiles")
      .select("telegram_id, first_name, timezone, reminder_last_sent")
      .eq("reminders", true)
      .not("timezone", "is", null)
      .order("telegram_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as ReminderRow[];

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const results = await Promise.allSettled(
        rows.slice(i, i + CONCURRENCY).map((row) => remind(row, now)),
      );
      for (const result of results) {
        checked++;
        if (result.status === "rejected") {
          failed++;
          console.error("Expense reminder failed:", result.reason);
        } else if (result.value) {
          sent++;
        }
      }
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return { checked, sent, failed };
}

/** Returns true if a reminder was sent. */
async function remind(row: ReminderRow, now: Date): Promise<boolean> {
  const local = localTime(row.timezone, now);
  if (!local || local.hour < REMINDER_HOUR) return false;
  if (row.reminder_last_sent && row.reminder_last_sent >= local.date) return false;

  const { data: today, error } = await db()
    .from("transactions")
    .select("id")
    .eq("telegram_id", row.telegram_id)
    .eq("type", "expense")
    .eq("occurred_on", local.date)
    .limit(1);
  if (error) throw error;
  if (today?.length) return false;

  // Record the reminder before sending it, and only if no other run got there
  // first, so overlapping runs can't both send it.
  const { data: claimed, error: claimError } = await db()
    .from("profiles")
    .update({ reminder_last_sent: local.date })
    .eq("telegram_id", row.telegram_id)
    .or(`reminder_last_sent.is.null,reminder_last_sent.lt.${local.date}`)
    .select("telegram_id");
  if (claimError) throw claimError;
  if (!claimed?.length) return false;

  const name = row.first_name ? `, ${row.first_name}` : "";
  await sendMessage(
    row.telegram_id,
    `📝 Hi${name}! You haven't added any expenses today. Take a minute to log them so your budget stays accurate.`,
  );
  return true;
}

/** The wall-clock date and hour in `timeZone`, or null if the zone is unknown. */
function localTime(timeZone: string, now: Date): { date: string; hour: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
  } catch {
    return null;
  }
}
