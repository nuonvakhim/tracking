// Minimal typings for the parts of https://telegram.org/js/telegram-web-app.js we use.
// Full reference: https://core.telegram.org/bots/webapps#initializing-mini-apps

type TelegramHapticImpact = "light" | "medium" | "heavy" | "rigid" | "soft";
type TelegramHapticNotification = "error" | "success" | "warning";

interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; username?: string } };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes?(): void;
  showConfirm(message: string, callback: (ok: boolean) => void): void;
  showAlert(message: string, callback?: () => void): void;
  openLink(url: string): void;
  BackButton: TelegramBackButton;
  HapticFeedback: {
    impactOccurred(style: TelegramHapticImpact): void;
    notificationOccurred(type: TelegramHapticNotification): void;
    selectionChanged(): void;
  };
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp };
}
