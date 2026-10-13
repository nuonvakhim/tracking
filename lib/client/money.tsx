"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { convert, formatMoney } from "@/lib/format";
import type { Currency, Rate } from "@/lib/types";

type Money = {
  /** Display currency. */
  currency: Currency;
  rate: Rate;
  /** Converts an amount in `from` to the display currency. */
  toDisplay: (amount: number, from: Currency) => number;
  /** Converts to the display currency and formats it. */
  format: (amount: number, from: Currency, opts?: { sign?: boolean }) => string;
};

const MoneyContext = createContext<Money | null>(null);

export function MoneyProvider({
  currency,
  rate,
  children,
}: {
  currency: Currency;
  rate: Rate;
  children: ReactNode;
}) {
  const value = useMemo<Money>(() => {
    const toDisplay = (amount: number, from: Currency) =>
      convert(amount, from, currency, rate.khrPerUsd);
    return {
      currency,
      rate,
      toDisplay,
      format: (amount, from, opts) => formatMoney(toDisplay(amount, from), currency, opts),
    };
  }, [currency, rate]);

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney(): Money {
  const money = useContext(MoneyContext);
  if (!money) throw new Error("useMoney must be used inside <MoneyProvider>");
  return money;
}
