"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES } from "@/lib/categories";
import { api } from "@/lib/client/api";
import { useMoney } from "@/lib/client/money";
import { haptic } from "@/lib/client/telegram";
import { today } from "@/lib/format";
import type { Currency, Transaction, TxType } from "@/lib/types";
import { AmountInput, ErrorText, Field, PrimaryButton, Segmented, inputClass, parseAmount } from "./ui";

export function TransactionForm({
  initialType,
  onSaved,
}: {
  initialType: TxType;
  onSaved: (tx: Transaction) => void;
}) {
  const money = useMoney();
  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(money.currency);
  const [category, setCategory] = useState(CATEGORIES[initialType][0].id);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const value = parseAmount(amount);
  const valid = Number.isFinite(value) && value > 0;

  function switchType(next: TxType) {
    setType(next);
    setCategory(CATEGORIES[next][0].id);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const { transaction } = await api.addTransaction({
        type,
        amount: value,
        currency,
        category,
        note,
        occurred_on: date,
      });
      haptic.success();
      onSaved(transaction);
    } catch (err) {
      haptic.error();
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <Segmented
        value={type}
        onChange={switchType}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
      />

      <AmountInput
        value={amount}
        onChange={setAmount}
        currency={currency}
        onCurrencyChange={setCurrency}
      />

      <div>
        <span className="mb-1.5 block text-[13px] text-hint">Category</span>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES[type].map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => {
                haptic.tap();
                setCategory(c.id);
              }}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[12px] transition-colors ${
                category === c.id ? "bg-button text-button-fg" : "bg-secondary text-fg"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {c.emoji}
              </span>
              <span className="w-full truncate text-center">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Note (optional)">
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder={type === "expense" ? "e.g. Lunch with team" : "e.g. October salary"}
            className={inputClass}
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value || today())}
            className={`${inputClass} w-[9.5rem]`}
          />
        </Field>
      </div>

      <ErrorText>{error}</ErrorText>
      <PrimaryButton type="submit" disabled={!valid || busy}>
        {busy ? "Saving…" : `Save ${type}`}
      </PrimaryButton>
    </form>
  );
}
