"use client";

import { useCallback, useEffect, useState } from "react";
import { findCategory } from "@/lib/categories";
import { ApiError, api } from "@/lib/client/api";
import { MoneyProvider } from "@/lib/client/money";
import { alertDialog, confirmDialog, haptic, initWebApp, waitForWebApp } from "@/lib/client/telegram";
import { convert, formatMoney, monthKeyOf, monthRange, shiftMonth, today } from "@/lib/format";
import { CURRENCIES, type Currency, type Profile, type Rate, type SavingsGoal, type Summary, type Transaction, type TxType } from "@/lib/types";
import { HistoryTab } from "./HistoryTab";
import { HomeTab } from "./HomeTab";
import { GoalForm, SavingsEntryForm } from "./SavingsForms";
import { SavingsTab } from "./SavingsTab";
import { TransactionForm } from "./TransactionForm";
import { PrimaryButton, Sheet } from "./ui";

type Tab = "home" | "history" | "savings";
type SheetState =
  | { kind: "transaction"; type: TxType }
  | { kind: "goal" }
  | { kind: "entry"; goal: SavingsGoal; mode: "deposit" | "withdraw" };

type Status = "loading" | "ready" | "unauthorized" | "error";

const byNewest = (a: Transaction, b: Transaction) =>
  b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at);

export default function TrackerApp() {
  const [status, setStatus] = useState<Status>("loading");
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rate, setRate] = useState<Rate | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [months, setMonths] = useState<Record<string, Transaction[]>>({});
  const [monthErrors, setMonthErrors] = useState<Record<string, string>>({});
  // Set on the client after mount: "today" must come from the user's clock, not the build.
  const [currentMonth, setCurrentMonth] = useState("");
  const [historyMonth, setHistoryMonth] = useState("");
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const loadMonth = useCallback(async (key: string) => {
    try {
      const { from, to } = monthRange(key);
      const { transactions } = await api.transactions(from, to);
      setMonths((m) => ({ ...m, [key]: transactions }));
    } catch (err) {
      setMonthErrors((e) => ({ ...e, [key]: (err as Error).message }));
    }
  }, []);

  const bootstrap = useCallback(async () => {
    const app = await waitForWebApp();
    if (app) initWebApp(app);
    try {
      const month = monthKeyOf(today());
      setCurrentMonth(month);
      setHistoryMonth((m) => m || month);
      const [me, g] = await Promise.all([api.me(), api.goals(), loadMonth(month)]);
      setProfile(me.profile);
      setSummary(me.summary);
      setRate(me.rate);
      setGoals(g.goals);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStatus("unauthorized");
      } else {
        setLoadError((err as Error).message);
        setStatus("error");
      }
    }
  }, [loadMonth]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === "ready" && !months[historyMonth] && !monthErrors[historyMonth]) {
      void loadMonth(historyMonth);
    }
  }, [status, historyMonth, months, monthErrors, loadMonth]);

  if (status === "loading") return <CenteredMessage title="Loading…" />;
  if (status === "unauthorized") {
    return (
      <CenteredMessage
        emoji="🔒"
        title="Open this app from Telegram"
        body="Your data is linked to your Telegram account, so this page only works inside the Telegram Mini App."
      />
    );
  }
  if (status === "error" || !profile || !summary || !rate) {
    return (
      <CenteredMessage emoji="⚠️" title="Couldn't load your data" body={loadError}>
        <PrimaryButton
          onClick={() => {
            setStatus("loading");
            void bootstrap();
          }}
        >
          Try again
        </PrimaryButton>
      </CenteredMessage>
    );
  }

  const currency = profile.currency;
  // Available balance in the display currency, across both currencies.
  const available = CURRENCIES.reduce((sum, c) => {
    const t = summary[c];
    return sum + convert(t.income - t.expense - t.saved, c, currency, rate.khrPerUsd);
  }, 0);

  function addTransaction(tx: Transaction) {
    const key = monthKeyOf(tx.occurred_on);
    setMonths((m) => (m[key] ? { ...m, [key]: [...m[key], tx].sort(byNewest) } : m));
    setSummary((s) => s && adjust(s, tx, 1));
    setSheet(null);
  }

  async function deleteTransaction(tx: Transaction) {
    const cat = findCategory(tx.type, tx.category);
    const ok = await confirmDialog(
      `Delete ${cat.label} ${formatMoney(tx.amount, tx.currency)}${tx.note ? ` (“${tx.note}”)` : ""}?`,
    );
    if (!ok) return;
    try {
      await api.deleteTransaction(tx.id);
      const key = monthKeyOf(tx.occurred_on);
      setMonths((m) => (m[key] ? { ...m, [key]: m[key].filter((t) => t.id !== tx.id) } : m));
      setSummary((s) => s && adjust(s, tx, -1));
      haptic.success();
    } catch (err) {
      haptic.error();
      void alertDialog((err as Error).message);
    }
  }

  async function deleteGoal(goal: SavingsGoal) {
    const ok = await confirmDialog(
      goal.saved > 0
        ? `Delete “${goal.name}”? The ${formatMoney(goal.saved, goal.currency)} saved in it returns to your available balance.`
        : `Delete “${goal.name}”?`,
    );
    if (!ok) return;
    try {
      await api.deleteGoal(goal.id);
      setGoals((gs) => gs.filter((g) => g.id !== goal.id));
      setSummary((s) => s && addSaved(s, goal.currency, -goal.saved));
      haptic.success();
    } catch (err) {
      haptic.error();
      void alertDialog((err as Error).message);
    }
  }

  async function changeCurrency(next: Currency) {
    if (next === currency) return;
    // Conversion happens on the client, so switch immediately and save the
    // preference in the background; roll back if saving fails.
    haptic.tap();
    setProfile((p) => p && { ...p, currency: next });
    try {
      await api.setCurrency(next);
    } catch (err) {
      setProfile((p) => p && { ...p, currency });
      void alertDialog((err as Error).message);
    }
  }

  return (
    <MoneyProvider currency={currency} rate={rate}>
      <div className="mx-auto min-h-dvh max-w-lg px-4 pt-4 pb-36">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">
            {tab === "home" ? "Overview" : tab === "history" ? "History" : "Savings"}
          </h1>
          <div className="flex rounded-full bg-section p-0.5 text-[12px] font-semibold" role="radiogroup" aria-label="Currency">
            {(["USD", "KHR"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => void changeCurrency(c)}
                className={`rounded-full px-3 py-1 ${currency === c ? "bg-button text-button-fg" : "text-hint"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </header>

        {tab === "home" && (
          <HomeTab
            name={profile.first_name ?? "there"}
            summary={summary}
            monthKey={currentMonth}
            monthTx={months[currentMonth]}
            onSeeAll={() => {
              setHistoryMonth(currentMonth);
              setTab("history");
            }}
            onSelect={deleteTransaction}
          />
        )}
        {tab === "history" && (
          <HistoryTab
            monthKey={historyMonth}
            isCurrentMonth={historyMonth >= currentMonth}
            transactions={months[historyMonth]}
            error={monthErrors[historyMonth] ?? ""}
            onShiftMonth={(d) => setHistoryMonth((m) => shiftMonth(m, d))}
            onRetry={() => {
              setMonthErrors((e) => ({ ...e, [historyMonth]: "" }));
              void loadMonth(historyMonth);
            }}
            onSelect={deleteTransaction}
          />
        )}
        {tab === "savings" && (
          <SavingsTab
            goals={goals}
            onNewGoal={() => setSheet({ kind: "goal" })}
            onEntry={(goal, mode) => setSheet({ kind: "entry", goal, mode })}
            onDelete={deleteGoal}
          />
        )}

        {tab !== "savings" && (
          <button
            type="button"
            aria-label="Add transaction"
            onClick={() => {
              haptic.tap();
              setSheet({ kind: "transaction", type: "expense" });
            }}
            className="fixed bottom-24 left-1/2 z-40 grid size-14 -translate-x-1/2 place-items-center rounded-full bg-button text-3xl leading-none text-button-fg shadow-lg"
          >
            +
          </button>
        )}

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-section">
          <div className="mx-auto flex max-w-lg">
            {(
              [
                ["home", "🏠", "Home"],
                ["history", "📅", "History"],
                ["savings", "🐷", "Savings"],
              ] as const
            ).map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                aria-current={tab === id ? "page" : undefined}
                onClick={() => {
                  if (tab !== id) haptic.tap();
                  setTab(id);
                }}
                className={`flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-medium ${
                  tab === id ? "text-button" : "text-hint"
                }`}
              >
                <span className={`text-xl ${tab === id ? "" : "opacity-60 grayscale"}`} aria-hidden>
                  {icon}
                </span>
                {label}
              </button>
            ))}
          </div>
        </nav>

        {sheet?.kind === "transaction" && (
          <Sheet title="New transaction" onClose={() => setSheet(null)}>
            <TransactionForm initialType={sheet.type} onSaved={addTransaction} />
          </Sheet>
        )}
        {sheet?.kind === "goal" && (
          <Sheet title="New savings goal" onClose={() => setSheet(null)}>
            <GoalForm
              onSaved={(goal) => {
                setGoals((gs) => [...gs, goal]);
                setSheet(null);
              }}
            />
          </Sheet>
        )}
        {sheet?.kind === "entry" && (
          <Sheet title={`${sheet.goal.emoji} ${sheet.goal.name}`} onClose={() => setSheet(null)}>
            <SavingsEntryForm
              goal={sheet.goal}
              initialMode={sheet.mode}
              available={available}
              onSaved={(goal, delta) => {
                setGoals((gs) => gs.map((g) => (g.id === goal.id ? goal : g)));
                setSummary((s) => s && addSaved(s, goal.currency, delta));
                setSheet(null);
              }}
            />
          </Sheet>
        )}
      </div>
    </MoneyProvider>
  );
}

function adjust(s: Summary, tx: Transaction, direction: 1 | -1): Summary {
  const t = s[tx.currency];
  const delta = direction * tx.amount;
  return {
    ...s,
    [tx.currency]:
      tx.type === "income" ? { ...t, income: t.income + delta } : { ...t, expense: t.expense + delta },
  };
}

function addSaved(s: Summary, currency: Currency, delta: number): Summary {
  return { ...s, [currency]: { ...s[currency], saved: s[currency].saved + delta } };
}

function CenteredMessage({
  emoji,
  title,
  body,
  children,
}: {
  emoji?: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-2 px-6 text-center">
      {emoji && (
        <p className="text-4xl" aria-hidden>
          {emoji}
        </p>
      )}
      <p className="text-lg font-semibold">{title}</p>
      {body && <p className="text-sm text-hint">{body}</p>}
      {children && <div className="mt-4 w-full">{children}</div>}
    </div>
  );
}
