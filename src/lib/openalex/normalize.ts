import type { Article } from "@/lib/types";
import { cleanText, doiToUrl, safeExternalUrl } from "@/lib/utils/sanitize";
import type { OpenAlexWorkRecord } from "./client";

const MAX_ABSTRACT_WORDS = 6000; // generous safety cap against malformed indices

/**
 * Publication types treated as genuine scholarly research content. Matches
 * the server-side `type:article|review` filter in works.ts — this is a
 * defensive second check (per OpenAlex docs verified 2026-08-26), not the
 * primary filter, in case a record is missing `type` metadata, the upstream
 * filter is ever bypassed (e.g. a future code path queries OpenAlex without
 * it), or OpenAlex returns something outside the requested filter.
 */
const ACCEPTABLE_PUBLICATION_TYPES = new Set(["article", "review"]);

/**
 * True if a work should appear in the feed: an article or review, and not
 * flagged as retracted. Exported standalone so it's easy to unit-test and to
 * reuse if another call site ever normalizes works outside this module.
 */
export function isAcceptablePublicationType(work: OpenAlexWorkRecord): boolean {
  if (work.is_retracted === true) return false;
  // A work with no `type` at all (shouldn't happen given the select fields,
  // but OpenAlex data is occasionally incomplete) is let through rather than
  // dropped — erring toward not silently hiding legitimate articles.
  if (work.type == null) return true;
  return ACCEPTABLE_PUBLICATION_TYPES.has(work.type);
}

/** OpenAlex stores abstracts as an inverted index (word -> positions) to save space. */
export function reconstructAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;

  let maxPosition = -1;
  for (const positions of Object.values(index)) {
    for (const position of positions) {
      if (position > maxPosition) maxPosition = position;
    }
  }
  if (maxPosition < 0 || maxPosition > MAX_ABSTRACT_WORDS) return null;

  const words = new Array<string>(maxPosition + 1).fill("");
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) {
      if (position >= 0 && position <= maxPosition) {
        words[position] = word;
      }
    }
  }

  return cleanText(words.join(" "));
}

function extractDoiIdentifier(doi: string | null | undefined): string | null {
  if (!doi) return null;
  const cleaned = doi.trim();
  return cleaned.replace(/^https?:\/\/doi\.org\//i, "") || null;
}

export function normalizeOpenAlexWork(
  work: OpenAlexWorkRecord,
  journalIdBySourceId: Map<string, string>,
  journalNameByJournalId: Map<string, string>,
): Article | null {
  const title = cleanText(work.title ?? work.display_name);
  if (!title) return null; // a work with no title at all isn't useful to show
  if (!isAcceptablePublicationType(work)) return null; // erratum/retraction/etc. — see isAcceptablePublicationType

  const sourceId = work.primary_location?.source?.id?.match(/S\d+$/i)?.[0] ?? null;
  const journalId = sourceId ? (journalIdBySourceId.get(sourceId) ?? null) : null;
  const journalName =
    (journalId && journalNameByJournalId.get(journalId)) ||
    cleanText(work.primary_location?.source?.display_name) ||
    "Unknown journal";

  const authors = (work.authorships ?? [])
    .map((a) => cleanText(a.author?.display_name))
    .filter((name): name is string => Boolean(name));

  const doi = extractDoiIdentifier(work.doi);

  return {
    id: work.id,
    title,
    authors,
    journalId: journalId ?? "unknown",
    journalName,
    publicationDate: work.publication_date ?? null,
    isOpenAccess: work.open_access?.is_oa ?? work.primary_location?.is_oa ?? null,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    doi,
    articleUrl:
      doiToUrl(doi) ??
      safeExternalUrl(work.primary_location?.landing_page_url) ??
      safeExternalUrl(work.id),
    /**
     * `best_oa_location` is OpenAlex's pick of the best freely-readable copy,
     * which may be the publisher or a repository. Only its `pdf_url` is taken:
     * its landing page is often the same page `articleUrl` already points at,
     * so offering it as a second link would promise a PDF and deliver a
     * paywall. Passed through `safeExternalUrl` like every other upstream
     * link, since this ends up in an href.
     */
    pdfUrl: safeExternalUrl(work.best_oa_location?.pdf_url),
    volume: cleanText(work.biblio?.volume),
    issue: cleanText(work.biblio?.issue),
    firstPage: cleanText(work.biblio?.first_page),
    lastPage: cleanText(work.biblio?.last_page),
    publicationYear: work.publication_year ?? null,
    /*
     * Kept whole, with no score threshold. OpenAlex scores these 0.30 to 1.00
     * and the low end is still specific and correct — dropping a term at 0.35
     * would be a false negative for the one reader who searches exactly that.
     * These are precise phrases rather than a broad taxonomy, so there is
     * little noise to filter, and a threshold is a number nobody would ever
     * tune. One line to add here if that turns out to be wrong.
     */
    /*
     * Sorted by OpenAlex's own relevance score, strongest first, because the
     * API does not return them in score order and the card shows only the
     * first handful. Without this, which terms a reader sees would be
     * arbitrary rather than the ones OpenAlex is most confident about.
     */
    keywords: (work.keywords ?? [])
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((keyword) => cleanText(keyword.display_name))
      .filter((name): name is string => Boolean(name)),
    source: "openalex",
  };
}

/** De-duplicates by work id first, then by DOI (OpenAlex occasionally has duplicate records). */
export function dedupeArticles(articles: Article[]): Article[] {
  const byId = new Map<string, Article>();
  for (const article of articles) {
    if (!byId.has(article.id)) byId.set(article.id, article);
  }

  const seenDois = new Set<string>();
  const result: Article[] = [];
  for (const article of byId.values()) {
    if (article.doi) {
      if (seenDois.has(article.doi)) continue;
      seenDois.add(article.doi);
    }
    result.push(article);
  }
  return result;
}
