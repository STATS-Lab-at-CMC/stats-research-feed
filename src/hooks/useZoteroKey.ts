"use client";

import { useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import type { ZoteroIdentity } from "@/lib/zotero/client";
import { createPersistedValueStore } from "./createPersistedStore";

/**
 * The user's Zotero connection: their API key, which library it belongs to,
 * and which articles have already been pushed from this browser.
 *
 * All three use `createPersistedValueStore` with **no sync slice**, which is
 * the entire point. A Zotero key with write access can modify or delete
 * someone's whole library; this app never uploads it, never stores it in
 * Supabase, and never sends it anywhere except `api.zotero.org` itself. That
 * guarantee is structural rather than conventional — `createPersistedValueStore`
 * takes no slice parameter, so this store type cannot join sync even by
 * mistake.
 *
 * Signing in on another device therefore does not bring the key across, and
 * that is the intended trade. The consequence worth knowing: because
 * "already sent" is also per-browser, sending from a second device can re-add
 * items the first already pushed. Zotero's own duplicate detection catches
 * those, and syncing the sent-list while deliberately not syncing the key
 * would be a confusing half-measure.
 */

const keyStore = createPersistedValueStore<string>(STORAGE_KEYS.zoteroApiKey, "");
const identityStore = createPersistedValueStore<ZoteroIdentity | null>(
  STORAGE_KEYS.zoteroIdentity,
  null,
);
const sentStore = createPersistedValueStore<string[]>(STORAGE_KEYS.zoteroSentArticleIds, []);

export function useZoteroKey() {
  const [apiKey, setApiKey] = keyStore.useValue();
  const [identity, setIdentity] = identityStore.useValue();
  const [sentIds, setSentIds] = sentStore.useValue();

  /**
   * Stores a key only after Zotero has confirmed it, along with the account it
   * belongs to. Keeping the identity means the account panel can say which
   * library is connected without a network round trip every time it opens.
   */
  const connect = useCallback(
    (key: string, who: ZoteroIdentity) => {
      setApiKey(key.trim());
      setIdentity(who);
    },
    [setApiKey, setIdentity],
  );

  const disconnect = useCallback(() => {
    setApiKey("");
    setIdentity(null);
    // The sent-list is only meaningful relative to one library, so clearing the
    // key clears it too. Keeping it would silently suppress sends after
    // switching to a different Zotero account.
    setSentIds([]);
  }, [setApiKey, setIdentity, setSentIds]);

  const markSent = useCallback(
    (ids: string[]) => setSentIds(Array.from(new Set([...sentIds, ...ids]))),
    [sentIds, setSentIds],
  );

  const hasSent = useCallback((id: string) => sentIds.includes(id), [sentIds]);

  return {
    apiKey,
    identity,
    isConnected: apiKey.length > 0 && identity !== null,
    sentIds,
    connect,
    disconnect,
    markSent,
    hasSent,
  };
}
