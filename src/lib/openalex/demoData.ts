import type { Article } from "@/lib/types";
import { getJournalById } from "@/lib/journals/catalog";

/**
 * Small, hand-written fallback dataset used ONLY when OpenAlex is
 * unreachable. Every title, author, and abstract below is fictitious —
 * invented for this app, not copied or adapted from any real publication —
 * so it can never be mistaken for a genuine research record. Every article
 * here carries `source: "demo"`, and the UI must always visibly label demo
 * data as such; it must never be presented as live OpenAlex results.
 */

interface DemoSeed {
  daysAgo: number;
  journalId: string;
  title: string;
  authors: string[];
  isOpenAccess: boolean | null;
  abstract: string | null;
  doi: string | null;
}

const DEMO_SEEDS: DemoSeed[] = [
  {
    daysAgo: 1,
    journalId: "jap",
    title: "Demo Article: Remote Onboarding Friction and Early Turnover Intentions",
    authors: ["A. Whitfield", "R. Okafor"],
    isOpenAccess: true,
    abstract:
      "This is placeholder demo content, not a real study. It illustrates how a recent, open-access article would appear in the feed, including a short abstract preview.",
    doi: "10.0000/demo.0001",
  },
  {
    daysAgo: 2,
    journalId: "jorb",
    title: "Demo Article: Team Psychological Safety Across Hybrid Work Arrangements",
    authors: ["M. Solano"],
    isOpenAccess: false,
    abstract:
      "Placeholder demo content. Represents a closed-access article card, showing how the feed handles articles without full-text availability.",
    doi: "10.0000/demo.0002",
  },
  {
    daysAgo: 4,
    journalId: "lq",
    title: "Demo Article: Leader Humility and Voice Behavior in Distributed Teams",
    authors: ["K. Ito", "D. Ferreira", "S. Novak"],
    isOpenAccess: true,
    abstract:
      "Placeholder demo content used only when live OpenAlex data is unavailable. Demonstrates multi-author byline rendering.",
    doi: "10.0000/demo.0003",
  },
  {
    daysAgo: 6,
    journalId: "jvb",
    title: "Demo Article: Career Calling and Burnout Trajectories in Early-Career Workers",
    authors: ["P. Alvarez"],
    isOpenAccess: null,
    abstract: null,
    doi: null,
  },
  {
    daysAgo: 9,
    journalId: "amj",
    title: "Demo Article: Algorithmic Management and Perceived Organizational Justice",
    authors: ["T. Higgins", "L. Mbeki"],
    isOpenAccess: true,
    abstract:
      "Placeholder demo content. Shows how the card renders when open-access status is confirmed but a DOI is missing.",
    doi: null,
  },
  {
    daysAgo: 12,
    journalId: "obhdp",
    title: "Demo Article: Decision Fatigue and Ethical Lapses in Managerial Judgment",
    authors: ["N. Osei", "C. Bergström"],
    isOpenAccess: false,
    abstract:
      "Placeholder demo content illustrating a moderately older, closed-access article within the current month grouping.",
    doi: "10.0000/demo.0006",
  },
  {
    daysAgo: 18,
    journalId: "hrm",
    title: "Demo Article: Pay Transparency Policies and Applicant Trust",
    authors: ["V. Castellanos"],
    isOpenAccess: true,
    abstract:
      "Placeholder demo content. Demonstrates a single-author byline with open-access status confirmed.",
    doi: "10.0000/demo.0007",
  },
  {
    daysAgo: 24,
    journalId: "joop",
    title: "Demo Article: Micro-Breaks, Recovery Experiences, and Afternoon Performance",
    authors: ["H. Lindqvist", "J. Park"],
    isOpenAccess: true,
    abstract:
      "Placeholder demo content used for fallback rendering. Represents an article nearing the end of the 'earlier this month' grouping window.",
    doi: "10.0000/demo.0008",
  },
  {
    daysAgo: 33,
    journalId: "orgsci",
    title: "Demo Article: Cross-Functional Coordination Costs in Platform Organizations",
    authors: ["E. Duarte", "R. Kowalski", "A. Singh"],
    isOpenAccess: false,
    abstract:
      "Placeholder demo content. Falls into the 'older' grouping bucket to demonstrate chronological sectioning.",
    doi: "10.0000/demo.0009",
  },
  {
    daysAgo: 41,
    journalId: "jbp",
    title: "Demo Article: Onboarding Mentorship Structures and First-Year Engagement",
    authors: ["F. Reinholt"],
    isOpenAccess: true,
    abstract: null,
    doi: "10.0000/demo.0010",
  },
  {
    daysAgo: 52,
    journalId: "johp",
    title: "Demo Article: Chronic Understaffing and Emotional Exhaustion in Frontline Roles",
    authors: ["G. Adeyemi", "M. Villanueva"],
    isOpenAccess: true,
    abstract:
      "Placeholder demo content. Illustrates an older open-access record still within the 90-day window.",
    doi: "10.0000/demo.0011",
  },
  {
    daysAgo: 61,
    journalId: "pp",
    title: "Demo Article: Structured Interview Adherence and Adverse Impact Reduction",
    authors: ["B. Thorne", "Y. Nakamura"],
    isOpenAccess: false,
    abstract:
      "Placeholder demo content demonstrating a closed-access, older article for filter testing.",
    doi: "10.0000/demo.0012",
  },
  {
    daysAgo: 70,
    journalId: "ijsa",
    title: "Demo Article: Gamified Assessments and Candidate Reactions Across Cultures",
    authors: ["S. Okonjo"],
    isOpenAccess: true,
    abstract:
      "Placeholder demo content. Used to populate search and filter demonstrations with older records.",
    doi: "10.0000/demo.0013",
  },
  {
    daysAgo: 79,
    journalId: "ws",
    title: "Demo Article: Shift Schedule Volatility and Sleep-Adjusted Wellbeing",
    authors: ["I. Malinowski", "C. Yeboah"],
    isOpenAccess: true,
    abstract:
      "Placeholder demo content near the edge of the 90-day retrieval window.",
    doi: "10.0000/demo.0014",
  },
  {
    daysAgo: 86,
    journalId: "arop",
    title: "Demo Article: A Review of Twenty Years of Person-Organization Fit Research",
    authors: ["W. Delgado", "P. Chukwu", "E. Sundqvist"],
    isOpenAccess: true,
    abstract:
      "Placeholder demo content representing a review-style article near the oldest edge of the retrieval window.",
    doi: "10.0000/demo.0015",
  },
];

function addDaysAgoIso(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export function getDemoArticles(): Article[] {
  return DEMO_SEEDS.map((seed) => ({
    id: `demo-${seed.doi ?? seed.title}`,
    title: seed.title,
    authors: seed.authors,
    journalId: seed.journalId,
    journalName: getJournalById(seed.journalId)?.name ?? "Unknown journal",
    publicationDate: addDaysAgoIso(seed.daysAgo),
    isOpenAccess: seed.isOpenAccess,
    abstract: seed.abstract,
    doi: seed.doi,
    articleUrl: null,
    source: "demo",
  }));
}
