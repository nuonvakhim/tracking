"use client";

import type { ReactNode } from "react";
import { useMoney } from "@/lib/client/money";
import { haptic, useBackButton } from "@/lib/client/telegram";
import { CURRENCIES, type Currency } from "@/lib/types";

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useBackButton(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="safe-bottom relative mx-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-section px-4 pt-3"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hint/40" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full bg-secondary text-hint"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-2xl bg-section p-4 ${className}`}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h3 className="text-[13px] font-medium uppercase tracking-wide text-hint">{children}</h3>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-secondary p-1" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => {
            if (o.value !== value) haptic.tap();
            onChange(o.value);
          }}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            value === o.value ? "bg-section text-fg shadow-sm" : "text-hint"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-xl bg-button py-3.5 text-[15px] font-semibold text-button-fg transition-opacity disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-hint">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl bg-secondary px-3.5 py-3 text-[15px] text-fg outline-none placeholder:text-hint focus:ring-2 focus:ring-button";

/**
 * Large amount field with a USD/KHR picker. When the entry currency differs
 * from the display currency, shows the converted value live.
 */
export function AmountInput({
  value,
  onChange,
  currency,
  onCurrencyChange,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  currency: Currency;
  onCurrencyChange?: (currency: Currency) => void;
  autoFocus?: boolean;
}) {
  const money = useMoney();
  const parsed = parseAmount(value);
  const preview =
    currency !== money.currency && Number.isFinite(parsed) && parsed > 0
      ? `≈ ${money.format(parsed, currency)}`
      : " ";

  return (
    <div className="flex flex-col items-center gap-1 py-1">
      {onCurrencyChange && (
        <div className="flex rounded-full bg-secondary p-0.5 text-[12px] font-semibold" role="radiogroup" aria-label="Entry currency">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={currency === c}
              onClick={() => {
                if (c !== currency) haptic.tap();
                onCurrencyChange(c);
              }}
              className={`rounded-full px-3 py-1 ${currency === c ? "bg-button text-button-fg" : "text-hint"}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-2xl text-hint">{currency === "KHR" ? "៛" : "$"}</span>
        <input
          autoFocus={autoFocus}
          inputMode={currency === "KHR" ? "numeric" : "decimal"}
          placeholder="0"
          aria-label={`Amount in ${currency}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="tabular w-52 bg-transparent text-center text-5xl font-semibold outline-none placeholder:text-hint/50"
        />
      </div>
      <p className="tabular text-[13px] text-hint" aria-live="polite">
        {preview}
      </p>
    </div>
  );
}

/** Parses user-typed money ("1,250.5") — returns NaN when invalid. */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,\s]/g, "");
  return cleaned ? Number(cleaned) : NaN;
}

/** 0..1 meter: same-hue track and fill. */
export function Meter({
  value,
  label,
  danger = false,
}: {
  value: number;
  label: string;
  danger?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={`h-2 w-full overflow-hidden rounded-full ${danger ? "bg-danger/15" : "bg-button/15"}`}
    >
      <div
        className={`h-full rounded-full transition-[width] ${danger ? "bg-danger" : "bg-button"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}
