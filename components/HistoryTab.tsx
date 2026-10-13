"use client";

import { useMoney } from "@/lib/client/money";
import { formatMoney, monthLabel } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { GroupedTransactions, useTotals } from "./TransactionList";
import { Card } from "./ui";

export function HistoryTab({
  monthKey,
  isCurrentMonth,
  transactions,
  error,
  onShiftMonth,
  onRetry,
  onSelect,
}: {
  monthKey: string;
  isCurrentMonth: boolean;
  transactions: Transaction[] | undefined;
  error: string;
  onShiftMonth: (delta: number) => void;
  onRetry: () => void;
  onSelect: (tx: Transaction) => void;
}) {
  const { currency } = useMoney();
  const { income, expense: spent } = useTotals(transactions);

  return (
    <div className="space-y-4">
      <Card className="py-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onShiftMonth(-1)}
            className="grid size-9 place-items-center rounded-full bg-secondary text-lg"
          >
            ‹
          </button>
          <p className="font-semibold">{monthLabel(monthKey)}</p>
          <button
            type="button"
            aria-label="Next month"
            disabled={isCurrentMonth}
            onClick={() => onShiftMonth(1)}
            className="grid size-9 place-items-center rounded-full bg-secondary text-lg disabled:opacity-30"
          >
            ›
          </button>
        </div>
        {transactions && (
          <dl className="mt-3 grid grid-cols-3 text-center text-[13px]">
            <div>
              <dt className="text-hint">Income</dt>
              <dd className="tabular font-semibold">{formatMoney(income, currency)}</dd>
            </div>
            <div>
              <dt className="text-hint">Spent</dt>
              <dd className="tabular font-semibold">{formatMoney(spent, currency)}</dd>
            </div>
            <div>
              <dt className="text-hint">Net</dt>
              <dd className="tabular font-semibold">
                {formatMoney(income - spent, currency, { sign: true })}
              </dd>
            </div>
          </dl>
        )}
      </Card>

      {error ? (
        <Card className="text-center">
          <p className="text-sm text-danger">{error}</p>
          <button type="button" onClick={onRetry} className="mt-2 text-sm text-accent">
            Try again
          </button>
        </Card>
      ) : !transactions ? (
        <Card>
          <p className="text-sm text-hint">Loading…</p>
        </Card>
      ) : transactions.length === 0 ? (
        <Card className="py-8 text-center">
          <p className="text-sm text-hint">Nothing recorded in {monthLabel(monthKey)}.</p>
        </Card>
      ) : (
        <>
          <GroupedTransactions transactions={transactions} onSelect={onSelect} />
          <p className="text-center text-[12px] text-hint">Tap a transaction to delete it.</p>
        </>
      )}
    </div>
  );
}
