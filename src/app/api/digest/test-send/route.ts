import { NextResponse } from "next/server";
import { bearerToken, createUserScopedClient } from "@/lib/supabase/serverClient";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { runDigest } from "@/lib/digest/run";
import { missingSendConfig } from "@/lib/digest/send";

/**
 * Sends this week's digest to the caller, and only to the caller.
 *
 * Previewing the HTML proves the email is right; it does not prove the email
 * arrives. Deliverability is its own problem — an unverified sending domain,
 * a spam classifier, a university gateway — and the only way to test it is to
 * actually send one. This is how that happens without putting the cron live
 * and mailing everyone.
 *
 * ## The identity boundary
 *
 * The caller's own token is verified first, through an RLS-bound client.
 * Only then is the admin client used, and only with `onlyUserId` pinned to the
 * id that token resolved to — so the service-role key never acts on an id
 * that came from the request. There is no user parameter to tamper with.
 *
 * `ignoreInterval` means this neither skips because of a recent send nor
 * records one, so a test can be repeated and, more importantly, cannot
 * cancel the sender's real Monday digest.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

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

  const missing = missingSendConfig();
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Sending is not set up on this deployment yet. Missing in Vercel: ${missing.join(
          ", ",
        )}. Remember that environment variables only take effect on a new deployment.`,
      },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set, so the digest cannot be assembled." },
      { status: 503 },
    );
  }

  try {
    const summary = await runDigest(admin, {
      siteUrl: new URL(request.url).origin,
      onlyUserId: userData.user.id,
      ignoreInterval: true,
    });

    const outcome = summary.outcomes[0];

    if (!outcome) {
      return NextResponse.json(
        {
          error:
            "Nothing to send: switch the weekly digest on first, and make sure you follow at least one journal.",
        },
        { status: 400 },
      );
    }

    if (outcome.status === "failed") {
      return NextResponse.json({ error: outcome.reason }, { status: 502 });
    }

    if (outcome.status === "skipped") {
      return NextResponse.json({ error: outcome.reason }, { status: 400 });
    }

    return NextResponse.json({
      sentTo: outcome.email,
      articleCount: outcome.articleCount ?? 0,
      note: outcome.reason,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send the test digest." },
      { status: 500 },
    );
  }
}
