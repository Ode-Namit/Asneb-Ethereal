"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthenticatedUserId, getPocketBase } from "@/lib/pocketbase";

export type HighlightGroup = {
  createdAt: string;
  id: string;
  name: string;
  parentId: string | null;
  updatedAt: string;
};

type HighlightGroupState = {
  assignments: Record<string, string | null>;
  expanded: Record<string, boolean>;
  groups: HighlightGroup[];
};

const HIGHLIGHT_GROUP_PREFIX = "asneb:highlight-groups";
const emptyState: HighlightGroupState = {
  assignments: {},
  expanded: {},
  groups: [],
};

function createGroupId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `group-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getStorageKey(bookId: string | null | undefined) {
  if (!bookId) {
    return null;
  }
  const userId = getAuthenticatedUserId(getPocketBase());
  return userId ? `${HIGHLIGHT_GROUP_PREFIX}:${userId}:${bookId}` : null;
}

function readStoredState(key: string | null) {
  if (!key) {
    return emptyState;
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(key) ?? "",
    ) as Partial<HighlightGroupState>;
    return {
      assignments: parsed.assignments ?? {},
      expanded: parsed.expanded ?? {},
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    };
  } catch {
    return emptyState;
  }
}

export function useHighlightGroups(bookId: string | null | undefined) {
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [state, setState] = useState<HighlightGroupState>(emptyState);

  useEffect(() => {
    const key = getStorageKey(bookId);
    setStorageKey(key);
    setState(readStoredState(key));
  }, [bookId]);

  const persist = useCallback(
    (updater: (current: HighlightGroupState) => HighlightGroupState) => {
      setState((current) => {
        const next = updater(current);
        if (storageKey) {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        }
        return next;
      });
    },
    [storageKey],
  );

  const createGroup = useCallback(
    (name: string, parentId: string | null = null) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return;
      }

      persist((current) => {
        const now = new Date().toISOString();
        const group: HighlightGroup = {
          createdAt: now,
          id: createGroupId(),
          name: trimmedName,
          parentId,
          updatedAt: now,
        };

        return {
          ...current,
          expanded: {
            ...current.expanded,
            ...(parentId ? { [parentId]: true } : {}),
            [group.id]: true,
          },
          groups: [...current.groups, group],
        };
      });
    },
    [persist],
  );

  const moveHighlightToGroup = useCallback(
    (highlightId: string, groupId: string | null) => {
      persist((current) => {
        const assignments = { ...current.assignments };
        if (groupId) {
          assignments[highlightId] = groupId;
        } else {
          delete assignments[highlightId];
        }
        return { ...current, assignments };
      });
    },
    [persist],
  );

  const toggleGroup = useCallback(
    (groupId: string) => {
      persist((current) => ({
        ...current,
        expanded: {
          ...current.expanded,
          [groupId]: !(current.expanded[groupId] ?? true),
        },
      }));
    },
    [persist],
  );

  const expandedGroupIds = useMemo(
    () =>
      new Set(
        Object.entries(state.expanded)
          .filter(([, expanded]) => expanded)
          .map(([groupId]) => groupId),
      ),
    [state.expanded],
  );

  return {
    assignments: state.assignments,
    createGroup,
    expandedGroupIds,
    groups: state.groups,
    moveHighlightToGroup,
    toggleGroup,
  };
}
