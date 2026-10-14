import { daysInMonth } from "./format";

/** All amounts are in one currency. */
export type BudgetStatus = {
  /** Today's share of what was left of the budget this morning. */
  allowance: number;
  spentToday: number;
  /** Negative when today's spending is over the allowance. */
  leftToday: number;
  /** Negative when the month is over budget. */
  leftMonth: number;
  /** Days remaining in the month, today included. */
  daysLeft: number;
};

/**
 * Rolling daily allowance: whatever was left of the monthly budget at the start
 * of today, split evenly over the days remaining (today included). Spending less
 * today raises tomorrow's allowance; spending more lowers it.
 *
 * `expenses` must all be in today's month. Ones dated later this month count as
 * already committed, so they reduce the allowance too.
 */
export function budgetStatus(
  budget: number,
  expenses: { amount: number; occurred_on: string }[],
  todayISO: string,
): BudgetStatus {
  let spentToday = 0;
  let spentOtherDays = 0;
  for (const e of expenses) {
    if (e.occurred_on === todayISO) spentToday += e.amount;
    else spentOtherDays += e.amount;
  }
  const daysLeft = daysInMonth(todayISO) - Number(todayISO.slice(8, 10)) + 1;
  const allowance = Math.max(0, (budget - spentOtherDays) / daysLeft);
  return {
    allowance,
    spentToday,
    leftToday: allowance - spentToday,
    leftMonth: budget - spentOtherDays - spentToday,
    daysLeft,
  };
}
