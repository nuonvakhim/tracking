import type { Currency } from "./types";

export function formatMoney(value: number, currency: Currency, { sign = false } = {}): string {
  const abs = Math.abs(value);
  const prefix = sign ? (value < 0 ? "−" : "+") : value < 0 ? "−" : "";
  if (currency === "KHR") {
    return `${prefix}${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}៛`;
  }
  return `${prefix}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Converts between USD and KHR given the current KHR-per-USD rate. */
export function convert(amount: number, from: Currency, to: Currency, khrPerUsd: number): number {
  if (from === to) return amount;
  return from === "USD" ? amount * khrPerUsd : amount / khrPerUsd;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date as YYYY-MM-DD (not UTC, so late-evening entries land on the right day). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const today = () => toISODate(new Date());

/** "YYYY-MM" month key. */
export const monthKeyOf = (isoDate: string) => isoDate.slice(0, 7);

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthRange(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map(Number);
  return { from: `${monthKey}-01`, to: toISODate(new Date(y, m, 0)) };
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function dayLabel(isoDate: string): string {
  if (isoDate === today()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isoDate === toISODate(yesterday)) return "Yesterday";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
