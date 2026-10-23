import type { Article, FeedDataStatus } from "@/lib/types";
import type { JournalDefinition } from "@/lib/journals/catalog";
import { storage } from "@/lib/storage/localStorageAdapter";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { resolveJournalSources } from "./sources";
import { fetchRecentWorksForSources } from "./works";
import { getDemoArticles } from "./demoData";
import { dedupeArticles } from "./normalize";

const RECENT_WINDOW_DAYS = 90;
const WORKS_CACHE_TTL_MS = 20 * 60 * 1000;

export interface FeedResult {
  status: Exclude<FeedDataStatus, "loading">;
  articles: Article[];
  /** Followed journals OpenAlex had no matching source for; still shown, just excluded from fetching. */
  unresolvedJournalIds: string[];
  /**
   * True when a fetch returned usable articles but did not finish — a page
   * request failed partway through, so the feed is a subset of what exists.
   *
   * This used to be swallowed entirely: the app kept whatever it had and
   * rendered a short feed that looked perfectly healthy. That is precisely
   * how OpenAlex's October 2026 cursor-paging key requirement went unnoticed,
   * silently cutting a 319-article feed to 100. The UI now says so.
   */
  partial: boolean;
  /** OpenAlex's own explanation for the failure, when it gave one. */
  partialReason?: string;
}

/**
 * One journal's cached recent works. Cached independently per journal (keyed
 * by our internal journal id) so that:
 *  - unfollowing a journal never needs a network call (it's just left out of
 *    the union below);
 *  - re-following a journal whose data is still fresh is instant;
 *  - only genuinely missing/stale journals get fetched, and are still
 *    batched together into as few OpenAlex requests as possible (see
 *    works.ts's chunking) rather than one request per journal.
 * Only the normalized fields the app actually uses are stored — no raw
 * OpenAlex response payloads — to keep the localStorage payload compact.
 */
interface JournalWorksCacheEntry {
  articles: Article[];
  fetchedAt: number;
}

type WorksCache = Record<string, JournalWorksCacheEntry>;

function isJournalWorksCacheEntry(value: unknown): value is JournalWorksCacheEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<JournalWorksCacheEntry>;
  return Array.isArray(entry.articles) && typeof entry.fetchedAt === "number";
}

function readWorksCache(): WorksCache {
  // Same reasoning as sources.ts: an old (pre-restructure) single-blob cache
  // under this key just fails the shape check per "journal id" lookup below
  // and is treated as empty — no crash, no migration code needed.
  const raw = storage.get<Record<string, unknown> | null>(STORAGE_KEYS.openAlexWorksCache, null);
  if (!raw || typeof raw !== "object") return {};

  const cache: WorksCache = {};
  for (const [journalId, entry] of Object.entries(raw)) {
    if (isJournalWorksCacheEntry(entry)) cache[journalId] = entry;
  }
  return cache;
}

function writeWorksCache(cache: WorksCache): void {
  storage.set(STORAGE_KEYS.openAlexWorksCache, cache);
}

function isFresh(entry: JournalWorksCacheEntry | undefined, now: number): entry is JournalWorksCacheEntry {
  return entry !== undefined && now - entry.fetchedAt <= WORKS_CACHE_TTL_MS;
}

/**
 * Returns the feed for the given followed journals, fetching from OpenAlex
 * only for journals whose cached works are missing or stale, and otherwise
 * assembling the result entirely from localStorage:
 *
 *  1. Resolve every followed journal's OpenAlex Source ID (per-journal
 *     cached — see sources.ts).
 *  2. Split resolved journals into "fresh" (cached works, still within TTL)
 *     and "stale/missing".
 *  3. Fetch the stale/missing set in one batched OpenAlex request (or a
 *     handful, only if the OR'd filter is large enough to need chunking —
 *     see works.ts), never one request per journal.
 *  4. Union the fresh-cached articles with the newly-fetched ones. Because
 *     this union only ever includes journals that are both (a) currently
 *     followed and (b) resolved, unfollowing a journal is a pure local
 *     operation — its cached articles are simply not included, with no
 *     stale data ever leaking back in.
 */
export async function getFeedArticles(followedJournals: JournalDefinition[]): Promise<FeedResult> {
  if (followedJournals.length === 0) {
    return { status: "live", articles: [], unresolvedJournalIds: [], partial: false };
  }

  const { sourceIdByJournalId, unresolvedJournalIds } = await resolveJournalSources(followedJournals);

  if (sourceIdByJournalId.size === 0) {
    // OpenAlex was unreachable, or nothing resolved: fall back to demo data,
    // filtered to the followed set (demo data is local, so this is just a
    // plain filter, not a fetch).
    return {
      status: "demo",
      articles: filterToFollowed(getDemoArticles(), followedJournals),
      unresolvedJournalIds,
      partial: false,
    };
  }

  const now = Date.now();
  const cache = readWorksCache();

  const staleSourceIdByJournalId = new Map<string, string>();
  for (const [journalId, sourceId] of sourceIdByJournalId) {
    if (!isFresh(cache[journalId], now)) staleSourceIdByJournalId.set(journalId, sourceId);
  }

  let nextCache = cache;
  let fetchFailedWithNoData = false;
  let partial = false;
  let partialReason: string | undefined;

  if (staleSourceIdByJournalId.size > 0) {
    const journalNameByJournalId = new Map(followedJournals.map((j) => [j.id, j.name]));
    const worksResult = await fetchRecentWorksForSources(
      staleSourceIdByJournalId,
      journalNameByJournalId,
      RECENT_WINDOW_DAYS,
    );

    // Group the freshly-fetched articles back by journal so each journal's
    // entry can be cached (and later reused) independently.
    const fetchedByJournalId = new Map<string, Article[]>();
    for (const journalId of staleSourceIdByJournalId.keys()) fetchedByJournalId.set(journalId, []);
    for (const article of worksResult.articles) {
      fetchedByJournalId.get(article.journalId)?.push(article);
    }

    if (worksResult.complete) {
      nextCache = { ...cache };
      for (const [journalId, articles] of fetchedByJournalId) {
        nextCache[journalId] = { articles, fetchedAt: now };
      }
      writeWorksCache(nextCache);
    } else {
      // Partial/failed fetch: don't cache anything as fresh (so it's retried
      // next time), but still use what we got for this render. Journals with
      // no old cache entry at all will simply be missing from the union
      // below — degraded, not broken.
      nextCache = { ...cache };
      for (const [journalId, articles] of fetchedByJournalId) {
        if (articles.length > 0) nextCache[journalId] = { articles, fetchedAt: now };
      }
      fetchFailedWithNoData = worksResult.articles.length === 0;
      partial = worksResult.articles.length > 0;
      partialReason = worksResult.error;
    }
  }

  const union: Article[] = [];
  for (const journalId of sourceIdByJournalId.keys()) {
    const entry = nextCache[journalId];
    if (entry) union.push(...entry.articles);
  }

  if (union.length === 0 && fetchFailedWithNoData) {
    return {
      status: "demo",
      articles: filterToFollowed(getDemoArticles(), followedJournals),
      unresolvedJournalIds,
      partial: false,
    };
  }

  return {
    status: "live",
    articles: dedupeArticles(union),
    unresolvedJournalIds,
    partial,
    partialReason,
  };
}

function filterToFollowed(articles: Article[], followedJournals: JournalDefinition[]): Article[] {
  const followedIds = new Set(followedJournals.map((j) => j.id));
  return articles.filter((a) => followedIds.has(a.journalId));
}
