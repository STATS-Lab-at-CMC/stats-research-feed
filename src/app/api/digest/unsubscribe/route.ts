import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { verifyUnsubscribe } from "@/lib/digest/unsubscribe";
import { escapeHtml } from "@/lib/digest/render";

/**
 * Unsubscribing, for someone who is not signed in.
 *
 * ## GET shows a page; POST does the work
 *
 * This is the one place in the app where that distinction is load-bearing
 * rather than good manners. University mail systems scan inbound links as a
 * matter of course — this project has already watched them consume sign-in
 * links before the reader clicked. A GET that unsubscribed on sight would be
 * triggered by the scanner, and the reader would stop receiving a digest they
 * never opted out of and could not explain.
 *
 * So the link in the email body is a GET that renders a confirmation page and
 * changes nothing. The button on that page POSTs.
 *
 * `List-Unsubscribe-Post` (the "Unsubscribe" button Gmail and Apple Mail draw
 * themselves) also POSTs, per RFC 8058, so it reaches the same handler and
 * takes effect immediately — which is the behaviour those clients promise
 * their users.
 *
 * ## Why this uses the service-role key
 *
 * The whole point is that it works without a session, so there is no user
 * token to act under and row-level security has no identity to enforce. The
 * HMAC in the link is the authorisation: it proves the bearer was given this
 * exact user's link, and it cannot be edited into someone else's.
 */

export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    padding: 24px; background: #f4f4f5; color: #18181b;
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  main { max-width: 32rem; width: 100%; background: #fff; border: 1px solid #e4e4e7;
         border-radius: 10px; padding: 28px; }
  h1 { margin: 0 0 12px; font-size: 18px; }
  p { margin: 0 0 14px; color: #52525b; }
  button { font: inherit; font-weight: 600; cursor: pointer; padding: 9px 16px;
           border-radius: 7px; border: 1px solid #18181b; background: #18181b; color: #fff; }
  button:disabled { opacity: .6; cursor: default; }
  a { color: #1d4ed8; }
  @media (prefers-color-scheme: dark) {
    body { background: #09090b; color: #fafafa; }
    main { background: #18181b; border-color: #27272a; }
    p { color: #a1a1aa; }
    button { background: #fafafa; color: #18181b; border-color: #fafafa; }
    a { color: #93c5fd; }
  }
</style>
</head>
<body><main>${body}</main></body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

function badLink(): NextResponse {
  return page(
    "Link not recognised",
    `<h1>That unsubscribe link isn't valid</h1>
     <p>It may have been altered in transit, or copied incompletely from the
     email. You can always turn the weekly digest off from your account on the
     site itself.</p>`,
    400,
  );
}

async function unsubscribe(userId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Unsubscribing is not configured on this deployment." };

  const { error } = await admin
    .from("user_settings")
    .update({ digest_enabled: false })
    .eq("user_id", userId);

  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = verifyUnsubscribe(url.searchParams.get("u"), url.searchParams.get("s"));
  if (!userId) return badLink();

  // Renders only. The POST below is what actually changes anything, so a mail
  // scanner following this link does nothing at all.
  return page(
    "Unsubscribe",
    `<h1>Stop sending the weekly digest?</h1>
     <p>You'll keep your account, your watchlist, your keywords and your saved
     articles. Only the Monday email stops.</p>
     <form method="post">
       <button type="submit">Unsubscribe me</button>
     </form>`,
  );
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = verifyUnsubscribe(url.searchParams.get("u"), url.searchParams.get("s"));
  if (!userId) return badLink();

  const result = await unsubscribe(userId);

  if (!result.ok) {
    return page(
      "Something went wrong",
      `<h1>We couldn't turn the digest off</h1>
       <p>${escapeHtml(result.error ?? "Unknown error.")}</p>
       <p>You can switch it off directly in your account on the site.</p>`,
      500,
    );
  }

  return page(
    "Unsubscribed",
    `<h1>Done — no more weekly digests</h1>
     <p>Your account and everything in it is untouched. If you change your
     mind, the switch is under Account → Weekly digest.</p>`,
  );
}
