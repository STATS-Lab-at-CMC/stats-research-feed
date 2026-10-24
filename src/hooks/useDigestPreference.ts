"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Whether this account receives the weekly digest.
 *
 * Deliberately outside the sync engine, unlike keywords or the watchlist.
 * Those are local state that happens to be mirrored to the cloud so it can
 * follow you between devices. This is the opposite: state the *server* owns
 * and reads while nobody is signed in, which only exists at all because there
 * is an account with an email address attached. There is no sensible
 * signed-out value to keep in localStorage, so there is nothing to sync.
 *
 * It therefore reads and writes `user_settings` directly through the
 * authenticated client. The upsert names only this column, so it cannot
 * clobber `followed_journal_ids` or `keywords` if the sync engine happens to
 * flush at the same moment.
 */

type Status = "loading" | "ready" | "saving" | "error";

export function useDigestPreference() {
  const { status: authStatus, userId } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const signedIn = authStatus === "signedIn" && Boolean(userId);

  useEffect(() => {
    if (!signedIn) return;
    const client = getSupabaseClient();
    if (!client) return;

    let cancelled = false;

    client
      .from("user_settings")
      .select("digest_enabled")
      .eq("user_id", userId!)
      .maybeSingle()
      .then(({ data, error: readError }) => {
        if (cancelled) return;
        if (readError) {
          // Most likely the migration has not been run yet. Say so rather
          // than showing a switch that silently does nothing.
          setStatus("error");
          setError(
            "Could not read your digest setting. If you run this site, check that the weekly-digest migration has been applied.",
          );
          return;
        }
        setEnabled(data?.digest_enabled === true);
        setStatus("ready");
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn, userId]);

  const setDigestEnabled = useCallback(
    async (next: boolean) => {
      const client = getSupabaseClient();
      if (!client || !userId) return;

      // Optimistic: the switch should move under the finger, not after a
      // round trip. Reverted below if the write fails.
      const previous = enabled;
      setEnabled(next);
      setStatus("saving");
      setError(null);

      const { error: writeError } = await client
        .from("user_settings")
        .upsert({ user_id: userId, digest_enabled: next }, { onConflict: "user_id" });

      if (writeError) {
        setEnabled(previous);
        setStatus("error");
        setError("Could not save that. Your setting is unchanged.");
        return;
      }
      setStatus("ready");
    },
    [enabled, userId],
  );

  return { enabled, status, error, setDigestEnabled, available: signedIn };
}
