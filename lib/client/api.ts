"use client";

import type { Budget, Currency, Profile, Rate, SavingsGoal, Summary, Transaction, TxType } from "@/lib/types";
import { webApp } from "./telegram";

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const initData = webApp()?.initData;
  if (initData) headers.set("Authorization", `tma ${initData}`);
  if (init.body) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ApiError(0, "Network error — check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  me: () => request<{ profile: Profile; summary: Summary; rate: Rate }>("/api/me"),

  setCurrency: (currency: Currency) =>
    request<{ profile: Profile }>("/api/me", { method: "PATCH", body: JSON.stringify({ currency }) }),

  /** null removes the budget. */
  setBudget: (budget: Budget | null) =>
    request<{ profile: Profile }>("/api/me", { method: "PATCH", body: JSON.stringify({ budget }) }),

  transactions: (from: string, to: string) =>
    request<{ transactions: Transaction[] }>(
      `/api/transactions?${new URLSearchParams({ from, to })}`,
    ),

  addTransaction: (input: {
    type: TxType;
    amount: number;
    currency: Currency;
    category: string;
    note: string;
    occurred_on: string;
  }) =>
    request<{ transaction: Transaction }>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteTransaction: (id: string) =>
    request<void>(`/api/transactions/${id}`, { method: "DELETE" }),

  goals: () => request<{ goals: SavingsGoal[] }>("/api/savings"),

  addGoal: (input: { name: string; emoji: string; currency: Currency; target_amount: number }) =>
    request<{ goal: SavingsGoal }>("/api/savings", { method: "POST", body: JSON.stringify(input) }),

  deleteGoal: (id: string) => request<void>(`/api/savings/${id}`, { method: "DELETE" }),

  addSavingsEntry: (goalId: string, input: { amount: number; note: string; occurred_on: string }) =>
    request<{ goal: SavingsGoal }>(`/api/savings/${goalId}/entries`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
