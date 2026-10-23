/**
 * Zotero Web API v3 client.
 *
 * ## Why this runs in the browser
 *
 * `api.zotero.org` sends `Access-Control-Allow-Origin: *` and explicitly
 * allows the `Zotero-API-Key` header, so the browser can talk to it directly.
 * That is the whole reason this feature is safe to offer: the key never
 * reaches this app's server, is never written to Supabase, and is not part of
 * the synced state. A Zotero key with write access can modify or delete
 * someone's entire library, and holding other people's is a liability worth
 * avoiding entirely rather than mitigating.
 *
 * The cost of that choice is that the key is per-browser. See
 * `hooks/useZoteroKey.ts`.
 */

import type { Article } from "@/lib/types";

const ZOTERO_BASE_URL = "https://api.zotero.org";
const API_VERSION = "3";

/** Zotero rejects writes larger than this many items per request. */
const MAX_ITEMS_PER_REQUEST = 50;

const REQUEST_TIMEOUT_MS = 30_000;

export interface ZoteroIdentity {
  userId: number;
  username: string;
  /** False when the key is read-only — worth catching before a user tries to send. */
  canWrite: boolean;
}

export interface ZoteroSendResult {
  created: number;
  /** Articles Zotero refused, with its reason. */
  failures: { article: Article; reason: string }[];
}

function headers(apiKey: string): HeadersInit {
  return {
    "Zotero-API-Key": apiKey,
    "Zotero-API-Version": API_VERSION,
    "Content-Type": "application/json",
  };
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Confirms a key works and reports whose library it writes to.
 *
 * Worth doing before the first send rather than after: a pasted key is easy to
 * truncate, and "which account is this?" is the question a user actually needs
 * answered before pushing 40 references somewhere.
 */
export async function verifyZoteroKey(apiKey: string): Promise<ZoteroIdentity> {
  const response = await withTimeout((signal) =>
    fetch(`${ZOTERO_BASE_URL}/keys/current`, { headers: headers(apiKey), signal }),
  );

  if (response.status === 403 || response.status === 401) {
    throw new Error("Zotero did not recognize that key. Check it was copied in full.");
  }
  if (!response.ok) {
    throw new Error(`Zotero returned status ${response.status} while checking the key.`);
  }

  const data = (await response.json()) as {
    userID?: number;
    username?: string;
    access?: { user?: { library?: boolean; write?: boolean } };
  };

  if (typeof data.userID !== "number") {
    throw new Error("Zotero accepted the key but did not say which account it belongs to.");
  }

  return {
    userId: data.userID,
    username: data.username ?? "your account",
    canWrite: data.access?.user?.write === true,
  };
}

/** Splits a display name on the final space — what most Zotero importers do. */
function splitName(displayName: string): { firstName: string; lastName: string } {
  const trimmed = displayName.trim().replace(/\s+/g, " ");
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return { firstName: "", lastName: trimmed };
  return {
    firstName: trimmed.slice(0, lastSpace),
    lastName: trimmed.slice(lastSpace + 1),
  };
}

interface ZoteroJournalArticle {
  itemType: "journalArticle";
  title: string;
  creators: { creatorType: "author"; firstName: string; lastName: string }[];
  abstractNote: string;
  publicationTitle: string;
  date: string;
  DOI: string;
  url: string;
  accessDate: string;
  libraryCatalog: string;
  tags: { tag: string }[];
}

/**
 * Maps a feed article onto Zotero's `journalArticle` type.
 *
 * Zotero wants empty strings rather than nulls for absent fields; sending null
 * makes it reject the whole item. Every field here exists on `Article`
 * already, which is why this is a mapping rather than a second data source.
 */
export function toZoteroItem(article: Article): ZoteroJournalArticle {
  return {
    itemType: "journalArticle",
    title: article.title,
    creators: article.authors.map((name) => ({
      creatorType: "author" as const,
      ...splitName(name),
    })),
    abstractNote: article.abstract ?? "",
    publicationTitle: article.journalName,
    date: article.publicationDate ?? "",
    DOI: article.doi ?? "",
    url: article.articleUrl ?? "",
    accessDate: new Date().toISOString().slice(0, 10),
    libraryCatalog: "OpenAlex",
    // Makes it obvious in Zotero where these came from, and gives the user a
    // one-click way to find or bulk-remove them later.
    tags: [{ tag: "I-O/Quant Psych Research Feed" }],
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Writes articles into the user's personal Zotero library.
 *
 * Partial success is the norm rather than an edge case: Zotero reports each
 * item in a batch independently, so the result separates what landed from what
 * did not and why, instead of collapsing to a single thrown error.
 */
export async function sendArticlesToZotero(
  apiKey: string,
  userId: number,
  articles: Article[],
): Promise<ZoteroSendResult> {
  let created = 0;
  const failures: ZoteroSendResult["failures"] = [];

  for (const batch of chunk(articles, MAX_ITEMS_PER_REQUEST)) {
    const response = await withTimeout((signal) =>
      fetch(`${ZOTERO_BASE_URL}/users/${userId}/items`, {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify(batch.map(toZoteroItem)),
        signal,
      }),
    );

    if (response.status === 403) {
      throw new Error(
        "That key is not allowed to write to this library. Create a new key with write access enabled.",
      );
    }
    if (response.status === 429 || response.headers.get("Backoff")) {
      const retry = response.headers.get("Retry-After") ?? response.headers.get("Backoff");
      throw new Error(
        `Zotero is rate-limiting this account. Try again in ${retry ?? "a few"} seconds.`,
      );
    }
    if (!response.ok) {
      throw new Error(`Zotero returned status ${response.status}.`);
    }

    // Zotero answers per item, keyed by the item's index within this batch.
    const body = (await response.json()) as {
      successful?: Record<string, unknown>;
      failed?: Record<string, { message?: string }>;
    };

    created += Object.keys(body.successful ?? {}).length;
    for (const [index, detail] of Object.entries(body.failed ?? {})) {
      const article = batch[Number(index)];
      if (article) failures.push({ article, reason: detail?.message ?? "Zotero rejected this item." });
    }
  }

  return { created, failures };
}
