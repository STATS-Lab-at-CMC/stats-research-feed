"use client";

import { useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { createPersistedValueStore } from "./createPersistedStore";

/**
 * The user's Zotero API key, and the ids of articles already pushed to their
 * library from this browser.
 *
 * Both use `createPersistedValueStore` with **no sync slice**, which is the
 * entire point. A Zotero key with write access can modify or delete someone's
 * whole library; this app never uploads it, never stores it in Supabase, and
 * never sends it anywhere except `api.zotero.org` itself. Signing in on
 * another device therefore does not bring the key across, and that is the
 * intended trade — see `lib/zotero/client.ts`.
 *
 * The consequence worth knowing: because "already sent" is also per-browser,
 * sending from a second device can re-add items that the first device already
 * pushed. Zotero's own duplicate detection catches those, and the alternative
 * (syncing the sent-list while deliberately not syncing the key) would be a
 * confusing half-measure.
 */

const keyStore = createPersistedValueStore<string>(STORAGE_KEYS.zoteroApiKey, "");
const sentStore = createPersistedValueStore<string[]>(STORAGE_KEYS.zoteroSentArticleIds, []);

export function useZoteroKey() {
  const [apiKey, setApiKey] = keyStore.useValue();
  const [sentIds, setSentIds] = sentStore.useValue();

  const saveKey = useCallback((next: string) => setApiKey(next.trim()), [setApiKey]);

  const forgetKey = useCallback(() => {
    setApiKey("");
    // The sent-list is only meaningful relative to a library, so clearing the
    // key clears it too. Keeping it would silently suppress sends after the
    // user switched to a different Zotero account.
    setSentIds([]);
  }, [setApiKey, setSentIds]);

  const markSent = useCallback(
    (ids: string[]) => setSentIds(Array.from(new Set([...sentIds, ...ids]))),
    [sentIds, setSentIds],
  );

  const hasSent = useCallback((id: string) => sentIds.includes(id), [sentIds]);

  return {
    apiKey,
    hasKey: apiKey.length > 0,
    sentIds,
    saveKey,
    forgetKey,
    markSent,
    hasSent,
  };
}
