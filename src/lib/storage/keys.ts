/** Central registry of every localStorage key the app uses, namespaced to avoid collisions. */
export const STORAGE_KEYS = {
  followedJournalIds: "stats-feed:followed-journal-ids",
  seenArticleIds: "stats-feed:seen-article-ids",
  /** Timestamp (ms) marking the end of the last distinct visit/session (the "previous visit" baseline). */
  previousVisitAt: "stats-feed:previous-visit-at",
  /** Timestamp (ms) of the most recent activity seen, used to detect when a new session has begun. */
  lastActivityAt: "stats-feed:last-activity-at",
  firstRunNoticeDismissed: "stats-feed:first-run-dismissed",
  /**
   * Full Article snapshots (not just ids) so a saved article stays viewable
   * in the Saved tab even after its journal is unfollowed or it ages out of
   * the live feed window. Supersedes the old id-only "bookmarked-article-ids"
   * key from V1, which is no longer read or written.
   */
  bookmarkedArticles: "stats-feed:bookmarked-articles-v2",
  openAlexSourceCache: "stats-feed:openalex-source-cache",
  openAlexWorksCache: "stats-feed:openalex-works-cache",
  /**
   * The Supabase user id the synced state in this browser belongs to, or
   * absent when that state is anonymous. Read only by the sync engine, to
   * avoid seeding one person's local watchlist and reading history into a
   * different person's new account on a shared machine.
   */
  syncOwner: "stats-feed:sync-owner",
  /**
   * The user's Zotero API key. Deliberately **never synced** — see
   * `hooks/useZoteroKey.ts`. A Zotero write key can alter or delete an entire
   * library, so it stays in the browser that entered it and travels only to
   * api.zotero.org.
   */
  /** Terms the reader watches for. Synced — see useKeywords. */
  keywords: "stats-feed:keywords",
  /** Whether to highlight keyword matches in the feed. Not synced: a display preference. */
  highlightKeywords: "stats-feed:highlight-keywords",
  /** Theme preference: "system" | "light" | "dark". Not synced — see useTheme. */
  theme: "stats-feed:theme",
  /**
   * Which generation of the default watchlist this browser has been reset to.
   * Deliberately NOT synced: it records what has happened to this browser, and
   * syncing it would let one device suppress the reset on another.
   */
  watchlistDefaultsVersion: "stats-feed:watchlist-defaults-version",
  /** Journals the user added beyond the built-in catalog. Synced — see useCustomJournals. */
  customJournals: "stats-feed:custom-journals",
  zoteroApiKey: "stats-feed:zotero-api-key",
  /** Which Zotero account the stored key belongs to, so the account panel can say so without a round trip. */
  zoteroIdentity: "stats-feed:zotero-identity",
  /** Article ids already pushed to Zotero from this browser, to avoid re-sending. */
  zoteroSentArticleIds: "stats-feed:zotero-sent-article-ids",
} as const;
