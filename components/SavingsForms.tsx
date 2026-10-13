"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/client/api";
import { useMoney } from "@/lib/client/money";
import { haptic } from "@/lib/client/telegram";
import { convert, formatMoney, today } from "@/lib/format";
import type { Currency, SavingsGoal } from "@/lib/types";
import { AmountInput, ErrorText, Field, PrimaryButton, Segmented, inputClass, parseAmount } from "./ui";

const GOAL_EMOJIS = ["🎯", "🏠", "🚗", "✈️", "📱", "💍", "🎓", "🏥", "🛟", "🎁"];

export function GoalForm({ onSaved }: { onSaved: (goal: SavingsGoal) => void }) {
  const money = useMoney();
  const [emoji, setEmoji] = useState(GOAL_EMOJIS[0]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [currency, setCurrency] = useState<Currency>(money.currency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const value = parseAmount(target);
  const valid = name.trim().length > 0 && Number.isFinite(value) && value > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const { goal } = await api.addGoal({ name: name.trim(), emoji, currency, target_amount: value });
      haptic.success();
      onSaved(goal);
    } catch (err) {
      haptic.error();
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Icon">
        {GOAL_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={emoji === e}
            onClick={() => setEmoji(e)}
            className={`grid size-11 place-items-center rounded-xl text-xl ${
              emoji === e ? "bg-button/20 ring-2 ring-button" : "bg-secondary"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <Field label="Goal name">
        <input
          autoFocus
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency fund"
          className={inputClass}
        />
      </Field>
      <div>
        <span className="mb-1.5 block text-[13px] text-hint">Target amount</span>
        <AmountInput
          value={target}
          onChange={setTarget}
          currency={currency}
          onCurrencyChange={setCurrency}
          autoFocus={false}
        />
        <p className="text-center text-[12px] text-hint">
          Deposits to this goal are made in {currency}.
        </p>
      </div>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton type="submit" disabled={!valid || busy}>
        {busy ? "Creating…" : "Create goal"}
      </PrimaryButton>
    </form>
  );
}

export function SavingsEntryForm({
  goal,
  initialMode,
  available,
  onSaved,
}: {
  goal: SavingsGoal;
  initialMode: "deposit" | "withdraw";
  /** Available balance in the display currency. */
  available: number;
  onSaved: (goal: SavingsGoal, delta: number) => void;
}) {
  const money = useMoney();
  const [mode, setMode] = useState(initialMode);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const value = parseAmount(amount);
  const valid =
    Number.isFinite(value) && value > 0 && (mode === "deposit" || value <= goal.saved);
  const availableInGoal = convert(available, money.currency, goal.currency, money.rate.khrPerUsd);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    const delta = mode === "deposit" ? value : -value;
    setBusy(true);
    setError("");
    try {
      const res = await api.addSavingsEntry(goal.id, { amount: delta, note, occurred_on: today() });
      haptic.success();
      onSaved(res.goal, delta);
    } catch (err) {
      haptic.error();
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "deposit", label: "Add money" },
          { value: "withdraw", label: "Withdraw" },
        ]}
      />
      <AmountInput value={amount} onChange={setAmount} currency={goal.currency} />
      <p className="text-center text-[13px] text-hint">
        {mode === "deposit"
          ? `Available balance: ${formatMoney(availableInGoal, goal.currency)}`
          : `Saved in this goal: ${formatMoney(goal.saved, goal.currency)}`}
      </p>
      <Field label="Note (optional)">
        <input
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </Field>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton type="submit" disabled={!valid || busy}>
        {busy ? "Saving…" : mode === "deposit" ? "Add to savings" : "Withdraw"}
      </PrimaryButton>
    </form>
  );
}
