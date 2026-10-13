import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REQUEST_TIMEOUT_MS = 10_000;

let client: SupabaseClient | undefined;

/**
 * Server-only Supabase client using the secret key. It bypasses RLS, so every
 * query MUST be scoped to the verified Telegram user id. Never import this
 * from a client component.
 */
export function db(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  }

  client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Every Supabase request gets a hard timeout; no automatic retries.
      fetch: (input, init) =>
        fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
    },
  });
  return client;
}
