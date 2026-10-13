import type { SavingsGoal } from "@/lib/types";

export const GOAL_COLUMNS =
  "id, name, emoji, currency, target_amount, created_at, savings_entries(amount)";

type GoalRow = {
  id: string;
  name: string;
  emoji: string;
  currency: SavingsGoal["currency"];
  target_amount: number | string;
  created_at: string;
  savings_entries: { amount: number | string }[];
};

export function toGoal(row: unknown): SavingsGoal {
  const { savings_entries, ...goal } = row as GoalRow;
  return {
    ...goal,
    target_amount: Number(goal.target_amount),
    saved: savings_entries.reduce((sum, e) => sum + Number(e.amount), 0),
  };
}
