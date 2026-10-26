"use client";

import { Search, X, Settings2, CheckCheck, Tag, ChevronDown } from "lucide-react";
import type { FeedFilterState, FeedSeenFilter } from "@/lib/types";
import type { JournalDefinition } from "@/lib/journals/catalog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils/cn";

interface FeedControlsProps {
  filters: FeedFilterState;
  onFiltersChange: (next: FeedFilterState) => void;
  journalFilter: string;
  onJournalFilterChange: (id: string) => void;
  journalOptions: JournalDefinition[];
  onOpenJournalManager: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  onMarkAllSeen: () => void;
  /** Unseen articles among those currently listed. The control hides at zero. */
  markAllSeenCount: number;
  onOpenKeywords: () => void;
  keywordCount: number;
  /** Only shown once keywords exist — a filter for nothing is just a dead switch. */
  keywordsOnly: boolean;
  onKeywordsOnlyChange: (next: boolean) => void;
}

const SEEN_OPTIONS: { value: FeedSeenFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unseen", label: "Unseen" },
  { value: "seen", label: "Seen" },
  { value: "saved", label: "Saved" },
];

/**
 * A native select draws its own arrow, and the browser decides where — tight
 * against the right border, ignoring the element's padding. `appearance-none`
 * removes it so this one can sit where the rest of the control's spacing says
 * it should.
 *
 * `pointer-events-none` so clicks fall through to the select underneath;
 * without it the arrow would be the one part of the control that does not open
 * the menu. Colour comes from a token rather than a background-image data URI,
 * which is what keeps it correct in both themes.
 */
function SelectChevron() {
  return (
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
    />
  );
}

/**
 * `pr-8` leaves room for the chevron above: 32px of text padding against an
 * arrow that ends 24px from the edge, so the label never runs underneath it.
 */
const SELECT_CLASS =
  "h-8 appearance-none rounded-md border border-input bg-card py-0 pl-2.5 pr-8 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FeedControls({
  filters,
  onFiltersChange,
  journalFilter,
  onJournalFilterChange,
  journalOptions,
  onOpenJournalManager,
  onClearFilters,
  hasActiveFilters,
  onMarkAllSeen,
  markAllSeenCount,
  onOpenKeywords,
  keywordCount,
  keywordsOnly,
  onKeywordsOnlyChange,
}: FeedControlsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search titles, authors, abstracts…"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-8"
            aria-label="Search articles"
          />
        </div>

        {/*
          `flex-wrap` is load-bearing on a phone. These buttons are
          whitespace-nowrap and there can be four of them; without wrapping the
          row is wider than a 375px viewport and pushes the whole page into
          horizontal scroll — which is what was actually overflowing, measured,
          rather than the journal select below it.
        */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden rather than disabled when nothing is unseen: a disabled
              control invites clicking to find out why. */}
          {markAllSeenCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onMarkAllSeen}
              className="gap-1.5"
              title={`Mark ${markAllSeenCount} listed ${markAllSeenCount === 1 ? "article" : "articles"} as seen`}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all seen
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onOpenKeywords} className="gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Keywords
            {keywordCount > 0 && (
              <span className="rounded bg-muted px-1 text-[11px] font-semibold text-foreground">
                {keywordCount}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenJournalManager} className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Manage journals
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1.5 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          role="group"
          aria-label="Filter by seen status"
          className="inline-flex overflow-hidden rounded-md border border-input"
        >
          {SEEN_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filters.seen === option.value}
              onClick={() => onFiltersChange({ ...filters, seen: option.value })}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:z-10",
                filters.seen === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/*
          A native select sizes itself to its widest option, and the widest here
          is "Organizational Behavior and Human Decision Processes". Unconstrained
          that is wider than a phone, so it pushed the whole page into horizontal
          overflow — which is also why the header's left padding looked wrong: the
          page could scroll sideways out from under it.

          Full width on mobile, capped on larger screens. `min-w-0` is what
          actually lets it shrink; a flex item defaults to min-width:auto and
          would otherwise refuse to go below its content width.
        */}
        <label className="relative flex w-full min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground sm:w-auto">
          <select
            value={journalFilter}
            onChange={(e) => onJournalFilterChange(e.target.value)}
            className={cn(SELECT_CLASS, "w-full min-w-0 truncate sm:w-auto sm:max-w-[16rem]")}
            aria-label="Filter by journal"
          >
            <option value="all">All journals</option>
            {journalOptions.map((journal) => (
              <option key={journal.id} value={journal.id}>
                {journal.name}
              </option>
            ))}
          </select>
          <SelectChevron />
        </label>

        <label className="relative flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <select
            value={filters.sort}
            onChange={(e) => onFiltersChange({ ...filters, sort: e.target.value as FeedFilterState["sort"] })}
            className={cn(SELECT_CLASS, "max-w-full")}
            aria-label="Sort order"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <SelectChevron />
        </label>

        {keywordCount > 0 && (
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Switch
              checked={keywordsOnly}
              onCheckedChange={onKeywordsOnlyChange}
              aria-label="Show only articles matching your keywords"
            />
            Keyword matches only
          </label>
        )}

        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Switch
            checked={filters.openAccessOnly}
            onCheckedChange={(checked) => onFiltersChange({ ...filters, openAccessOnly: checked })}
            aria-label="Show only open access articles"
          />
          Open Access only
        </label>
      </div>
    </div>
  );
}
