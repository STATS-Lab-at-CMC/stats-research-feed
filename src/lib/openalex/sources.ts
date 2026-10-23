import { JOURNAL_CATALOG, type JournalDefinition } from "@/lib/journals/catalog";
import { storage } from "@/lib/storage/localStorageAdapter";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { openAlexGet, type OpenAlexListResponse, type OpenAlexSourceRecord } from "./client";

const SOURCE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // journal->source mappings barely ever change

export interface SourceResolution {
  /** Maps our internal journal id -> OpenAlex Source ID (e.g. "S154957246"). */
  sourceIdByJournalId: Map<string, string>;
  /** Journal ids the catalog defines but OpenAlex had no matching source for. */
  unresolvedJournalIds: string[];
}

/**
 * One journal's cached resolution: either a resolved OpenAlex Source ID, or a
 * confirmed "OpenAlex has no source for this journal" (sourceId: null) — both
 * are cached, so a genuinely unresolvable journal doesn't get re-queried on
 * every load either. `resolvedAt` lets each journal's entry expire and be
 * re-checked independently of every other journal's entry.
 */
interface JournalSourceCacheEntry {
  sourceId: string | null;
  resolvedAt: number;
}

/** Per-journal cache, keyed by our internal journal id. Replaces the old single-blob shape. */
type SourceCache = Record<string, JournalSourceCacheEntry>;

function isJournalSourceCacheEntry(value: unknown): value is JournalSourceCacheEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<JournalSourceCacheEntry>;
  return (
    (typeof entry.sourceId === "string" || entry.sourceId === null) &&
    typeof entry.resolvedAt === "number"
  );
}

function extractShortSourceId(fullId: string): string {
  const match = fullId.match(/[SW]\d+$/i);
  return match ? match[0] : fullId;
}

function normalizeIssn(issn: string): string {
  return issn.trim().toUpperCase();
}

function readCache(): SourceCache {
  // Reading an old (pre-restructure) single-blob cache under this same key is
  // safe: its top-level keys ("sourceIdByJournalId", "resolvedAt", …) never
  // collide with a real journal id, and any entry that doesn't look like a
  // JournalSourceCacheEntry is ignored below — so it behaves exactly like an
  // empty cache (one extra fetch, no crash) rather than needing a migration.
  const raw = storage.get<Record<string, unknown> | null>(STORAGE_KEYS.openAlexSourceCache, null);
  if (!raw || typeof raw !== "object") return {};

  const cache: SourceCache = {};
  for (const [journalId, entry] of Object.entries(raw)) {
    if (isJournalSourceCacheEntry(entry)) cache[journalId] = entry;
  }
  return cache;
}

function writeCache(cache: SourceCache): void {
  storage.set(STORAGE_KEYS.openAlexSourceCache, cache);
}

function isFresh(entry: JournalSourceCacheEntry | undefined, now: number): entry is JournalSourceCacheEntry {
  return entry !== undefined && now - entry.resolvedAt <= SOURCE_CACHE_TTL_MS;
}

/**
 * Resolves every followed journal's OpenAlex Source ID using ISSNs, the
 * stable identifier OpenAlex recommends over fuzzy title matching.
 *
 * Cached per journal, independently: a journal whose source was resolved
 * (or confirmed unresolvable) within the last 24h is served straight from
 * the cache and costs no network call. Only journals that are missing or
 * stale are looked up — and those are still batched into as few OpenAlex
 * requests as possible (all their ISSNs OR'd into one `/sources` filter,
 * chunked only if the OR'd list would risk URL length limits) rather than
 * one request per journal.
 */
export async function resolveJournalSources(
  journals: JournalDefinition[] = JOURNAL_CATALOG,
): Promise<SourceResolution> {
  const now = Date.now();
  const cache = readCache();

  const sourceIdByJournalId = new Map<string, string>();
  const unresolvedJournalIds: string[] = [];
  const staleJournals: JournalDefinition[] = [];

  for (const journal of journals) {
    const entry = cache[journal.id];
    if (isFresh(entry, now)) {
      if (entry.sourceId) sourceIdByJournalId.set(journal.id, entry.sourceId);
      else unresolvedJournalIds.push(journal.id);
    } else {
      staleJournals.push(journal);
    }
  }

  if (staleJournals.length === 0) {
    return { sourceIdByJournalId, unresolvedJournalIds };
  }

  const issnToJournalId = new Map<string, string>();
  for (const journal of staleJournals) {
    for (const issn of journal.issns) {
      issnToJournalId.set(normalizeIssn(issn), journal.id);
    }
  }

  const allIssns = Array.from(issnToJournalId.keys());
  const resolvedNow = new Map<string, string>();

  // OpenAlex allows OR-ing many filter values with `|`; chunk defensively in
  // case the stale set is large enough to risk URL length limits. In the
  // common case (first-ever load, or several journals toggled at once) this
  // is a single request for every stale journal, not one request each.
  const ISSN_CHUNK_SIZE = 50;
  let fetchFailed = false;
  for (let i = 0; i < allIssns.length; i += ISSN_CHUNK_SIZE) {
    const issnChunk = allIssns.slice(i, i + ISSN_CHUNK_SIZE);
    const result = await openAlexGet<OpenAlexListResponse<OpenAlexSourceRecord>>("/sources", {
      filter: `issn:${issnChunk.join("|")}`,
      "per-page": String(issnChunk.length),
      select: "id,display_name,issn_l,issn",
    });

    if (!result.ok) {
      fetchFailed = true;
      break;
    }

    for (const source of result.data.results) {
      const candidateIssns = [source.issn_l, ...(source.issn ?? [])].filter(
        (issn): issn is string => Boolean(issn),
      );
      for (const issn of candidateIssns) {
        const journalId = issnToJournalId.get(normalizeIssn(issn));
        if (journalId && !resolvedNow.has(journalId)) {
          resolvedNow.set(journalId, extractShortSourceId(source.id));
        }
      }
    }
  }

  if (fetchFailed) {
    // Network/API failure resolving the stale set: don't cache anything for
    // it (so it's retried next time), and don't claim it's unresolved. Fall
    // back to whatever was already resolved from cache above.
    return { sourceIdByJournalId, unresolvedJournalIds };
  }

  // Merge freshly-resolved (and freshly-confirmed-unresolved) entries into
  // the persisted per-journal cache, leaving every other journal's entry
  // (including ones not part of this call at all) untouched.
  const nextCache: SourceCache = { ...cache };
  for (const journal of staleJournals) {
    const sourceId = resolvedNow.get(journal.id) ?? null;
    nextCache[journal.id] = { sourceId, resolvedAt: now };
    if (sourceId) sourceIdByJournalId.set(journal.id, sourceId);
    else unresolvedJournalIds.push(journal.id);
  }
  writeCache(nextCache);

  return { sourceIdByJournalId, unresolvedJournalIds };
}
