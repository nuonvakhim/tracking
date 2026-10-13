"use client";

import { useEffect, useRef } from "react";

export function webApp(): TelegramWebApp | undefined {
  return typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
}

/**
 * The SDK script is loaded `beforeInteractive`, but its execution isn't
 * guaranteed to finish before hydration — wait briefly for it.
 */
export async function waitForWebApp(timeoutMs = 2000): Promise<TelegramWebApp | undefined> {
  const start = Date.now();
  while (!webApp() && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return webApp();
}

/** Applies Telegram chrome settings once the app has mounted. */
export function initWebApp(app: TelegramWebApp) {
  app.ready();
  app.expand();
  if (app.isVersionAtLeast("6.1")) {
    app.setHeaderColor("secondary_bg_color");
    app.setBackgroundColor("secondary_bg_color");
  }
  // Stops swipe-down-to-close from fighting with scrolling inside sheets.
  if (app.isVersionAtLeast("7.7")) app.disableVerticalSwipes?.();
}

/** True when running inside Telegram with signed launch data. */
export function insideTelegram(): boolean {
  return Boolean(webApp()?.initData);
}

export const haptic = {
  tap: () => webApp()?.HapticFeedback.selectionChanged(),
  success: () => webApp()?.HapticFeedback.notificationOccurred("success"),
  error: () => webApp()?.HapticFeedback.notificationOccurred("error"),
};

/** Telegram's native confirm dialog, with a browser fallback for local dev. */
export function confirmDialog(message: string): Promise<boolean> {
  const app = webApp();
  if (app && insideTelegram()) {
    return new Promise((resolve) => app.showConfirm(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

/** Opens an external link in the browser (Telegram's in-app browser when inside Telegram). */
export function openExternal(url: string) {
  const app = webApp();
  if (app && insideTelegram()) app.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

export function alertDialog(message: string): Promise<void> {
  const app = webApp();
  if (app && insideTelegram()) {
    return new Promise((resolve) => app.showAlert(message, resolve));
  }
  window.alert(message);
  return Promise.resolve();
}

/** Shows Telegram's header back button while `active`, calling `onBack` on tap. */
export function useBackButton(active: boolean, onBack: () => void) {
  const handler = useRef(onBack);
  useEffect(() => {
    handler.current = onBack;
  });

  useEffect(() => {
    const button = webApp()?.BackButton;
    if (!button || !active) return;
    const cb = () => handler.current();
    button.onClick(cb);
    button.show();
    return () => {
      button.offClick(cb);
      button.hide();
    };
  }, [active]);
}
