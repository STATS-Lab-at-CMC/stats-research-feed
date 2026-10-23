"use client";

import { useCallback, useMemo } from "react";
import { DEFAULT_FOLLOWED_JOURNAL_IDS } from "@/lib/journals/catalog";
import { useCustomJournals } from "./useCustomJournals";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { createPersistedIdSetStore } from "./createPersistedStore";

const watchlistStore = createPersistedIdSetStore(
  STORAGE_KEYS.followedJournalIds,
  DEFAULT_FOLLOWED_JOURNAL_IDS,
  "watchlist",
);

/** The user's customizable, persistent journal watchlist. */
export function useWatchlist() {
  const { ids: followedJournalIds, toggle: toggleJournal, setAll, clear } = watchlistStore.useIdSet();
  // "All" means everything the user can actually see, which includes journals
  // they added themselves — not just the built-in catalog.
  const { allJournals } = useCustomJournals();

  const selectAll = useCallback(() => {
    setAll(allJournals.map((journal) => journal.id));
  }, [setAll, allJournals]);

  const clearAll = useCallback(() => clear(), [clear]);

  const restoreDefaults = useCallback(() => {
    setAll(DEFAULT_FOLLOWED_JOURNAL_IDS);
  }, [setAll]);

  const followedJournals = useMemo(
    () => allJournals.filter((journal) => followedJournalIds.has(journal.id)),
    [followedJournalIds, allJournals],
  );

  return {
    followedJournalIds,
    followedJournals,
    followedCount: followedJournalIds.size,
    allJournals,
    toggleJournal,
    selectAll,
    clearAll,
    restoreDefaults,
  };
}
