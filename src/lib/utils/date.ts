const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses an ISO "YYYY-MM-DD" (or full ISO) date string into a UTC-midnight timestamp. */
export function parseDateMs(date: string | null | undefined): number | null {
  if (!date) return null;
  const ms = Date.parse(date);
  return Number.isNaN(ms) ? null : ms;
}

export function formatPublicationDate(date: string | null | undefined): string {
  const ms = parseDateMs(date);
  if (ms === null) return "Date unavailable";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function daysAgo(date: string | null | undefined, now: number = Date.now()): number | null {
  const ms = parseDateMs(date);
  if (ms === null) return null;
  return Math.floor((now - ms) / DAY_MS);
}

/** Chronological bucket for grouping the feed. */
export type RecencyBucket = "thisWeek" | "earlierThisMonth" | "older" | "undated";

export function recencyBucket(date: string | null | undefined, now: number = Date.now()): RecencyBucket {
  const age = daysAgo(date, now);
  if (age === null) return "undated";
  if (age < 0) return "thisWeek"; // future-dated advance-online-publication edge case
  if (age <= 7) return "thisWeek";
  if (age <= 30) return "earlierThisMonth";
  return "older";
}

export const RECENCY_BUCKET_LABELS: Record<RecencyBucket, string> = {
  thisWeek: "This Week",
  earlierThisMonth: "Earlier This Month",
  older: "Older",
  undated: "Undated",
};

export function daysBetween(startMs: number, endMs: number): number {
  return Math.floor((endMs - startMs) / DAY_MS);
}
