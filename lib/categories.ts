import type { TxType } from "./types";

export type Category = { id: string; label: string; emoji: string };

export const CATEGORIES: Record<TxType, Category[]> = {
  expense: [
    { id: "food", label: "Food", emoji: "🍜" },
    { id: "coffee", label: "Coffee", emoji: "☕" },
    { id: "transport", label: "Transport", emoji: "🛵" },
    { id: "shopping", label: "Shopping", emoji: "🛍️" },
    { id: "bills", label: "Bills", emoji: "🧾" },
    { id: "health", label: "Health", emoji: "💊" },
    { id: "fun", label: "Fun", emoji: "🎬" },
    { id: "education", label: "Education", emoji: "📚" },
    { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
    { id: "other", label: "Other", emoji: "📦" },
  ],
  income: [
    { id: "salary", label: "Salary", emoji: "💼" },
    { id: "bonus", label: "Bonus", emoji: "🎁" },
    { id: "business", label: "Business", emoji: "🏪" },
    { id: "freelance", label: "Freelance", emoji: "💻" },
    { id: "gift", label: "Gift", emoji: "🧧" },
    { id: "investment", label: "Investment", emoji: "📈" },
    { id: "other", label: "Other", emoji: "💰" },
  ],
};

export function categoryIds(type: TxType): string[] {
  return CATEGORIES[type].map((c) => c.id);
}

export function findCategory(type: TxType, id: string): Category {
  return CATEGORIES[type].find((c) => c.id === id) ?? { id, label: id, emoji: "•" };
}
