/**
 * Turns one subscriber's watchlist into the content of one weekly email.
 *
 * No LLM. Articles are grouped by journal, and anything matching the reader's
 * own keywords is lifted to the top. That is a deliberate v1 choice rather
 * than a placeholder: a weekly email's job is to let someone see what came out
 * and decide what to open, and grouping by journal does that with no inference
 * to be wrong about, no per-send cost, and no delay. Thematic clustering is a
 * later upgrade that can be measured against this, not a prerequisite for it.
 *
 * Nothing here sends anything or touches a database — it takes a watchlist and
 * returns a structure. That keeps the preview endpoint, and later the cron
 * job, free to render the same digest without either of them being the only
 * way to see what a digest would say.
 */
import type { Article } from "@/lib/types";
import type { JournalDefinition } from "@/lib/journals/catalog";
import { JOURNAL_CATALOG } from "@/lib/journals/catalog";
import {
  buildKeywordPattern,
  articleMatchesKeywords,
  matchIsIndexTermOnly,
  matchedIndexTerms,
} from "@/lib/keywords/match";
import { resolveJournalSources } from "@/lib/openalex/sources";
import { fetchRecentWorksForSources } from "@/lib/openalex/works";
import { serverOpenAlexGet } from "@/lib/openalex/serverFetch";

/** The ordinary cadence, and the window for a first-ever send. */
export const DEFAULT_WINDOW_DAYS = 7;

/**
 * Ceiling on the window, however long it has been since the last send.
 *
 * A gap longer than a week means something went wrong — a failed send, a
 * paused cron, an account that opted in and then sat idle. Faithfully
 * covering a two-month gap would produce an email of several hundred
 * articles, which is not a digest and will not be read. Two weeks covers the
 * realistic failure (one or two missed Mondays); beyond that the email says
 * plainly which date it starts from, so nothing is silently dropped.
 */
export const MAX_WINDOW_DAYS = 14;

export interface DigestRecipient {
  email: string;
  /** Internal journal ids from `user_settings.followed_journal_ids`. */
  journalIds: string[];
  /** The reader's own added journals, which are not in the built-in catalog. */
  customJournals?: JournalDefinition[];
  keywords?: string[];
  /** `last_digest_sent_at`. Null for a first send. */
  lastSentAt?: string | null;
}

export interface DigestGroup {
  journalId: string;
  journalName: string;
  articles: Article[];
}

export interface Digest {
  /** Inclusive ISO date (YYYY-MM-DD) the window starts at. */
  windowStart: string;
  windowEnd: string;
  windowDays: number;
  /** Every article in the window, across all followed journals. */
  totalCount: number;
  /** Articles matching the reader's keywords, newest first. Empty if they have none. */
  keywordMatches: Article[];
  /**
   * For articles matched only on an OpenAlex index term, the terms that did
   * it, keyed by article id. An email cannot be inspected the way a page can,
   * so an entry whose title and abstract say nothing about the reader's
   * keywords needs to carry its own explanation.
   */
  matchReasons: Record<string, string[]>;
  keywords: string[];
  /**
   * The rest, by journal, busiest journal first.
   *
   * Excludes anything already listed under `keywordMatches`. Showing an
   * article twice in one email reads as a bug rather than as emphasis, and
   * the keyword section exists precisely so those articles do not have to be
   * hunted for in the journal lists.
   */
  groups: DigestGroup[];
  /** Followed journals OpenAlex had no source for — named, not silently dropped. */
  unresolvedJournalNames: string[];
  /**
   * True when the fetch did not finish. The email says so: a digest that
   * undercounts without admitting it is worse than one that is late, because
   * the reader has no way to tell and will assume it was a quiet week.
   */
  incomplete: boolean;
  incompleteReason?: string;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * How many days back this digest should reach.
 *
 * Measured from `lastSentAt` so a late send covers the gap rather than
 * repeating a week or skipping one, clamped at both ends: never less than a
 * day (two sends in one day would otherwise ask for a zero-day window), never
 * more than `MAX_WINDOW_DAYS`.
 */
export function windowDaysFor(lastSentAt: string | null | undefined, now = new Date()): number {
  if (!lastSentAt) return DEFAULT_WINDOW_DAYS;
  const last = new Date(lastSentAt);
  if (Number.isNaN(last.getTime())) return DEFAULT_WINDOW_DAYS;
  const days = Math.ceil((now.getTime() - last.getTime()) / 86_400_000);
  return Math.min(MAX_WINDOW_DAYS, Math.max(1, days));
}

/** Resolves a reader's followed ids to journal definitions, catalog plus their own. */
export function journalsFor(recipient: DigestRecipient): JournalDefinition[] {
  const byId = new Map<string, JournalDefinition>();
  for (const journal of JOURNAL_CATALOG) byId.set(journal.id, journal);
  // Custom journals last: a reader's own definition wins if an id ever collides.
  for (const journal of recipient.customJournals ?? []) byId.set(journal.id, journal);

  return recipient.journalIds
    .map((id) => byId.get(id))
    .filter((journal): journal is JournalDefinition => journal !== undefined);
}

/**
 * Fetches and arranges one reader's digest.
 *
 * Takes `articles` when the caller already has them — the cron job fetches
 * once for the union of every subscriber's journals and then composes per
 * reader, so one Monday costs one set of OpenAlex requests rather than one set
 * per subscriber.
 */
export interface ComposeOptions {
  now?: Date;
  /** Pre-fetched articles, from a shared fetch across all subscribers. */
  articles?: Article[];
  /** Journal ids that shared fetch could not resolve, so this digest can still say so. */
  unresolvedJournalIds?: string[];
  /** Whether that shared fetch finished. Carried through rather than assumed. */
  incomplete?: boolean;
  incompleteReason?: string;
}

export async function composeDigest(
  recipient: DigestRecipient,
  options: ComposeOptions = {},
): Promise<Digest> {
  const now = options.now ?? new Date();
  const windowDays = windowDaysFor(recipient.lastSentAt, now);
  const windowStart = isoDate(new Date(now.getTime() - windowDays * 86_400_000));
  const windowEnd = isoDate(now);

  const journals = journalsFor(recipient);
  const keywords = (recipient.keywords ?? []).map((k) => k.trim()).filter(Boolean);

  const empty: Digest = {
    windowStart,
    windowEnd,
    windowDays,
    totalCount: 0,
    keywordMatches: [],
    matchReasons: {},
    keywords,
    groups: [],
    unresolvedJournalNames: [],
    incomplete: false,
  };

  if (journals.length === 0) return empty;

  let articles: Article[];
  let unresolvedJournalNames: string[] = [];
  let incomplete = false;
  let incompleteReason: string | undefined;

  if (options.articles) {
    const followedIds = new Set(journals.map((j) => j.id));
    articles = options.articles.filter((a) => followedIds.has(a.journalId));

    // Only this reader's own unresolved journals: the shared fetch reports
    // them across everyone's watchlists, and naming a journal someone does
    // not follow in their email would be baffling.
    const nameById = new Map(journals.map((j) => [j.id, j.name]));
    unresolvedJournalNames = (options.unresolvedJournalIds ?? [])
      .filter((id) => followedIds.has(id))
      .map((id) => nameById.get(id) ?? id);

    incomplete = options.incomplete ?? false;
    incompleteReason = options.incompleteReason;
  } else {
    const { sourceIdByJournalId, unresolvedJournalIds } = await resolveJournalSources(
      journals,
      serverOpenAlexGet,
    );

    const nameById = new Map(journals.map((j) => [j.id, j.name]));
    unresolvedJournalNames = unresolvedJournalIds.map((id) => nameById.get(id) ?? id);

    if (sourceIdByJournalId.size === 0) {
      return {
        ...empty,
        unresolvedJournalNames,
        incomplete: true,
        incompleteReason: "Could not reach OpenAlex to look up these journals.",
      };
    }

    const result = await fetchRecentWorksForSources(
      sourceIdByJournalId,
      nameById,
      windowDays,
      serverOpenAlexGet,
    );
    articles = result.articles;
    incomplete = !result.complete;
    incompleteReason = result.error;
  }

  // `from_publication_date` is day-granular and the catalog fetch may have
  // used a wider window (the shared-fetch path above), so bound it here too.
  const inWindow = articles
    .filter((article) => !article.publicationDate || article.publicationDate >= windowStart)
    .sort((a, b) => (b.publicationDate ?? "").localeCompare(a.publicationDate ?? ""));

  const pattern = buildKeywordPattern(keywords);
  const keywordMatches = pattern
    ? inWindow.filter((article) => articleMatchesKeywords(article, pattern))
    : [];

  const matchReasons: Record<string, string[]> = {};
  for (const article of keywordMatches) {
    if (matchIsIndexTermOnly(article, pattern)) {
      matchReasons[article.id] = matchedIndexTerms(article, pattern);
    }
  }

  const liftedIds = new Set(keywordMatches.map((article) => article.id));

  const byJournal = new Map<string, DigestGroup>();
  for (const article of inWindow) {
    if (liftedIds.has(article.id)) continue;
    const existing = byJournal.get(article.journalId);
    if (existing) existing.articles.push(article);
    else
      byJournal.set(article.journalId, {
        journalId: article.journalId,
        journalName: article.journalName,
        articles: [article],
      });
  }

  const groups = Array.from(byJournal.values()).sort(
    (a, b) =>
      b.articles.length - a.articles.length || a.journalName.localeCompare(b.journalName),
  );

  return {
    windowStart,
    windowEnd,
    windowDays,
    totalCount: inWindow.length,
    keywordMatches,
    matchReasons,
    keywords,
    groups,
    unresolvedJournalNames,
    incomplete,
    incompleteReason,
  };
}
