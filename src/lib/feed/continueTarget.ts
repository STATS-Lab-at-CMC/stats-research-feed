import type { Article } from "@/lib/types";
import { parseDateMs } from "@/lib/utils/date";

/**
 * "Continue where you left off" state, computed fresh on every render rather
 * than persisted — see Issue 3 in the Zhou remediation: a stored scroll/
 * viewport position could never reflect manual seen/unseen changes made
 * without scrolling, so it's derived instead.
 *
 * The rule: the first unseen article in a fixed, newest-first chronological
 * order across the currently followed journals. This is deliberately
 * independent of the user's current sort toggle (oldest/newest) and of any
 * transient UI filter (search, seen/unseen tab, Open Access, per-journal
 * dropdown) — those are view preferences, not a redefinition of "what's next
 * to read." `articles` should be the full set for the current watchlist,
 * unfiltered by those transient controls; `seenIds` is the persisted
 * seen-article-id set. Because both inputs are live state, this recomputes
 * correctly whenever the watchlist changes or new articles arrive — there is
 * nothing to go stale.
 *
 * - `hidden`: nothing has been marked seen yet, so there's nothing to resume.
 * - `caught-up`: every currently-followed article is seen.
 * - `target`: points to the first unseen article, newest-first.
 */
export type ContinueState =
  | { kind: "hidden" }
  | { kind: "caught-up" }
  | { kind: "target"; article: Article };

export function getContinueState(articles: Article[], seenIds: ReadonlySet<string>): ContinueState {
  if (seenIds.size === 0) return { kind: "hidden" };

  const unseen = articles.filter((article) => !seenIds.has(article.id));
  if (unseen.length === 0) return { kind: "caught-up" };

  const sorted = [...unseen].sort((a, b) => {
    const aMs = parseDateMs(a.publicationDate) ?? -Infinity;
    const bMs = parseDateMs(b.publicationDate) ?? -Infinity;
    return bMs - aMs; // fixed newest-first, regardless of the feed's current sort toggle
  });

  return { kind: "target", article: sorted[0] };
}
