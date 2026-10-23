/**
 * The STATS Research Feed default journal catalog.
 *
 * Each journal is identified by ISSNs rather than a fuzzy title match or a
 * hand-typed OpenAlex Source ID. OpenAlex Source IDs are resolved at runtime
 * (see `src/lib/openalex/sources.ts`) by querying OpenAlex's
 * `/sources?filter=issn:...` endpoint, which is the stable-identifier
 * approach OpenAlex itself recommends. We never hardcode a guessed Source ID.
 *
 * ISSNs below were cross-checked against the ISSN International Centre
 * portal (portal.issn.org), publisher pages, and Wikipedia during
 * development. A journal is marked `confidence: "low"` if only one ISSN
 * could be confidently identified (still enough for OpenAlex resolution,
 * but flagged here for transparency). None are fabricated.
 */

export interface JournalDefinition {
  /** Stable internal identifier, independent of any external API. */
  id: string;
  name: string;
  /** Print and/or online ISSNs, used to resolve the OpenAlex Source ID. */
  issns: string[];
  publisher?: string;
  /** Whether this journal is part of the user's watchlist on first visit. */
  defaultFollowed: boolean;
  confidence: "verified" | "low";
}

export const JOURNAL_CATALOG: JournalDefinition[] = [
  {
    id: "amj",
    name: "Academy of Management Journal",
    issns: ["0001-4273", "1948-0989"],
    publisher: "Academy of Management",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "amr",
    name: "Academy of Management Review",
    issns: ["0363-7425", "1930-3807"],
    publisher: "Academy of Management",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "asq",
    name: "Administrative Science Quarterly",
    issns: ["0001-8392", "1930-3815"],
    publisher: "SAGE / Cornell Johnson",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "arop",
    name: "Annual Review of Organizational Psychology and Organizational Behavior",
    issns: ["2327-0608", "2327-0616"],
    publisher: "Annual Reviews",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "ejwop",
    name: "European Journal of Work and Organizational Psychology",
    issns: ["1359-432X", "1464-0643"],
    publisher: "Taylor & Francis",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "gom",
    name: "Group & Organization Management",
    issns: ["1059-6011", "1552-3993"],
    publisher: "SAGE",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "hp",
    name: "Human Performance",
    issns: ["0895-9285", "1532-7043"],
    publisher: "Taylor & Francis",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "hrdq",
    name: "Human Resource Development Quarterly",
    issns: ["1044-8004", "1532-1096"],
    publisher: "Wiley",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "hrm",
    name: "Human Resource Management",
    issns: ["0090-4848", "1099-050X"],
    publisher: "Wiley",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "iopsp",
    name: "Industrial and Organizational Psychology: Perspectives on Science and Practice",
    issns: ["1754-9426", "1754-9434"],
    publisher: "Cambridge University Press",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "ijsa",
    name: "International Journal of Selection and Assessment",
    issns: ["0965-075X", "1468-2389"],
    publisher: "Wiley",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "jap",
    name: "Journal of Applied Psychology",
    issns: ["0021-9010", "1939-1854"],
    publisher: "American Psychological Association",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "jbp",
    name: "Journal of Business and Psychology",
    issns: ["0889-3268", "1573-353X"],
    publisher: "Springer",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "jom",
    name: "Journal of Management",
    issns: ["0149-2063", "1557-1211"],
    publisher: "SAGE",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "jmp",
    name: "Journal of Managerial Psychology",
    issns: ["0268-3946", "1758-7778"],
    publisher: "Emerald",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "johp",
    name: "Journal of Occupational Health Psychology",
    issns: ["1076-8998", "1939-1307"],
    publisher: "American Psychological Association",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "joop",
    name: "Journal of Occupational and Organizational Psychology",
    issns: ["0963-1798", "2044-8325"],
    publisher: "Wiley / British Psychological Society",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "jorb",
    name: "Journal of Organizational Behavior",
    issns: ["0894-3796", "1099-1379"],
    publisher: "Wiley",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "jpp",
    name: "Journal of Personnel Psychology",
    issns: ["1866-5888", "2190-5150"],
    publisher: "Hogrefe",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "jvb",
    name: "Journal of Vocational Behavior",
    issns: ["0001-8791", "1095-9084"],
    publisher: "Elsevier",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "lq",
    name: "Leadership Quarterly",
    issns: ["1048-9843", "1873-3409"],
    publisher: "Elsevier",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "orgsci",
    name: "Organization Science",
    issns: ["1047-7039", "1526-5455"],
    publisher: "INFORMS",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "obhdp",
    name: "Organizational Behavior and Human Decision Processes",
    issns: ["0749-5978", "1095-9920"],
    publisher: "Elsevier",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "opr",
    name: "Organizational Psychology Review",
    issns: ["2041-3866", "2041-3874"],
    publisher: "SAGE",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "pp",
    name: "Personnel Psychology",
    issns: ["0031-5826", "1744-6570"],
    publisher: "Wiley",
    defaultFollowed: true,
    confidence: "verified",
  },
  {
    id: "ws",
    name: "Work & Stress",
    issns: ["0267-8373", "1464-5335"],
    publisher: "Taylor & Francis",
    defaultFollowed: true,
    confidence: "verified",
  },
];

export function getJournalById(id: string): JournalDefinition | undefined {
  return JOURNAL_CATALOG.find((journal) => journal.id === id);
}

export const DEFAULT_FOLLOWED_JOURNAL_IDS = JOURNAL_CATALOG.filter(
  (journal) => journal.defaultFollowed,
).map((journal) => journal.id);
