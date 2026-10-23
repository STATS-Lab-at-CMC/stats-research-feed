"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PartialResultsBannerProps {
  /** OpenAlex's own explanation, when it gave one. */
  reason?: string;
  onRetry: () => void;
}

/**
 * Shown when a fetch returned real articles but stopped early.
 *
 * The app previously handled this case silently — it kept whatever arrived
 * and rendered a feed that looked complete. That is how OpenAlex's October
 * 2026 cursor-paging change went unnoticed while cutting a 319-article feed
 * to 100: nothing was broken on screen, there was just less of it. A short
 * feed is indistinguishable from a quiet week unless the app says otherwise.
 *
 * Deliberately not styled as an error. Nothing the reader did caused this,
 * the articles on screen are genuine, and the likely fix is on the operator's
 * side — so it is a caution, not a failure.
 */
export function PartialResultsBanner({ reason, onRetry }: PartialResultsBannerProps) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Showing only part of your feed
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            OpenAlex stopped returning results partway through, so there are more recent articles
            in your journals than appear below. What is shown is real and current — just
            incomplete.
          </p>
          {reason && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium">OpenAlex said:</span> {reason}
            </p>
          )}
        </div>
      </div>

      <Button variant="secondary" size="sm" onClick={onRetry} className="shrink-0 self-start">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
