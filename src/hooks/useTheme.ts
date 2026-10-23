"use client";

import { useCallback, useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { createPersistedValueStore } from "./createPersistedStore";

/**
 * Light / dark / follow-the-system.
 *
 * Deliberately **not** synced. A theme is a property of the device you are
 * reading on — a laptop in a bright office and a phone at night want different
 * answers — so forcing one choice across devices would be worse than letting
 * each pick. It is also the only preference whose correct value the OS already
 * knows, which is why "system" is the default rather than an afterthought.
 */
export type ThemePreference = "system" | "light" | "dark";

const themeStore = createPersistedValueStore<ThemePreference>(STORAGE_KEYS.theme, "system");

/**
 * Must match the inline script in `app/layout.tsx` exactly. Both write the same
 * attribute from the same stored value; the script runs before first paint so
 * the page never flashes the wrong palette, and this keeps it in step
 * afterwards.
 */
function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

export function useTheme() {
  const [preference, setPreference] = themeStore.useValue();

  // Syncing an external system (the document element) with React state is
  // exactly what an effect is for.
  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setPreference(next);
      // Applied immediately as well as in the effect, so the change lands on
      // the same frame as the click rather than a render later.
      applyTheme(next);
    },
    [setPreference],
  );

  /** Cycles light → dark → system, which keeps one control doing all three. */
  const cycleTheme = useCallback(() => {
    setTheme(preference === "light" ? "dark" : preference === "dark" ? "system" : "light");
  }, [preference, setTheme]);

  return { theme: preference, setTheme, cycleTheme };
}
