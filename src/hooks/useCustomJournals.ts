"use client";

import { useMemo } from "react";
import { JOURNAL_CATALOG, type JournalDefinition } from "@/lib/journals/catalog";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { createPersistedEntityStore } from "./createPersistedStore";

/**
 * Journals the user added beyond the built-in catalog.
 *
 * Synced, unlike the Zotero key, and necessarily so: the watchlist syncs as a
 * list of journal *ids*, so if the definitions behind those ids stayed local,
 * signing in on a second device would restore a watchlist pointing at journals
 * that device knows nothing about — no name to show, no ISSNs to fetch. The
 * ids and their definitions have to travel together.
 */
const customJournalsStore = createPersistedEntityStore<JournalDefinition>(
  STORAGE_KEYS.customJournals,
  (journal) => journal.id,
  "customJournals",
);

export function useCustomJournals() {
  const {
    entities,
    has: isCustom,
    toggle,
    remove: removeJournal,
  } = customJournalsStore.useEntities();

  const customJournals = useMemo(() => Array.from(entities.values()), [entities]);

  /**
   * The built-in catalog plus anything the user added, which is what every
   * other part of the app should read. Sorted by name so added journals are
   * interleaved rather than dumped at the end, and deduplicated by id in case
   * a journal in the catalog is also found through search.
   */
  const allJournals = useMemo(() => {
    const byId = new Map<string, JournalDefinition>();
    for (const journal of JOURNAL_CATALOG) byId.set(journal.id, journal);
    for (const journal of customJournals) {
      if (!byId.has(journal.id)) byId.set(journal.id, journal);
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [customJournals]);

  return {
    customJournals,
    allJournals,
    isCustom,
    addJournal: toggle,
    removeJournal,
  };
}

