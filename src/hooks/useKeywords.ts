"use client";

import { useMemo } from "react";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { buildKeywordPattern } from "@/lib/keywords/match";
import { createPersistedIdSetStore, createPersistedValueStore } from "./createPersistedStore";

/**
 * Terms the reader watches for, and whether to highlight them.
 *
 * The terms sync: they are real curation, the same kind of thing as the
 * watchlist, and retyping them on a second device would be the main reason not
 * to bother on a second device at all.
 *
 * Whether to *highlight* does not sync. It is a display preference about how
 * dense the page feels, which is as device-specific as the theme — and it is
 * one click to flip, so carrying it across adds a schema column to save nobody
 * anything.
 *
 * Empty by default. Keywords are a thing a reader opts into for their own
 * research; inventing a starting set would be guessing at someone's field.
 */
const keywordStore = createPersistedIdSetStore(STORAGE_KEYS.keywords, [], "keywords");
const highlightStore = createPersistedValueStore<boolean>(STORAGE_KEYS.highlightKeywords, true);

export function useKeywords() {
  const { ids, add, remove, clear } = keywordStore.useIdSet();
  const [highlight, setHighlight] = highlightStore.useValue();

  const keywords = useMemo(
    () => Array.from(ids).sort((a, b) => a.localeCompare(b)),
    [ids],
  );

  /**
   * One compiled regex for the whole list, rebuilt only when the list changes.
   * Every article in the feed is tested against it on each render pass, so
   * recompiling per article would be the difference between one regex and
   * hundreds.
   */
  const pattern = useMemo(() => buildKeywordPattern(keywords), [keywords]);

  /** Null when highlighting is off, so callers can pass it straight through. */
  const highlightPattern = highlight ? pattern : null;

  return {
    keywords,
    hasKeywords: keywords.length > 0,
    pattern,
    highlight,
    highlightPattern,
    setHighlight,
    addKeyword: (term: string) => {
      const trimmed = term.trim().replace(/\s+/g, " ");
      if (trimmed) add(trimmed);
    },
    removeKeyword: remove,
    clearKeywords: clear,
  };
}
