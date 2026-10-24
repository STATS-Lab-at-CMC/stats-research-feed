/**
 * `openAlexGet`'s server-side twin: same signature, straight to OpenAlex.
 *
 * The browser's version (`client.ts`) goes through this app's `/api/openalex`
 * proxy because the browser cannot hold the API key. Server code already can,
 * so proxying would mean this deployment making an HTTP request to itself —
 * an extra hop, an extra timeout to tune, and a cold-start dependency on its
 * own public URL. It calls upstream directly instead.
 *
 * Shape-compatible with `openAlexGet` on purpose: `fetchRecentWorksForSources`
 * and `resolveJournalSources` take whichever one fits the context, so the
 * pagination, chunking and ISSN-matching logic has exactly one implementation
 * rather than a browser copy and a server copy that drift.
 */
import "server-only";
import { UPSTREAM_TIMEOUT_MS, buildUpstreamUrl, safeUpstreamError } from "./upstream";
import type { OpenAlexResult } from "./client";

export async function serverOpenAlexGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<OpenAlexResult<T>> {
  // `path` arrives as a leading-slash collection path ("/works") because that
  // is what the browser client takes; upstream.ts wants the bare name.
  const endpoint = path.replace(/^\//, "");
  const upstream = buildUpstreamUrl(endpoint, Object.entries(params));
  if (!upstream) {
    return { ok: false, error: `Unsupported OpenAlex endpoint: ${endpoint}` };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(upstream, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const body = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        // OpenAlex's own words where it gave them — the cursor-paging notice
        // and rate-limit messages are the ones worth reading in a cron log.
        error:
          safeUpstreamError(body) ?? `OpenAlex responded with status ${response.status}`,
      };
    }

    return { ok: true, data: JSON.parse(body) as T };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "OpenAlex request timed out" };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown network error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
