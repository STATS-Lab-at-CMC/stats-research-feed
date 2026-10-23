"use client";

import { useEffect, useState } from "react";
import { storage } from "@/lib/storage/localStorageAdapter";
import { STORAGE_KEYS } from "@/lib/storage/keys";

/**
 * A researcher checking this feed "sporadically" doesn't reload once and
 * disappear — they reload repeatedly within one sitting. We only want to
 * advance the "previous visit" baseline when a real gap in activity has
 * passed, otherwise every reload would reset "new since last visit" to
 * nothing and the feature becomes useless.
 */
const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes of inactivity = a new visit

interface VisitState {
  previousVisitAt: number | null;
  hydrated: boolean;
}

export function useVisitTracking(): VisitState {
  const [state, setState] = useState<VisitState>({ previousVisitAt: null, hydrated: false });

  useEffect(() => {
    const now = Date.now();
    const lastActivityAt = storage.get<number | null>(STORAGE_KEYS.lastActivityAt, null);
    let previousVisitAt = storage.get<number | null>(STORAGE_KEYS.previousVisitAt, null);

    const isFirstVisitEver = lastActivityAt === null;
    const gapSinceLastActivity = isFirstVisitEver ? Infinity : now - lastActivityAt;

    if (!isFirstVisitEver && gapSinceLastActivity > SESSION_GAP_MS) {
      // The previous session ended; its last known activity becomes the new baseline.
      previousVisitAt = lastActivityAt;
      storage.set(STORAGE_KEYS.previousVisitAt, previousVisitAt);
    }

    storage.set(STORAGE_KEYS.lastActivityAt, now);
    // One-time session-boundary computation on mount, not a props/state-derived
    // render loop: reading and (conditionally) advancing the persisted visit
    // baseline is the actual side effect this hook exists to perform.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ previousVisitAt, hydrated: true });
  }, []);

  return state;
}
