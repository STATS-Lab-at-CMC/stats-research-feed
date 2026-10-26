"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Info, Upload } from "lucide-react";
import type { Article, FeedDataStatus, FeedFilterState } from "@/lib/types";
import type { JournalDefinition } from "@/lib/journals/catalog";
import { useCustomJournals } from "@/hooks/useCustomJournals";
import { useWatchlistDefaultsMigration } from "@/hooks/useWatchlistDefaultsMigration";
import { getFeedArticles } from "@/lib/openalex/feed";
import { getContinueState } from "@/lib/feed/continueTarget";
import { articleMatchesKeywords } from "@/lib/keywords/match";
import { parseDateMs, recencyBucket, RECENCY_BUCKET_LABELS, type RecencyBucket } from "@/lib/utils/date";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useSeenState } from "@/hooks/useSeenState";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useVisitTracking } from "@/hooks/useVisitTracking";
import { useFirstRunNotice } from "@/hooks/useFirstRunNotice";
import { useHasMounted } from "@/hooks/useHasMounted";

import { FirstRunNotice } from "./FirstRunNotice";
import { DemoModeBanner } from "./DemoModeBanner";
import { PartialResultsBanner } from "./PartialResultsBanner";
import { MarkAllSeenDialog } from "./MarkAllSeenDialog";
import { KeywordsDialog } from "./KeywordsDialog";
import { useKeywords } from "@/hooks/useKeywords";
import { ZoteroDialog } from "@/components/zotero/ZoteroDialog";
import { ContinueBanner } from "./ContinueBanner";
import { FeedStatusBar } from "./FeedStatusBar";
import { FeedControls } from "./FeedControls";
import { ArticleCard } from "./ArticleCard";
import { DateGroupHeader } from "./DateGroupHeader";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { JournalManager } from "@/components/journals/JournalManager";
import { InfoDialog } from "@/components/info/InfoDialog";
import { AccountButton } from "@/components/auth/AccountButton";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useZoteroKey } from "@/hooks/useZoteroKey";
import { Button } from "@/components/ui/button";

const DEFAULT_FILTERS: FeedFilterState = {
  seen: "all",
  search: "",
  openAccessOnly: false,
  sort: "newest",
};

const BUCKET_ORDER_NEWEST_FIRST: RecencyBucket[] = ["thisWeek", "earlierThisMonth", "older", "undated"];
const BUCKET_ORDER_OLDEST_FIRST: RecencyBucket[] = ["older", "earlierThisMonth", "thisWeek", "undated"];

export function FeedPage() {
  const auth = useAuth();
  const watchlist = useWatchlist();
  const seenState = useSeenState();
  const bookmarks = useBookmarks();
  const visit = useVisitTracking();
  const firstRun = useFirstRunNotice();
  const zotero = useZoteroKey();
  const journalLibrary = useCustomJournals();
  const keywords = useKeywords();

  const hasMounted = useHasMounted();
  const allReady = hasMounted && visit.hydrated;

  /**
   * The watchlist is only final once any cloud pull has landed — for a
   * signed-in reader the pull overwrites it, so a reset run beforehand is
   * silently undone while still recording itself as done.
   *
   * `"unknown"` has to be excluded explicitly, and missing that is what broke
   * the first attempt: it is the pre-hydration status, so `status !==
   * "signedIn"` is true on the very first render for signed-in and signed-out
   * readers alike. The gate opened before Supabase had resolved the session,
   * and before the sync engine had installed its op handler — so the reset
   * applied locally, pushed nothing, and was then overwritten by the pull.
   */
  const authResolved = auth.status !== "unknown";
  const watchlistSettled =
    allReady &&
    authResolved &&
    (auth.status !== "signedIn" || auth.sync.status === "synced" || auth.sync.status === "error");

  useWatchlistDefaultsMigration(watchlistSettled, watchlist.restoreDefaults);

  const [feedStatus, setFeedStatus] = useState<FeedDataStatus>("loading");
  const [articles, setArticles] = useState<Article[]>([]);
  const [unresolvedJournalIds, setUnresolvedJournalIds] = useState<string[]>([]);
  const [partial, setPartial] = useState<{ reason?: string } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [journalManagerOpen, setJournalManagerOpen] = useState(false);
  const [markAllSeenOpen, setMarkAllSeenOpen] = useState(false);
  const [zoteroOpen, setZoteroOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  const [keywordsOnly, setKeywordsOnly] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [filters, setFilters] = useState<FeedFilterState>(DEFAULT_FILTERS);
  const [journalFilter, setJournalFilter] = useState<string>("all");
  const [highlightedArticleId, setHighlightedArticleId] = useState<string | null>(null);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  useEffect(() => {
    if (!allReady) return;
    let cancelled = false;
    // Kicking off an async fetch and reflecting its lifecycle (loading /
    // result / error) in state is exactly what this effect exists to do.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeedStatus("loading");

    getFeedArticles(watchlist.followedJournals)
      .then((result) => {
        if (cancelled) return;
        setArticles(result.articles);
        setUnresolvedJournalIds(result.unresolvedJournalIds);
        setPartial(result.partial ? { reason: result.partialReason } : null);
        setFeedStatus(result.status);
      })
      .catch(() => {
        if (cancelled) return;
        setFeedStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [allReady, watchlist.followedJournals, reloadToken]);

  /**
   * Saved articles are snapshots, frozen at the moment they were bookmarked,
   * so one saved before a field existed never gains it — which is how saved
   * articles ended up with no `pdfUrl` after PDF links shipped, and therefore
   * no PDF attached on Zotero export.
   *
   * Whenever a bookmarked article is still in the live feed, its fresh copy
   * replaces the stored one. Self-limiting: `refreshBookmarks` only acts on
   * snapshots that are actually missing keys, so this is one write per stale
   * article and then nothing.
   */
  useEffect(() => {
    if (articles.length === 0) return;
    bookmarks.refreshBookmarks(articles);
  }, [articles, bookmarks]);

  // In Saved mode, the journal dropdown should also offer journals behind a
  // bookmark that's no longer followed — otherwise there'd be no way to
  // filter Saved down to that article's journal.
  const journalOptions = useMemo(() => {
    if (filters.seen !== "saved") return watchlist.followedJournals;
    const followedIds = new Set(watchlist.followedJournals.map((j) => j.id));
    const savedJournalIds = new Set(bookmarks.bookmarkedArticles.map((a) => a.journalId));
    const extraJournals = journalLibrary.allJournals.filter(
      (journal) => savedJournalIds.has(journal.id) && !followedIds.has(journal.id),
    );
    return [...watchlist.followedJournals, ...extraJournals].sort((a, b) => a.name.localeCompare(b.name));
  }, [filters.seen, watchlist.followedJournals, bookmarks.bookmarkedArticles, journalLibrary.allJournals]);

  // If the journal currently selected in the per-journal display filter is no
  // longer a valid option (its dropdown entry disappeared — e.g. unfollowed
  // and not covered by a Saved-mode exception above), reset to "all" rather
  // than silently filtering everything out via a now-orphaned id.
  useEffect(() => {
    if (journalFilter === "all") return;
    const validIds = new Set(journalOptions.map((j) => j.id));
    if (!validIds.has(journalFilter)) {
      // Resetting a now-orphaned filter selection back to "all" in response to
      // an external change (the watchlist) — same pattern as the fetch effect above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJournalFilter("all");
    }
  }, [journalFilter, journalOptions]);

  const isNewArticle = useCallback(
    (article: Article) => {
      if (visit.previousVisitAt === null) return false;
      const ms = parseDateMs(article.publicationDate);
      return ms !== null && ms > visit.previousVisitAt;
    },
    [visit.previousVisitAt],
  );

  const unseenCount = useMemo(
    () => articles.filter((a) => !seenState.seenArticleIds.has(a.id)).length,
    [articles, seenState.seenArticleIds],
  );

  const newSinceLastVisit = useMemo(
    () => (visit.previousVisitAt === null ? null : articles.filter(isNewArticle).length),
    [articles, visit.previousVisitAt, isNewArticle],
  );

  const filteredSorted = useMemo(() => {
    let list: Article[] = filters.seen === "saved" ? bookmarks.bookmarkedArticles : articles;

    if (filters.seen === "unseen") list = list.filter((a) => !seenState.seenArticleIds.has(a.id));
    else if (filters.seen === "seen") list = list.filter((a) => seenState.seenArticleIds.has(a.id));

    if (journalFilter !== "all") list = list.filter((a) => a.journalId === journalFilter);
    if (filters.openAccessOnly) list = list.filter((a) => a.isOpenAccess === true);
    // Independent of highlighting: you can filter to matches with highlighting
    // off, and vice versa, so `pattern` is used here rather than
    // `highlightPattern`.
    if (keywordsOnly && keywords.pattern) {
      list = list.filter((a) => articleMatchesKeywords(a, keywords.pattern));
    }

    const q = filters.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.journalName.toLowerCase().includes(q) ||
          a.authors.some((name) => name.toLowerCase().includes(q)) ||
          (a.abstract?.toLowerCase().includes(q) ?? false),
      );
    }

    return [...list].sort((a, b) => {
      const aMs = parseDateMs(a.publicationDate) ?? -Infinity;
      const bMs = parseDateMs(b.publicationDate) ?? -Infinity;
      return filters.sort === "newest" ? bMs - aMs : aMs - bMs;
    });
  }, [
    articles,
    bookmarks.bookmarkedArticles,
    journalFilter,
    filters,
    seenState.seenArticleIds,
    keywordsOnly,
    keywords.pattern,
  ]);

  const groupedEntries = useMemo(() => {
    const buckets: Record<RecencyBucket, Article[]> = {
      thisWeek: [],
      earlierThisMonth: [],
      older: [],
      undated: [],
    };
    for (const article of filteredSorted) {
      buckets[recencyBucket(article.publicationDate)].push(article);
    }
    const bucketOrder = filters.sort === "oldest" ? BUCKET_ORDER_OLDEST_FIRST : BUCKET_ORDER_NEWEST_FIRST;
    return bucketOrder.map((bucket) => [bucket, buckets[bucket]] as const).filter(
      ([, items]) => items.length > 0,
    );
  }, [filteredSorted, filters.sort]);

  /**
   * "Mark all seen" acts on what is currently listed, not on the whole feed.
   * Acting on everything regardless of filters would be the more surprising
   * of the two: someone who has filtered to one journal and clicks a button
   * sitting beside that filter means that journal.
   */
  const unseenInView = useMemo(
    () => filteredSorted.filter((article) => !seenState.seenArticleIds.has(article.id)),
    [filteredSorted, seenState.seenArticleIds],
  );

  /** Null when the unfiltered feed is shown, so the dialog can skip the qualifier. */
  const scopeLabel = useMemo(() => {
    const parts: string[] = [];
    if (filters.seen === "saved") parts.push("your saved articles");
    else if (filters.seen === "unseen") parts.push("unseen articles");
    if (journalFilter !== "all") {
      const journal = journalOptions.find((j) => j.id === journalFilter);
      if (journal) parts.push(journal.name);
    }
    if (filters.openAccessOnly) parts.push("Open Access only");
    if (filters.search.trim()) parts.push(`matching “${filters.search.trim()}”`);
    return parts.length > 0 ? parts.join(", ") : null;
  }, [filters, journalFilter, journalOptions]);

  /**
   * Adding a journal follows it in the same step: searching for one by name is
   * already the act of wanting it in the feed, and leaving it added-but-
   * unfollowed would mean nothing visibly happened.
   */
  const handleAddJournal = useCallback(
    (journal: JournalDefinition) => {
      journalLibrary.addJournal(journal);
      if (!watchlist.followedJournalIds.has(journal.id)) watchlist.toggleJournal(journal.id);
    },
    [journalLibrary, watchlist],
  );

  /** Removing also unfollows, so no orphaned id is left in the watchlist. */
  const handleRemoveJournal = useCallback(
    (id: string) => {
      if (watchlist.followedJournalIds.has(id)) watchlist.toggleJournal(id);
      journalLibrary.removeJournal(id);
    },
    [journalLibrary, watchlist],
  );

  const handleMarkAllSeen = useCallback(() => {
    seenState.markManySeen(unseenInView.map((article) => article.id));
    setMarkAllSeenOpen(false);
  }, [seenState, unseenInView]);

  const keywordMatchCount = useMemo(
    () =>
      keywords.pattern
        ? filteredSorted.filter((article) => articleMatchesKeywords(article, keywords.pattern))
            .length
        : 0,
    [filteredSorted, keywords.pattern],
  );

  const hasActiveFilters =
    filters.search !== "" ||
    filters.seen !== "all" ||
    filters.openAccessOnly ||
    filters.sort !== "newest" ||
    journalFilter !== "all";

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setJournalFilter("all");
  }, []);

  // Derived, not persisted — see Issue 3 in the Zhou remediation. Recomputes
  // from the full (unfiltered) article set for the current watchlist plus
  // the manually-maintained seen set, so it can never go stale and never
  // depends on scroll position, hover, or viewport.
  const continueState = useMemo(
    () => getContinueState(articles, seenState.seenArticleIds),
    [articles, seenState.seenArticleIds],
  );

  // Retries once `groupedEntries` changes (e.g. after clearFilters() re-renders
  // the list), since the target element may not exist in the DOM yet on the
  // same render that requested the scroll.
  useEffect(() => {
    if (!pendingScrollId) return;
    const id = pendingScrollId;
    const el = document.getElementById(`article-${id}`);
    if (!el) return;

    // Imperative DOM scroll plus the highlight state that accompanies it —
    // an external-system sync, not state derived from props/state.
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingScrollId(null);
    setHighlightedArticleId(id);
    const timer = setTimeout(
      () => setHighlightedArticleId((current) => (current === id ? null : current)),
      2500,
    );
    return () => clearTimeout(timer);
  }, [pendingScrollId, groupedEntries]);

  const handleContinue = useCallback(() => {
    if (continueState.kind !== "target") return;
    // The target may be hidden by an active search/seen-filter/OA/journal
    // filter — clear them first so it's guaranteed to be in the DOM to
    // scroll to.
    clearFilters();
    setPendingScrollId(continueState.article.id);
  }, [continueState, clearFilters]);

  const showLoading = !allReady || feedStatus === "loading";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        {/*
          `min-w-0` on the title column: without it a flex item will not shrink
          below its content width, so a long title plus three fixed-width
          controls overflowed the row on narrow screens. `gap-3` rather than
          `gap-4` buys back a little more of that width on a phone.
        */}
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-3 px-4 py-4 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              I-O/Quant Psych Research Feed
            </h1>
            <p className="text-sm text-muted-foreground">
              Your personalized research inbox, built by the STATS Lab at CMC.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <AccountButton open={accountOpen} onOpenChange={setAccountOpen} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInfoOpen(true)}
              aria-label="About this feed"
              className="shrink-0 gap-1.5 px-2 text-muted-foreground sm:px-3"
            >
              <Info className="h-3.5 w-3.5" />
              {/* Label hidden on a phone: three labelled controls squeezed the
                  title into three wrapped lines. The icon plus aria-label
                  carries the same meaning in a third of the width. */}
              <span className="hidden sm:inline">About</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {allReady && !firstRun.dismissed && <FirstRunNotice onDismiss={firstRun.dismiss} />}

        {feedStatus === "demo" && <DemoModeBanner unresolvedJournalCount={unresolvedJournalIds.length} />}

        {partial && filters.seen !== "saved" && (
          <PartialResultsBanner
            reason={partial.reason}
            onRetry={() => setReloadToken((t) => t + 1)}
          />
        )}

        {continueState.kind !== "hidden" && <ContinueBanner state={continueState} onContinue={handleContinue} />}

        <FeedStatusBar
          totalShown={filteredSorted.length}
          unseenCount={unseenCount}
          newSinceLastVisit={newSinceLastVisit}
          journalsFollowed={watchlist.followedCount}
        />

        {/*
          Zotero export requires an account. Signed out there is no control at
          all rather than one that explains why it cannot be used.

          When signed in but not yet connected, the button says so and opens
          the account dialog, where connecting lives — a button labelled for
          what it will actually do beats one that opens a dead end.
        */}
        {filters.seen === "saved" &&
          bookmarks.bookmarkedArticles.length > 0 &&
          auth.status === "signedIn" && (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => (zotero.isConnected ? setZoteroOpen(true) : setAccountOpen(true))}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                {zotero.isConnected ? "Send to Zotero" : "Connect Zotero"}
              </Button>
            </div>
          )}

        <FeedControls
          filters={filters}
          onFiltersChange={setFilters}
          journalFilter={journalFilter}
          onJournalFilterChange={setJournalFilter}
          journalOptions={journalOptions}
          onOpenJournalManager={() => setJournalManagerOpen(true)}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          onMarkAllSeen={() => setMarkAllSeenOpen(true)}
          markAllSeenCount={unseenInView.length}
          onOpenKeywords={() => setKeywordsOpen(true)}
          keywordCount={keywords.keywords.length}
          keywordsOnly={keywordsOnly}
          onKeywordsOnlyChange={setKeywordsOnly}
        />

        {showLoading ? (
          <LoadingState />
        ) : feedStatus === "error" && filters.seen !== "saved" ? (
          <ErrorState onRetry={() => setReloadToken((t) => t + 1)} />
        ) : filters.seen !== "saved" && watchlist.followedCount === 0 ? (
          <EmptyState
            title="No journals followed"
            description="Your watchlist is empty. Add journals to start seeing research in your feed."
            action={{ label: "Manage journals", onClick: () => setJournalManagerOpen(true) }}
          />
        ) : filters.seen === "saved" && bookmarks.bookmarkedArticles.length === 0 ? (
          <EmptyState
            title="No saved articles yet"
            description="Use the bookmark button on any article to save it here — even if you later unfollow its journal."
            icon={<Bookmark className="h-6 w-6" aria-hidden="true" />}
          />
        ) : groupedEntries.length === 0 ? (
          <EmptyState
            title="No articles match your filters"
            description="Try adjusting your search, seen status, or Open Access filter."
            action={{ label: "Clear filters", onClick: clearFilters }}
          />
        ) : (
          <div className="space-y-4">
            {groupedEntries.map(([bucket, items]) => (
              <section key={bucket} aria-label={RECENCY_BUCKET_LABELS[bucket]}>
                <DateGroupHeader label={RECENCY_BUCKET_LABELS[bucket]} count={items.length} />
                <div className="space-y-3">
                  {items.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      isSeen={seenState.seenArticleIds.has(article.id)}
                      isNew={isNewArticle(article)}
                      isBookmarked={bookmarks.isBookmarked(article.id)}
                      onToggleSeen={() => seenState.toggleSeen(article.id)}
                      onToggleBookmark={() => bookmarks.toggleBookmark(article)}
                      isContinueTarget={highlightedArticleId === article.id}
                      highlightPattern={keywords.highlightPattern}
                      matchPattern={keywordsOnly || keywords.highlight ? keywords.pattern : null}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <JournalManager
        open={journalManagerOpen}
        onOpenChange={setJournalManagerOpen}
        journals={journalLibrary.allJournals}
        followedJournalIds={watchlist.followedJournalIds}
        onToggleJournal={watchlist.toggleJournal}
        onSelectAll={watchlist.selectAll}
        onClearAll={watchlist.clearAll}
        onRestoreDefaults={watchlist.restoreDefaults}
        unresolvedJournalIds={unresolvedJournalIds}
        onAddJournal={handleAddJournal}
        onRemoveJournal={handleRemoveJournal}
      />

      <KeywordsDialog
        open={keywordsOpen}
        onOpenChange={setKeywordsOpen}
        matchCount={keywordMatchCount}
      />

      <MarkAllSeenDialog
        open={markAllSeenOpen}
        onOpenChange={setMarkAllSeenOpen}
        count={unseenInView.length}
        scopeLabel={scopeLabel}
        onConfirm={handleMarkAllSeen}
      />

      <ZoteroDialog
        open={zoteroOpen}
        onOpenChange={setZoteroOpen}
        savedArticles={bookmarks.bookmarkedArticles}
      />

      <InfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
    </div>
  );
}
