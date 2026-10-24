/**
 * Signed unsubscribe tokens.
 *
 * An unsubscribe link has to work for someone who is not signed in, reading
 * an email on a phone they have not used with this site, possibly months
 * later. So it carries its own proof: the user's id plus an HMAC of that id
 * under a server-side secret. No database lookup is needed to tell a genuine
 * link from a forged one, and a link cannot be edited into someone else's.
 *
 * Deliberately no expiry. People unsubscribe from the email they happen to
 * have open, which is often not the most recent one, and a dead unsubscribe
 * link is how a newsletter becomes spam.
 *
 * The secret is its own variable rather than a reuse of `CRON_SECRET`: these
 * protect different things, and sharing one would mean an unsubscribe token
 * leaking also hands over the ability to trigger a send.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string | null {
  return process.env.DIGEST_UNSUBSCRIBE_SECRET?.trim() || null;
}

function sign(userId: string, key: string): string {
  return createHmac("sha256", key).update(userId).digest("base64url");
}

/** The query string for an unsubscribe link, or null if no secret is set. */
export function unsubscribeParams(userId: string): string | null {
  const key = secret();
  if (!key) return null;
  return `u=${encodeURIComponent(userId)}&s=${sign(userId, key)}`;
}

export function unsubscribeUrl(siteUrl: string, userId: string): string | undefined {
  const params = unsubscribeParams(userId);
  return params ? `${siteUrl}/api/digest/unsubscribe?${params}` : undefined;
}

/**
 * Checks a token and returns the user id it vouches for, or null.
 *
 * Compared with `timingSafeEqual` so the check cannot be turned into an
 * oracle by measuring how long a wrong signature takes to reject.
 */
export function verifyUnsubscribe(userId: string | null, signature: string | null): string | null {
  const key = secret();
  if (!key || !userId || !signature) return null;

  const expected = Buffer.from(sign(userId, key));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) return null;
  return timingSafeEqual(expected, provided) ? userId : null;
}
