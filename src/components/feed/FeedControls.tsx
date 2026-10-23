"use client";

import { Search, X, Settings2, CheckCheck, Tag } from "lucide-react";
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

        <div className="flex items-center gap-2">
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

        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <select
            value={journalFilter}
            onChange={(e) => onJournalFilterChange(e.target.value)}
            className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Filter by journal"
          >
            <option value="all">All journals</option>
            {journalOptions.map((journal) => (
              <option key={journal.id} value={journal.id}>
                {journal.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <select
            value={filters.sort}
            onChange={(e) => onFiltersChange({ ...filters, sort: e.target.value as FeedFilterState["sort"] })}
            className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Sort order"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
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
