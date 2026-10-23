import type { Article } from "@/lib/types";
import { openAlexGet, type OpenAlexListResponse, type OpenAlexWorkRecord } from "./client";
import { dedupeArticles, normalizeOpenAlexWork } from "./normalize";

/**
 * OpenAlex's maximum. Using it halves the number of requests for the same
 * data: the 38-journal default returns ~531 works in a 90-day window, which is
 * 3 requests at 200 rather than 6 at 100.
 */
const PER_PAGE = 200;

/**
 * Ceiling on requests per chunk, so one pathological watchlist cannot page
 * forever. 10 x 200 = 2,000 works per chunk, against ~531 for the default
 * catalogue — roughly a 4x margin.
 *
 * The previous 8 x 100 = 800 was set when the catalogue was 26 journals and
 * returned ~319. At 38 journals that margin had quietly fallen to 1.5x, and
 * overflow was invisible: the loop simply stopped at the limit and reported
 * success. `pageLimitHit` below exists so it can never be silent again.
 */
const MAX_PAGES = 10;

/**
 * Journals per `/works` request. 40 keeps the OR'd filter comfortably within
 * URL limits — the default catalogue builds an 871-character URL against a
 * ~2,000 practical ceiling — while keeping the number of separate pagination
 * sequences down. More journals than this simply means more chunks, each with
 * its own page budget, so total capacity grows rather than shrinks.
 */
const SOURCE_ID_CHUNK_SIZE = 40;
const WORK_SELECT_FIELDS =
  "id,doi,title,display_name,publication_date,authorships,primary_location,best_oa_location,open_access,abstract_inverted_index,type,is_retracted,biblio,publication_year";

/**
 * Publication-quality filter, applied server-side. Verified against
 * OpenAlex's current (2026-07-15 type-classification overhaul) documentation:
 * `type` is a canonical field with "article", "review", "erratum",
 * "retraction", etc. as distinct values, and `is_retracted` is a
 * Retraction-Watch-backed boolean. This keeps genuine research articles and
 * reviews while excluding errata, corrections, editorials, letters, and
 * other non-research entries, plus anything flagged as retracted.
 * `,` combines filters with AND; `|` combines values with OR within one
 * filter (see developers.openalex.org/guides/filtering).
 */
const PUBLICATION_TYPE_FILTER = "type:article|review,is_retracted:false";

export interface WorksFetchResult {
  articles: Article[];
  /** False if any page request failed; callers should treat results as partial. */
  complete: boolean;
  /** Why the fetch stopped early, straight from OpenAlex, when it said. */
  error?: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/**
 * Fetches works published within the last `windowDays` days across the given
 * OpenAlex source ids, batching source ids into OR filters instead of
 * issuing one request per journal or per article.
 */
export async function fetchRecentWorksForSources(
  sourceIdByJournalId: Map<string, string>,
  journalNameByJournalId: Map<string, string>,
  windowDays: number,
): Promise<WorksFetchResult> {
  const journalIdBySourceId = new Map<string, string>();
  for (const [journalId, sourceId] of sourceIdByJournalId) {
    journalIdBySourceId.set(sourceId, journalId);
  }

  const sourceIds = Array.from(sourceIdByJournalId.values());
  if (sourceIds.length === 0) return { articles: [], complete: true };

  const fromDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const allWorks: OpenAlexWorkRecord[] = [];
  let complete = true;
  let error: string | undefined;
  /** True when a chunk ran out of page budget with results still waiting. */
  let pageLimitHit = false;

  for (const sourceIdChunk of chunk(sourceIds, SOURCE_ID_CHUNK_SIZE)) {
    const filter = `primary_location.source.id:${sourceIdChunk.join("|")},from_publication_date:${fromDate},${PUBLICATION_TYPE_FILTER}`;
    let cursor = "*";
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await openAlexGet<OpenAlexListResponse<OpenAlexWorkRecord>>("/works", {
        filter,
        sort: "publication_date:desc",
        "per-page": String(PER_PAGE),
        cursor,
        select: WORK_SELECT_FIELDS,
      });

      if (!result.ok) {
        complete = false;
        // Keep the first failure's message: later chunks tend to fail the
        // same way, and the first one is the one that explains why.
        error ??= result.error;
        break;
      }

      allWorks.push(...result.data.results);

      const nextCursor = result.data.meta.next_cursor;

      if (!nextCursor || result.data.results.length < PER_PAGE) break;

      cursor = nextCursor;

      

      // Last allowed page, and OpenAlex says there is more. Stopping here

      // is correct — the budget exists for a reason — but reporting

      // success would not be: the reader would see a short feed with

      // nothing to indicate it had been cut off.

      if (page === MAX_PAGES - 1) pageLimitHit = true;
    }
  }

  const articles = allWorks
    .map((work) => normalizeOpenAlexWork(work, journalIdBySourceId, journalNameByJournalId))
    .filter((article): article is Article => article !== null);

  if (pageLimitHit) {
    complete = false;
    error ??=
      "This watchlist returns more articles than one load can fetch. Narrowing it, or shortening the window, will show everything.";
  }

  return { articles: dedupeArticles(articles), complete, error };
}
