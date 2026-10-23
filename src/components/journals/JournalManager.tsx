"use client";

import { useCallback, useMemo, useState } from "react";
import { Search, AlertTriangle, Plus, Loader2, Trash2, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { JournalDefinition } from "@/lib/journals/catalog";
import { searchJournals, type JournalSearchResult } from "@/lib/openalex/sourceSearch";

const MIN_QUERY_LENGTH = 3;

interface JournalManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journals: JournalDefinition[];
  followedJournalIds: Set<string>;
  onToggleJournal: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onRestoreDefaults: () => void;
  unresolvedJournalIds: string[];
  /** Adds a journal found in OpenAlex and follows it. */
  onAddJournal: (journal: JournalDefinition) => void;
  /** Removes a user-added journal entirely. Built-in catalog entries cannot be removed. */
  onRemoveJournal: (id: string) => void;
}

type SearchState =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; results: JournalSearchResult[]; query: string }
  | { kind: "error"; message: string };

/** "1,981 articles" — a size signal, so an obscure namesake is distinguishable from the real journal. */
function formatWorks(count: number | null): string | null {
  if (count === null) return null;
  return `${count.toLocaleString()} article${count === 1 ? "" : "s"} indexed`;
}

export function JournalManager({
  open,
  onOpenChange,
  journals,
  followedJournalIds,
  onToggleJournal,
  onSelectAll,
  onClearAll,
  onRestoreDefaults,
  unresolvedJournalIds,
  onAddJournal,
  onRemoveJournal,
}: JournalManagerProps) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });

  const filteredJournals = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return journals;
    return journals.filter(
      (journal) =>
        journal.name.toLowerCase().includes(q) || journal.publisher?.toLowerCase().includes(q),
    );
  }, [journals, query]);

  const unresolvedSet = useMemo(() => new Set(unresolvedJournalIds), [unresolvedJournalIds]);
  const knownIds = useMemo(() => new Set(journals.map((journal) => journal.id)), [journals]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    setSearch({ kind: "searching" });
    try {
      const results = await searchJournals(trimmed);
      setSearch({ kind: "results", results, query: trimmed });
    } catch (error) {
      setSearch({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not reach OpenAlex.",
      });
    }
  }, [query]);

  const canSearch = query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage your journal watchlist</DialogTitle>
          <DialogDescription>
            Choose which journals appear in your feed, or add any journal indexed by OpenAlex.
            Changes apply immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Clear stale results directly rather than in an effect: this is
              // a response to typing, not a sync with an external system.
              setSearch({ kind: "idle" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredJournals.length === 0 && canSearch) {
                e.preventDefault();
                void runSearch();
              }
            }}
            placeholder="Search your journals, or any journal to add…"
            className="pl-8"
            aria-label="Search journals"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-foreground">
            {followedJournalIds.size} of {journals.length} followed
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onSelectAll} className="h-7 px-2 text-xs">
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearAll} className="h-7 px-2 text-xs">
              Clear all
            </Button>
            <Button variant="ghost" size="sm" onClick={onRestoreDefaults} className="h-7 px-2 text-xs">
              Restore defaults
            </Button>
          </div>
        </div>

        <Separator />

        <div className="max-h-80 overflow-y-auto pr-1">
          {filteredJournals.length === 0 && search.kind === "idle" ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                None of your journals match &ldquo;{query}&rdquo;.
              </p>
              {canSearch ? (
                <Button variant="secondary" size="sm" onClick={() => void runSearch()} className="gap-1.5">
                  <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                  Search OpenAlex for &ldquo;{query.trim()}&rdquo;
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Type at least {MIN_QUERY_LENGTH} characters to search OpenAlex for more journals.
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filteredJournals.map((journal) => {
                const isFollowed = followedJournalIds.has(journal.id);
                const isUnresolved = unresolvedSet.has(journal.id);
                return (
                  <li key={journal.id} className="group flex items-start gap-1">
                    <label className="flex flex-1 cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted">
                      <Checkbox
                        checked={isFollowed}
                        onCheckedChange={() => onToggleJournal(journal.id)}
                        className="mt-0.5"
                      />
                      <span className="flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{journal.name}</span>
                          {journal.isCustom && (
                            <Badge variant="muted" className="shrink-0 text-[10px]">
                              Added
                            </Badge>
                          )}
                        </span>
                        {journal.publisher && (
                          <span className="block text-xs text-muted-foreground">{journal.publisher}</span>
                        )}
                        {isUnresolved && (
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-primary">
                            <AlertTriangle className="h-3 w-3" />
                            Could not be matched to an OpenAlex source right now
                          </span>
                        )}
                      </span>
                    </label>
                    {/* Only user-added journals can be removed; the built-in
                        catalog is unfollowed rather than deleted. */}
                    {journal.isCustom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveJournal(journal.id)}
                        className="mt-1 h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={`Remove ${journal.name} from your journal list`}
                        title="Remove from your list"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* OpenAlex search results, below whatever the local list showed. */}
          {search.kind !== "idle" && (
            <div className="mt-3 space-y-2">
              <Separator />
              <p className="px-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                From OpenAlex
              </p>

              {search.kind === "searching" && (
                <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Searching…
                </p>
              )}

              {search.kind === "error" && (
                <p
                  role="alert"
                  className="mx-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-foreground"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  {search.message}
                </p>
              )}

              {search.kind === "results" && search.results.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  OpenAlex has no journal matching &ldquo;{search.query}&rdquo;. Try the full title
                  rather than an abbreviation.
                </p>
              )}

              {search.kind === "results" &&
                search.results.map((result) => {
                  const alreadyHave = knownIds.has(result.id);
                  const works = formatWorks(result.worksCount);
                  return (
                    <div
                      key={result.id}
                      className="flex items-start justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">{result.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[result.publisher, works].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <Button
                        variant={alreadyHave ? "ghost" : "secondary"}
                        size="sm"
                        disabled={alreadyHave}
                        onClick={() => onAddJournal(result)}
                        className="shrink-0 gap-1.5"
                      >
                        {alreadyHave ? (
                          "On your list"
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {filteredJournals.length > 0 && search.kind === "idle" && canSearch && (
            <Button variant="ghost" size="sm" onClick={() => void runSearch()} className="gap-1.5 text-muted-foreground">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              Not here? Search OpenAlex
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} className="sm:ml-auto">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
