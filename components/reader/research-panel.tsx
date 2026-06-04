"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bookmark,
  BookOpen,
  Bot,
  Clipboard,
  Clock3,
  FileSearch,
  Filter,
  FlaskConical,
  Highlighter,
  LoaderCircle,
  Map,
  MessageSquareText,
  Network,
  NotebookPen,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SortSelect } from "@/components/ui/sort-select";
import { getAuthenticatedUserId, getPocketBase, logPocketBaseError } from "@/lib/pocketbase";
import { formatResearchDate, getHighlightColor, highlightColors } from "@/lib/research";
import {
  getPocketBaseSort,
  sortByOption,
  type SortOption,
} from "@/lib/sorting";
import type {
  AiAnalysisRecord,
  BookmarkRecord,
  BookRecord,
  DocumentPageRecord,
  HighlightColor,
  HighlightRecord,
  NoteRecord,
  PromptMode,
} from "@/lib/types";

export type ReaderTool =
  | "contents"
  | "search"
  | "highlights"
  | "notes"
  | "bookmarks"
  | "history"
  | "progress"
  | "topology"
  | "notebook";

export type OutlineEntry = {
  page: number;
  title: string;
};

const toolMeta: Record<
  ReaderTool,
  { icon: typeof BookOpen; label: string; subtitle: string }
> = {
  contents: {
    icon: BookOpen,
    label: "Document Map",
    subtitle: "Table of contents and page navigator",
  },
  search: {
    icon: Search,
    label: "Sanctuary Search",
    subtitle: "Current PDF and global memory index",
  },
  highlights: {
    icon: Highlighter,
    label: "Memory Fragments",
    subtitle: "Persistent passage anchors",
  },
  notes: {
    icon: MessageSquareText,
    label: "Notes Matrix",
    subtitle: "Inline and sticky memory notes",
  },
  bookmarks: {
    icon: Bookmark,
    label: "Bookmarks",
    subtitle: "Saved reading coordinates",
  },
  history: {
    icon: Bot,
    label: "Companion Archive",
    subtitle: "Recent AI reflection history",
  },
  progress: {
    icon: Activity,
    label: "Progress Timeline",
    subtitle: "Reading memory and session state",
  },
  topology: {
    icon: Network,
    label: "Memory Graph",
    subtitle: "Current document constellation",
  },
  notebook: {
    icon: NotebookPen,
    label: "Memory Atlas",
    subtitle: "Fragments, notes, and companion syntheses",
  },
};

function PanelShell({
  children,
  onClose,
  tool,
}: {
  children: React.ReactNode;
  onClose: () => void;
  tool: ReaderTool;
}) {
  const meta = toolMeta[tool];
  const Icon = meta.icon;

  return (
    <motion.aside
      className="floating-glass fixed inset-y-0 left-0 z-50 flex w-full flex-col border-r border-pearl/10 shadow-[24px_0_70px_rgba(0,0,0,0.38)] sm:w-[410px] md:left-[52px]"
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: "-100%" }}
      transition={{ type: "spring", damping: 29, stiffness: 270 }}
    >
      <div className="border-b border-pearl/10 px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-aureate/25 bg-aureate/[0.08] p-2 shadow-halo">
              <Icon className="h-4 w-4 text-aureate" />
            </div>
            <div>
              <div className="hud-label text-[0.5rem]">Sanctuary Module</div>
              <div className="mt-1 text-sm font-semibold text-white">
                {meta.label}
              </div>
            </div>
          </div>
          <button
            aria-label="Close research panel"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-pearl/[0.06] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
          {meta.subtitle}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </motion.aside>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="spatial-panel rounded-lg border border-dashed border-pearl/15 bg-pearl/[0.035] px-4 py-8 text-center text-xs leading-6 text-slate-500">
      {children}
    </div>
  );
}

function HighlightCard({
  highlight,
  onAsk,
  onDelete,
  onNavigate,
  onUpdateNote,
}: {
  highlight: HighlightRecord;
  onAsk: (text: string) => void;
  onDelete: (highlightId: string) => void;
  onNavigate: (page: number, highlightId?: string) => void;
  onUpdateNote: (highlightId: string, note: string) => void;
}) {
  const color = getHighlightColor(highlight.color);

  return (
    <div
      className={`spatial-panel rounded-lg border border-l-2 ${color.ring} ${color.soft} p-3`}
    >
      <button
        className="w-full text-left"
        onClick={() => onNavigate(highlight.page, highlight.id)}
        type="button"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-mono text-[0.61rem] tracking-widest text-slate-500">
            <span
              className={`h-2.5 w-2.5 rounded-full ${color.solid} shadow-[0_0_12px_rgba(255,255,255,0.18)]`}
            />
            PAGE {highlight.page}
          </span>
          <span className="flex items-center gap-2">
            {highlight.note.trim() && (
              <span className="flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/[0.1] px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-amber-100/80">
                <MessageSquareText className="h-3 w-3" />
                Note
              </span>
            )}
            <span className="text-[0.6rem] text-slate-600">
              {formatResearchDate(highlight.updated)}
            </span>
          </span>
        </div>
        <p className={`mt-2 line-clamp-4 text-xs leading-5 ${color.text}`}>
          {highlight.selected_text}
        </p>
      </button>
      <textarea
        className="mt-3 min-h-16 w-full resize-y rounded-md border border-slate-700/45 bg-slate-950/62 px-2.5 py-2 text-[0.7rem] leading-5 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-aureate/55 focus:shadow-halo"
        onChange={(event) => onUpdateNote(highlight.id, event.target.value)}
        placeholder="Attach a note to this evidence..."
        value={highlight.note}
      />
      <div className="mt-2 flex items-center gap-1">
        <button
          aria-label="Copy highlight"
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-cyan-200"
          onClick={() => void navigator.clipboard.writeText(highlight.selected_text)}
          type="button"
        >
          <Clipboard className="h-3.5 w-3.5" />
        </button>
        <button
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[0.63rem] font-semibold text-violet-200 transition hover:bg-violet-400/[0.1]"
          onClick={() => onAsk(highlight.selected_text)}
          type="button"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask companion
        </button>
        <button
          aria-label="Delete highlight"
          className="ml-auto rounded-md p-1.5 text-slate-600 transition hover:bg-rose-400/[0.08] hover:text-rose-200"
          onClick={() => onDelete(highlight.id)}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function NoteCard({
  note,
  onDelete,
  onNavigate,
  onUpdate,
}: {
  note: NoteRecord;
  onDelete: (noteId: string) => void;
  onNavigate: (page: number) => void;
  onUpdate: (noteId: string, content: string) => void;
}) {
  return (
    <div className="spatial-panel rounded-lg border border-pearl/10 bg-pearl/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          className="font-mono text-[0.61rem] uppercase tracking-widest text-amber-200/75"
          onClick={() => onNavigate(note.page)}
          type="button"
        >
          {note.kind} // PAGE {note.page}
        </button>
        <button
          aria-label="Delete note"
          className="text-slate-600 transition hover:text-rose-200"
          onClick={() => onDelete(note.id)}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        className="mt-3 min-h-20 w-full resize-y rounded-md border border-slate-700/35 bg-slate-950/50 px-2.5 py-2 text-xs leading-5 text-slate-300 outline-none transition focus:border-amber-300/45"
        onChange={(event) => onUpdate(note.id, event.target.value)}
        value={note.content}
      />
    </div>
  );
}

export function ResearchPanel({
  activePage,
  analyses,
  book,
  bookmarks,
  currentAnalyses,
  currentBookmarks,
  currentHighlights,
  currentNotes,
  highlights,
  indexedPages,
  notes,
  numPages,
  onAddStickyNote,
  onAsk,
  onClose,
  onDeleteHighlight,
  onDeleteNote,
  onNavigate,
  onOpenAnalysis,
  onToggleBookmark,
  onUpdateHighlightNote,
  onUpdateNote,
  open,
  outline,
  tool,
}: {
  activePage: number;
  analyses: AiAnalysisRecord[];
  book: BookRecord | null;
  bookmarks: BookmarkRecord[];
  currentAnalyses: AiAnalysisRecord[];
  currentBookmarks: BookmarkRecord[];
  currentHighlights: HighlightRecord[];
  currentNotes: NoteRecord[];
  highlights: HighlightRecord[];
  indexedPages: DocumentPageRecord[];
  notes: NoteRecord[];
  numPages: number;
  onAddStickyNote: (content: string) => void;
  onAsk: (text: string) => void;
  onClose: () => void;
  onDeleteHighlight: (highlightId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onNavigate: (page: number, highlightId?: string) => void;
  onOpenAnalysis: (analysis: AiAnalysisRecord) => void;
  onToggleBookmark: (page: number) => void;
  onUpdateHighlightNote: (highlightId: string, note: string) => void;
  onUpdateNote: (noteId: string, content: string) => void;
  open: boolean;
  outline: OutlineEntry[];
  tool: ReaderTool;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"book" | "global">("book");
  const [color, setColor] = useState<HighlightColor | "all">("all");
  const [date, setDate] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOption>("newest");
  const [stickyDraft, setStickyDraft] = useState("");
  const [globalPageMatches, setGlobalPageMatches] = useState<DocumentPageRecord[]>(
    [],
  );
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (tool !== "search" || scope !== "global" || query.trim().length < 2) {
      setGlobalPageMatches([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      const pb = getPocketBase();
      const userId = getAuthenticatedUserId(pb);
      if (!userId) {
        return;
      }

      setSearching(true);
      try {
        const result = await pb.collection("document_pages").getList<DocumentPageRecord>(
          1,
          60,
          {
            filter: pb.filter("user = {:userId} && content ~ {:query}", {
              userId,
              query: query.trim(),
            }),
            sort: getPocketBaseSort(sortOrder, "content"),
          },
        );
        setGlobalPageMatches(result.items);
      } catch (searchError) {
        logPocketBaseError("Global PDF search", searchError);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => window.clearTimeout(timeout);
  }, [query, scope, sortOrder, tool]);

  const visibleHighlights = useMemo(() => {
    const source = scope === "book" ? currentHighlights : highlights;
    return sortByOption(
      source.filter((highlight) => {
        const matchesQuery =
          !query ||
          `${highlight.selected_text} ${highlight.note}`
            .toLowerCase()
            .includes(query.toLowerCase());
        const matchesColor = color === "all" || highlight.color === color;
        const matchesDate = !date || highlight.created.slice(0, 10) >= date;
        return matchesQuery && matchesColor && matchesDate;
      }),
      sortOrder,
      (highlight) => highlight.selected_text,
    );
  }, [color, currentHighlights, date, highlights, query, scope, sortOrder]);

  const pageMatches = useMemo(() => {
    const source = scope === "book" ? indexedPages : globalPageMatches;
    if (!query.trim()) {
      return [];
    }
    return sortByOption(
      source.filter((page) =>
        page.content.toLowerCase().includes(query.trim().toLowerCase()),
      ),
      sortOrder,
      (page) => page.content,
    );
  }, [globalPageMatches, indexedPages, query, scope, sortOrder]);

  const noteMatches = useMemo(() => {
    const source = scope === "book" ? currentNotes : notes;
    return sortByOption(
      source.filter((note) =>
        note.content.toLowerCase().includes(query.toLowerCase()),
      ),
      sortOrder,
      (note) => note.content,
    );
  }, [currentNotes, notes, query, scope, sortOrder]);

  const analysisMatches = useMemo(() => {
    const source = scope === "book" ? currentAnalyses : analyses;
    return sortByOption(
      source.filter((analysis) =>
        `${analysis.selected_text} ${analysis.response}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
      sortOrder,
      (analysis) => analysis.selected_text || analysis.response,
    );
  }, [analyses, currentAnalyses, query, scope, sortOrder]);

  const sortedOutline = useMemo(() => {
    if (sortOrder !== "az" && sortOrder !== "za") {
      return outline;
    }
    return sortByOption(outline, sortOrder, (entry) => entry.title);
  }, [outline, sortOrder]);

  const sortedCurrentHighlights = useMemo(
    () =>
      sortByOption(currentHighlights, sortOrder, (highlight) =>
        highlight.selected_text,
      ),
    [currentHighlights, sortOrder],
  );

  const sortedCurrentNotes = useMemo(
    () => sortByOption(currentNotes, sortOrder, (note) => note.content),
    [currentNotes, sortOrder],
  );

  const sortedCurrentBookmarks = useMemo(
    () =>
      sortByOption(
        currentBookmarks,
        sortOrder,
        (bookmark) => bookmark.label || `Page ${bookmark.page}`,
      ),
    [currentBookmarks, sortOrder],
  );

  const sortedCurrentAnalyses = useMemo(
    () =>
      sortByOption(
        currentAnalyses,
        sortOrder,
        (analysis) => analysis.selected_text || analysis.response,
      ),
    [currentAnalyses, sortOrder],
  );

  const bookmarkOnPage = currentBookmarks.some(
    (bookmark) => bookmark.page === activePage,
  );

  const openResearchLocation = (
    targetBookId: string,
    page: number,
    highlightId?: string,
  ) => {
    if (targetBookId && targetBookId !== book?.id) {
      const params = new URLSearchParams({ page: String(page) });
      if (highlightId) {
        params.set("highlight", highlightId);
      }
      router.push(`/reader/${targetBookId}?${params.toString()}`);
      return;
    }

    onNavigate(page, highlightId);
  };

  return (
    <AnimatePresence>
      {open && (
        <PanelShell onClose={onClose} tool={tool}>
          {tool !== "progress" && tool !== "topology" && (
            <div className="mb-4 flex justify-end">
              <SortSelect
                label={`Sort ${toolMeta[tool].label}`}
                onChange={setSortOrder}
                value={sortOrder}
              />
            </div>
          )}
          {tool === "contents" && (
            <div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="rounded-lg border border-slate-700/45 bg-slate-950/45 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-300/45"
                  max={numPages}
                  min={1}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Jump to page..."
                  type="number"
                  value={query}
                />
                <Button
                  onClick={() => onNavigate(Math.max(1, Math.min(numPages, Number(query))))}
                  type="button"
                >
                  Navigate
                </Button>
              </div>
              <div className="mt-5 space-y-1">
                {sortedOutline.length ? (
                  sortedOutline.map((entry, index) => (
                    <button
                      className="flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left text-xs text-slate-400 transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.05] hover:text-cyan-100"
                      key={`${entry.page}-${entry.title}-${index}`}
                      onClick={() => onNavigate(entry.page)}
                      type="button"
                    >
                      <span className="font-mono text-[0.58rem] text-cyan-300/60">
                        {String(entry.page).padStart(3, "0")}
                      </span>
                      <span>{entry.title}</span>
                    </button>
                  ))
                ) : (
                  <EmptyState>
                    This PDF does not expose a table of contents. Use the page
                    navigator above.
                  </EmptyState>
                )}
              </div>
            </div>
          )}

          {tool === "search" && (
            <div>
              <div className="relative">
                <FileSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/65" />
                <input
                  autoFocus
                  className="w-full rounded-lg border border-slate-700/45 bg-slate-950/45 py-2.5 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-cyan-300/45"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search PDF, notes, highlights, analyses..."
                  value={query}
                />
              </div>
              <div className="mt-3 flex gap-1">
                {(["book", "global"] as const).map((item) => (
                  <button
                    className={`rounded-md border px-2.5 py-1.5 text-[0.62rem] font-semibold uppercase tracking-wider transition ${
                      scope === item
                        ? "border-cyan-300/35 bg-cyan-400/[0.1] text-cyan-100"
                        : "border-slate-700/35 text-slate-500 hover:text-slate-300"
                    }`}
                    key={item}
                    onClick={() => setScope(item)}
                    type="button"
                  >
                    {item === "book" ? "Current PDF" : "Global Index"}
                  </button>
                ))}
              </div>
              {searching && (
                <div className="mt-4 flex items-center gap-2 text-xs text-cyan-200/75">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Resolving global index...
                </div>
              )}
              <div className="mt-5 space-y-4">
                {query && (
                  <>
                    <div>
                      <div className="hud-label mb-2">Indexed PDF Matches</div>
                      <div className="space-y-1.5">
                        {pageMatches.map((page) => (
                          <button
                            className="spatial-panel w-full rounded-md border border-pearl/10 bg-pearl/[0.035] px-3 py-2 text-left transition hover:border-cyan-300/30"
                            key={page.id}
                            onClick={() => openResearchLocation(page.book, page.page)}
                            type="button"
                          >
                            <div className="font-mono text-[0.58rem] tracking-widest text-cyan-300/70">
                              PAGE {page.page}
                            </div>
                            <p className="mt-1 line-clamp-2 text-[0.68rem] leading-5 text-slate-400">
                              {page.content}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                            <div className="hud-label mb-2">Memory Matches</div>
                      <div className="space-y-1.5">
                        {visibleHighlights.slice(0, 8).map((highlight) => (
                          <button
                            className="spatial-panel w-full rounded-md border border-pearl/10 bg-pearl/[0.035] px-3 py-2 text-left text-[0.7rem] leading-5 text-slate-400 transition hover:border-cyan-300/30"
                            key={highlight.id}
                            onClick={() =>
                              openResearchLocation(
                                highlight.book,
                                highlight.page,
                                highlight.id,
                              )
                            }
                            type="button"
                          >
                            Highlight // Page {highlight.page}: {highlight.selected_text}
                          </button>
                        ))}
                        {noteMatches.slice(0, 8).map((note) => (
                          <button
                            className="spatial-panel w-full rounded-md border border-pearl/10 bg-pearl/[0.035] px-3 py-2 text-left text-[0.7rem] leading-5 text-slate-400 transition hover:border-amber-300/30"
                            key={note.id}
                            onClick={() => openResearchLocation(note.book, note.page)}
                            type="button"
                          >
                            {note.kind} // Page {note.page}: {note.content}
                          </button>
                        ))}
                        {analysisMatches.slice(0, 6).map((analysis) => (
                          <button
                            className="spatial-panel w-full rounded-md border border-pearl/10 bg-pearl/[0.035] px-3 py-2 text-left text-[0.7rem] leading-5 text-slate-400 transition hover:border-violet-300/30"
                            key={analysis.id}
                            onClick={() => onOpenAnalysis(analysis)}
                            type="button"
                          >
                            Companion // Page {analysis.page}: {analysis.selected_text}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {tool === "highlights" && (
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                <input
                  className="w-full rounded-lg border border-slate-700/45 bg-slate-950/45 py-2 pl-8 pr-3 text-xs text-slate-200 outline-none focus:border-cyan-300/45"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search evidence..."
                  value={query}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Filter className="mr-1 h-3.5 w-3.5 text-slate-600" />
                {(["book", "global"] as const).map((item) => (
                  <button
                    className={`rounded-md border px-2 py-1 text-[0.58rem] uppercase tracking-wider ${
                      scope === item
                        ? "border-cyan-300/35 text-cyan-200"
                        : "border-slate-700/35 text-slate-600"
                    }`}
                    key={item}
                    onClick={() => setScope(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
                <select
                  className="rounded-md border border-slate-700/35 bg-slate-950 px-2 py-1 text-[0.58rem] uppercase tracking-wider text-slate-400 outline-none"
                  onChange={(event) =>
                    setColor(event.target.value as HighlightColor | "all")
                  }
                  value={color}
                >
                  <option value="all">All colors</option>
                  {highlightColors.map((item) => (
                    <option key={item.color} value={item.color}>
                      {item.color}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-md border border-slate-700/35 bg-slate-950 px-2 py-1 text-[0.58rem] text-slate-400 outline-none"
                  onChange={(event) => setDate(event.target.value)}
                  type="date"
                  value={date}
                />
              </div>
              <div className="mt-4 space-y-2.5">
                {visibleHighlights.length ? (
                  visibleHighlights.map((highlight) => (
                    <HighlightCard
                      highlight={highlight}
                      key={highlight.id}
                      onAsk={onAsk}
                      onDelete={onDeleteHighlight}
                      onNavigate={(page, highlightId) =>
                        openResearchLocation(highlight.book, page, highlightId)
                      }
                      onUpdateNote={onUpdateHighlightNote}
                    />
                  ))
                ) : (
                  <EmptyState>
                    Highlight a passage in the PDF to preserve it as a memory fragment.
                  </EmptyState>
                )}
              </div>
            </div>
          )}

          {tool === "notes" && (
            <div>
              <textarea
                className="min-h-24 w-full resize-y rounded-lg border border-slate-700/45 bg-slate-950/45 px-3 py-2 text-xs leading-5 text-slate-300 outline-none focus:border-amber-300/45"
                onChange={(event) => setStickyDraft(event.target.value)}
                placeholder={`Attach a sticky note to page ${activePage}...`}
                value={stickyDraft}
              />
              <Button
                className="mt-2 w-full"
                disabled={!stickyDraft.trim()}
                onClick={() => {
                  onAddStickyNote(stickyDraft);
                  setStickyDraft("");
                }}
                type="button"
                variant="ghost"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Save sticky note
              </Button>
              <div className="mt-5 space-y-2.5">
                {sortedCurrentNotes.length ? (
                  sortedCurrentNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onDelete={onDeleteNote}
                      onNavigate={onNavigate}
                      onUpdate={onUpdateNote}
                    />
                  ))
                ) : (
                  <EmptyState>No memory notes are attached to this PDF yet.</EmptyState>
                )}
              </div>
            </div>
          )}

          {tool === "bookmarks" && (
            <div>
              <Button
                className="w-full"
                onClick={() => onToggleBookmark(activePage)}
                type="button"
                variant={bookmarkOnPage ? "danger" : "ghost"}
              >
                <Bookmark className="h-3.5 w-3.5" />
                {bookmarkOnPage
                  ? `Remove page ${activePage} bookmark`
                  : `Bookmark page ${activePage}`}
              </Button>
              <div className="mt-5 space-y-1.5">
                {sortedCurrentBookmarks.length ? (
                  sortedCurrentBookmarks.map((bookmark) => (
                    <div
                      className="spatial-panel flex items-center rounded-md border border-pearl/10 bg-pearl/[0.035] px-3 py-2"
                      key={bookmark.id}
                    >
                      <button
                        className="flex-1 text-left text-xs text-slate-300"
                        onClick={() => onNavigate(bookmark.page)}
                        type="button"
                      >
                        {bookmark.label || `Page ${bookmark.page}`}
                      </button>
                      <button
                        aria-label="Remove bookmark"
                        className="text-slate-600 transition hover:text-rose-200"
                        onClick={() => onToggleBookmark(bookmark.page)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <EmptyState>No saved page coordinates for this PDF.</EmptyState>
                )}
              </div>
            </div>
          )}

          {tool === "history" && (
            <div className="space-y-2.5">
              {sortedCurrentAnalyses.length ? (
                sortedCurrentAnalyses.map((analysis) => (
                  <button
                    className="spatial-panel w-full rounded-lg border border-pearl/10 bg-pearl/[0.04] p-3 text-left transition hover:border-violet-300/35"
                    key={analysis.id}
                    onClick={() => onOpenAnalysis(analysis)}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className="hud-label text-[0.48rem] text-violet-200/75">
                        {analysis.mode} // PAGE {analysis.page}
                      </span>
                      <span className="text-[0.58rem] text-slate-600">
                        {analysis.provider}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">
                      {analysis.selected_text}
                    </p>
                  </button>
                ))
              ) : (
                <EmptyState>
                  Companion reflections appear here after you explain, deconstruct, or
                  summarize selected passages.
                </EmptyState>
              )}
            </div>
          )}

          {tool === "progress" && (
            <div>
              <div className="spatial-panel rounded-xl border border-cyan-300/20 bg-cyan-400/[0.05] p-4">
                <div className="hud-label">Reading Coordinate</div>
                <div className="mt-3 text-4xl font-semibold tracking-[-0.08em] text-white">
                  {activePage}
                  <span className="ml-2 text-base text-slate-600">/ {numPages}</span>
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    animate={{
                      width: `${numPages ? (activePage / numPages) * 100 : 0}%`,
                    }}
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ["Highlights", currentHighlights.length],
                  ["Notes", currentNotes.length],
                  ["Bookmarks", currentBookmarks.length],
                  ["Analyses", currentAnalyses.length],
                ].map(([label, value]) => (
                  <div
                    className="spatial-panel rounded-lg border border-pearl/10 bg-pearl/[0.035] p-3"
                    key={String(label)}
                  >
                    <div className="text-xl font-semibold text-white">{value}</div>
                    <div className="hud-label mt-2 text-[0.45rem]">{label}</div>
                  </div>
                ))}
              </div>
              <div className="spatial-panel mt-4 rounded-lg border border-pearl/10 bg-pearl/[0.035] p-3 text-xs leading-6 text-slate-500">
                Session restore is armed. The latest reading coordinate is saved
                automatically as pages enter the active viewport.
              </div>
            </div>
          )}

          {tool === "topology" && (
            <div>
              <div className="relative mx-auto mt-3 h-60 max-w-[310px]">
                <div className="absolute inset-[32px] animate-spin-slow rounded-full border border-dashed border-cyan-300/20" />
                <div className="absolute inset-[62px] rounded-full border border-violet-300/30" />
                <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/45 bg-cyan-400/[0.08] text-center text-[0.58rem] font-semibold tracking-wider text-cyan-100 shadow-neon">
                  ACTIVE
                  <br />
                  PDF
                </div>
                {[
                  ["H", currentHighlights.length, "left-0 top-6"],
                  ["N", currentNotes.length, "right-0 top-20"],
                  ["A", currentAnalyses.length, "bottom-0 left-12"],
                  ["B", currentBookmarks.length, "bottom-3 right-12"],
                ].map(([label, value, position]) => (
                  <div
                    className={`absolute flex h-12 w-12 items-center justify-center rounded-full border border-violet-300/35 bg-violet-400/[0.1] text-center text-[0.56rem] font-semibold text-violet-100 shadow-violet ${position}`}
                    key={String(label)}
                  >
                    {label}
                    <br />
                    {value}
                  </div>
                ))}
              </div>
              <div className="spatial-panel mt-5 rounded-lg border border-pearl/10 bg-pearl/[0.035] p-3 text-xs leading-6 text-slate-500">
                {book?.title ?? "Current PDF"} is linked to{" "}
                {currentHighlights.length + currentNotes.length + currentAnalyses.length}{" "}
                persistent memory artifacts.
              </div>
            </div>
          )}

          {tool === "notebook" && (
            <div className="space-y-5">
              <div className="spatial-panel rounded-lg border border-violet-300/20 bg-violet-400/[0.05] p-3">
                <div className="flex items-center gap-2">
                  <NotebookPen className="h-4 w-4 text-violet-200" />
                  <div className="hud-label text-[0.49rem]">Combined Memory Log</div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Fragments, personal notes, and companion syntheses for the active
                  document.
                </p>
              </div>
              <div>
                <div className="hud-label mb-2">Fragments</div>
                <div className="space-y-2">
                  {sortedCurrentHighlights.slice(0, 6).map((highlight) => (
                    <HighlightCard
                      highlight={highlight}
                      key={highlight.id}
                      onAsk={onAsk}
                      onDelete={onDeleteHighlight}
                      onNavigate={onNavigate}
                      onUpdateNote={onUpdateHighlightNote}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="hud-label mb-2">Notes</div>
                <div className="space-y-2">
                  {sortedCurrentNotes.slice(0, 6).map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onDelete={onDeleteNote}
                      onNavigate={onNavigate}
                      onUpdate={onUpdateNote}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="hud-label mb-2">Companion Syntheses</div>
                <div className="space-y-2">
                  {sortedCurrentAnalyses.slice(0, 6).map((analysis) => (
                    <button
                      className="spatial-panel w-full rounded-lg border border-pearl/10 bg-pearl/[0.04] p-3 text-left transition hover:border-violet-300/35"
                      key={analysis.id}
                      onClick={() => onOpenAnalysis(analysis)}
                      type="button"
                    >
                      <div className="flex items-center gap-2 text-violet-200">
                        <FlaskConical className="h-3.5 w-3.5" />
                        <span className="hud-label text-[0.45rem]">
                          {analysis.mode} // PAGE {analysis.page}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">
                        {analysis.response}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </PanelShell>
      )}
    </AnimatePresence>
  );
}
