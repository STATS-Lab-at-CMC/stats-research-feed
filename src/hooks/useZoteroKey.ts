"use client";

import { useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import type { ZoteroIdentity } from "@/lib/zotero/client";
import { createPersistedIdSetStore, createPersistedValueStore } from "./createPersistedStore";

/**
 * The user's Zotero connection: their API key, which library it belongs to,
 * and which articles have already been pushed from this browser.
 *
 * The split here is deliberate and load-bearing.
 *
 * **The key and identity never sync.** Both use `createPersistedValueStore`,
 * which takes no slice parameter — so that store type cannot join sync even
 * by mistake. A Zotero key with write access can modify or delete someone's
 * whole library; this app never uploads it, never stores it in Supabase, and
 * never sends it anywhere except `api.zotero.org` itself.
 *
 * **The export record does sync.** Which articles have already been sent is
 * bookkeeping, not a credential, and keeping it per-browser made the
 * duplicate guard useless in the cases most likely to hit it: exporting from
 * a second device, or after clearing site data, re-sent everything.
 *
 * The asymmetry this creates is real and intentional. Signing in elsewhere
 * brings the export history across but still asks for the key.
 */

const keyStore = createPersistedValueStore<string>(STORAGE_KEYS.zoteroApiKey, "");
const identityStore = createPersistedValueStore<ZoteroIdentity | null>(
  STORAGE_KEYS.zoteroIdentity,
  null,
);
/**
 * An id-set store rather than a value store, so it can carry a sync slice —
 * and because the on-disk shape is identical (a JSON array of ids), existing
 * local history survives the change.
 */
const sentStore = createPersistedIdSetStore(STORAGE_KEYS.zoteroSentArticleIds, [], "zoteroExports");

export function useZoteroKey() {
  const [apiKey, setApiKey] = keyStore.useValue();
  const [identity, setIdentity] = identityStore.useValue();
  const { ids: sentIds, has: hasSent, addMany: markSent, clear: clearSentHistory } =
    sentStore.useIdSet();

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

  /**
   * Disconnecting no longer clears the export record.
   *
   * It used to, on the reasoning that the record only means something
   * relative to one library. But now that the record is account data synced
   * across devices, clearing it on disconnect would propagate a deletion
   * everywhere — and the common reason to disconnect is reconnecting the same
   * library, where wiping it guarantees duplicates. Switching to a genuinely
   * different Zotero library is the rarer case, and has its own explicit
   * control.
   */
  const disconnect = useCallback(() => {
    setApiKey("");
    setIdentity(null);
  }, [setApiKey, setIdentity]);

  return {
    apiKey,
    identity,
    isConnected: apiKey.length > 0 && identity !== null,
    sentIds,
    exportedCount: sentIds.size,
    connect,
    disconnect,
    markSent,
    hasSent,
    clearSentHistory,
  };
}
