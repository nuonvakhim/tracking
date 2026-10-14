export type TxType = "income" | "expense";
export const CURRENCIES = ["USD", "KHR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Profile = {
  telegram_id: number;
  first_name: string | null;
  /** Display currency; every amount is converted to it. */
  currency: Currency;
  budget: Budget | null;
};

/** Monthly spending budget. */
export type Budget = {
  amount: number;
  currency: Currency;
  /** Expense category ids that don't count toward the budget. */
  excluded: string[];
  /** Telegram message at 80% and 100% of the budget. */
  alerts: boolean;
};

export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  currency: Currency;
  category: string;
  note: string | null;
  occurred_on: string; // YYYY-MM-DD
  created_at: string;
};

export type SavingsGoal = {
  id: string;
  name: string;
  emoji: string;
  /** Target and all deposits/withdrawals are in this currency. */
  currency: Currency;
  target_amount: number;
  saved: number;
  created_at: string;
};

export type Totals = { income: number; expense: number; saved: number };

/** All-time totals, kept per original currency so they can be converted on the fly. */
export type Summary = Record<Currency, Totals>;

export type Rate = {
  khrPerUsd: number;
  updatedAt: string | null;
  /** false when the rate service was unreachable and a fallback is in use. */
  live: boolean;
};
