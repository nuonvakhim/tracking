"use client";

import { findCategory } from "@/lib/categories";
import { useMoney } from "@/lib/client/money";
import { dayLabel, formatMoney } from "@/lib/format";
import type { Transaction } from "@/lib/types";

const signedAmount = (tx: Transaction) => (tx.type === "income" ? tx.amount : -tx.amount);

export function TransactionRow({
  tx,
  onSelect,
}: {
  tx: Transaction;
  onSelect?: (tx: Transaction) => void;
}) {
  const money = useMoney();
  const cat = findCategory(tx.type, tx.category);
  const signed = signedAmount(tx);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(tx)}
        disabled={!onSelect}
        className="flex w-full items-center gap-3 py-2.5 text-left"
      >
        <span
          aria-hidden
          className={`grid size-10 shrink-0 place-items-center rounded-full text-lg ${
            tx.type === "income" ? "bg-income/15" : "bg-expense/15"
          }`}
        >
          {cat.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{cat.label}</span>
          {tx.note && <span className="block truncate text-[13px] text-hint">{tx.note}</span>}
        </span>
        <span className="tabular shrink-0 text-right">
          <span className="block text-[15px] font-semibold">
            {money.format(signed, tx.currency, { sign: true })}
          </span>
          {tx.currency !== money.currency && (
            <span className="block text-[12px] text-hint">
              {formatMoney(signed, tx.currency, { sign: true })}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/** Transactions grouped under day headers, each with the day's net total. */
export function GroupedTransactions({
  transactions,
  onSelect,
}: {
  transactions: Transaction[];
  onSelect?: (tx: Transaction) => void;
}) {
  const money = useMoney();
  const days = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const list = days.get(tx.occurred_on) ?? [];
    list.push(tx);
    days.set(tx.occurred_on, list);
  }

  return (
    <div className="space-y-3">
      {[...days].map(([day, list]) => {
        const net = list.reduce((s, t) => s + money.toDisplay(signedAmount(t), t.currency), 0);
        return (
          <section key={day} className="rounded-2xl bg-section px-4 pt-2 pb-1">
            <div className="flex items-center justify-between border-b border-separator pb-2 text-[13px] text-hint">
              <span>{dayLabel(day)}</span>
              <span className="tabular">{formatMoney(net, money.currency, { sign: true })}</span>
            </div>
            <ul className="divide-y divide-separator">
              {list.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} onSelect={onSelect} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Income and expense totals of a list, converted to the display currency. */
export function useTotals(transactions: Transaction[] | undefined) {
  const money = useMoney();
  let income = 0;
  let expense = 0;
  for (const t of transactions ?? []) {
    const v = money.toDisplay(t.amount, t.currency);
    if (t.type === "income") income += v;
    else expense += v;
  }
  return { income, expense, net: income - expense };
}
