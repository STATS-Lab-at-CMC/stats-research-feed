/**
 * The service-role Supabase client: the one that bypasses row-level security.
 *
 * This is the single most dangerous object in the codebase. The service-role
 * key is not a stronger login — it is a key that ignores every policy in
 * `supabase/migrations/`, so a query made with it can read or write any row
 * belonging to any user. Nothing in the browser, and nothing that merely
 * handles a user's request, may ever hold it.
 *
 * Three guards, in order of how much they are relied on:
 *
 *  1. `import "server-only"` — the build fails if a client module imports this.
 *  2. The key has no `NEXT_PUBLIC_` prefix, so Next will not inline it.
 *  3. Only three routes import this file, each for a reason that genuinely
 *     cannot be met by a user's own token:
 *
 *       - the weekly cron job, which must read every subscriber;
 *       - the unsubscribe endpoint, which must write a row for someone who by
 *         definition is not signed in;
 *       - the test-send endpoint, which assembles a digest the same way the
 *         cron does, but with the user id pinned to one already verified from
 *         the caller's own token, so the key never acts on an id taken from
 *         the request.
 *
 *     Everything else uses `serverClient.ts`, which acts as one person under
 *     RLS. If a fourth caller appears, that is the moment to ask whether it
 *     really needs to bypass RLS or whether it just needs the user's token.
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

/**
 * Returns the admin client, or null if this deployment has no service-role
 * key — which is the normal state for a fork that has not set up the digest.
 * Callers treat null as "this feature is not configured", not as an error.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = normalizeProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
