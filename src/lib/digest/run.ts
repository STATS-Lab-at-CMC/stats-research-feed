/**
 * The weekly run: gather subscribers, fetch once, compose and send per person.
 *
 * ## One fetch, not one per subscriber
 *
 * Subscribers' watchlists overlap almost completely — most people keep some
 * subset of the same 38-journal default. So this resolves the *union* of every
 * subscriber's journals, makes one set of OpenAlex requests for the widest
 * window anyone needs, and then composes each digest from that shared result.
 * Twenty subscribers cost one fetch rather than twenty, which matters because
 * the OpenAlex budget is per key, not per reader.
 *
 * ## Why a send can never duplicate
 *
 * `last_digest_sent_at` is both the window boundary and the idempotency
 * guard. A subscriber sent to within `MIN_RESEND_INTERVAL_DAYS` is skipped, so
 * a cron that fires twice — a retry, a redeploy, a manual trigger during
 * testing — cannot produce a second email. The timestamp advances only after
 * Resend accepts the message: a failed send leaves it untouched so next
 * week's run covers the gap instead of losing a week.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Article } from "@/lib/types";
import type { JournalDefinition } from "@/lib/journals/catalog";
import {
  MAX_WINDOW_DAYS,
  composeDigest,
  journalsFor,
  windowDaysFor,
  type DigestRecipient,
} from "./compose";
import { digestSubject, renderDigestHtml, renderDigestText } from "./render";
import { sendDigestEmail } from "./send";
import { unsubscribeUrl } from "./unsubscribe";
import { resolveJournalSources } from "@/lib/openalex/sources";
import { fetchRecentWorksForSources } from "@/lib/openalex/works";
import { serverOpenAlexGet } from "@/lib/openalex/serverFetch";

/**
 * A subscriber sent to more recently than this is skipped.
 *
 * Six rather than seven: the cron fires weekly but Vercel's Hobby plan only
 * promises the hour, so two consecutive runs can be a little under or over
 * 168 hours apart. Seven days would occasionally skip a legitimate week.
 */
const MIN_RESEND_INTERVAL_DAYS = 6;

export interface SubscriberOutcome {
  userId: string;
  email: string;
  status: "sent" | "skipped" | "failed";
  reason?: string;
  articleCount?: number;
}

export interface RunSummary {
  subscribers: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Articles fetched once and shared across every digest. */
  fetchedArticles: number;
  fetchIncomplete: boolean;
  fetchError?: string;
  outcomes: SubscriberOutcome[];
}

/**
 * Whether a `custom_journals.journal` row is safe to put in the shared fetch.
 *
 * That column is unvalidated `jsonb` that any signed-in person can write to
 * through their own Supabase session, and the digest composes *one* OpenAlex
 * query for every subscriber at once. So a single malformed row is not one
 * person's problem: a journal with no `issns` throws inside
 * `resolveJournalSources` and takes down the entire Monday run, and a
 * `openAlexSourceId` carrying a comma injects an extra clause into a filter
 * shared with everyone else's journals.
 *
 * Bad rows are dropped rather than thrown on. One person's broken row should
 * cost them one journal, not cost everybody their digest.
 */
function isUsableJournal(value: unknown): value is JournalDefinition {
  if (!value || typeof value !== "object") return false;
  const journal = value as Partial<JournalDefinition>;
  if (typeof journal.id !== "string" || journal.id.length === 0) return false;
  if (typeof journal.name !== "string" || journal.name.length === 0) return false;
  if (!Array.isArray(journal.issns)) return false;
  if (!journal.issns.every((issn) => typeof issn === "string")) return false;
  // Must be an OpenAlex source id and nothing else — no separators that
  // could extend the filter expression it is interpolated into.
  if (journal.openAlexSourceId !== undefined && !/^S\d+$/.test(journal.openAlexSourceId)) {
    return false;
  }
  return true;
}

interface SubscriberRow {
  user_id: string;
  followed_journal_ids: string[] | null;
  keywords: string[] | null;
  last_digest_sent_at: string | null;
}

/**
 * Loads everyone who opted in, with their email address.
 *
 * Addresses live in `auth.users`, which PostgREST does not expose, so they
 * come from the Admin API instead. Paged, because `listUsers` returns the
 * first 50 by default and silently truncating the recipient list is the kind
 * of bug that looks like "the digest just didn't send for some people".
 */
async function loadSubscribers(
  admin: SupabaseClient,
  onlyUserId?: string,
): Promise<{ rows: SubscriberRow[]; emailByUserId: Map<string, string> }> {
  // Narrowed in the database for a single-recipient run (the "send me one
  // now" button), rather than loading every subscriber and discarding all
  // but one — which also meant paging the whole user table for their emails.
  let query = admin
    .from("user_settings")
    .select("user_id, followed_journal_ids, keywords, last_digest_sent_at")
    .eq("digest_enabled", true);
  if (onlyUserId) query = query.eq("user_id", onlyUserId);
  const { data, error } = await query;

  if (error) throw new Error(`Could not read subscribers: ${error.message}`);

  const rows = (data ?? []) as SubscriberRow[];
  const wanted = new Set(rows.map((row) => row.user_id));
  const emailByUserId = new Map<string, string>();

  if (wanted.size === 0) return { rows, emailByUserId };

  // One lookup when there is one subscriber to find.
  if (wanted.size === 1) {
    const [only] = wanted;
    const { data: user } = await admin.auth.admin.getUserById(only);
    if (user?.user?.email) emailByUserId.set(only, user.user.email);
    return { rows, emailByUserId };
  }

  /*
   * Bounded by the pages the API reports, not by "have I found everyone yet".
   * A user_settings row whose auth.users entry is gone, or has no email, can
   * never be found — and the old condition would then walk the entire user
   * table to its end looking for it.
   */
  const MAX_PAGES = 50;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (usersError) throw new Error(`Could not read user emails: ${usersError.message}`);
    if (!users.users.length) break;

    for (const user of users.users) {
      if (wanted.has(user.id) && user.email) emailByUserId.set(user.id, user.email);
    }

    if (emailByUserId.size === wanted.size) break;
    if (users.users.length < 200) break;
  }

  return { rows, emailByUserId };
}

/** Everyone's journals, de-duplicated, so the fetch below happens once. */
async function fetchSharedArticles(
  recipients: DigestRecipient[],
  now: Date,
): Promise<{
  articles: Article[];
  unresolvedJournalIds: string[];
  incomplete: boolean;
  error?: string;
}> {
  const unionById = new Map<string, JournalDefinition>();
  let widestWindow = 0;

  for (const recipient of recipients) {
    for (const journal of journalsFor(recipient)) unionById.set(journal.id, journal);
    widestWindow = Math.max(widestWindow, windowDaysFor(recipient.lastSentAt, now));
  }

  const journals = Array.from(unionById.values());
  if (journals.length === 0) {
    return { articles: [], unresolvedJournalIds: [], incomplete: false };
  }

  const { sourceIdByJournalId, unresolvedJournalIds } = await resolveJournalSources(
    journals,
    serverOpenAlexGet,
  );

  if (sourceIdByJournalId.size === 0) {
    return {
      articles: [],
      unresolvedJournalIds,
      incomplete: true,
      error: "Could not reach OpenAlex to look up these journals.",
    };
  }

  const nameById = new Map(journals.map((j) => [j.id, j.name]));
  const result = await fetchRecentWorksForSources(
    sourceIdByJournalId,
    nameById,
    Math.min(widestWindow || MAX_WINDOW_DAYS, MAX_WINDOW_DAYS),
    serverOpenAlexGet,
  );

  return {
    articles: result.articles,
    unresolvedJournalIds,
    incomplete: !result.complete,
    error: result.error,
  };
}

function daysSince(iso: string | null | undefined, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then.getTime()) / 86_400_000;
}

export interface RunOptions {
  siteUrl: string;
  /** Compose and report, send nothing, record nothing. */
  dryRun?: boolean;
  /** Restrict the run to one user — used by the "send me one now" button. */
  onlyUserId?: string;
  /** Ignore the resend interval and leave `last_digest_sent_at` alone. */
  ignoreInterval?: boolean;
  now?: Date;
}

export async function runDigest(
  admin: SupabaseClient,
  options: RunOptions,
): Promise<RunSummary> {
  const now = options.now ?? new Date();
  const { rows, emailByUserId } = await loadSubscribers(admin, options.onlyUserId);

  const considered = options.onlyUserId
    ? rows.filter((row) => row.user_id === options.onlyUserId)
    : rows;

  // Custom journals, for everyone being considered, in one query rather than
  // one per subscriber.
  const customByUserId = new Map<string, JournalDefinition[]>();
  if (considered.length > 0) {
    const { data: customRows } = await admin
      .from("custom_journals")
      .select("user_id, journal")
      .in(
        "user_id",
        considered.map((row) => row.user_id),
      );

    for (const row of (customRows ?? []) as { user_id: string; journal?: unknown }[]) {
      if (!isUsableJournal(row.journal)) continue;
      const list = customByUserId.get(row.user_id) ?? [];
      list.push(row.journal);
      customByUserId.set(row.user_id, list);
    }
  }

  const outcomes: SubscriberOutcome[] = [];
  const eligible: { row: SubscriberRow; recipient: DigestRecipient }[] = [];

  for (const row of considered) {
    const email = emailByUserId.get(row.user_id);
    if (!email) {
      outcomes.push({
        userId: row.user_id,
        email: "",
        status: "skipped",
        reason: "No email address on this account.",
      });
      continue;
    }

    if (
      !options.ignoreInterval &&
      daysSince(row.last_digest_sent_at, now) < MIN_RESEND_INTERVAL_DAYS
    ) {
      outcomes.push({
        userId: row.user_id,
        email,
        status: "skipped",
        reason: "Already sent a digest within the last six days.",
      });
      continue;
    }

    const recipient: DigestRecipient = {
      email,
      journalIds: row.followed_journal_ids ?? [],
      keywords: row.keywords ?? [],
      customJournals: customByUserId.get(row.user_id) ?? [],
      // A test send should look like a normal week, not like a first-ever
      // digest reaching back to whenever the account was last mailed.
      lastSentAt: options.ignoreInterval ? null : row.last_digest_sent_at,
    };

    if (recipient.journalIds.length === 0) {
      outcomes.push({
        userId: row.user_id,
        email,
        status: "skipped",
        reason: "No journals followed, so there is nothing to report.",
      });
      continue;
    }

    eligible.push({ row, recipient });
  }

  const shared = await fetchSharedArticles(
    eligible.map((entry) => entry.recipient),
    now,
  );

  for (const { row, recipient } of eligible) {
    try {
      await sendToOne(row, recipient);
    } catch (error) {
      /*
       * One recipient's failure must not end the run. Composing and
       * rendering sit outside `sendDigestEmail`'s own error handling, so
       * before this an unexpected throw on subscriber six meant subscribers
       * six to twenty were never attempted — and the summary, built after
       * the loop, could not even say who was missed.
       */
      outcomes.push({
        userId: row.user_id,
        email: recipient.email,
        status: "failed",
        reason: error instanceof Error ? error.message : "Could not build this digest.",
      });
    }
  }

  async function sendToOne(row: SubscriberRow, recipient: DigestRecipient): Promise<void> {
    const digest = await composeDigest(recipient, {
      now,
      articles: shared.articles,
      unresolvedJournalIds: shared.unresolvedJournalIds,
      incomplete: shared.incomplete,
      incompleteReason: shared.error,
    });

    const unsubscribe = unsubscribeUrl(options.siteUrl, row.user_id);
    const renderOptions = { siteUrl: options.siteUrl, unsubscribeUrl: unsubscribe };

    if (options.dryRun) {
      outcomes.push({
        userId: row.user_id,
        email: recipient.email,
        status: "skipped",
        reason: "Dry run — composed but not sent.",
        articleCount: digest.totalCount,
      });
      return;
    }

    const result = await sendDigestEmail({
      to: recipient.email,
      subject: digestSubject(digest),
      html: renderDigestHtml(digest, renderOptions),
      text: renderDigestText(digest, renderOptions),
      unsubscribeUrl: unsubscribe,
    });

    if (!result.ok) {
      outcomes.push({
        userId: row.user_id,
        email: recipient.email,
        status: "failed",
        reason: result.error,
        articleCount: digest.totalCount,
      });
      return;
    }

    // Only now, and only for a real run. A test send that advanced this would
    // cancel the subscriber's actual Monday digest.
    if (!options.ignoreInterval) {
      const { error: updateError } = await admin
        .from("user_settings")
        .update({ last_digest_sent_at: now.toISOString() })
        .eq("user_id", row.user_id);

      if (updateError) {
        // The mail is already gone, so this is not a failed send — but it is
        // worth shouting about: an un-advanced timestamp means next week's
        // run will send this person a second copy of the same week.
        outcomes.push({
          userId: row.user_id,
          email: recipient.email,
          status: "sent",
          reason: `Sent, but could not record the send: ${updateError.message}`,
          articleCount: digest.totalCount,
        });
        return;
      }
    }

    outcomes.push({
      userId: row.user_id,
      email: recipient.email,
      status: "sent",
      articleCount: digest.totalCount,
    });
  }

  return {
    subscribers: considered.length,
    sent: outcomes.filter((o) => o.status === "sent").length,
    skipped: outcomes.filter((o) => o.status === "skipped").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    fetchedArticles: shared.articles.length,
    fetchIncomplete: shared.incomplete,
    fetchError: shared.error,
    outcomes,
  };
}
