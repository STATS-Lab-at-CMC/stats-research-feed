/**
 * Low-level fetch wrapper for the OpenAlex REST API.
 *
 * Requests go through this app's own `/api/openalex/*` route rather than
 * straight to `api.openalex.org`. That route attaches the OpenAlex API key
 * server-side — which, as of October 2026, is required to page past the first
 * page of results with `cursor=`. Without a key a 26-journal watchlist
 * silently truncates to one page of 100.
 *
 * The key is deliberately *not* a `NEXT_PUBLIC_*` value: this is a public
 * site, anything in the browser bundle is readable by every visitor, and an
 * OpenAlex key carries the issuing person's daily budget. This is the
 * "keyed server-side proxy, not a client-side key" upgrade path this file
 * has described since V1.
 *
 * Proxying is unconditional. The route works with or without a key
 * configured — keyless it simply forwards the request, which is exactly the
 * old behaviour — so the browser never needs to know whether one exists, and
 * a deployment with no key still functions (just truncated, and now visibly
 * so: see `WorksFetchResult.complete` and the partial-results banner).
 *
 * Usage is metered as a daily budget rather than a flat request cap. Keyless
 * is ~$0.10/day, about 1,000 list queries; a key raises it 10x. The
 * per-second ceiling is 100. The app stays well under this via batching and
 * per-journal caching (see `sources.ts`, `works.ts`, `feed.ts`), the
 * in-flight de-duplication below, and the CDN caching the proxy route sets —
 * which is shared across readers, so a popular watchlist costs one upstream
 * call rather than one per visitor.
 */

/**
 * Relative on purpose: it resolves against whatever origin the app is served
 * from, so localhost, Vercel previews, and production all work with no
 * configuration.
 */
const OPENALEX_PROXY_PATH = "/api/openalex";
const REQUEST_TIMEOUT_MS = 20_000;

export type OpenAlexResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// In-flight request de-duplication: if two callers ask for the exact same
// URL (same path + params) while a request is already in flight, they share
// one network call instead of issuing two. Keyed by the fully-built URL, so
// it's automatically request-shape-aware (different filters/cursors are
// different keys). Cleared as soon as the request settles — this is only
// about coalescing concurrent duplicates, not a result cache (that's
// sources.ts / feed.ts's job, with real TTLs).
const inFlightRequests = new Map<string, Promise<OpenAlexResult<unknown>>>();

/** Dev-only request logging. Gated off in production; kept intentionally (not stripped) as lightweight observability for future debugging of request volume. */
function logRequest(url: URL): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[OpenAlex] GET ${url.pathname}${url.search}`);
}

export async function openAlexGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<OpenAlexResult<T>> {
  // `path` is a leading-slash OpenAlex collection path such as "/works".
  // Joined by hand rather than via `new URL(path, base)`, which would treat
  // the leading slash as absolute and discard the proxy prefix entirely.
  const base = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(`${OPENALEX_PROXY_PATH}${path}`, base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const key = url.toString();

  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<OpenAlexResult<T>>;

  const requestPromise = performRequest<T>(url);
  inFlightRequests.set(key, requestPromise as Promise<OpenAlexResult<unknown>>);
  requestPromise.finally(() => inFlightRequests.delete(key));
  return requestPromise;
}

async function performRequest<T>(url: URL): Promise<OpenAlexResult<T>> {
  logRequest(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      // The proxy relays OpenAlex's own error text, which is where actionable
      // messages live ("API key required for cursor paging", rate limits).
      // Surfacing it beats a bare status code when the next policy change lands.
      // Prefer OpenAlex's own words. The numeric status here is the proxy's
      // (it maps upstream failures to 502/504), so quoting it alongside an
      // upstream message would name a code OpenAlex never sent.
      const detail = await readErrorDetail(response);
      return {
        ok: false,
        error: detail ?? `OpenAlex responded with status ${response.status}`,
      };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "OpenAlex request timed out" };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Unknown network error" };
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { upstream?: string; error?: string };
    return body.upstream ?? body.error;
  } catch {
    return undefined;
  }
}

export interface OpenAlexSourceRecord {
  id: string;
  display_name: string;
  issn_l?: string | null;
  issn?: string[] | null;
}

export interface OpenAlexAuthorship {
  author?: { display_name?: string | null } | null;
}

export interface OpenAlexLocation {
  source?: { id?: string | null; display_name?: string | null } | null;
  landing_page_url?: string | null;
  is_oa?: boolean | null;
  /** Direct PDF address, when OpenAlex knows one. Frequently absent even for OA work. */
  pdf_url?: string | null;
}

export interface OpenAlexWorkRecord {
  id: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_date?: string | null;
  authorships?: OpenAlexAuthorship[] | null;
  primary_location?: OpenAlexLocation | null;
  /** OpenAlex's pick of the best freely-readable copy, wherever it lives. */
  best_oa_location?: OpenAlexLocation | null;
  open_access?: { is_oa?: boolean | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  /**
   * OpenAlex's canonical work type (post the July 2026 type-classification
   * overhaul): "article", "review", "erratum", "retraction", "preprint",
   * "editorial", "letter", "paratext", etc. Requested and checked defensively
   * (see normalize.ts) even though the API request itself already filters on
   * it, in case a record is missing the field or the upstream filter ever
   * misbehaves.
   */
  type?: string | null;
  /**
   * True if OpenAlex's Retraction Watch-backed data says this work has been
   * retracted. Distinct from type:"retraction", which is the retraction
   * *notice* document itself, not the retracted original work.
   */
  is_retracted?: boolean | null;
  /** Volume/issue/pages. Often empty for advance online publications. */
  biblio?: {
    volume?: string | null;
    issue?: string | null;
    first_page?: string | null;
    last_page?: string | null;
  } | null;
  publication_year?: number | null;
}

export interface OpenAlexListResponse<T> {
  results: T[];
  meta: { count: number; next_cursor?: string | null };
}
