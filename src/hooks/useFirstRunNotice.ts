"use client";

import { useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { createPersistedValueStore } from "./createPersistedStore";

const dismissedStore = createPersistedValueStore<boolean>(STORAGE_KEYS.firstRunNoticeDismissed, false);

export function useFirstRunNotice() {
  const [dismissed, setDismissed] = dismissedStore.useValue();

  const dismiss = useCallback(() => setDismissed(true), [setDismissed]);

  return { dismissed, dismiss };
}
