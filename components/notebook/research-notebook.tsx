"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clipboard,
  FileSearch,
  Flame,
  Folder,
  Highlighter,
  LoaderCircle,
  MessageSquareText,
  NotebookPen,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { Brand } from "@/components/ui/brand";
import {
  getAuthenticatedUserId,
  getPocketBase,
  hydratePocketBaseAuth,
  logPocketBaseError,
  runPocketBaseRequest,
} from "@/lib/pocketbase";
import { formatResearchDate, getHighlightColor, highlightColors } from "@/lib/research";
import type {
  AiAnalysisRecord,
  BookRecord,
  DocumentPageRecord,
  FolderRecord,
  HighlightColor,
  HighlightRecord,
  NoteRecord,
} from "@/lib/types";

type NotebookTab = "highlights" | "notes" | "analyses" | "search";

export function ResearchNotebook() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<NotebookTab>("highlights");
  const [query, setQuery] = useState("");
  const [bookFilter, setBookFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState<HighlightColor | "all">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [highlights, setHighlights] = useState<HighlightRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [analyses, setAnalyses] = useState<AiAnalysisRecord[]>([]);
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [pageMatches, setPageMatches] = useState<DocumentPageRecord[]>([]);
  const [searching, setSearching] = useState(false);

  const loadNotebook = useCallback(async () => {
    const pb = getPocketBase();
    try {
      const userId = await hydratePocketBaseAuth(pb);
      const filter = pb.filter("user = {:userId}", { userId });
      const [highlightRows, noteRows, analysisRows, bookRows, folderRows] =
        await Promise.all([
          runPocketBaseRequest("List notebook highlights", () =>
            pb.collection("highlights").getFullList<HighlightRecord>({
              filter,
              sort: "-updated",
            }),
          ),
          runPocketBaseRequest("List notebook notes", () =>
            pb.collection("notes").getFullList<NoteRecord>({
              filter,
              sort: "-updated",
            }),
          ),
          runPocketBaseRequest("List notebook analyses", () =>
            pb.collection("ai_analyses").getFullList<AiAnalysisRecord>({
              filter,
              sort: "-created",
            }),
          ),
          runPocketBaseRequest("List notebook books", () =>
            pb.collection("books").getFullList<BookRecord>({
              filter,
              sort: "title",
            }),
          ),
          runPocketBaseRequest("List notebook folders", () =>
            pb.collection("folders").getFullList<FolderRecord>({
              filter,
              sort: "name",
            }),
          ),
        ]);
      setHighlights(highlightRows);
      setNotes(noteRows);
      setAnalyses(analysisRows);
      setBooks(bookRows);
      setFolders(folderRows);
    } catch (loadError) {
      logPocketBaseError("Load global research notebook", loadError);
      if (!getAuthenticatedUserId(pb)) {
        router.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadNotebook();
  }, [loadNotebook]);

  useEffect(() => {
    if (tab !== "search" || query.trim().length < 2) {
      setPageMatches([]);
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
          100,
          {
            filter: pb.filter("user = {:userId} && content ~ {:query}", {
              userId,
              query: query.trim(),
            }),
            sort: "-updated",
          },
        );
        setPageMatches(result.items);
      } catch (searchError) {
        logPocketBaseError("Search global PDF index", searchError);
      } finally {
        setSearching(false);
      }
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [query, tab]);

  const bookMap = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books],
  );

  const visibleHighlights = useMemo(
    () =>
      highlights.filter((highlight) => {
        const book = bookMap.get(highlight.book);
        return (
          (!query ||
            `${highlight.selected_text} ${highlight.note}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (bookFilter === "all" || highlight.book === bookFilter) &&
          (folderFilter === "all" || book?.folder === folderFilter) &&
          (colorFilter === "all" || highlight.color === colorFilter) &&
          (!dateFilter || highlight.created.slice(0, 10) >= dateFilter)
        );
      }),
    [
      bookFilter,
      bookMap,
      colorFilter,
      dateFilter,
      folderFilter,
      highlights,
      query,
    ],
  );

  const visibleNotes = useMemo(
    () =>
      notes.filter((note) => {
        const book = bookMap.get(note.book);
        return (
          (!query || note.content.toLowerCase().includes(query.toLowerCase())) &&
          (bookFilter === "all" || note.book === bookFilter) &&
          (folderFilter === "all" || book?.folder === folderFilter) &&
          (!dateFilter || note.created.slice(0, 10) >= dateFilter)
        );
      }),
    [bookFilter, bookMap, dateFilter, folderFilter, notes, query],
  );

  const visibleAnalyses = useMemo(
    () =>
      analyses.filter((analysis) => {
        const book = bookMap.get(analysis.book);
        return (
          (!query ||
            `${analysis.selected_text} ${analysis.response}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (bookFilter === "all" || analysis.book === bookFilter) &&
          (folderFilter === "all" || book?.folder === folderFilter) &&
          (!dateFilter || analysis.created.slice(0, 10) >= dateFilter)
        );
      }),
    [analyses, bookFilter, bookMap, dateFilter, folderFilter, query],
  );

  const activeDates = useMemo(
    () =>
      new Set(
        [...highlights, ...notes, ...analyses].map((record) =>
          record.created.slice(0, 10),
        ),
      ),
    [analyses, highlights, notes],
  );

  const streak = useMemo(() => {
    let days = 0;
    const date = new Date();
    while (activeDates.has(date.toISOString().slice(0, 10))) {
      days += 1;
      date.setDate(date.getDate() - 1);
    }
    return days;
  }, [activeDates]);

  function openArtifact(bookId: string, page: number, highlightId?: string) {
    router.push(
      `/reader/${bookId}?${new URLSearchParams({
        ...(highlightId ? { highlight: highlightId } : {}),
        page: String(page),
      }).toString()}`,
    );
  }

  async function deleteRecord(collection: "highlights" | "notes", id: string) {
    const pb = getPocketBase();
    try {
      await runPocketBaseRequest(`Delete notebook ${collection}`, () =>
        pb.collection(collection).delete(id),
      );
      if (collection === "highlights") {
        setHighlights((current) => current.filter((item) => item.id !== id));
      } else {
        setNotes((current) => current.filter((item) => item.id !== id));
      }
    } catch (deleteError) {
      logPocketBaseError(`Delete notebook ${collection}`, deleteError);
    }
  }

  return (
    <main className="spatial-root relative min-h-screen overflow-hidden bg-space text-slate-200">
      <AmbientBackground compact />
      <div className="spatial-layer relative z-10">
        <header className="floating-glass flex h-[72px] items-center gap-3 border-b border-pearl/10 px-4 sm:px-6">
          <button
            aria-label="Return to dashboard"
            className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-2 text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
            onClick={() => router.push("/dashboard")}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Brand />
          <div className="ml-auto hidden items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/[0.06] px-3 py-1.5 sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
            <span className="hud-label text-[0.48rem] text-violet-200">
              Global notebook synchronized
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 pb-12 pt-7 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="hud-label">Persistent Memory Archive</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                Memory Atlas
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                A global view of preserved fragments, annotations, companion
                syntheses, and searchable PDF coordinates.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Highlighter,
                label: "Highlights",
                value: highlights.length,
              },
              {
                icon: MessageSquareText,
                label: "Memory notes",
                value: notes.length,
              },
              {
                icon: Sparkles,
                label: "Companion reflections",
                value: analyses.length,
              },
              { icon: Flame, label: "Daily streak", value: `${streak}d` },
            ].map(({ icon: Icon, label, value }) => (
              <div
                className="glass-panel spatial-panel cinematic-reveal rounded-xl p-4"
                key={String(label)}
              >
                <Icon className="h-4 w-4 text-cyan-300/80" />
                <div className="mt-5 text-2xl font-semibold tracking-[-0.05em] text-white">
                  {value}
                </div>
                <div className="hud-label mt-2 text-[0.48rem]">{label}</div>
              </div>
            ))}
          </div>

          <div className="glass-panel spatial-panel mt-6 rounded-xl p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/65" />
              <input
                className="w-full rounded-lg border border-slate-700/45 bg-slate-950/45 py-3 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-cyan-300/45"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search highlights, notes, analyses, or indexed PDF text..."
                value={query}
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select
                className="rounded-md border border-slate-700/35 bg-slate-950 px-2 py-2 text-xs text-slate-400 outline-none"
                onChange={(event) => setBookFilter(event.target.value)}
                value={bookFilter}
              >
                <option value="all">All books</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-slate-700/35 bg-slate-950 px-2 py-2 text-xs text-slate-400 outline-none"
                onChange={(event) => setFolderFilter(event.target.value)}
                value={folderFilter}
              >
                <option value="all">All realms</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-slate-700/35 bg-slate-950 px-2 py-2 text-xs text-slate-400 outline-none"
                onChange={(event) =>
                  setColorFilter(event.target.value as HighlightColor | "all")
                }
                value={colorFilter}
              >
                <option value="all">All highlight colors</option>
                {highlightColors.map((item) => (
                  <option key={item.color} value={item.color}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                className="rounded-md border border-slate-700/35 bg-slate-950 px-2 py-2 text-xs text-slate-400 outline-none"
                onChange={(event) => setDateFilter(event.target.value)}
                type="date"
                value={dateFilter}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {(
              [
                ["highlights", Highlighter, "Fragments"],
                ["notes", MessageSquareText, "Notes"],
                ["analyses", Sparkles, "AI Reflections"],
                ["search", FileSearch, "PDF Search"],
              ] as const
            ).map(([item, Icon, label]) => (
              <button
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  tab === item
                    ? "border-cyan-300/35 bg-cyan-400/[0.1] text-cyan-100 shadow-neon"
                    : "border-slate-700/35 bg-slate-950/30 text-slate-500 hover:text-slate-200"
                }`}
                key={item}
                onClick={() => setTab(item)}
                type="button"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className="col-span-full flex min-h-64 items-center justify-center">
                <LoaderCircle className="h-7 w-7 animate-spin text-cyan-300" />
              </div>
            ) : tab === "highlights" ? (
              visibleHighlights.map((highlight) => {
                const book = bookMap.get(highlight.book);
                const color = getHighlightColor(highlight.color);
                return (
                  <motion.div
                    className="glass-panel spatial-panel rounded-xl p-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={highlight.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-mono text-[0.6rem] tracking-widest text-slate-500">
                        <span className={`h-2 w-2 rounded-full ${color.solid}`} />
                        PAGE {highlight.page}
                      </span>
                      <span className="text-[0.58rem] text-slate-600">
                        {formatResearchDate(highlight.updated)}
                      </span>
                    </div>
                    <button
                      className="mt-3 w-full text-left"
                      onClick={() =>
                        openArtifact(highlight.book, highlight.page, highlight.id)
                      }
                      type="button"
                    >
                      <div className="hud-label text-[0.46rem] text-cyan-200/65">
                        {book?.title ?? "Reading PDF"}
                      </div>
                      <p className="mt-2 line-clamp-5 text-xs leading-5 text-slate-300">
                        {highlight.selected_text}
                      </p>
                    </button>
                    {highlight.note && (
                      <p className="mt-3 border-l border-amber-300/35 pl-3 text-[0.7rem] leading-5 text-amber-100/65">
                        {highlight.note}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-1">
                      <button
                        aria-label="Copy highlight"
                        className="rounded-md p-1.5 text-slate-500 hover:text-cyan-200"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            highlight.selected_text,
                          )
                        }
                        type="button"
                      >
                        <Clipboard className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[0.62rem] font-semibold text-violet-200 hover:bg-violet-400/[0.08]"
                        onClick={() =>
                          router.push(
                            `/reader/${highlight.book}?highlight=${highlight.id}&ask=1`,
                          )
                        }
                        type="button"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Ask companion
                      </button>
                      <button
                        aria-label="Delete highlight"
                        className="ml-auto rounded-md p-1.5 text-slate-600 hover:text-rose-200"
                        onClick={() => void deleteRecord("highlights", highlight.id)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            ) : tab === "notes" ? (
              visibleNotes.map((note) => (
                <div className="glass-panel spatial-panel rounded-xl p-4" key={note.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="hud-label text-[0.48rem] text-amber-200/75">
                      {note.kind} // PAGE {note.page}
                    </span>
                    <button
                      aria-label="Delete note"
                      className="text-slate-600 hover:text-rose-200"
                      onClick={() => void deleteRecord("notes", note.id)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    className="mt-3 w-full text-left text-xs leading-6 text-slate-300"
                    onClick={() => openArtifact(note.book, note.page)}
                    type="button"
                  >
                    {note.content}
                  </button>
                </div>
              ))
            ) : tab === "analyses" ? (
              visibleAnalyses.map((analysis) => (
                <button
                  className="glass-panel spatial-panel rounded-xl p-4 text-left transition hover:border-violet-300/35"
                  key={analysis.id}
                  onClick={() => openArtifact(analysis.book, analysis.page)}
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
                  <p className="mt-3 line-clamp-5 text-xs leading-5 text-slate-300">
                    {analysis.response}
                  </p>
                </button>
              ))
            ) : (
              pageMatches.map((page) => (
                <button
                  className="glass-panel spatial-panel rounded-xl p-4 text-left transition hover:border-cyan-300/35"
                  key={page.id}
                  onClick={() => openArtifact(page.book, page.page)}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-cyan-300/75" />
                    <span className="hud-label text-[0.48rem]">
                      PDF index // page {page.page}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-5 text-xs leading-5 text-slate-400">
                    {page.content}
                  </p>
                </button>
              ))
            )}
            {!loading &&
              ((tab === "highlights" && visibleHighlights.length === 0) ||
                (tab === "notes" && visibleNotes.length === 0) ||
                (tab === "analyses" && visibleAnalyses.length === 0) ||
                (tab === "search" && !searching && pageMatches.length === 0)) && (
                <div className="glass-panel spatial-panel col-span-full flex min-h-52 flex-col items-center justify-center rounded-xl border-dashed p-8 text-center">
                  <CalendarDays className="h-7 w-7 text-cyan-300/45" />
                  <p className="mt-4 max-w-md text-xs leading-6 text-slate-500">
                    No memory artifacts match this coordinate. Open a PDF and
                    preserve fragments, notes, or companion reflections to populate the
                    atlas.
                  </p>
                </div>
              )}
          </section>
        </div>
      </div>
    </main>
  );
}
