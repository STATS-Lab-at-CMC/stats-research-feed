"use client";

import { useCallback, useState } from "react";
import { AlertCircle, Check, ExternalLink, Loader2, Upload } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useZoteroKey } from "@/hooks/useZoteroKey";
import {
  sendArticlesToZotero,
  verifyZoteroKey,
  type ZoteroIdentity,
  type ZoteroSendResult,
} from "@/lib/zotero/client";

const ZOTERO_KEYS_URL = "https://www.zotero.org/settings/keys/new";

interface ZoteroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedArticles: Article[];
}

type Phase =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "sending"; total: number }
  | { kind: "done"; result: ZoteroSendResult }
  | { kind: "error"; message: string };

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-secondary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

export function ZoteroDialog({ open, onOpenChange, savedArticles }: ZoteroDialogProps) {
  const zotero = useZoteroKey();
  const [keyInput, setKeyInput] = useState("");
  const [identity, setIdentity] = useState<ZoteroIdentity | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const unsent = savedArticles.filter((article) => !zotero.hasSent(article.id));
  const alreadySent = savedArticles.length - unsent.length;

  const handleSend = useCallback(async () => {
    const key = zotero.apiKey || keyInput.trim();
    if (!key) return;

    setPhase({ kind: "verifying" });
    try {
      const who = await verifyZoteroKey(key);
      setIdentity(who);

      if (!who.canWrite) {
        setPhase({
          kind: "error",
          message:
            "That key can read your library but not write to it. Create a new key with “Allow write access” ticked.",
        });
        return;
      }

      // Only persist once Zotero has confirmed it works, so a typo is never
      // stored and silently reused.
      zotero.saveKey(key);

      if (unsent.length === 0) {
        setPhase({ kind: "done", result: { created: 0, failures: [] } });
        return;
      }

      setPhase({ kind: "sending", total: unsent.length });
      const result = await sendArticlesToZotero(key, who.userId, unsent);

      const failedIds = new Set(result.failures.map((f) => f.article.id));
      zotero.markSent(unsent.filter((a) => !failedIds.has(a.id)).map((a) => a.id));

      setPhase({ kind: "done", result });
    } catch (error) {
      setPhase({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not reach Zotero.",
      });
    }
  }, [zotero, keyInput, unsent]);

  const busy = phase.kind === "verifying" || phase.kind === "sending";

  function reset() {
    setPhase({ kind: "idle" });
    setKeyInput("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
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
                      {identity?.username ?? "your library"}
                    </span>
                    , tagged “I-O/Quant Psych Research Feed”.
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
                Adds your saved articles to your personal Zotero library as journal articles, with
                authors, abstract, DOI, and link.
              </DialogDescription>
            </DialogHeader>

            <Separator />

            {!zotero.hasKey && (
              <div className="space-y-2">
                <label htmlFor="zotero-key" className="text-sm font-medium text-foreground">
                  Zotero API key
                </label>
                <Input
                  id="zotero-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Paste your key"
                  value={keyInput}
                  onChange={(event) => setKeyInput(event.target.value)}
                  aria-describedby="zotero-key-hint"
                />
                <p id="zotero-key-hint" className="text-xs leading-relaxed text-muted-foreground">
                  Create one at{" "}
                  <TextLink href={ZOTERO_KEYS_URL}>zotero.org/settings/keys</TextLink> with{" "}
                  <span className="font-medium text-foreground">Allow write access</span> ticked.
                </p>
              </div>
            )}

            {zotero.hasKey && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-secondary" aria-hidden="true" />
                  Zotero key saved in this browser
                </span>
                <Button variant="ghost" size="sm" onClick={zotero.forgetKey} disabled={busy}>
                  Remove
                </Button>
              </div>
            )}

            <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  {unsent.length} {unsent.length === 1 ? "article" : "articles"}
                </span>{" "}
                will be sent
                {alreadySent > 0 && <> — {alreadySent} already sent from this browser</>}.
              </p>
              <p className="text-xs">
                Your key is stored only in this browser. It is never uploaded to this site or synced
                to your account, so you will need to enter it again on another device.
              </p>
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
              <Button variant="ghost" asChild>
                <a href={ZOTERO_KEYS_URL} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                  Get a key
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button
                onClick={() => void handleSend()}
                disabled={busy || (!zotero.hasKey && keyInput.trim().length === 0)}
                className="gap-1.5"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {phase.kind === "verifying" ? "Checking key…" : `Sending ${phase.total}…`}
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
