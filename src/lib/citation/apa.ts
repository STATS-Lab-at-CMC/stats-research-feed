import type { Article } from "@/lib/types";

/**
 * APA 7th edition reference entries for journal articles.
 *
 * Follows the Publication Manual (7th ed.) patterns:
 *
 *   With DOI       Author, A. A., & Author, B. B. (Year). Title of article.
 *                  *Journal Name*, *Volume*(Issue), pages. https://doi.org/xxx
 *   Advance online Author, A. A. (Year). Title of article. *Journal Name*.
 *                  Advance online publication. https://doi.org/xxx
 *   Article number ..., *Volume*(Issue), Article ######. https://doi.org/xxx
 *
 * Produces both plain text and HTML. The HTML carries the italics APA
 * requires on the journal name and volume, which plain text cannot — copying
 * both flavours to the clipboard means pasting into Word or Google Docs lands
 * correctly formatted, while pasting into a plain-text field still works.
 */

/** APA lists the first 19 authors, an ellipsis, then the final author. */
const MAX_LISTED_AUTHORS = 20;
const AUTHORS_BEFORE_ELLIPSIS = 19;

/**
 * Surname particles APA keeps with the surname rather than treating as given
 * names, so "Jan van der Berg" becomes "van der Berg, J." and not "Berg, J. v. d."
 */
const SURNAME_PARTICLES = new Set([
  "van", "von", "de", "del", "della", "der", "den", "di", "da", "dos", "das",
  "du", "la", "le", "les", "ter", "ten", "bin", "ibn", "al", "st", "st.",
]);

/** Suffixes that follow the initials: "Smith, J. A., Jr." */
const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * "Vera M. Schweitzer" → "Schweitzer, V. M."
 *
 * OpenAlex supplies display names, not structured name parts, so this has to
 * infer which tokens are the surname. Particles and suffixes are handled;
 * genuinely ambiguous cases (a two-word surname with no particle) will be
 * wrong, which is why the UI says the citation is worth a read before use.
 */
export function formatAuthorName(displayName: string): string {
  const tokens = displayName.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0];

  let suffix = "";
  if (NAME_SUFFIXES.has(tokens[tokens.length - 1].toLowerCase().replace(/,$/, ""))) {
    suffix = tokens.pop()!.replace(/,$/, "");
  }
  if (tokens.length === 1) return suffix ? `${tokens[0]}, ${suffix}` : tokens[0];

  // Walk back from the end over any particles to find where the surname starts.
  let surnameStart = tokens.length - 1;
  while (
    surnameStart > 1 &&
    SURNAME_PARTICLES.has(tokens[surnameStart - 1].toLowerCase().replace(/\./g, ""))
  ) {
    surnameStart -= 1;
  }

  const surname = tokens.slice(surnameStart).join(" ");
  const initials = tokens
    .slice(0, surnameStart)
    .map((given) => `${given.replace(/\./g, "").charAt(0).toUpperCase()}.`)
    .join(" ");

  const base = initials ? `${surname}, ${initials}` : surname;
  return suffix ? `${base}, ${suffix}` : base;
}

/** Joins formatted names per APA: commas throughout, ampersand before the last. */
function joinAuthors(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

export function formatAuthorList(authors: string[]): string {
  const names = authors.map(formatAuthorName).filter(Boolean);
  if (names.length === 0) return "";

  if (names.length <= MAX_LISTED_AUTHORS) return joinAuthors(names);

  // 21+: first 19, an ellipsis, then the final author — and notably no
  // ampersand before that last name.
  const listed = names.slice(0, AUTHORS_BEFORE_ELLIPSIS).join(", ");
  return `${listed}, . . . ${names[names.length - 1]}`;
}

/**
 * A page value that is really a publisher e-location (SAGE and others emit
 * things like "17456916261445341"), which APA cites as "Article #####"
 * rather than as a page number.
 */
function isArticleNumber(first: string | null, last: string | null): boolean {
  if (!first) return false;
  if (last && last !== first) return false;
  return /^\d{6,}$/.test(first);
}

function formatPages(article: Article): string | null {
  const { firstPage, lastPage } = article;
  if (!firstPage) return null;
  if (isArticleNumber(firstPage, lastPage)) return `Article ${firstPage}`;
  if (!lastPage || lastPage === firstPage) return firstPage;
  // En dash, which APA uses for ranges.
  return `${firstPage}–${lastPage}`;
}

export interface ApaCitation {
  text: string;
  html: string;
  /**
   * True when the reference had to fall back to "Advance online publication"
   * because no volume was available — worth surfacing, since it is a real APA
   * form rather than a defect, but one a reader may want to check.
   */
  advanceOnline: boolean;
}

export function formatApaCitation(article: Article): ApaCitation {
  const authors = formatAuthorList(article.authors);
  const year =
    article.publicationYear ??
    (article.publicationDate ? Number(article.publicationDate.slice(0, 4)) : null);

  // APA uses (n.d.) when no date is available.
  const datePart = year && Number.isFinite(year) ? `(${year}).` : "(n.d.).";

  // Article titles are roman and sentence case in APA. The case is left as the
  // publisher supplied it: OpenAlex returns a mix of title and sentence case,
  // and mechanically lowercasing would destroy proper nouns and acronyms
  // ("Generative AI" → "generative ai"), which is a worse error than casing
  // the reader can see and fix.
  const title = article.title.replace(/\s+/g, " ").trim().replace(/\.$/, "");

  const pages = formatPages(article);
  const hasVolume = Boolean(article.volume);
  const advanceOnline = !hasVolume && !pages;

  const doiUrl = article.doi
    ? `https://doi.org/${article.doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    : null;

  const authorPart = authors ? `${authors} ` : "";

  let sourceText: string;
  let sourceHtml: string;

  if (advanceOnline) {
    sourceText = `${article.journalName}. Advance online publication.`;
    sourceHtml = `<i>${escapeHtml(article.journalName)}</i>. Advance online publication.`;
  } else {
    // Volume is italic; the issue in parentheses beside it is not.
    const volumeText = hasVolume
      ? `, ${article.volume}${article.issue ? `(${article.issue})` : ""}`
      : "";
    const volumeHtml = hasVolume
      ? `, <i>${escapeHtml(article.volume!)}</i>${article.issue ? `(${escapeHtml(article.issue)})` : ""}`
      : "";
    const pagePart = pages ? `, ${pages}` : "";
    sourceText = `${article.journalName}${volumeText}${pagePart}.`;
    sourceHtml = `<i>${escapeHtml(article.journalName)}</i>${volumeHtml}${escapeHtml(pagePart)}.`;
  }

  const doiText = doiUrl ? ` ${doiUrl}` : "";
  const doiHtml = doiUrl ? ` <a href="${escapeHtml(doiUrl)}">${escapeHtml(doiUrl)}</a>` : "";

  return {
    text: `${authorPart}${datePart} ${title}. ${sourceText}${doiText}`.trim(),
    html: `${escapeHtml(authorPart)}${datePart} ${escapeHtml(title)}. ${sourceHtml}${doiHtml}`.trim(),
    advanceOnline,
  };
}
