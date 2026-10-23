/**
 * Normalized internal representation of a research article, independent of
 * whichever upstream metadata source (OpenAlex, demo fallback) produced it.
 * UI and persistence code should only ever see this shape.
 */
export interface Article {
  /** Stable identifier. OpenAlex work IDs (e.g. "W123..."), or "demo-..." for fallback data. */
  id: string;
  title: string;
  authors: string[];
  journalId: string;
  journalName: string;
  /** ISO 8601 date (YYYY-MM-DD), or null if OpenAlex did not report one. */
  publicationDate: string | null;
  /** null means "unknown", not "closed access". */
  isOpenAccess: boolean | null;
  /** Plain-text abstract, reconstructed from OpenAlex's inverted index. Null if unavailable. */
  abstract: string | null;
  doi: string | null;
  /** Best available link to the article itself (DOI resolver preferred). */
  articleUrl: string | null;
  /**
   * Direct link to a legally-hosted full-text PDF, from OpenAlex's
   * `best_oa_location`. Null for paywalled work, and also for roughly half of
   * open-access work — OpenAlex often knows a free copy exists without
   * knowing a direct PDF address for it.
   */
  pdfUrl: string | null;
  /**
   * Bibliographic detail, for building a citation. Frequently absent: only
   * about 38% of recent articles have a volume, because the rest are advance
   * online publications that have not been assigned to an issue yet. APA has
   * a distinct reference form for exactly that case, so absence here is a
   * meaningful signal rather than missing data.
   */
  volume: string | null;
  issue: string | null;
  firstPage: string | null;
  lastPage: string | null;
  /** OpenAlex's own publication year, which can differ from `publicationDate`'s. */
  publicationYear: number | null;
  source: "openalex" | "demo";
}

export interface JournalWithState {
  id: string;
  name: string;
  publisher?: string;
  followed: boolean;
  confidence: "verified" | "low";
}

export type FeedSeenFilter = "all" | "unseen" | "seen" | "saved";
export type FeedSortOrder = "newest" | "oldest";

export interface FeedFilterState {
  seen: FeedSeenFilter;
  search: string;
  openAccessOnly: boolean;
  sort: FeedSortOrder;
}

export type FeedDataStatus = "loading" | "live" | "demo" | "error";
