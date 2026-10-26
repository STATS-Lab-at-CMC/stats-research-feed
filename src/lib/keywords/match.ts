import type { Article } from "@/lib/types";

/**
 * Matching saved keywords against article text.
 *
 * Matches on word boundaries rather than bare substrings, because the terms a
 * researcher actually saves are the ones substring matching ruins: "calling"
 * would hit every "recalling", "fit" every "benefit", "AI" every "said" and
 * "maintain". Multi-word phrases ("leader emergence") work unchanged, since
 * the boundaries sit at the ends of the whole phrase.
 */

/** Escapes a user-supplied term so it cannot alter the regex it is placed in. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `\b` is defined in terms of `\w`, so it fails where a term starts or ends
 * with punctuation — "p-hacking" or "COVID-19" would never match. Falling back
 * to a lookaround on word characters keeps those working.
 */
function termPattern(term: string): string {
  const escaped = escapeRegex(term.trim());
  const startsWithWord = /^\w/.test(term.trim());
  const endsWithWord = /\w$/.test(term.trim());
  return `${startsWithWord ? "(?<!\\w)" : ""}${escaped}${endsWithWord ? "(?!\\w)" : ""}`;
}

/** One regex for all terms, so a long keyword list is still a single pass. */
export function buildKeywordPattern(keywords: string[]): RegExp | null {
  const terms = keywords.map((term) => term.trim()).filter(Boolean);
  if (terms.length === 0) return null;
  // Longest first, so "leader emergence" wins over "leader" at the same spot.
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  return new RegExp(`(${sorted.map(termPattern).join("|")})`, "gi");
}

/**
 * Which of an article's fields a keyword hit, if any.
 *
 * Title, abstract, and OpenAlex's own index terms. Author names are excluded
 * deliberately: a term like "Lee" or "Wang" would match constantly and drown
 * the signal, and following a person is a different feature from following a
 * topic.
 *
 * The index terms matter most where they are the only thing available —
 * roughly 6% of articles arrive from OpenAlex with no abstract, and until now
 * those could only ever be matched on their title.
 *
 * OpenAlex `topics` are deliberately *not* matched. They are a coarse
 * taxonomy, so the single topic "Workaholism, burnout, and well-being" would
 * make every paper carrying it answer to both "burnout" and "well-being" —
 * including papers about commuting and about playful work design. That is a
 * subject-area browse, not a keyword filter, and folding it in silently would
 * flood the result with things the reader did not ask for.
 */
export function articleMatchesKeywords(article: Article, pattern: RegExp | null): boolean {
  if (!pattern) return false;
  // A /g regex carries lastIndex between calls, which makes repeated .test()
  // on the same instance skip matches. Reset before each article.
  pattern.lastIndex = 0;
  if (pattern.test(article.title)) return true;
  pattern.lastIndex = 0;
  if (article.abstract && pattern.test(article.abstract)) return true;
  return matchedIndexTerms(article, pattern).length > 0;
}

/**
 * The article's own OpenAlex keywords that the reader's terms hit.
 *
 * Exists so a match can be *shown*. An article matching only on an index term
 * has nothing highlighted in its title or abstract, so without this the
 * reader sees a result in a filtered list with no visible reason for being
 * there — which reads as a bug rather than as a feature working.
 *
 * `keywords` is optional at runtime despite the type: an article restored
 * from a saved snapshot written before this field existed will not have one.
 */
export function matchedIndexTerms(article: Article, pattern: RegExp | null): string[] {
  if (!pattern) return [];
  return (article.keywords ?? []).filter((keyword) => {
    pattern.lastIndex = 0;
    return pattern.test(keyword);
  });
}

/**
 * True when the *only* thing linking this article to the reader's terms is an
 * index term — nothing in the title or abstract to highlight. This is the
 * case, and the only case, where the match needs explaining in the UI.
 */
export function matchIsIndexTermOnly(article: Article, pattern: RegExp | null): boolean {
  if (!pattern) return false;
  pattern.lastIndex = 0;
  if (pattern.test(article.title)) return false;
  pattern.lastIndex = 0;
  if (article.abstract && pattern.test(article.abstract)) return false;
  return matchedIndexTerms(article, pattern).length > 0;
}

export interface TextSegment {
  text: string;
  match: boolean;
}

/** Splits text into alternating plain and matched runs, for rendering. */
export function segmentByKeywords(text: string, pattern: RegExp | null): TextSegment[] {
  if (!pattern || !text) return [{ text, match: false }];

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  pattern.lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) segments.push({ text: text.slice(lastIndex, start), match: false });
    segments.push({ text: match[0], match: true });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), match: false });
  return segments.length > 0 ? segments : [{ text, match: false }];
}
