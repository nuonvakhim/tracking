import { HttpError } from "./auth";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route param ids: anything that isn't a UUID can't exist, so 404 early. */
export function id(value: string): string {
  if (!UUID_RE.test(value)) throw new HttpError(404, "Not found");
  return value;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {}
  throw new HttpError(400, "Invalid JSON body");
}

export function amount(value: unknown, { allowNegative = false } = {}): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n === 0 || Math.abs(n) >= 1e12) {
    throw new HttpError(400, "Invalid amount");
  }
  if (n < 0 && !allowNegative) throw new HttpError(400, "Amount must be positive");
  return Math.round(n * 100) / 100;
}

export function date(value: unknown): string {
  if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, "Invalid date");
  }
  return value;
}

export function text(value: unknown, { max, required = false }: { max: number; required?: boolean }) {
  if (value == null || value === "") {
    if (required) throw new HttpError(400, "Missing required field");
    return null;
  }
  if (typeof value !== "string") throw new HttpError(400, "Invalid text field");
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, "Missing required field");
  if (trimmed.length > max) throw new HttpError(400, `Text must be at most ${max} characters`);
  return trimmed || null;
}

/** An IANA timezone name such as "Asia/Phnom_Penh", or null if missing or unknown. */
export function timezone(value: string | null): string | null {
  if (!value || value.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new HttpError(400, "Invalid value");
  }
  return value as T;
}
