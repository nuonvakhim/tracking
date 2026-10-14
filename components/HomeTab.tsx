"use client";

import { budgetStatus } from "@/lib/budget";
import { findCategory } from "@/lib/categories";
import { useMoney } from "@/lib/client/money";
import { openExternal } from "@/lib/client/telegram";
import { formatMoney, monthLabel, today } from "@/lib/format";
import { CURRENCIES, type Budget, type Summary, type Transaction } from "@/lib/types";
import { GroupedTransactions, useTotals } from "./TransactionList";
import { Card, Meter, SectionTitle } from "./ui";

const MAX_CATEGORY_ROWS = 6;

export function HomeTab({
  name,
  summary,
  monthKey,
  monthTx,
  budget,
  onEditBudget,
  onSeeAll,
  onSelect,
}: {
  name: string;
  summary: Summary;
  monthKey: string;
  monthTx: Transaction[] | undefined;
  budget: Budget | null;
  onEditBudget: () => void;
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

      {budget ? (
        monthTx && (
          <div>
            <SectionTitle
              action={
                <button type="button" onClick={onEditBudget} className="text-[13px] text-accent">
                  Edit
                </button>
              }
            >
              Daily budget
            </SectionTitle>
            <BudgetCard budget={budget} monthTx={monthTx} />
          </div>
        )
      ) : (
        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">Daily budget</p>
            <p className="text-[13px] text-hint">
              Set a monthly budget to see how much you can spend each day.
            </p>
          </div>
          <button
            type="button"
            onClick={onEditBudget}
            className="shrink-0 rounded-full bg-button px-4 py-1.5 text-[13px] font-semibold text-button-fg"
          >
            Set up
          </button>
        </Card>
      )}

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

/** Today's allowance from the monthly budget, plus how the month is going. */
function BudgetCard({ budget, monthTx }: { budget: Budget; monthTx: Transaction[] }) {
  const money = useMoney();
  const display = (v: number) => formatMoney(v, money.currency);
  const excluded = new Set(budget.excluded);
  const expenses = monthTx
    .filter((t) => t.type === "expense" && !excluded.has(t.category))
    .map((t) => ({ amount: money.toDisplay(t.amount, t.currency), occurred_on: t.occurred_on }));
  const s = budgetStatus(money.toDisplay(budget.amount, budget.currency), expenses, today());
  const overToday = s.leftToday < 0;

  return (
    <Card>
      <p className="text-[13px] text-hint">{overToday ? "Over today's budget by" : "Left to spend today"}</p>
      <p className={`tabular mt-0.5 text-[32px] leading-tight font-bold ${overToday ? "text-danger" : ""}`}>
        {display(Math.abs(s.leftToday))}
      </p>
      <p className="tabular mb-2 text-[13px] text-hint">
        Spent {display(s.spentToday)} of {display(s.allowance)} today
      </p>
      <Meter
        value={s.allowance > 0 ? s.spentToday / s.allowance : 1}
        label="Today's budget used"
        danger={overToday}
      />
      <div className="tabular mt-3 flex items-baseline justify-between gap-2 border-t border-separator pt-3 text-[13px]">
        <span className="text-hint">
          {s.daysLeft} {s.daysLeft === 1 ? "day" : "days"} left this month
        </span>
        <span className={s.leftMonth < 0 ? "text-danger" : ""}>
          {s.leftMonth < 0
            ? `${display(-s.leftMonth)} over`
            : `${display(s.leftMonth)} left`}{" "}
          <span className="text-hint">of {money.format(budget.amount, budget.currency)}</span>
        </span>
      </div>
    </Card>
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
