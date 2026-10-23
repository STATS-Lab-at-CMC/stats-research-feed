/**
 * The only module that issues Supabase *data* queries — the same containment
 * rule `lib/openalex/` follows for OpenAlex. The sync engine decides *when* to
 * read and write; this file knows *how*.
 *
 * Every function here assumes an authenticated client. Authorization is not
 * enforced in this file and must not be: it lives in the row-level security
 * policies in `supabase/migrations/0001_user_state.sql`, so a bug here can
 * only ever affect the signed-in user's own rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalDefinition } from "@/lib/journals/catalog";
import type { Article } from "@/lib/types";
import type { SlicePayload, SyncOp } from "./bus";

/**
 * PostgREST caps a single response (1,000 rows by default), so reads page
 * explicitly rather than silently truncating a long reading history.
 */
const PAGE_SIZE = 1000;

/**
 * Writes are chunked because ids travel in the query string for deletes
 * (`?article_id=in.(...)`), and a user clearing thousands of seen articles
 * would otherwise build a URL past what proxies accept.
 */
const WRITE_CHUNK = 200;

export interface RemoteState {
  /**
   * `null` means this account has no `user_settings` row yet — it has never
   * synced, so local state should seed the cloud. An empty array is different:
   * it means the user genuinely follows nothing.
   */
  watchlist: string[] | null;
  seen: string[];
  saved: Article[];
  /** Article ids already exported to Zotero. Never includes the API key. */
  zoteroExports: string[];
  /** Journals the user added themselves, beyond the built-in catalog. */
  customJournals: JournalDefinition[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Reads every row of a table for this user, following PostgREST's page cap. */
async function selectAllPages<Row>(
  client: SupabaseClient,
  table: string,
  columns: string,
  userId: string,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await client
      .from(table)
      .select(columns)
      .eq("user_id", userId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

/** Fetches this user's complete cloud state. */
export async function pullRemoteState(
  client: SupabaseClient,
  userId: string,
): Promise<RemoteState> {
  const settingsPromise = client
    .from("user_settings")
    .select("followed_journal_ids")
    .eq("user_id", userId)
    .maybeSingle();

  const [settings, seenRows, savedRows, zoteroRows, journalRows] = await Promise.all([
    settingsPromise,
    selectAllPages<{ article_id: string }>(client, "seen_articles", "article_id", userId),
    selectAllPages<{ article: Article }>(client, "saved_articles", "article", userId),
    selectAllPages<{ article_id: string }>(client, "zotero_exports", "article_id", userId),
    selectAllPages<{ journal: JournalDefinition }>(client, "custom_journals", "journal", userId),
  ]);

  if (settings.error) {
    throw new Error(`Could not read your settings: ${settings.error.message}`);
  }

  return {
    watchlist: settings.data ? (settings.data.followed_journal_ids ?? []) : null,
    seen: seenRows.map((row) => row.article_id),
    saved: savedRows.map((row) => row.article).filter((article): article is Article => !!article?.id),
    zoteroExports: zoteroRows.map((row) => row.article_id),
    customJournals: journalRows
      .map((row) => row.journal)
      .filter((journal): journal is JournalDefinition => !!journal?.id),
  };
}

async function replaceWatchlist(
  client: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<void> {
  const { error } = await client
    .from("user_settings")
    .upsert({ user_id: userId, followed_journal_ids: ids }, { onConflict: "user_id" });
  if (error) throw new Error(`Could not save your watchlist: ${error.message}`);
}

/** Both seen_articles and zotero_exports are plain (user_id, article_id) tables. */
async function addIds(
  client: SupabaseClient,
  userId: string,
  table: string,
  ids: string[],
  label: string,
): Promise<void> {
  for (const batch of chunk(ids, WRITE_CHUNK)) {
    const { error } = await client
      .from(table)
      .upsert(
        batch.map((articleId) => ({ user_id: userId, article_id: articleId })),
        { onConflict: "user_id,article_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(`Could not save your ${label}: ${error.message}`);
  }
}

async function removeIds(
  client: SupabaseClient,
  userId: string,
  table: string,
  ids: string[],
  label: string,
): Promise<void> {
  for (const batch of chunk(ids, WRITE_CHUNK)) {
    const { error } = await client
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("article_id", batch);
    if (error) throw new Error(`Could not update your ${label}: ${error.message}`);
  }
}

const addSeen = (c: SupabaseClient, u: string, ids: string[]) =>
  addIds(c, u, "seen_articles", ids, "seen articles");
const removeSeen = (c: SupabaseClient, u: string, ids: string[]) =>
  removeIds(c, u, "seen_articles", ids, "seen articles");
const addExports = (c: SupabaseClient, u: string, ids: string[]) =>
  addIds(c, u, "zotero_exports", ids, "Zotero export history");
const removeExports = (c: SupabaseClient, u: string, ids: string[]) =>
  removeIds(c, u, "zotero_exports", ids, "Zotero export history");

async function addSaved(client: SupabaseClient, userId: string, items: Article[]): Promise<void> {
  for (const batch of chunk(items, WRITE_CHUNK)) {
    const { error } = await client.from("saved_articles").upsert(
      batch.map((article) => ({ user_id: userId, article_id: article.id, article })),
      { onConflict: "user_id,article_id" },
    );
    if (error) throw new Error(`Could not save your bookmarks: ${error.message}`);
  }
}

async function removeSaved(client: SupabaseClient, userId: string, ids: string[]): Promise<void> {
  for (const batch of chunk(ids, WRITE_CHUNK)) {
    const { error } = await client
      .from("saved_articles")
      .delete()
      .eq("user_id", userId)
      .in("article_id", batch);
    if (error) throw new Error(`Could not update your bookmarks: ${error.message}`);
  }
}

async function addCustomJournals(
  client: SupabaseClient,
  userId: string,
  journals: JournalDefinition[],
): Promise<void> {
  for (const batch of chunk(journals, WRITE_CHUNK)) {
    const { error } = await client.from("custom_journals").upsert(
      batch.map((journal) => ({ user_id: userId, journal_id: journal.id, journal })),
      { onConflict: "user_id,journal_id" },
    );
    if (error) throw new Error(`Could not save your added journals: ${error.message}`);
  }
}

async function removeCustomJournals(
  client: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<void> {
  for (const batch of chunk(ids, WRITE_CHUNK)) {
    const { error } = await client
      .from("custom_journals")
      .delete()
      .eq("user_id", userId)
      .in("journal_id", batch);
    if (error) throw new Error(`Could not update your added journals: ${error.message}`);
  }
}

async function deleteAll(client: SupabaseClient, userId: string, table: string): Promise<void> {
  const { error } = await client.from(table).delete().eq("user_id", userId);
  if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
}

/**
 * Applies one local mutation to the cloud.
 *
 * Watchlist ops always arrive here already normalized to a full `replace` by
 * the engine — the array is bounded by the journal catalog, so a whole-value
 * write is cheaper than tracking deltas and is idempotent on retry.
 */
export async function pushOp(
  client: SupabaseClient,
  userId: string,
  op: SyncOp,
): Promise<void> {
  switch (op.slice) {
    case "watchlist":
      await replaceWatchlist(client, userId, op.ids);
      return;

    case "seen":
      if (op.kind === "add") return addSeen(client, userId, op.ids);
      if (op.kind === "remove") return removeSeen(client, userId, op.ids);
      await deleteAll(client, userId, "seen_articles");
      if (op.ids.length > 0) await addSeen(client, userId, op.ids);
      return;

    case "saved": {
      const articles = (op.items ?? []) as Article[];
      if (op.kind === "add") return addSaved(client, userId, articles);
      if (op.kind === "remove") return removeSaved(client, userId, op.ids);
      await deleteAll(client, userId, "saved_articles");
      if (articles.length > 0) await addSaved(client, userId, articles);
      return;
    }

    case "customJournals": {
      const journals = (op.items ?? []) as JournalDefinition[];
      if (op.kind === "add") return addCustomJournals(client, userId, journals);
      if (op.kind === "remove") return removeCustomJournals(client, userId, op.ids);
      await deleteAll(client, userId, "custom_journals");
      if (journals.length > 0) await addCustomJournals(client, userId, journals);
      return;
    }

    case "zoteroExports":
      if (op.kind === "add") return addExports(client, userId, op.ids);
      if (op.kind === "remove") return removeExports(client, userId, op.ids);
      await deleteAll(client, userId, "zotero_exports");
      if (op.ids.length > 0) await addExports(client, userId, op.ids);
      return;
  }
}

/**
 * Writes local state into a fresh account, and creates the `user_settings`
 * row that marks the account as initialized.
 *
 * Ordering matters: the settings row is written *last*, so an interrupted seed
 * leaves the account still looking uninitialized and the next sign-in retries
 * the whole thing rather than treating a half-written account as authoritative.
 */
export async function seedRemoteState(
  client: SupabaseClient,
  userId: string,
  local: {
    watchlist: SlicePayload;
    seen: SlicePayload;
    saved: SlicePayload;
    zoteroExports: SlicePayload;
    customJournals: SlicePayload;
  },
): Promise<void> {
  if (local.seen.ids.length > 0) await addSeen(client, userId, local.seen.ids);
  if ((local.saved.items ?? []).length > 0) {
    await addSaved(client, userId, (local.saved.items ?? []) as Article[]);
  }
  if (local.zoteroExports.ids.length > 0) {
    await addExports(client, userId, local.zoteroExports.ids);
  }
  const localJournals = (local.customJournals.items ?? []) as JournalDefinition[];
  if (localJournals.length > 0) await addCustomJournals(client, userId, localJournals);
  await replaceWatchlist(client, userId, local.watchlist.ids);
}
