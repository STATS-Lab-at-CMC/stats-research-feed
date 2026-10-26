"use client";

import { useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useKeywords } from "@/hooks/useKeywords";

interface KeywordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many of the currently listed articles match, so the effect is visible before closing. */
  matchCount: number;
}

/**
 * Manage watched terms.
 *
 * Deliberately starts empty. Keywords are specific to someone's own research,
 * and a default set would be guessing at their field — worse, it would make
 * the highlight look broken rather than unconfigured.
 */
export function KeywordsDialog({ open, onOpenChange, matchCount }: KeywordsDialogProps) {
  const { keywords, highlight, setHighlight, addKeyword, removeKeyword, clearKeywords } =
    useKeywords();
  const [draft, setDraft] = useState("");

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    addKeyword(draft);
    setDraft("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keywords</DialogTitle>
          <DialogDescription>
            Terms you want to spot in the feed. Each one is matched against an article&apos;s
            title, its abstract, and the keywords OpenAlex assigns it — so a paper can match on
            its subject even when it never uses your word. Matches are highlighted, and the feed
            can be filtered down to them.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="e.g. calling, leader emergence, measurement invariance"
            aria-label="Add a keyword"
          />
          <Button type="submit" size="sm" disabled={!draft.trim()} className="shrink-0 gap-1.5">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </Button>
        </form>

        {/*
          Says what the matcher actually does, with the two cases people get
          caught by. Whole-word matching is the right default — substrings
          would make "fit" hit every "benefit" — but it has no stemming, and
          nothing on screen would otherwise reveal that a plural is a
          different term.
        */}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Whole words, any capitalisation, and no stemming:{" "}
          <span className="font-medium text-foreground">leader</span> does not find{" "}
          <span className="font-medium text-foreground">leaders</span>, and{" "}
          <span className="font-medium text-foreground">meta-analysis</span> does not find{" "}
          <span className="font-medium text-foreground">meta-analytic</span> — add both forms if
          you want both. Partial words never match, so{" "}
          <span className="font-medium text-foreground">calling</span> skips
          &ldquo;recalling&rdquo;. Phrases and hyphens work as typed.
        </p>

        {keywords.length > 0 ? (
          <div className="space-y-2">
            <ul className="flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <li key={keyword}>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 py-1 pl-2.5 pr-1 text-sm text-foreground">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Remove keyword ${keyword}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {matchCount === 0
                ? "Nothing currently listed matches these."
                : `${matchCount} of the articles currently listed ${matchCount === 1 ? "matches" : "match"}.`}
            </p>
          </div>
        ) : (
          <p className="py-2 text-sm leading-relaxed text-muted-foreground">
            No keywords yet. Add terms you follow — a construct, a method, a phenomenon — and they
            will stand out wherever they appear.
          </p>
        )}

        <Separator />

        <label className="flex items-start justify-between gap-4">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium text-foreground">
              Highlight matches in the feed
            </span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              Stays on this device — it changes how the page looks, not what your account holds.
            </span>
          </span>
          <Switch
            checked={highlight}
            onCheckedChange={setHighlight}
            aria-label="Highlight keyword matches in the feed"
            className="mt-0.5 shrink-0"
          />
        </label>

        <DialogFooter className="sm:justify-between">
          {keywords.length > 0 ? (
            <Button variant="ghost" onClick={clearKeywords} className="text-muted-foreground">
              Remove all
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => onOpenChange(false)} className="gap-1.5">
            <Tag className="h-4 w-4" aria-hidden="true" />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
