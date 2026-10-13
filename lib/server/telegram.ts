import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

const MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * Validates Telegram Mini App `initData` as described in
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Returns the signed-in Telegram user, or null if the data is invalid or expired.
 */
export function validateInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = Buffer.from(hash, "hex");

  const matches = (excluded: string[]) => {
    const dataCheckString = [...params.entries()]
      .filter(([key]) => !excluded.includes(key))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    const actual = createHmac("sha256", secret).update(dataCheckString).digest();
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };

  // Newer clients also send an Ed25519 `signature` field; depending on client
  // version it may or may not be part of the HMAC payload. Both are HMAC-signed
  // with the bot token, so accepting either is equally safe.
  if (!matches(["hash"]) && !matches(["hash", "signature"])) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "") as TelegramUser;
    return typeof user?.id === "number" ? user : null;
  } catch {
    return null;
  }
}
