"use client";

import { useCallback, useState } from "react";
import { AlertCircle, Loader2, Upload } from "lucide-react";
import type { Article } from "@/lib/types";
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
import { useZoteroKey } from "@/hooks/useZoteroKey";
import { sendArticlesToZotero, type ZoteroSendResult } from "@/lib/zotero/client";

interface ZoteroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedArticles: Article[];
}

type Phase =
  | { kind: "idle" }
  | { kind: "sending"; total: number }
  | { kind: "done"; result: ZoteroSendResult }
  | { kind: "error"; message: string };

/**
 * Export-only. Connecting a library lives in the account dialog, because it is
 * a standing setting rather than a step in an export — and because asking for
 * a credential in the middle of another task is both worse UX and a worse
 * habit to teach.
 *
 * This dialog is only reachable once a library is connected, so it can use the
 * stored identity instead of re-verifying the key on every send. A key revoked
 * in the meantime surfaces as a 403 on the write, which is handled.
 */
export function ZoteroDialog({ open, onOpenChange, savedArticles }: ZoteroDialogProps) {
  const zotero = useZoteroKey();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const unsent = savedArticles.filter((article) => !zotero.hasSent(article.id));
  const alreadySent = savedArticles.length - unsent.length;
  const pdfCount = unsent.filter((article) => article.pdfUrl).length;

  const handleSend = useCallback(async () => {
    if (!zotero.identity || unsent.length === 0) return;

    setPhase({ kind: "sending", total: unsent.length });
    try {
      const result = await sendArticlesToZotero(zotero.apiKey, zotero.identity.userId, unsent);
      const failedIds = new Set(result.failures.map((f) => f.article.id));
      zotero.markSent(unsent.filter((a) => !failedIds.has(a.id)).map((a) => a.id));
      setPhase({ kind: "done", result });
    } catch (error) {
      setPhase({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not reach Zotero.",
      });
    }
  }, [zotero, unsent]);

  const sending = phase.kind === "sending";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPhase({ kind: "idle" });
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {phase.kind === "done" ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {phase.result.created > 0
                  ? `Added ${phase.result.created} to Zotero`
                  : "Nothing new to add"}
              </DialogTitle>
              <DialogDescription>
                {phase.result.created > 0 ? (
                  <>
                    They are in{" "}
                    <span className="font-medium text-foreground">
                      {zotero.identity?.username ?? "your library"}
                    </span>
                    , tagged &ldquo;I-O/Quant Psych Research Feed&rdquo;
                    {phase.result.pdfsLinked > 0 && (
                      <>
                        , with{" "}
                        <span className="font-medium text-foreground">
                          {phase.result.pdfsLinked}
                        </span>{" "}
                        full-text PDF {phase.result.pdfsLinked === 1 ? "link" : "links"} attached
                      </>
                    )}
                    .
                  </>
                ) : (
                  <>Every saved article has already been sent from this browser.</>
                )}
              </DialogDescription>
            </DialogHeader>

            {phase.result.failures.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                    {phase.result.failures.length} could not be added
                  </p>
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto text-sm text-muted-foreground">
                    {phase.result.failures.map(({ article, reason }) => (
                      <li key={article.id}>
                        <span className="text-foreground">{article.title}</span> — {reason}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    These stay in your saved list and will be retried next time.
                  </p>
                </div>
              </>
            )}

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Send saved articles to Zotero</DialogTitle>
              <DialogDescription>
                Adds them to{" "}
                <span className="font-medium text-foreground">{zotero.identity?.username}</span> as
                journal articles, with authors, abstract, DOI, and link.
              </DialogDescription>
            </DialogHeader>

            <Separator />

            <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  {unsent.length} {unsent.length === 1 ? "article" : "articles"}
                </span>{" "}
                will be sent
                {alreadySent > 0 && <> — {alreadySent} already sent from this browser</>}.
              </p>
              <p className="text-xs">
                Items arrive tagged &ldquo;I-O/Quant Psych Research Feed&rdquo;, so they are easy to
                find or remove in bulk later.
              </p>
              {pdfCount > 0 && (
                <p className="text-xs">
                  {pdfCount} of them {pdfCount === 1 ? "has" : "have"} a free full-text PDF, which
                  will be attached as a link on the Zotero item. The file itself stays with the
                  publisher, so it uses none of your Zotero storage.
                </p>
              )}
            </div>

            {phase.kind === "error" && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-foreground"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                {phase.message}
              </p>
            )}

            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={() => void handleSend()} disabled={sending || unsent.length === 0} className="gap-1.5">
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Sending {phase.total}…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Send {unsent.length > 0 ? unsent.length : ""} to Zotero
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
