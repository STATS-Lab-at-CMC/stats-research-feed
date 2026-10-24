import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { runDigest } from "@/lib/digest/run";
import { isDigestSendConfigured } from "@/lib/digest/send";

/**
 * The Monday job. The only thing in this codebase that sends email unprompted.
 *
 * ## Authentication
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that variable is
 * set on the project. This route checks it and refuses everything else, which
 * matters because the URL is public: without the check, anyone who guessed the
 * path could mail every subscriber at will.
 *
 * The secret is compared with `timingSafeEqual`, and a deployment without one
 * configured refuses outright rather than running unauthenticated. "No secret
 * set" is a misconfiguration, not a reason to skip the lock.
 *
 * ## Reading the result
 *
 * The response is a per-subscriber summary rather than a bare "ok", and it is
 * what shows up in the Vercel logs for the run. An empty inbox could mean a
 * quiet week, a Resend rejection, or a cron that never fired, and those need
 * to be distinguishable after the fact.
 */

export const dynamic = "force-dynamic";

/**
 * One OpenAlex fetch plus one Resend call per subscriber. Comfortably inside
 * this at the current scale; a deployment with hundreds of subscribers would
 * want a queue rather than a longer timeout.
 */
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() ?? "";
  if (provided.length !== configured.length) return false;

  // Both are ASCII secrets of equal length by this point.
  let mismatch = 0;
  for (let i = 0; i < configured.length; i++) {
    mismatch |= configured.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set, so the digest cannot read subscribers." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  if (!dryRun && !isDigestSendConfigured()) {
    return NextResponse.json(
      { error: "Set RESEND_API_KEY and DIGEST_FROM_EMAIL before the digest can send." },
      { status: 503 },
    );
  }

  try {
    const summary = await runDigest(admin, {
      // The deployment's own origin, so links in the email point back here
      // rather than at a hard-coded domain that breaks on a preview branch.
      siteUrl: url.origin,
      dryRun,
    });
    return NextResponse.json({ ranAt: new Date().toISOString(), dryRun, ...summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The digest run failed." },
      { status: 500 },
    );
  }
}
