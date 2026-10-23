"use client";

import { useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { createPersistedValueStore } from "./createPersistedStore";

/**
 * One-time reset of every existing watchlist to the current defaults.
 *
 * Normally adding journals to the catalog does **not** touch anyone's stored
 * watchlist — `defaultFollowed` only decides what a first-time visitor starts
 * with, and silently changing what someone follows is exactly the kind of
 * thing an app should not do on its own.
 *
 * This is a deliberate, explicitly-requested exception, made while the user
 * base is small enough that overriding people's customization is an
 * acceptable cost for everyone getting the twelve new journals. It is
 * destructive: a reader who had unfollowed journals they did not want gets
 * them back.
 *
 * Bump `WATCHLIST_DEFAULTS_VERSION` only to repeat that decision
 * deliberately. Leaving it alone makes this inert, which is why it is safe to
 * leave in place; it can be deleted once no browser is plausibly still on an
 * older version.
 */
const WATCHLIST_DEFAULTS_VERSION = 2;

const versionStore = createPersistedValueStore<number>(
  STORAGE_KEYS.watchlistDefaultsVersion,
  // 1, not 0: browsers that have never seen this key predate it and are
  // exactly the ones that need the reset.
  1,
);

/**
 * @param ready  Must be false until local state is final for this load.
 *   For a signed-in reader the cloud pull overwrites the watchlist, so running
 *   before it settles would reset, push, and then be overwritten by the
 *   in-flight response — leaving the old list and a version marker claiming
 *   the migration had already run.
 * @param restoreDefaults  `useWatchlist`'s own action, so the migration writes
 *   through the same path (and the same sync op) as the user clicking
 *   "Restore defaults".
 */
export function useWatchlistDefaultsMigration(ready: boolean, restoreDefaults: () => void) {
  const [version, setVersion] = versionStore.useValue();

  useEffect(() => {
    if (!ready) return;
    if (version >= WATCHLIST_DEFAULTS_VERSION) return;

    restoreDefaults();
    setVersion(WATCHLIST_DEFAULTS_VERSION);
  }, [ready, version, restoreDefaults, setVersion]);

  return { applied: version >= WATCHLIST_DEFAULTS_VERSION };
}
