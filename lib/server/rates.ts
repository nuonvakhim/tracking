import { cacheLife } from "next/cache";
import type { Rate } from "@/lib/types";

// Free, keyless endpoint from ExchangeRate-API (updates daily). Its terms
// require visible attribution, which the app shows next to the rate.
const RATE_URL = "https://open.er-api.com/v6/latest/USD";
const TIMEOUT_MS = 5_000;

// Used only when the rate service is unreachable; shown as an estimate.
const FALLBACK_KHR_PER_USD = 4100;

/** Current USD→KHR rate. Cached for hours; failures are cached briefly, never retried in a loop. */
export async function getRate(): Promise<Rate> {
  "use cache";

  try {
    const res = await fetch(RATE_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Rate API responded ${res.status}`);
    const data = await res.json();
    const khrPerUsd = Number(data?.rates?.KHR);
    if (data?.result !== "success" || !(khrPerUsd > 0)) throw new Error("Rate API returned no KHR rate");

    cacheLife("hours");
    return {
      khrPerUsd,
      updatedAt: new Date(Number(data.time_last_update_unix) * 1000).toISOString(),
      live: true,
    };
  } catch (err) {
    console.error("Exchange rate fetch failed, using fallback:", err);
    cacheLife("minutes");
    return { khrPerUsd: FALLBACK_KHR_PER_USD, updatedAt: null, live: false };
  }
}
