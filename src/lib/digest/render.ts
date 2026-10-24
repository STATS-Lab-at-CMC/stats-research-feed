/**
 * Renders a `Digest` as the HTML and plain text of one email.
 *
 * Email HTML is not web HTML. Everything here is inline-styled, table-free
 * where possible and block-based where not, because a stylesheet is the first
 * thing a mail client throws away: Gmail strips `<style>` from forwarded mail,
 * Outlook's Word renderer ignores most of it, and none of them support the CSS
 * variables the site itself is built on. So the design tokens are re-stated
 * here as literals rather than imported — the duplication is the price of the
 * email looking like the site in clients that will never load its CSS.
 *
 * Also plain text, not as an afterthought: a `text/plain` alternative is what
 * keeps a digest out of spam folders and readable in a terminal mail client,
 * and it is the version screen readers handle best.
 */
import type { Article } from "@/lib/types";
import type { Digest } from "./compose";

const SITE_NAME = "STATS Research Feed";

/** Restated from the site's tokens; see the note above on why these are literals. */
const INK = "#18181b";
const MUTED = "#52525b";
const FAINT = "#71717a";
const RULE = "#e4e4e7";
const ACCENT = "#1d4ed8";
const PAPER = "#ffffff";
const CANVAS = "#f4f4f5";

/** How many articles to list per journal before linking out for the rest. */
const MAX_PER_JOURNAL = 8;

export interface RenderOptions {
  siteUrl: string;
  /**
   * One-click unsubscribe, signed so it works without signing in. Omitted in
   * the preview, which falls back to pointing at the account dialog.
   */
  unsubscribeUrl?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The subject line. The count goes first because it is the one thing worth
 * knowing before opening — the reader explicitly asked for it there.
 */
export function digestSubject(digest: Digest): string {
  if (digest.totalCount === 0) return `${SITE_NAME}: a quiet week`;
  const noun = digest.totalCount === 1 ? "new article" : "new articles";
  const matches = digest.keywordMatches.length;
  const tail = matches > 0 ? ` (${matches} matching your keywords)` : "";
  return `${digest.totalCount} ${noun} in your journals${tail}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "date unknown";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** First three authors, then "et al." — a full list of 40 is noise in an email. */
function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")}, et al.`;
}

function articleHtml(article: Article): string {
  const title = escapeHtml(article.title);
  const href = article.articleUrl ? escapeHtml(article.articleUrl) : null;
  const titleHtml = href
    ? `<a href="${href}" style="color:${ACCENT};text-decoration:none;font-weight:600">${title}</a>`
    : `<span style="font-weight:600">${title}</span>`;

  const meta = [formatAuthors(article.authors), formatDate(article.publicationDate)]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" &middot; ");

  const pdf = article.pdfUrl
    ? ` <a href="${escapeHtml(article.pdfUrl)}" style="color:${ACCENT};text-decoration:none">PDF</a>`
    : "";

  return `
      <tr>
        <td style="padding:0 0 14px 0;font-size:14px;line-height:1.45;color:${INK}">
          ${titleHtml}
          <div style="margin-top:3px;font-size:12px;color:${MUTED}">${meta}${pdf}</div>
        </td>
      </tr>`;
}

function sectionHeadingHtml(text: string, note?: string): string {
  const noteHtml = note
    ? `<span style="font-weight:400;color:${FAINT};font-size:12px"> ${escapeHtml(note)}</span>`
    : "";
  return `
      <tr>
        <td style="padding:6px 0 10px 0;border-top:1px solid ${RULE};font-size:13px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.04em">
          ${escapeHtml(text)}${noteHtml}
        </td>
      </tr>`;
}

export function renderDigestHtml(digest: Digest, options: RenderOptions): string {
  const { siteUrl } = options;
  const sections: string[] = [];

  if (digest.totalCount === 0) {
    sections.push(`
      <tr>
        <td style="padding:4px 0 18px 0;font-size:14px;line-height:1.5;color:${MUTED}">
          Nothing new was published in your journals between
          ${escapeHtml(formatDate(digest.windowStart))} and
          ${escapeHtml(formatDate(digest.windowEnd))}. Quiet weeks happen, and
          an empty digest is still worth sending — it means you have not missed
          anything rather than that the email failed.
        </td>
      </tr>`);
  }

  if (digest.keywordMatches.length > 0) {
    sections.push(
      sectionHeadingHtml(
        "Matching your keywords",
        digest.keywords.join(", "),
      ),
      ...digest.keywordMatches.map(articleHtml),
    );
  }

  for (const group of digest.groups) {
    const shown = group.articles.slice(0, MAX_PER_JOURNAL);
    const remaining = group.articles.length - shown.length;
    sections.push(
      sectionHeadingHtml(
        group.journalName,
        `${group.articles.length} ${group.articles.length === 1 ? "article" : "articles"}`,
      ),
      ...shown.map(articleHtml),
    );
    if (remaining > 0) {
      sections.push(`
      <tr>
        <td style="padding:0 0 14px 0;font-size:13px;color:${MUTED}">
          and ${remaining} more &mdash;
          <a href="${escapeHtml(siteUrl)}" style="color:${ACCENT};text-decoration:none">see them in the feed</a>
        </td>
      </tr>`);
    }
  }

  const warnings: string[] = [];
  if (digest.incomplete) {
    warnings.push(
      `This digest may be incomplete: ${escapeHtml(
        digest.incompleteReason ?? "the article lookup did not finish.",
      )}`,
    );
  }
  if (digest.unresolvedJournalNames.length > 0) {
    warnings.push(
      `No results could be looked up for ${escapeHtml(
        digest.unresolvedJournalNames.join(", "),
      )}.`,
    );
  }

  const warningHtml =
    warnings.length > 0
      ? `
      <tr>
        <td style="padding:12px 14px;margin:0;background:${CANVAS};border-radius:6px;font-size:12px;line-height:1.5;color:${MUTED}">
          ${warnings.join("<br>")}
        </td>
      </tr>`
      : "";

  const manageHtml = options.unsubscribeUrl
    ? `<a href="${escapeHtml(options.unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline">Unsubscribe</a>`
    : `<a href="${escapeHtml(siteUrl)}" style="color:${MUTED};text-decoration:underline">Manage in your account</a>`;

  const countLine =
    digest.totalCount > 0
      ? `<strong style="color:${INK}">${digest.totalCount} ${
          digest.totalCount === 1 ? "new article" : "new articles"
        }</strong> since ${escapeHtml(formatDate(digest.windowStart))}`
      : `No new articles since ${escapeHtml(formatDate(digest.windowStart))}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(digestSubject(digest))}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(
    digestSubject(digest),
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS}">
  <tr>
    <td align="center" style="padding:24px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${PAPER};border:1px solid ${RULE};border-radius:10px">
        <tr>
          <td style="padding:24px 24px 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 0 4px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${FAINT}">
                  ${escapeHtml(SITE_NAME)}
                </td>
              </tr>
              <tr>
                <td style="padding:0 0 18px 0;font-size:15px;line-height:1.5;color:${MUTED}">
                  ${countLine}
                </td>
              </tr>
              ${sections.join("")}
              ${warningHtml}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px 24px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${FAINT};border-top:1px solid ${RULE}">
            <a href="${escapeHtml(siteUrl)}" style="color:${MUTED};text-decoration:underline">Open the feed</a>
            &nbsp;&middot;&nbsp; ${manageHtml}
            <div style="margin-top:8px">
              You are receiving this because you switched on the weekly digest
              in your ${escapeHtml(SITE_NAME)} account.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function renderDigestText(digest: Digest, options: RenderOptions): string {
  const lines: string[] = [];
  lines.push(SITE_NAME.toUpperCase());
  lines.push(
    digest.totalCount > 0
      ? `${digest.totalCount} new ${
          digest.totalCount === 1 ? "article" : "articles"
        } since ${formatDate(digest.windowStart)}`
      : `No new articles since ${formatDate(digest.windowStart)}`,
  );
  lines.push("");

  function articleLines(article: Article): void {
    lines.push(`- ${article.title}`);
    const meta = [formatAuthors(article.authors), formatDate(article.publicationDate)]
      .filter(Boolean)
      .join(" | ");
    if (meta) lines.push(`  ${meta}`);
    if (article.articleUrl) lines.push(`  ${article.articleUrl}`);
    if (article.pdfUrl) lines.push(`  PDF: ${article.pdfUrl}`);
    lines.push("");
  }

  if (digest.keywordMatches.length > 0) {
    lines.push(`MATCHING YOUR KEYWORDS (${digest.keywords.join(", ")})`);
    lines.push("");
    digest.keywordMatches.forEach(articleLines);
  }

  for (const group of digest.groups) {
    const shown = group.articles.slice(0, MAX_PER_JOURNAL);
    lines.push(`${group.journalName.toUpperCase()} (${group.articles.length})`);
    lines.push("");
    shown.forEach(articleLines);
    const remaining = group.articles.length - shown.length;
    if (remaining > 0) lines.push(`  ...and ${remaining} more: ${options.siteUrl}`, "");
  }

  if (digest.incomplete) {
    lines.push(
      `Note: this digest may be incomplete. ${
        digest.incompleteReason ?? "The article lookup did not finish."
      }`,
      "",
    );
  }
  if (digest.unresolvedJournalNames.length > 0) {
    lines.push(
      `Note: no results could be looked up for ${digest.unresolvedJournalNames.join(", ")}.`,
      "",
    );
  }

  lines.push(`Open the feed: ${options.siteUrl}`);
  if (options.unsubscribeUrl) lines.push(`Unsubscribe: ${options.unsubscribeUrl}`);
  lines.push(
    "You are receiving this because you switched on the weekly digest in your account.",
  );

  return lines.join("\n");
}
