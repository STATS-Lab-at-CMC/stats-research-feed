import { NextResponse } from "next/server";
import type { JournalDefinition } from "@/lib/journals/catalog";
import { composeDigest, MAX_WINDOW_DAYS, type DigestRecipient } from "@/lib/digest/compose";
import { digestSubject, renderDigestHtml, renderDigestText } from "@/lib/digest/render";
import { bearerToken, createUserScopedClient } from "@/lib/supabase/serverClient";

/**
 * Renders *your* weekly digest and sends nothing.
 *
 * This exists so the email can be read before anyone can receive one. The
 * composition and rendering here are the same modules the Monday cron job will
 * call, so what this returns is the email, not an approximation of it — which
 * is the only way to iterate on an email's layout without using subscribers as
 * the test harness.
 *
 * ## Why it needs a bearer token
 *
 * A digest is built from one person's watchlist and keywords, so the route has
 * to know whose. The app keeps its Supabase session in localStorage rather
 * than a cookie, so there is nothing for the server to read implicitly: the
 * caller sends their access token, and the query runs *as them*, under the
 * same row-level security as the browser. No service-role key is involved, and
 * there is no user id parameter to tamper with — the token is the identity.
 */

/** Digest content is per-user and time-sensitive; nothing here may be cached. */
export const dynamic = "force-dynamic";

interface SettingsRow {
  followed_journal_ids?: string[] | null;
  keywords?: string[] | null;
  last_digest_sent_at?: string | null;
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Sign in and send your access token as a Bearer header." },
      { status: 401 },
    );
  }

  const supabase = createUserScopedClient(token);
  if (!supabase) {
    return NextResponse.json(
      { error: "Accounts are not configured on this deployment." },
      { status: 503 },
    );
  }

  // Confirms the token is real and gets the address the digest would go to.
  // Without this a revoked or forged token would simply read no rows and
  // render a plausible-looking empty digest.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "That session is not valid." }, { status: 401 });
  }

  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle<SettingsRow>();

  if (settingsError) {
    return NextResponse.json(
      {
        error:
          "Could not read your settings. If you run this site, check that the weekly-digest migration has been applied.",
        detail: settingsError.message,
      },
      { status: 500 },
    );
  }

  const { data: customRows } = await supabase
    .from("custom_journals")
    .select("journal")
    .eq("user_id", userData.user.id);

  const customJournals = (customRows ?? [])
    .map((row) => (row as { journal?: JournalDefinition }).journal)
    .filter((journal): journal is JournalDefinition => Boolean(journal?.id));

  const url = new URL(request.url);

  // `days` overrides the window so the layout can be checked against a week
  // that actually has articles in it. Clamped to the same ceiling the real
  // job uses, so the preview can never render a digest the job could not send.
  const daysParam = Number(url.searchParams.get("days"));
  const lastSentAt = Number.isFinite(daysParam) && daysParam > 0
    ? new Date(Date.now() - Math.min(daysParam, MAX_WINDOW_DAYS) * 86_400_000).toISOString()
    : settings?.last_digest_sent_at ?? null;

  const recipient: DigestRecipient = {
    email: userData.user.email ?? "",
    journalIds: settings?.followed_journal_ids ?? [],
    keywords: settings?.keywords ?? [],
    customJournals,
    lastSentAt,
  };

  const digest = await composeDigest(recipient);
  const siteUrl = url.origin;
  const format = url.searchParams.get("format");

  if (format === "json") {
    return NextResponse.json({
      subject: digestSubject(digest),
      to: recipient.email,
      watchlistSize: recipient.journalIds.length,
      digest,
    });
  }

  if (format === "text") {
    return new NextResponse(renderDigestText(digest, { siteUrl }), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return new NextResponse(renderDigestHtml(digest, { siteUrl }), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
