import { NextResponse } from "next/server";
import { bearerToken, createUserScopedClient } from "@/lib/supabase/serverClient";
import { missingSendConfig } from "@/lib/digest/send";

/**
 * What is and is not configured for the digest on this deployment.
 *
 * Exists because "I clicked the button and no email arrived" has at least six
 * causes — an unset variable, a variable set but not yet deployed, no
 * service-role key, the digest switch off, an empty watchlist, a Resend
 * rejection — and from outside they are indistinguishable. Every one of those
 * shows up here by name.
 *
 * Reports **presence only**. No value, no prefix, no length, not even whether
 * a value parses. A missing variable's name is operational information; its
 * contents are a credential.
 *
 * Requires a signed-in caller, and reports that caller's own digest state
 * alongside the deployment's — the two together are what actually determine
 * whether a given person receives an email.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const supabase = createUserScopedClient(token);
  if (!supabase) {
    return NextResponse.json(
      { error: "Accounts are not configured on this deployment." },
      { status: 503 },
    );
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "That session is not valid." }, { status: 401 });
  }

  const present = (name: string) => Boolean(process.env[name]?.trim());

  const deployment = {
    RESEND_API_KEY: present("RESEND_API_KEY"),
    DIGEST_FROM_EMAIL: present("DIGEST_FROM_EMAIL"),
    SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
    CRON_SECRET: present("CRON_SECRET"),
    DIGEST_UNSUBSCRIBE_SECRET: present("DIGEST_UNSUBSCRIBE_SECRET"),
  };

  const { data: settings } = await supabase
    .from("user_settings")
    .select("digest_enabled, followed_journal_ids, last_digest_sent_at")
    .eq("user_id", userData.user.id)
    .maybeSingle<{
      digest_enabled?: boolean | null;
      followed_journal_ids?: string[] | null;
      last_digest_sent_at?: string | null;
    }>();

  const missing = Object.entries(deployment)
    .filter(([, set]) => !set)
    .map(([name]) => name);

  const blockers: string[] = [];
  if (missingSendConfig().length > 0) blockers.push("Sending is not configured.");
  if (!deployment.SUPABASE_SERVICE_ROLE_KEY) {
    blockers.push("No service-role key, so subscribers cannot be read.");
  }
  if (!settings?.digest_enabled) blockers.push("Your digest switch is off.");
  if ((settings?.followed_journal_ids?.length ?? 0) === 0) {
    blockers.push("You follow no journals, so there would be nothing to send.");
  }

  return NextResponse.json({
    deployment,
    missing,
    you: {
      email: userData.user.email,
      digestEnabled: settings?.digest_enabled === true,
      followedJournals: settings?.followed_journal_ids?.length ?? 0,
      lastDigestSentAt: settings?.last_digest_sent_at ?? null,
    },
    wouldSend: blockers.length === 0,
    blockers,
    note: "Environment variables only take effect on a deployment created after they were added.",
  });
}
