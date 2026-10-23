import type { JournalDefinition } from "@/lib/journals/catalog";
import { openAlexGet, type OpenAlexListResponse } from "./client";

/**
 * Free-text journal search against OpenAlex's `/sources`, used by "Add a
 * journal" to reach anything beyond the built-in catalog.
 *
 * Goes through the same proxy as every other OpenAlex call, so it carries the
 * API key and counts against the same budget.
 */

const MAX_RESULTS = 8;

interface OpenAlexSourceSearchRecord {
  id: string;
  display_name: string;
  issn?: string[] | null;
  issn_l?: string | null;
  host_organization_name?: string | null;
  works_count?: number | null;
  type?: string | null;
}

export interface JournalSearchResult extends JournalDefinition {
  /** Rough size signal, shown so an obscure namesake is distinguishable from the real journal. */
  worksCount: number | null;
}

/** "https://openalex.org/S45419345" → "S45419345" */
function shortSourceId(id: string): string {
  return id.replace(/^https?:\/\/openalex\.org\//i, "");
}

export async function searchJournals(query: string): Promise<JournalSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const result = await openAlexGet<OpenAlexListResponse<OpenAlexSourceSearchRecord>>("/sources", {
    search: trimmed,
    // Excludes repositories, conference series, and ebook platforms, which
    // are all "sources" to OpenAlex but not things to follow as a journal.
    filter: "type:journal",
    "per-page": String(MAX_RESULTS),
    select: "id,display_name,issn,issn_l,host_organization_name,works_count,type",
  });

  if (!result.ok) throw new Error(result.error);

  return result.data.results.map((source) => {
    const issns = Array.from(
      new Set([source.issn_l, ...(source.issn ?? [])].filter((i): i is string => Boolean(i))),
    );
    return {
      /**
       * Namespaced by OpenAlex id, which makes it stable and collision-free
       * against the built-in catalog's short slugs ("amj", "amr", …).
       */
      id: `oa-${shortSourceId(source.id)}`,
      name: source.display_name,
      issns,
      publisher: source.host_organization_name ?? undefined,
      // Already known, so this journal never needs an ISSN lookup — which also
      // means journals OpenAlex indexes without an ISSN still work.
      openAlexSourceId: shortSourceId(source.id),
      isCustom: true,
      // Resolution is exact rather than inferred from a title match, so there
      // is no low-confidence case here the way there is for the hand-built
      // catalog.
      confidence: "verified" as const,
      // Adding a journal is itself the act of following it; this field only
      // governs which catalog entries are on by default for a new visitor.
      defaultFollowed: true,
      worksCount: source.works_count ?? null,
    };
  });
}
