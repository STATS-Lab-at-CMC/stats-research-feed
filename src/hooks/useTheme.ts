"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { createPersistedValueStore } from "./createPersistedStore";

/**
 * Light / dark, starting from the system preference.
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

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * The OS preference, read through `useSyncExternalStore` rather than an
 * effect — it is an external system React should subscribe to, not state to
 * mirror. Also means the control updates live if the OS flips at sunset with
 * the page open.
 */
function subscribeToSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSystemSnapshot(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** The server cannot know; the real value arrives immediately after hydration. */
function getSystemServerSnapshot(): boolean {
  return false;
}

export function useTheme() {
  const [preference, setPreference] = themeStore.useValue();
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemSnapshot,
    getSystemServerSnapshot,
  );

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

  /** What is actually on screen right now, with "system" resolved. */
  const resolvedTheme: "light" | "dark" =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  /**
   * Flips to the opposite of what is currently *showing*, not the opposite of
   * what is stored.
   *
   * Those differ on the first click: the default is "system", so a cycle
   * through light → dark → system meant someone on a light OS clicked once and
   * saw nothing change, because "system" and "light" looked identical. One
   * click now always changes the screen.
   *
   * "system" survives as the starting state and stops applying once a choice
   * is made, which is the usual bargain — follow the OS until told otherwise.
   */
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return { theme: preference, resolvedTheme, setTheme, toggleTheme };
}
