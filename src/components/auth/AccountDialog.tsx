"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CloudOff,
  Eye,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Send,
} from "lucide-react";
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
import { useAuth } from "@/lib/auth/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Digest } from "@/lib/digest/compose";
import { digestSubject, renderDigestHtml } from "@/lib/digest/render";
import { ZoteroKeySection } from "@/components/zotero/ZoteroKeySection";
import { useDigestPreference } from "@/hooks/useDigestPreference";

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

/** "just now" / "6 minutes ago" / a wall-clock time for anything older than an hour. */
function formatLastSynced(ms: number | null): string {
  if (ms === null) return "not yet";
  const elapsed = Date.now() - ms;
  if (elapsed < 45_000) return "just now";
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * Shown to someone who is already signed in: the complete list of what leaves
 * this browser, including the Zotero bookkeeping and the explicit note that
 * the key is not part of it.
 */
function WhatSyncs() {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
      <p>An account carries these between your devices:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>The journals on your watchlist</li>
        <li>Which articles you have marked seen</li>
        <li>Your saved articles</li>
        <li>
          Which articles you have already sent to Zotero — so a second device does not send them
          again
        </li>
      </ul>
      <p>
        Those four, plus the email address you sign in with. Nothing else is uploaded: your
        searches, filters, and cached article data stay in this browser, exactly as they do without
        an account.
      </p>
      <p>
        <span className="font-medium text-foreground">Your Zotero API key is not included.</span>{" "}
        Only the list of what was sent is stored — the key itself never leaves the browser you
        typed it into.
      </p>
    </div>
  );
}

/**
 * Shown before signing in, where the job is different: say what an account is
 * *for*, not catalogue what it stores.
 *
 * It deliberately omits the Zotero key caveat that the signed-in version
 * carries. Someone who has no account has no key and nowhere to put one, so
 * reassurance about how that key is handled reads as a reference to a feature
 * that does not appear anywhere on screen.
 */
function WhyAnAccount() {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
      <p>An account carries these between your devices:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>The journals on your watchlist</li>
        <li>Which articles you have marked seen</li>
        <li>Your saved articles</li>
      </ul>
      <p>
        <span className="font-medium text-foreground">It also unlocks Zotero export.</span> Send
        your saved articles straight into your Zotero library as proper references — authors,
        abstract, DOI, link, and a full-text PDF where one is freely available. You can connect a
        library from this menu once you are signed in.
      </p>
      <p>
        Nothing else is uploaded: your searches, filters, and cached article data stay in this
        browser, exactly as they do now.
      </p>
    </div>
  );
}

/**
 * Code entry for the "check your email" step.
 *
 * Offered alongside the link rather than instead of it, and placed first,
 * because for institutional addresses the code is the path that actually
 * works: mail security systems routinely open inbound links before the reader
 * does, which spends a single-use link, while a code typed by hand
 * cannot be consumed by anything.
 */
/**
 * Digits only, so "123 456" and "123-456" count as six rather than seven or
 * eight. Six is Supabase's shortest possible OTP, so it is the floor for
 * "has the person finished typing", not an expected length.
 */
function digitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

function CodeEntry({ email, onSignedIn }: { email: string; onSignedIn: () => void }) {
  const { verifyCode } = useAuth();
  const [code, setCode] = useState("");
  const [state, setState] = useState<SendState>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (digitCount(code) < 6 || state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      await verifyCode(email, code);
      onSignedIn();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "That code did not work.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="signin-code" className="text-sm font-medium text-foreground">
        Enter the code from the email
      </label>
      <div className="flex items-center gap-2">
        <Input
          id="signin-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          /*
           * Long enough for Supabase's maximum OTP (10 digits) plus any
           * spaces or hyphens someone pastes along with it.
           *
           * This was 7, sized for a 6-digit code and one separator — which
           * silently truncated the 8-digit codes this project actually
           * issues. The length is a Supabase setting that can be changed in
           * a dashboard this code knows nothing about, so the input must not
           * assume one: `verifyCode` strips the separators and the server
           * decides whether the code is right.
           */
          maxLength={14}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.replace(/[^\d\s-]/g, ""));
            setState({ kind: "idle" });
          }}
          className="font-mono tracking-[0.3em]"
          aria-describedby="signin-code-hint"
        />
        <Button type="submit" disabled={state.kind === "sending" || digitCount(code) < 6}>
          {state.kind === "sending" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Checking…
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Sign in
            </>
          )}
        </Button>
      </div>

      {state.kind === "error" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <p id="signin-code-hint" className="text-xs text-muted-foreground">
        The code works even if the link does not &mdash; some mail systems open links before you
        do, which uses them up.
      </p>
    </form>
  );
}

function SignInPanel({ onClose }: { onClose: () => void }) {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [send, setSend] = useState<SendState>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || send.kind === "sending") return;
    setSend({ kind: "sending" });
    try {
      await sendMagicLink(email);
      setSend({ kind: "sent" });
    } catch (error) {
      setSend({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not send the link.",
      });
    }
  }

  if (send.kind === "sent") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Check your email</DialogTitle>
          <DialogDescription>
            A sign-in link was requested for{" "}
            <span className="font-medium text-foreground">{email.trim()}</span>.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <CodeEntry email={email.trim()} onSignedIn={onClose} />

        <Separator />

        {/*
          Deliberately says "requested", not "sent".
          The server accepts the request and returns success *before* the
          message is handed to a mail provider, so a delivery failure happens
          after this screen is already showing. The app genuinely cannot know
          whether the mail went out, and claiming it did turns a
          misconfiguration into an invisible one — which is exactly what
          happened on first setup, when the built-in sender silently refused
          an address that was not on the project's team.
        */}
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            The email also contains a link. Opening it signs you in too — it works once and expires
            after an hour.
          </p>
          <p className="font-medium text-foreground">If nothing arrives within a few minutes:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Check your spam or quarantine folder — institutional filters often hold automated
              sign-in mail.</li>
            <li>
              <span className="font-medium text-foreground">Try a personal address instead</span>{" "}
              — Gmail, Outlook.com, iCloud. A university gateway refusing the mail outright is
              the commonest reason nothing arrives, and no setting on this site can get past it.
              Each address is its own account, though, with its own watchlist.
            </li>
            <li>
              If the link says it is invalid or expired, a mail scanner opened it first — use the
              code above instead, which cannot be consumed that way.
            </li>
            <li>
              If this site was set up recently, its mail provider may not be configured yet. Until
              one is, sign-in emails can be silently dropped no matter what this screen says — the
              site&apos;s operator can confirm in their auth logs.
            </li>
          </ul>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => setSend({ kind: "idle" })}>
            Use a different email
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Sign in to sync your feed</DialogTitle>
        <DialogDescription>
          Optional. The feed works fully without one — an account lets your watchlist and reading
          history follow you to another device, and unlocks sending saved articles to Zotero.
        </DialogDescription>
      </DialogHeader>

      <Separator />

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="account-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="account-email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@university.edu"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby="account-email-hint"
          />
          <p id="account-email-hint" className="text-xs text-muted-foreground">
            No password — we email you a link and a code that sign you in. University mail
            systems sometimes block automated sign-in mail, so a personal address is often more
            reliable.
          </p>
        </div>

        {send.kind === "error" && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-foreground"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            {send.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={send.kind === "sending"}>
          {send.kind === "sending" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Send me a sign-in link
            </>
          )}
        </Button>
      </form>

      <Separator />

      <WhyAnAccount />

      <p className="text-sm leading-relaxed text-muted-foreground">
        If you already have a watchlist and reading history in this browser, signing in for the
        first time keeps it and copies it up to your new account.
      </p>
    </>
  );
}

function SyncStatusLine() {
  const { sync, refresh } = useAuth();
  const [, forceRender] = useState(0);

  // "synced 3 minutes ago" would otherwise sit frozen at "just now".
  useEffect(() => {
    const timer = setInterval(() => forceRender((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const isBusy = sync.status === "syncing";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-secondary" aria-hidden="true" />
              Syncing…
            </>
          ) : sync.status === "error" ? (
            <>
              <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
              Sync problem
            </>
          ) : (
            <>
              <Check className="h-4 w-4 text-secondary" aria-hidden="true" />
              Synced {formatLastSynced(sync.lastSyncedAt)}
            </>
          )}
        </span>

        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={isBusy}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Sync now
        </Button>
      </div>

      {sync.pendingWrites > 0 && (
        <p className="text-xs text-muted-foreground">
          {sync.pendingWrites} change{sync.pendingWrites === 1 ? "" : "s"} still uploading.
        </p>
      )}

      {sync.status === "error" && sync.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <span>
            {sync.error} Your changes are still saved in this browser — nothing has been lost.
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * Opt-in for the weekly email.
 *
 * Off until switched on, and the copy says what arriving mail will look like
 * before anyone agrees to receive it — day, contents, and the fact that a
 * quiet week still sends rather than going silent and looking broken.
 */
type TestSendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; to: string; articleCount: number }
  | { kind: "error"; message: string; blockers?: string[] };

/**
 * Sends one real digest to the signed-in address.
 *
 * The preview proves the email is right; this proves it arrives, which is a
 * different question and the one that university mail gateways tend to answer
 * badly. Sending to yourself is the only honest test of it, and the endpoint
 * will not send anywhere else.
 */
function DigestTestSend() {
  const [state, setState] = useState<TestSendState>({ kind: "idle" });

  async function send() {
    setState({ kind: "sending" });

    const client = getSupabaseClient();
    const { data } = (await client?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) {
      setState({ kind: "error", message: "Your session expired. Sign in again." });
      return;
    }

    try {
      const response = await fetch("/api/digest/test-send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        sentTo?: string;
        articleCount?: number;
        error?: string;
      };

      if (!response.ok || !body.sentTo) {
        // A failed send is where someone most needs to know *why*, and the
        // reasons are spread across deployment config and their own account.
        // Ask for the full picture rather than making them go looking.
        const blockers = await fetch("/api/digest/status", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((s) => (s?.blockers as string[] | undefined)?.filter(Boolean))
          .catch(() => undefined);

        setState({
          kind: "error",
          message: body.error ?? "Could not send that.",
          blockers: blockers && blockers.length > 0 ? blockers : undefined,
        });
        return;
      }

      setState({
        kind: "sent",
        to: body.sentTo,
        articleCount: body.articleCount ?? 0,
      });
    } catch {
      setState({ kind: "error", message: "Could not reach the server." });
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void send()}
        disabled={state.kind === "sending"}
      >
        {state.kind === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Sending
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            Send me one now
          </>
        )}
      </Button>

      {state.kind === "sent" && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
          Sent to {state.to} &mdash; {state.articleCount}{" "}
          {state.articleCount === 1 ? "article" : "articles"}. This does not affect your
          Monday digest.
        </p>
      )}

      {state.kind === "error" && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-foreground"
        >
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            {state.message}
          </p>
          {state.blockers && (
            <ul className="ml-6 list-disc space-y-1 text-xs text-muted-foreground">
              {state.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type PreviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; digest: Digest; html: string }
  | { kind: "error"; message: string };

/**
 * Renders what this account's next digest would say, without sending it.
 *
 * The HTML is built in the browser from the same `render.ts` the send job
 * uses, so this is the email rather than a mock-up of it. Only the digest
 * *data* comes from the server, which is the part that needs the watchlist.
 *
 * The access token is read from the Supabase client at click time rather than
 * held in React state or exposed on the auth context: it is a bearer
 * credential, and the fewer places it sits the better.
 */
function DigestPreview() {
  const [state, setState] = useState<PreviewState>({ kind: "idle" });

  async function loadPreview() {
    setState({ kind: "loading" });

    const client = getSupabaseClient();
    const { data } = (await client?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) {
      setState({ kind: "error", message: "Your session expired. Sign in again to preview." });
      return;
    }

    try {
      // A fortnight rather than a week: the point of the preview is to see the
      // layout with articles in it, and a single quiet week would show an
      // empty email that reveals nothing about how a full one reads.
      const response = await fetch("/api/digest/preview?format=json&days=14", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as { digest?: Digest; error?: string };

      if (!response.ok || !body.digest) {
        setState({ kind: "error", message: body.error ?? "Could not build a preview." });
        return;
      }

      setState({
        kind: "ready",
        digest: body.digest,
        html: renderDigestHtml(body.digest, { siteUrl: window.location.origin }),
      });
    } catch {
      setState({ kind: "error", message: "Could not reach the server to build a preview." });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadPreview()}
          disabled={state.kind === "loading"}
        >
          {state.kind === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Building preview
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" aria-hidden="true" />
              Preview this email
            </>
          )}
        </Button>
        {state.kind === "ready" && (
          <span className="text-xs text-muted-foreground">
            Last 14 days, so the layout has something in it.
          </span>
        )}
      </div>

      {state.kind === "error" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          {state.message}
        </p>
      )}

      {state.kind === "ready" && (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Subject:{" "}
            <span className="font-medium text-foreground">{digestSubject(state.digest)}</span>
          </p>
          {/*
            `sandbox` with nothing enabled: this is email HTML being rendered
            inside the app, so it gets no script execution, no same-origin
            access and no navigation of the parent page.
          */}
          <iframe
            title="Weekly digest preview"
            srcDoc={state.html}
            sandbox=""
            className="h-80 w-full rounded-md border border-border bg-white"
          />
        </div>
      )}
    </div>
  );
}

function DigestSection() {
  const { enabled, status, error, setDigestEnabled } = useDigestPreference();
  const busy = status === "loading" || status === "saving";

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Weekly digest</h3>

      <label className="flex items-start justify-between gap-4">
        <span className="space-y-0.5">
          <span className="block text-sm text-muted-foreground">
            A Monday-morning email with what was published in your journals over the previous
            seven days — anything matching your keywords first, then grouped by journal.
          </span>
          <span className="block text-xs leading-relaxed text-muted-foreground">
            Quiet weeks still send, with the count in the subject line, so silence always means
            something is wrong rather than nothing being published.
          </span>
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={(next) => void setDigestEnabled(next)}
          disabled={busy}
          aria-label="Receive the weekly digest email"
          className="mt-0.5 shrink-0"
        />
      </label>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          {error}
        </p>
      )}

      {/*
        Shown whether or not the digest is switched on, because it bears on
        the decision to switch it on. Confirmed the hard way: a digest to a
        cmc.edu address bounced off the university gateway twice while the
        identical email reached a personal address first time. Sign-in mail
        gets through the same gateway, so this is specific to bulk HTML with
        a page of outbound links, and no setting on this end changes it.
      */}
      {!error && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          The digest goes to{" "}
          <span className="font-medium text-foreground">the address you signed in with</span>, and{" "}
          <span className="font-medium text-foreground">a personal address is recommended</span>.
          University mail systems often block automated mail like this, even when sign-in emails
          from the same sender arrive normally. If the digest never turns up, an account under a
          personal address (Gmail, Outlook.com, iCloud) will receive it reliably.
        </p>
      )}

      {enabled && !error && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Every digest carries an unsubscribe link that works without signing in.
        </p>
      )}

      {!error && (
        <div className="space-y-3">
          <DigestPreview />
          <DigestTestSend />
        </div>
      )}
    </section>
  );
}

function AccountPanel({ onClose }: { onClose: () => void }) {
  const { email, signOut } = useAuth();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Your account</DialogTitle>
        <DialogDescription>
          Signed in as <span className="font-medium text-foreground">{email}</span>
        </DialogDescription>
      </DialogHeader>

      <Separator />

      <SyncStatusLine />

      <Separator />

      <WhatSyncs />

      <Separator />

      <DigestSection />

      <Separator />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Zotero</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Connect a Zotero library to export your saved articles into it as proper journal-article
          references, with authors, abstract, DOI, and link.
        </p>
        <ZoteroKeySection />
      </section>

      {confirmingSignOut ? (
        <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-sm leading-relaxed text-foreground">
            Signing out removes your watchlist, seen articles, and saved articles{" "}
            <span className="font-medium">from this browser</span>, so the next person to use it
            starts fresh. Everything stays in your account, and signing back in brings it all
            back.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setConfirmingSignOut(false)} disabled={signingOut}>
              Stay signed in
            </Button>
            <Button variant="destructive" onClick={() => void handleSignOut()} disabled={signingOut}>
              {signingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Signing out…
                </>
              ) : (
                "Sign out"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => setConfirmingSignOut(true)}>
            Sign out
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      )}
    </>
  );
}

function UnconfiguredPanel({ onClose }: { onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Accounts are not set up</DialogTitle>
        <DialogDescription>
          This copy of the feed has no backend configured, so there is nothing to sign in to.
        </DialogDescription>
      </DialogHeader>

      <Separator />

      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          Everything works normally — your watchlist, seen articles, and saved articles are kept in
          this browser. They just will not follow you to another device.
        </p>
        <p className="flex items-start gap-2">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          If you are running this yourself, see <code className="rounded bg-muted px-1 py-0.5 text-xs">SUPABASE_SETUP.md</code>{" "}
          in the repository to turn accounts on.
        </p>
      </div>

      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </>
  );
}

export function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
  const { status } = useAuth();
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {status === "unconfigured" ? (
          <UnconfiguredPanel onClose={close} />
        ) : status === "signedIn" ? (
          <AccountPanel onClose={close} />
        ) : (
          <SignInPanel onClose={close} />
        )}
      </DialogContent>
    </Dialog>
  );
}
