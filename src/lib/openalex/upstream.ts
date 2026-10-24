/**
 * How a request to `api.openalex.org` is built, including the API key.
 *
 * `import "server-only"` is the point of this file. The OpenAlex key carries
 * the issuing person's daily budget, so it must never reach a browser bundle,
 * and "must never" is worth more than a comment: if any module in a
 * `"use client"` graph ever imports this one, the build fails rather than
 * quietly shipping the key to every visitor.
 *
 * Two callers, for two different reasons:
 *
 *  - `app/api/openalex/[...path]/route.ts` — the proxy the browser talks to,
 *    because the browser cannot be trusted with the key.
 *  - `openalex/serverFetch.ts` — server code (the weekly digest) that calls
 *    OpenAlex directly, because it is already on the server and self-calling
 *    the proxy would only add a network hop and a failure mode.
 *
 * Both go through `buildUpstreamUrl`, so the allowlist and the key handling
 * cannot drift apart between them.
 */
import "server-only";

export const OPENALEX_BASE_URL = "https://api.openalex.org";
export const UPSTREAM_TIMEOUT_MS = 20_000;

/** The only OpenAlex collections this app reads. */
export const ALLOWED_ENDPOINTS = new Set(["works", "sources"]);

/** The only query parameters forwarded upstream. Anything else is dropped. */
export const ALLOWED_PARAMS = new Set([
  "filter",
  "search",
  "sort",
  "select",
  "per-page",
  "per_page",
  "page",
  "cursor",
  "sample",
  "seed",
]);

/**
 * Builds the upstream URL for one OpenAlex request, dropping any parameter
 * not on the allowlist and then attaching the API key.
 *
 * The key is set *after* the allowlist pass, which is what stops a caller
 * from injecting or overriding it through the query string — the proxy
 * forwards parameters from the open internet, so that ordering is load-bearing
 * rather than stylistic.
 *
 * Returns null for an endpoint this app does not read, which for the proxy is
 * a 404 and for server callers is a programming error.
 */
export function buildUpstreamUrl(
  endpoint: string,
  params: Iterable<[string, string]>,
): URL | null {
  if (!ALLOWED_ENDPOINTS.has(endpoint)) return null;

  const upstream = new URL(`/${endpoint}`, OPENALEX_BASE_URL);
  for (const [key, value] of params) {
    if (ALLOWED_PARAMS.has(key)) upstream.searchParams.set(key, value);
  }

  const apiKey = process.env.OPENALEX_API_KEY?.trim();
  if (apiKey) upstream.searchParams.set("api_key", apiKey);

  return upstream;
}

/** Extracts OpenAlex's own error text, bounded so a huge body can't be relayed. */
export function safeUpstreamError(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string };
    const text = [parsed.error, parsed.message].filter(Boolean).join(" — ");
    return text ? text.slice(0, 300) : undefined;
  } catch {
    return undefined;
  }
}
