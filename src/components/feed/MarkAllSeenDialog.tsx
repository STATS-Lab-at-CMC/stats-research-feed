"use client";

import { CheckCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface MarkAllSeenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many of the currently-listed articles are not already seen. */
  count: number;
  /**
   * Plain-language description of what is currently listed, e.g.
   * "Journal of Applied Psychology" or "matching your search". Null when the
   * full feed is shown and no qualifier is needed.
   */
  scopeLabel: string | null;
  onConfirm: () => void;
}

/**
 * Confirmation for the one bulk action in the app.
 *
 * Marking a feed seen is cheap to do and expensive to undo: the only way back
 * is to find each article and unmark it individually, and after the fact there
 * is no record of which ones were already seen beforehand. That asymmetry is
 * what earns a confirmation step here when nothing else in the app has one.
 *
 * The dialog states the exact number and the exact scope rather than asking
 * "are you sure?", because the real risk is not misclicking the button — it is
 * not realising a filter is active, and marking a different set than intended.
 */
export function MarkAllSeenDialog({
  open,
  onOpenChange,
  count,
  scopeLabel,
  onConfirm,
}: MarkAllSeenDialogProps) {
  const plural = count === 1 ? "article" : "articles";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Mark {count} {plural} as seen?
          </DialogTitle>
          <DialogDescription>
            {scopeLabel ? (
              <>
                This applies to what is currently listed —{" "}
                <span className="font-medium text-foreground">{scopeLabel}</span> — not your whole
                feed.
              </>
            ) : (
              <>This is everything currently in your feed.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            Seen articles stay in your feed and remain fully readable — they just stop counting as
            unread and lose their unread marker.
          </p>
          <p>
            <span className="font-medium text-foreground">There is no undo.</span> Reversing this
            means unmarking each article one at a time, and afterwards there is no record of which
            ones you had already read.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} className="gap-1.5">
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark {count} {plural} as seen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
