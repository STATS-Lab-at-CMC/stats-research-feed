/**
 * Utilities for handling untrusted text and links that come from OpenAlex
 * (or any external metadata source). React/JSX already escapes plain string
 * children, so these helpers focus on the two remaining risks: control
 * characters sneaking into displayed text, and unsafe URL schemes ending up
 * in an `href`.
 */

const CONTROL_CHAR_PATTERN = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]",
  "g",
);

/** Strips control characters and collapses whitespace in external text before display. */
export function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  const withoutControlChars = value.replace(CONTROL_CHAR_PATTERN, "");
  const collapsed = withoutControlChars.replace(/\s+/g, " ").trim();
  return collapsed.length > 0 ? collapsed : null;
}

/**
 * Only allow http(s) URLs to be used as external links. Rejects
 * `javascript:`, `data:`, and similar schemes that could otherwise be
 * injected via malformed upstream metadata.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function doiToUrl(doi: string | null | undefined): string | null {
  if (!doi) return null;
  const trimmed = doi.trim();
  if (trimmed.length === 0) return null;
  const withUrl = trimmed.startsWith("http") ? trimmed : `https://doi.org/${trimmed.replace(/^doi:/i, "")}`;
  return safeExternalUrl(withUrl);
}
