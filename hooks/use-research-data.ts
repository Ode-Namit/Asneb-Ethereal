"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RecordModel } from "pocketbase";
import {
  getAuthenticatedUserId,
  getPocketBase,
  hydratePocketBaseAuth,
  isPocketBaseNotFound,
  logPocketBaseError,
  runPocketBaseRequest,
  withAuthenticatedUser,
} from "@/lib/pocketbase";
import type {
  AiAnalysisRecord,
  BookmarkRecord,
  DocumentPageRecord,
  HighlightColor,
  HighlightRecord,
  NoteRecord,
  PdfAnchor,
  PromptMode,
  ResearchNoteKind,
} from "@/lib/types";

type ResearchState = {
  analyses: AiAnalysisRecord[];
  bookmarks: BookmarkRecord[];
  highlights: HighlightRecord[];
  notes: NoteRecord[];
  pages: DocumentPageRecord[];
};

const emptyState: ResearchState = {
  analyses: [],
  bookmarks: [],
  highlights: [],
  notes: [],
  pages: [],
};

function optimisticRecord<T extends RecordModel>(
  fields: Omit<T, keyof RecordModel>,
): T {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    collectionId: "optimistic",
    collectionName: "optimistic",
    created: now,
    updated: now,
    expand: {},
    ...fields,
  } as unknown as T;
}

export function useResearchData(bookId: string) {
  const [research, setResearch] = useState<ResearchState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const channelRef = useRef<BroadcastChannel | null>(null);
  const noteTimers = useRef<Map<string, number>>(new Map());
  const highlightTimers = useRef<Map<string, number>>(new Map());
  const pageIndexRef = useRef<Map<number, DocumentPageRecord>>(new Map());

  const loadResearch = useCallback(async () => {
    const pb = getPocketBase();

    try {
      const userId = await hydratePocketBaseAuth(pb);
      const userFilter = pb.filter("user = {:userId}", { userId });
      const pageFilter = pb.filter("user = {:userId} && book = {:bookId}", {
        userId,
        bookId,
      });
      const [highlights, bookmarks, notes, analyses, pages] = await Promise.all([
        runPocketBaseRequest("List research highlights", () =>
          pb.collection("highlights").getFullList<HighlightRecord>({
            filter: userFilter,
            sort: "-created",
          }),
        ),
        runPocketBaseRequest("List research bookmarks", () =>
          pb.collection("bookmarks").getFullList<BookmarkRecord>({
            filter: userFilter,
            sort: "-created",
          }),
        ),
        runPocketBaseRequest("List research notes", () =>
          pb.collection("notes").getFullList<NoteRecord>({
            filter: userFilter,
            sort: "-updated",
          }),
        ),
        runPocketBaseRequest("List AI analysis history", () =>
          pb.collection("ai_analyses").getFullList<AiAnalysisRecord>({
            filter: userFilter,
            sort: "-created",
          }),
        ),
        runPocketBaseRequest("List indexed PDF pages", () =>
          pb.collection("document_pages").getFullList<DocumentPageRecord>({
            filter: pageFilter,
            sort: "page",
          }),
        ),
      ]);

      pageIndexRef.current = new Map(pages.map((page) => [page.page, page]));
      setResearch({ highlights, bookmarks, notes, analyses, pages });
      setError("");
    } catch (loadError) {
      logPocketBaseError("Load research workstation state", loadError);
      setError("Research persistence is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  const broadcast = useCallback((reason: string) => {
    channelRef.current?.postMessage({ reason, timestamp: Date.now() });
  }, []);

  useEffect(() => {
    void loadResearch();
    const channel = new BroadcastChannel("asneb-research-sync");
    channelRef.current = channel;
    channel.onmessage = () => void loadResearch();

    return () => {
      channel.close();
      channelRef.current = null;
      noteTimers.current.forEach((timer) => window.clearTimeout(timer));
      highlightTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [loadResearch]);

  const currentHighlights = useMemo(
    () => research.highlights.filter((highlight) => highlight.book === bookId),
    [bookId, research.highlights],
  );
  const currentBookmarks = useMemo(
    () => research.bookmarks.filter((bookmark) => bookmark.book === bookId),
    [bookId, research.bookmarks],
  );
  const currentNotes = useMemo(
    () => research.notes.filter((note) => note.book === bookId),
    [bookId, research.notes],
  );
  const currentAnalyses = useMemo(
    () => research.analyses.filter((analysis) => analysis.book === bookId),
    [bookId, research.analyses],
  );

  const addHighlight = useCallback(
    async ({
      anchor,
      color,
      page,
      selectedText,
    }: {
      anchor: PdfAnchor;
      color: HighlightColor;
      page: number;
      selectedText: string;
    }) => {
      const pb = getPocketBase();
      const user = getAuthenticatedUserId(pb);
      if (!user) {
        return;
      }

      const payload = {
        book: bookId,
        page,
        selected_text: selectedText,
        anchor_json: JSON.stringify(anchor),
        color,
        note: "",
        user,
      };
      const optimistic = optimisticRecord<HighlightRecord>(payload);
      setResearch((current) => ({
        ...current,
        highlights: [optimistic, ...current.highlights],
      }));

      try {
        const created = await runPocketBaseRequest("Create highlight", () =>
          pb
            .collection("highlights")
            .create<HighlightRecord>(withAuthenticatedUser(pb, payload)),
        );
        setResearch((current) => ({
          ...current,
          highlights: current.highlights.map((item) =>
            item.id === optimistic.id ? created : item,
          ),
        }));
        broadcast("highlight-created");
      } catch (createError) {
        setResearch((current) => ({
          ...current,
          highlights: current.highlights.filter(
            (item) => item.id !== optimistic.id,
          ),
        }));
        logPocketBaseError("Create highlight", createError);
      }
    },
    [bookId, broadcast],
  );

  const deleteHighlight = useCallback(
    async (highlightId: string) => {
      const pb = getPocketBase();
      const previous = research.highlights;
      setResearch((current) => ({
        ...current,
        highlights: current.highlights.filter((item) => item.id !== highlightId),
      }));

      try {
        await runPocketBaseRequest("Delete highlight", () =>
          pb.collection("highlights").delete(highlightId),
        );
        broadcast("highlight-deleted");
      } catch (deleteError) {
        setResearch((current) => ({ ...current, highlights: previous }));
        logPocketBaseError("Delete highlight", deleteError);
      }
    },
    [broadcast, research.highlights],
  );

  const updateHighlightNote = useCallback(
    (highlightId: string, note: string) => {
      setResearch((current) => ({
        ...current,
        highlights: current.highlights.map((item) =>
          item.id === highlightId ? { ...item, note } : item,
        ),
      }));
      const previousTimer = highlightTimers.current.get(highlightId);
      if (previousTimer) {
        window.clearTimeout(previousTimer);
      }
      highlightTimers.current.set(
        highlightId,
        window.setTimeout(async () => {
          try {
            await runPocketBaseRequest("Autosave highlight note", () =>
              getPocketBase().collection("highlights").update(highlightId, { note }),
            );
            broadcast("highlight-note-updated");
          } catch (saveError) {
            logPocketBaseError("Autosave highlight note", saveError);
          }
        }, 550),
      );
    },
    [broadcast],
  );

  const addNote = useCallback(
    async ({
      anchor,
      content,
      kind = "note",
      page,
    }: {
      anchor?: PdfAnchor | null;
      content: string;
      kind?: ResearchNoteKind;
      page: number;
    }) => {
      const pb = getPocketBase();
      const user = getAuthenticatedUserId(pb);
      if (!user || !content.trim()) {
        return;
      }
      const payload = {
        user,
        book: bookId,
        page,
        kind,
        content: content.trim(),
        anchor_json: anchor ? JSON.stringify(anchor) : "",
      };
      const optimistic = optimisticRecord<NoteRecord>(payload);
      setResearch((current) => ({
        ...current,
        notes: [optimistic, ...current.notes],
      }));

      try {
        const created = await runPocketBaseRequest("Create research note", () =>
          pb.collection("notes").create<NoteRecord>(withAuthenticatedUser(pb, payload)),
        );
        setResearch((current) => ({
          ...current,
          notes: current.notes.map((item) =>
            item.id === optimistic.id ? created : item,
          ),
        }));
        broadcast("note-created");
      } catch (createError) {
        setResearch((current) => ({
          ...current,
          notes: current.notes.filter((item) => item.id !== optimistic.id),
        }));
        logPocketBaseError("Create research note", createError);
      }
    },
    [bookId, broadcast],
  );

  const updateNote = useCallback(
    (noteId: string, content: string) => {
      setResearch((current) => ({
        ...current,
        notes: current.notes.map((item) =>
          item.id === noteId ? { ...item, content } : item,
        ),
      }));
      const previousTimer = noteTimers.current.get(noteId);
      if (previousTimer) {
        window.clearTimeout(previousTimer);
      }
      noteTimers.current.set(
        noteId,
        window.setTimeout(async () => {
          try {
            await runPocketBaseRequest("Autosave research note", () =>
              getPocketBase().collection("notes").update(noteId, { content }),
            );
            broadcast("note-updated");
          } catch (saveError) {
            logPocketBaseError("Autosave research note", saveError);
          }
        }, 550),
      );
    },
    [broadcast],
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      const previous = research.notes;
      setResearch((current) => ({
        ...current,
        notes: current.notes.filter((item) => item.id !== noteId),
      }));
      try {
        await runPocketBaseRequest("Delete research note", () =>
          getPocketBase().collection("notes").delete(noteId),
        );
        broadcast("note-deleted");
      } catch (deleteError) {
        setResearch((current) => ({ ...current, notes: previous }));
        logPocketBaseError("Delete research note", deleteError);
      }
    },
    [broadcast, research.notes],
  );

  const toggleBookmark = useCallback(
    async (page: number) => {
      const pb = getPocketBase();
      const existing = currentBookmarks.find((bookmark) => bookmark.page === page);

      if (existing) {
        setResearch((current) => ({
          ...current,
          bookmarks: current.bookmarks.filter((item) => item.id !== existing.id),
        }));
        try {
          await runPocketBaseRequest("Delete page bookmark", () =>
            pb.collection("bookmarks").delete(existing.id),
          );
          broadcast("bookmark-deleted");
        } catch (deleteError) {
          logPocketBaseError("Delete page bookmark", deleteError);
          void loadResearch();
        }
        return;
      }

      const payload = { book: bookId, page, label: `Page ${page}` };
      try {
        const created = await runPocketBaseRequest("Create page bookmark", () =>
          pb
            .collection("bookmarks")
            .create<BookmarkRecord>(withAuthenticatedUser(pb, payload)),
        );
        setResearch((current) => ({
          ...current,
          bookmarks: [created, ...current.bookmarks],
        }));
        broadcast("bookmark-created");
      } catch (createError) {
        logPocketBaseError("Create page bookmark", createError);
      }
    },
    [bookId, broadcast, currentBookmarks, loadResearch],
  );

  const saveAnalysis = useCallback(
    async ({
      mode,
      page,
      provider,
      response,
      selectedText,
    }: {
      mode: PromptMode;
      page: number;
      provider: string;
      response: string;
      selectedText: string;
    }) => {
      const pb = getPocketBase();
      try {
        const created = await runPocketBaseRequest("Persist tutor analysis", () =>
          pb.collection("ai_analyses").create<AiAnalysisRecord>(
            withAuthenticatedUser(pb, {
              book: bookId,
              page,
              mode,
              selected_text: selectedText,
              response,
              provider,
            }),
          ),
        );
        setResearch((current) => ({
          ...current,
          analyses: [created, ...current.analyses],
        }));
        broadcast("analysis-created");
      } catch (createError) {
        logPocketBaseError("Persist tutor analysis", createError);
      }
    },
    [bookId, broadcast],
  );

  const indexDocumentPage = useCallback(
    async (page: number, content: string) => {
      const normalized = content.replace(/\s+/g, " ").trim();
      if (!normalized) {
        return;
      }

      const pb = getPocketBase();
      const existing = pageIndexRef.current.get(page);
      if (existing?.content === normalized) {
        return;
      }

      try {
        const record = existing
          ? await runPocketBaseRequest("Refresh indexed PDF page", () =>
              pb
                .collection("document_pages")
                .update<DocumentPageRecord>(existing.id, { content: normalized }),
            )
          : await runPocketBaseRequest("Index PDF page", () =>
              pb.collection("document_pages").create<DocumentPageRecord>(
                withAuthenticatedUser(pb, {
                  book: bookId,
                  page,
                  content: normalized,
                }),
              ),
            );
        pageIndexRef.current.set(page, record);
        setResearch((current) => ({
          ...current,
          pages: [
            ...current.pages.filter((item) => item.page !== page),
            record,
          ].sort((left, right) => left.page - right.page),
        }));
      } catch (indexError) {
        logPocketBaseError("Index PDF page", indexError);
      }
    },
    [bookId],
  );

  const findProgressRecord = useCallback(
    async (userId: string) => {
      const pb = getPocketBase();
      try {
        return await pb
          .collection("reading_progress")
          .getFirstListItem(
            pb.filter("book = {:bookId} && user = {:userId}", {
              bookId,
              userId,
            }),
          );
      } catch (findError) {
        if (!isPocketBaseNotFound(findError)) {
          logPocketBaseError("Find reading progress", findError);
        }
        return null;
      }
    },
    [bookId],
  );

  return {
    ...research,
    addHighlight,
    addNote,
    broadcast,
    currentAnalyses,
    currentBookmarks,
    currentHighlights,
    currentNotes,
    deleteHighlight,
    deleteNote,
    error,
    findProgressRecord,
    indexDocumentPage,
    loading,
    reload: loadResearch,
    saveAnalysis,
    toggleBookmark,
    updateHighlightNote,
    updateNote,
  };
}
