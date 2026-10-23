import type { Article } from "@/lib/types";
import { openAlexGet, type OpenAlexListResponse, type OpenAlexWorkRecord } from "./client";
import { dedupeArticles, normalizeOpenAlexWork } from "./normalize";

const PER_PAGE = 100;
const MAX_PAGES = 8; // caps requests at 8 even for a very active 90-day window across 26 journals
const SOURCE_ID_CHUNK_SIZE = 40; // keeps the OR filter well under URL length limits
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
    }
  }

  const articles = allWorks
    .map((work) => normalizeOpenAlexWork(work, journalIdBySourceId, journalNameByJournalId))
    .filter((article): article is Article => article !== null);

  return { articles: dedupeArticles(articles), complete, error };
}
