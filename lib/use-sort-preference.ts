"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthenticatedUserId, getPocketBase } from "@/lib/pocketbase";
import { sortOptions, type SortOption } from "@/lib/sorting";

const SORT_PREFERENCE_PREFIX = "asneb:default-sort";

function isSortOption(value: string | null): value is SortOption {
  return sortOptions.some((option) => option.value === value);
}

function getPreferenceKey() {
  const userId = getAuthenticatedUserId(getPocketBase());
  return userId ? `${SORT_PREFERENCE_PREFIX}:${userId}` : null;
}

export function useUserSortPreference(defaultSort: SortOption = "newest") {
  const [sortOrder, setSortOrder] = useState<SortOption>(defaultSort);
  const [preferenceKey, setPreferenceKey] = useState<string | null>(null);

  useEffect(() => {
    const key = getPreferenceKey();
    setPreferenceKey(key);

    if (!key) {
      setSortOrder(defaultSort);
      return;
    }

    const savedSort = window.localStorage.getItem(key);
    setSortOrder(isSortOption(savedSort) ? savedSort : defaultSort);
  }, [defaultSort]);

  useEffect(() => {
    function syncSortPreference(event: StorageEvent) {
      if (event.key !== preferenceKey) {
        return;
      }
      setSortOrder(isSortOption(event.newValue) ? event.newValue : defaultSort);
    }

    window.addEventListener("storage", syncSortPreference);
    return () => window.removeEventListener("storage", syncSortPreference);
  }, [defaultSort, preferenceKey]);

  const updateSortOrder = useCallback(
    (nextSort: SortOption) => {
      setSortOrder(nextSort);
      const key = preferenceKey ?? getPreferenceKey();
      if (!key) {
        return;
      }
      setPreferenceKey(key);
      window.localStorage.setItem(key, nextSort);
    },
    [preferenceKey],
  );

  return [sortOrder, updateSortOrder] as const;
}
