"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES } from "@/lib/categories";
import { api } from "@/lib/client/api";
import { useMoney } from "@/lib/client/money";
import { haptic } from "@/lib/client/telegram";
import { daysInMonth, formatMoney, today } from "@/lib/format";
import type { Budget, Currency, Profile } from "@/lib/types";
import { AmountInput, ErrorText, PrimaryButton, parseAmount } from "./ui";

// Fixed costs like rent would use up a daily allowance in one go.
const DEFAULT_EXCLUDED = ["bills"];

export function BudgetForm({
  budget,
  onSaved,
}: {
  budget: Budget | null;
  onSaved: (profile: Profile) => void;
}) {
  const money = useMoney();
  const [amount, setAmount] = useState(budget ? String(budget.amount) : "");
  const [currency, setCurrency] = useState<Currency>(budget?.currency ?? money.currency);
  const [excluded, setExcluded] = useState<string[]>(budget?.excluded ?? DEFAULT_EXCLUDED);
  const [alerts, setAlerts] = useState(budget?.alerts ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const value = parseAmount(amount);
  const counted = CATEGORIES.expense.length - excluded.length;
  const valid = Number.isFinite(value) && value > 0 && counted > 0;

  function toggle(id: string) {
    haptic.tap();
    setExcluded((ex) => (ex.includes(id) ? ex.filter((x) => x !== id) : [...ex, id]));
  }

  async function save(next: Budget | null) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { profile } = await api.setBudget(next);
      haptic.success();
      onSaved(profile);
    } catch (err) {
      haptic.error();
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (valid) void save({ amount: value, currency, excluded, alerts });
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <div>
        <span className="mb-1.5 block text-[13px] text-hint">Monthly budget</span>
        <AmountInput value={amount} onChange={setAmount} currency={currency} onCurrencyChange={setCurrency} />
        <p className="tabular text-center text-[12px] text-hint">
          {Number.isFinite(value) && value > 0
            ? `About ${formatMoney(value / daysInMonth(today()), currency)} a day this month`
            : "What you can spend in a month"}
        </p>
      </div>

      <div>
        <span className="mb-1.5 block text-[13px] text-hint">Counts toward the budget</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.expense.map((c) => {
            const on = !excluded.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                className={`rounded-full px-3 py-1.5 text-[13px] ${
                  on ? "bg-button/20 ring-1 ring-button" : "bg-secondary text-hint line-through"
                }`}
              >
                <span aria-hidden>{c.emoji}</span> {c.label}
              </button>
            );
          })}
        </div>
        {counted === 0 && (
          <p className="mt-1.5 text-[12px] text-danger">Pick at least one category.</p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={alerts}
        onClick={() => {
          haptic.tap();
          setAlerts((a) => !a);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-xl bg-secondary px-3.5 py-3 text-left"
      >
        <span>
          <span className="block text-[15px]">Telegram alerts</span>
          <span className="block text-[12px] text-hint">Message me at 80% and 100% of the budget</span>
        </span>
        <span
          aria-hidden
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${alerts ? "bg-button" : "bg-hint/40"}`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${alerts ? "left-[18px]" : "left-0.5"}`}
          />
        </span>
      </button>

      <ErrorText>{error}</ErrorText>
      <PrimaryButton type="submit" disabled={!valid || busy}>
        {busy ? "Saving…" : "Save budget"}
      </PrimaryButton>
      {budget && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(null)}
          className="w-full py-2 text-[15px] text-danger disabled:opacity-50"
        >
          Remove budget
        </button>
      )}
    </form>
  );
}
