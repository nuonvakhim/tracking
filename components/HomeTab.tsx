"use client";

import { findCategory } from "@/lib/categories";
import { useMoney } from "@/lib/client/money";
import { openExternal } from "@/lib/client/telegram";
import { formatMoney, monthLabel } from "@/lib/format";
import { CURRENCIES, type Summary, type Transaction } from "@/lib/types";
import { GroupedTransactions, useTotals } from "./TransactionList";
import { Card, SectionTitle } from "./ui";

const MAX_CATEGORY_ROWS = 6;

export function HomeTab({
  name,
  summary,
  monthKey,
  monthTx,
  onSeeAll,
  onSelect,
}: {
  name: string;
  summary: Summary;
  monthKey: string;
  monthTx: Transaction[] | undefined;
  onSeeAll: () => void;
  onSelect: (tx: Transaction) => void;
}) {
  const money = useMoney();
  const { available, saved } = useBalance(summary);
  const month = useTotals(monthTx);
  const display = (v: number, opts?: { sign?: boolean }) => formatMoney(v, money.currency, opts);

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-[13px] text-hint">Hi {name} · Available balance</p>
        <p className="tabular mt-1 text-[44px] leading-tight font-bold tracking-tight">
          {display(available)}
        </p>
        <p className="mt-1 text-[13px] text-hint">{display(saved)} set aside in savings</p>
      </Card>

      <div>
        <SectionTitle>{monthLabel(monthKey)}</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Income" value={display(month.income)} mark="bg-income" />
          <StatTile label="Spent" value={display(month.expense)} mark="bg-expense" />
          <StatTile label="Net" value={display(month.net, { sign: true })} />
        </div>
      </div>

      {monthTx && monthTx.some((t) => t.type === "expense") && (
        <div>
          <SectionTitle>Spending by category</SectionTitle>
          <Card>
            <CategoryBars transactions={monthTx} />
          </Card>
        </div>
      )}

      <div>
        <SectionTitle
          action={
            monthTx?.length ? (
              <button type="button" onClick={onSeeAll} className="text-[13px] text-accent">
                See all
              </button>
            ) : null
          }
        >
          Recent
        </SectionTitle>
        {!monthTx ? (
          <Card>
            <p className="text-sm text-hint">Loading…</p>
          </Card>
        ) : monthTx.length === 0 ? (
          <Card className="py-8 text-center">
            <p className="text-3xl" aria-hidden>
              🧾
            </p>
            <p className="mt-2 font-medium">No transactions this month</p>
            <p className="mt-1 text-sm text-hint">Tap + to add your first expense or income.</p>
          </Card>
        ) : (
          <GroupedTransactions transactions={monthTx.slice(0, 6)} onSelect={onSelect} />
        )}
      </div>

      <RateNote />
    </div>
  );
}

/** All-time balance in the display currency: income − expenses − money in savings. */
function useBalance(summary: Summary) {
  const money = useMoney();
  let available = 0;
  let saved = 0;
  for (const c of CURRENCIES) {
    const t = summary[c];
    available += money.toDisplay(t.income - t.expense - t.saved, c);
    saved += money.toDisplay(t.saved, c);
  }
  return { available, saved };
}

function RateNote() {
  const { rate } = useMoney();
  const ATTRIBUTION_URL = "https://www.exchangerate-api.com";
  return (
    <p className="px-1 text-center text-[12px] text-hint">
      1 USD = {formatMoney(rate.khrPerUsd, "KHR")}
      {rate.live ? (
        <>
          {rate.updatedAt &&
            ` · updated ${new Date(rate.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          {" · "}
          <a
            href={ATTRIBUTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              openExternal(ATTRIBUTION_URL);
            }}
            className="underline"
          >
            Rates By Exchange Rate API
          </a>
        </>
      ) : (
        " · estimated (live rate unavailable)"
      )}
    </p>
  );
}

function StatTile({ label, value, mark }: { label: string; value: string; mark?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-section p-3">
      <p className="flex items-center gap-1.5 text-[12px] text-hint">
        {mark && <span aria-hidden className={`size-2 rounded-full ${mark}`} />}
        {label}
      </p>
      <p className="tabular mt-1 truncate text-[15px] font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}

/** Ranked horizontal bars, one hue; the tail beyond MAX_CATEGORY_ROWS folds into "Everything else". */
function CategoryBars({ transactions }: { transactions: Transaction[] }) {
  const money = useMoney();
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + money.toDisplay(t.amount, t.currency));
  }
  const ranked = [...totals].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, v]) => s + v, 0);

  let rows = ranked.map(([id, value]) => ({ ...findCategory("expense", id), value }));
  if (rows.length > MAX_CATEGORY_ROWS) {
    const head = rows.slice(0, MAX_CATEGORY_ROWS - 1);
    const tail = rows.slice(MAX_CATEGORY_ROWS - 1).reduce((s, r) => s + r.value, 0);
    rows = [...head, { id: "_rest", label: "Everything else", emoji: "⋯", value: tail }];
  }
  const max = rows[0]?.value ?? 1;

  return (
    <ul className="space-y-3" aria-label="Spending by category">
      {rows.map((r) => (
        <li key={r.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[14px]">
            <span className="truncate">
              <span aria-hidden>{r.emoji}</span> {r.label}
            </span>
            <span className="tabular shrink-0">
              <span className="font-medium">{formatMoney(r.value, money.currency)}</span>
              <span className="ml-1.5 text-hint">{Math.round((r.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2">
            <div
              className="h-full rounded-r-[4px] bg-button"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
