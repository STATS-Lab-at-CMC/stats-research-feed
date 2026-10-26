/**
 * Sending one digest through Resend.
 *
 * A plain `fetch` rather than the Resend SDK: this makes exactly one API call
 * with a JSON body, and a dependency that has to be kept current for the rest
 * of the project's life is a poor trade for saving fifteen lines.
 *
 * ## List-Unsubscribe, and why the visible link is not the same thing
 *
 * Two unsubscribe routes are advertised, for two different readers:
 *
 *  - The `List-Unsubscribe` / `List-Unsubscribe-Post` headers, which let Gmail
 *    and Apple Mail show their own "Unsubscribe" button and **POST** to it.
 *    Gmail's bulk-sender rules expect these, and mail that lacks them is more
 *    likely to be filtered.
 *  - The link in the email body, which is a plain **GET** to a confirmation
 *    page that mutates nothing until a button is pressed.
 *
 * That split is not pedantry about HTTP verbs. This project has already been
 * bitten by institutional mail scanners silently following links in sign-in
 * emails and consuming them before the reader clicked. A GET that
 * unsubscribed on sight would be unsubscribed by the scanner, and the reader
 * would simply stop receiving a digest they never opted out of.
 */
import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendDigestArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Signed, session-free. Omitted only if no unsubscribe secret is configured. */
  unsubscribeUrl?: string;
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

/**
 * Which send-related variables are missing, by name.
 *
 * Returns names rather than a bare boolean because "sending is not
 * configured" is a useless thing to read when five variables could be the
 * cause and the deployment dashboard is in another tab. Names only — never
 * values, and never whether a value looks valid.
 */
export function missingSendConfig(): string[] {
  const required = ["RESEND_API_KEY", "DIGEST_FROM_EMAIL"] as const;
  return required.filter((name) => !process.env[name]?.trim());
}


export async function sendDigestEmail(args: SendDigestArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.DIGEST_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Sending is not configured: set RESEND_API_KEY and DIGEST_FROM_EMAIL.",
    };
  }

  const headers: Record<string, string> = {};
  if (args.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${args.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!response.ok) {
      // Resend's own message names the actual problem — an unverified sending
      // domain, an invalid address — which is what a cron log needs to carry.
      return {
        ok: false,
        error: body?.message ?? `Resend responded with status ${response.status}`,
      };
    }

    return { ok: true, id: body?.id ?? null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not reach Resend",
    };
  }
}
