import { NextResponse } from "next/server";
import {
  ALLOWED_ENDPOINTS,
  UPSTREAM_TIMEOUT_MS,
  buildUpstreamUrl,
  safeUpstreamError,
} from "@/lib/openalex/upstream";

/**
 * Server-side proxy to the OpenAlex REST API.
 *
 * ## Why this exists
 *
 * As of October 2026 OpenAlex requires an API key to page past the first page
 * of results with `cursor=`. Without one, the default watchlist silently
 * truncates to a single page — the app's fetch is marked incomplete and the
 * reader just sees a short feed.
 *
 * The key could have been shipped as a `NEXT_PUBLIC_*` variable, but this is
 * a public site: anything in the browser bundle is readable by every visitor,
 * and an OpenAlex key is issued to a person and carries their daily budget.
 * So it stays server-side, exactly as `lib/openalex/client.ts` always said the
 * upgrade path should work. The key itself, and the allowlist that keeps this
 * from being an open proxy, live in `lib/openalex/upstream.ts` — shared with
 * the digest job, which calls OpenAlex from the server directly.
 *
 * ## Two incidental wins
 *
 * - **Privacy.** OpenAlex now sees this deployment's IP rather than each
 *   reader's, so a reader's journal interests are no longer tied to their
 *   address by the upstream service.
 * - **Shared cache.** Identical upstream requests are cached at the CDN, so
 *   twenty readers with the same watchlist cost one upstream call instead of
 *   twenty. That matters because the budget is per key, not per reader.
 */

/**
 * How long the CDN may serve a cached copy. Source records (journal → OpenAlex
 * id) are effectively static; works change as journals publish. Both are far
 * shorter-lived than the client-side caches in `sources.ts` / `feed.ts`, which
 * remain the first line of defence against redundant requests.
 */
const CACHE_CONTROL: Record<string, string> = {
  works: "public, s-maxage=600, stale-while-revalidate=1800",
  sources: "public, s-maxage=86400, stale-while-revalidate=172800",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const endpoint = path?.[0];

  // Reject anything that isn't one of the two collections we read. This also
  // rejects nested paths like /works/W123, which the app never requests.
  if (!endpoint || path.length !== 1 || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json(
      { error: "Unsupported OpenAlex endpoint." },
      { status: 404 },
    );
  }

  const upstream = buildUpstreamUrl(endpoint, new URL(request.url).searchParams);
  if (!upstream) {
    return NextResponse.json(
      { error: "Unsupported OpenAlex endpoint." },
      { status: 404 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(upstream, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // Vercel's data cache is bypassed in favour of the CDN headers below,
      // which are shared across readers rather than per-deployment.
      cache: "no-store",
    });

    const body = await response.text();

    if (!response.ok) {
      // Deliberately does not echo the upstream URL: it carries the API key.
      return NextResponse.json(
        {
          error: `OpenAlex responded with status ${response.status}`,
          // OpenAlex's own error body is safe — it never contains the key —
          // and carries the actionable message (e.g. the cursor-paging notice).
          upstream: safeUpstreamError(body),
        },
        { status: response.status === 429 ? 429 : 502 },
      );
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": CACHE_CONTROL[endpoint] ?? "public, s-maxage=300",
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: timedOut ? "OpenAlex request timed out" : "Could not reach OpenAlex" },
      { status: 504 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
