"use client";

import { useMemo, useState } from "react";
import { Search, AlertTriangle } from "lucide-react";
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
import type { JournalDefinition } from "@/lib/journals/catalog";

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
}: JournalManagerProps) {
  const [query, setQuery] = useState("");

  const filteredJournals = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return journals;
    return journals.filter(
      (journal) =>
        journal.name.toLowerCase().includes(q) || journal.publisher?.toLowerCase().includes(q),
    );
  }, [journals, query]);

  const unresolvedSet = useMemo(() => new Set(unresolvedJournalIds), [unresolvedJournalIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage your journal watchlist</DialogTitle>
          <DialogDescription>
            Choose which journals appear in your feed. Changes apply immediately and are saved in
            this browser.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search journals…"
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
          {filteredJournals.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No journals match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filteredJournals.map((journal) => {
                const isFollowed = followedJournalIds.has(journal.id);
                const isUnresolved = unresolvedSet.has(journal.id);
                return (
                  <li key={journal.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted">
                      <Checkbox
                        checked={isFollowed}
                        onCheckedChange={() => onToggleJournal(journal.id)}
                        className="mt-0.5"
                      />
                      <span className="flex-1">
                        <span className="block font-medium text-foreground">{journal.name}</span>
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
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
