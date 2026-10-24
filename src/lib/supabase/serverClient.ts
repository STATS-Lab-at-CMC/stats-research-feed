/**
 * Server-side Supabase clients.
 *
 * Deliberately *not* the service-role key. This file only builds clients that
 * act as a specific signed-in person, using the anon key plus that person's
 * own access token, so every query still passes through the row-level security
 * policies in `supabase/migrations/`. A bug here can therefore leak one
 * person's watchlist to that same person, and nothing worse.
 *
 * The weekly send job genuinely does need to read every subscriber's row and
 * so will need the service-role key, which bypasses RLS entirely. That is
 * confined to the cron route, where it can be reviewed in one place, rather
 * than made available to anything that imports this module.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function normalizeProjectUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  return raw
    .trim()
    .replace(/\/(rest|auth|storage|realtime|functions)\/v\d+\/?$/, "")
    .replace(/\/+$/, "");
}

const SUPABASE_URL = normalizeProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function isSupabaseConfiguredOnServer(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * A client that acts as whoever owns `accessToken`.
 *
 * The token is sent as the `Authorization` header on every request, which is
 * what makes `auth.uid()` — and therefore every RLS policy — resolve to that
 * user. Session persistence is off: there is no browser here to persist into,
 * and a server-side client that cached a session across requests would be a
 * way for one request's identity to leak into another's.
 */
export function createUserScopedClient(accessToken: string): SupabaseClient | null {
  if (!isSupabaseConfiguredOnServer()) return null;

  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Pulls the bearer token out of a request, or null if there isn't a usable one. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}
