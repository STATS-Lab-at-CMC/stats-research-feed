/**
 * Thin, isolated wrapper around `localStorage`.
 *
 * Every other module in the app reads/writes state through this adapter
 * rather than calling `localStorage` directly. That keeps a V2 migration to
 * a real backend (e.g. Supabase) to a single file: swap the implementation
 * of `get`/`set`/`remove` for network calls and nothing else in the app
 * needs to change.
 *
 * Guards against SSR (no `window`), private-browsing quota errors, and
 * malformed JSON already stored under a key.
 */

export interface StorageAdapter {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

class LocalStorageAdapter implements StorageAdapter {
  get<T>(key: string, fallback: T): T {
    if (!isBrowser()) return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded or storage disabled (e.g. private browsing). The app
      // continues to function with in-memory state for this session.
    }
  }

  remove(key: string): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter();
