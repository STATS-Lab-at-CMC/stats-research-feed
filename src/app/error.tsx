"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Last line of defence for an unexpected render error.
 *
 * Without this file a throw anywhere in the tree unmounts the app to a blank
 * white page with no explanation and no way back — and because almost
 * everything here is a client component reading persisted state, a single
 * malformed value in localStorage could do it.
 *
 * So the recovery offered is specific rather than a bare "try again": this
 * app's state lives in the browser, which means a broken value is both the
 * likely cause and something the reader can clear themselves. Nothing is
 * cleared automatically — a watchlist and a reading history are worth more
 * than a quick fix, and wiping them silently would be its own bug report.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error in the research feed:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold text-foreground">Something broke</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The feed hit an error it could not recover from on its own. Nothing has been lost:
        your watchlist, reading history and saved articles are stored separately and are
        untouched.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        If it keeps happening, the cause is most likely a stored value this browser is
        holding. Clearing this site&apos;s data will fix it, at the cost of your local
        watchlist and reading history — signed in, both come back on your next sign-in.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </main>
  );
}
