"use client";

import { useState } from "react";
import { AlertCircle, Check, ExternalLink, Library, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useZoteroKey } from "@/hooks/useZoteroKey";
import { verifyZoteroKey } from "@/lib/zotero/client";

export const ZOTERO_KEYS_URL = "https://www.zotero.org/settings/keys/new";

type State = { kind: "idle" } | { kind: "checking" } | { kind: "error"; message: string };

/**
 * Connect/disconnect UI for a Zotero library, shown inside the account dialog.
 *
 * It lives there rather than inside the send dialog because it is a standing
 * setting, not a step in an export: you connect once and then forget about it.
 * Asking for a credential at the moment someone is trying to do something else
 * is both worse UX and a worse habit to teach — a sign-in-shaped prompt
 * appearing mid-task is exactly the pattern phishing relies on.
 */
export function ZoteroKeySection() {
  const zotero = useZoteroKey();
  const [keyInput, setKeyInput] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [resetting, setResetting] = useState(false);

  async function handleConnect(event: React.FormEvent) {
    event.preventDefault();
    const key = keyInput.trim();
    if (!key || state.kind === "checking") return;

    setState({ kind: "checking" });
    try {
      const who = await verifyZoteroKey(key);
      if (!who.canWrite) {
        setState({
          kind: "error",
          message:
            "That key can read your library but not write to it. Create a new one with “Allow write access” ticked.",
        });
        return;
      }
      zotero.connect(key, who);
      setKeyInput("");
      setState({ kind: "idle" });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not reach Zotero.",
      });
    }
  }

  if (zotero.isConnected) {
    return (
      <div className="space-y-2">
        {resetting && (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm leading-relaxed text-foreground">
              Forget that {zotero.exportedCount}{" "}
              {zotero.exportedCount === 1 ? "article has" : "articles have"} been exported? They
              stay in Zotero — this only means a future export will send them again, creating
              duplicates unless you removed them there first.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" size="sm" onClick={() => setResetting(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  zotero.clearSentHistory();
                  setResetting(false);
                }}
              >
                Forget export history
              </Button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
            <span className="truncate">
              Connected to{" "}
              <span className="font-medium text-foreground">{zotero.identity?.username}</span>
            </span>
          </span>
          <Button variant="ghost" size="sm" onClick={zotero.disconnect} className="shrink-0">
            Disconnect
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Export saved articles from the <span className="font-medium text-foreground">Saved</span>{" "}
          tab. Disconnecting removes the key from this browser; it changes nothing in Zotero, and
          your export history is kept so reconnecting does not re-send everything.
        </p>

        {zotero.exportedCount > 0 && !resetting && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              {zotero.exportedCount} already exported
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetting(true)}
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              title="Only needed when switching to a different Zotero library"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleConnect} className="space-y-2">
      <Input
        id="zotero-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="Paste your Zotero API key"
        value={keyInput}
        onChange={(event) => setKeyInput(event.target.value)}
        aria-label="Zotero API key"
        aria-describedby="zotero-key-hint"
      />

      {state.kind === "error" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={state.kind === "checking" || !keyInput.trim()}>
          {state.kind === "checking" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Checking…
            </>
          ) : (
            <>
              <Library className="h-3.5 w-3.5" aria-hidden="true" />
              Connect
            </>
          )}
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={ZOTERO_KEYS_URL} target="_blank" rel="noopener noreferrer" className="gap-1.5">
            Get a key
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>

      <p id="zotero-key-hint" className="text-xs leading-relaxed text-muted-foreground">
        Tick <span className="font-medium text-foreground">Allow write access</span> when creating
        the key. It is stored in this browser only — never uploaded here and never synced to your
        account, because a Zotero key can alter or delete an entire library. You will need to enter
        it again on another device.
      </p>
    </form>
  );
}
