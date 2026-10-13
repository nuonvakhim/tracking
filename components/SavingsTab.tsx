"use client";

import { useMoney } from "@/lib/client/money";
import { formatMoney } from "@/lib/format";
import type { SavingsGoal } from "@/lib/types";
import { Card, Meter, PrimaryButton, SectionTitle } from "./ui";

export function SavingsTab({
  goals,
  onNewGoal,
  onEntry,
  onDelete,
}: {
  goals: SavingsGoal[];
  onNewGoal: () => void;
  onEntry: (goal: SavingsGoal, mode: "deposit" | "withdraw") => void;
  onDelete: (goal: SavingsGoal) => void;
}) {
  const money = useMoney();
  const totalSaved = goals.reduce((s, g) => s + money.toDisplay(g.saved, g.currency), 0);
  const totalTarget = goals.reduce((s, g) => s + money.toDisplay(g.target_amount, g.currency), 0);

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-[13px] text-hint">Total saved</p>
        <p className="tabular mt-1 text-[44px] leading-tight font-bold tracking-tight">
          {formatMoney(totalSaved, money.currency)}
        </p>
        {goals.length > 0 && (
          <p className="mt-1 text-[13px] text-hint">
            of {formatMoney(totalTarget, money.currency)} across {goals.length}{" "}
            {goals.length === 1 ? "goal" : "goals"}
          </p>
        )}
      </Card>

      {goals.length === 0 ? (
        <Card className="py-8 text-center">
          <p className="text-3xl" aria-hidden>
            🐷
          </p>
          <p className="mt-2 font-medium">Start a savings goal</p>
          <p className="mt-1 mb-4 text-sm text-hint">
            Money you move into a goal is set aside from your available balance.
          </p>
          <PrimaryButton onClick={onNewGoal}>New goal</PrimaryButton>
        </Card>
      ) : (
        <div>
          <SectionTitle
            action={
              <button type="button" onClick={onNewGoal} className="text-[13px] text-accent">
                + New goal
              </button>
            }
          >
            Goals
          </SectionTitle>
          <ul className="space-y-3">
            {goals.map((g) => {
              // Progress is measured in the goal's own currency, so it never drifts with the rate.
              const progress = g.saved / g.target_amount;
              const done = progress >= 1;
              const converted = g.currency !== money.currency;
              return (
                <li key={g.id}>
                  <Card>
                    <div className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-2xl" aria-hidden>
                        {g.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{g.name}</p>
                        <p className="tabular text-[13px] text-hint">
                          {money.format(g.saved, g.currency)} of {money.format(g.target_amount, g.currency)}
                        </p>
                        {converted && (
                          <p className="tabular text-[12px] text-hint">
                            Goal in {g.currency}: {formatMoney(g.saved, g.currency)} of{" "}
                            {formatMoney(g.target_amount, g.currency)}
                          </p>
                        )}
                      </div>
                      <span className="tabular text-[15px] font-semibold">
                        {done ? "🎉" : `${Math.floor(progress * 100)}%`}
                      </span>
                    </div>
                    <div className="mt-3">
                      <Meter value={progress} label={`${g.name} progress`} />
                    </div>
                    <p className="mt-2 text-[13px] text-hint">
                      {done
                        ? "Goal reached!"
                        : `${money.format(g.target_amount - g.saved, g.currency)} to go`}
                    </p>
                    <div className="mt-3 flex gap-2 text-[14px] font-medium">
                      <button
                        type="button"
                        onClick={() => onEntry(g, "deposit")}
                        className="flex-1 rounded-xl bg-button py-2.5 text-button-fg"
                      >
                        Add money
                      </button>
                      <button
                        type="button"
                        onClick={() => onEntry(g, "withdraw")}
                        disabled={g.saved <= 0}
                        className="flex-1 rounded-xl bg-secondary py-2.5 text-fg disabled:opacity-40"
                      >
                        Withdraw
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${g.name}`}
                        onClick={() => onDelete(g)}
                        className="rounded-xl bg-secondary px-3.5 text-danger"
                      >
                        🗑
                      </button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
