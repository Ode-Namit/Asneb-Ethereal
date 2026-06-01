"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Atom,
  Bookmark,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileSearch,
  FileText,
  FlaskConical,
  Highlighter,
  LoaderCircle,
  LogOut,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Network,
  NotebookPen,
  PanelRightOpen,
  Quote,
  Search,
  Sigma,
  Sparkles,
  TextQuote,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { HighlightLayer } from "@/components/reader/highlight-layer";
import {
  ResearchPanel,
  type OutlineEntry,
  type ReaderTool,
} from "@/components/reader/research-panel";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { useResearchData } from "@/hooks/use-research-data";
import {
  getAuthenticatedUserId,
  getPocketBase,
  hydratePocketBaseAuth,
  logPocketBaseError,
  runPocketBaseRequest,
  withAuthenticatedUser,
} from "@/lib/pocketbase";
import { highlightColors } from "@/lib/research";
import type {
  AiAnalysisRecord,
  BookRecord,
  HighlightColor,
  PdfAnchor,
  PromptMode,
  ReadingProgressRecord,
  ResearchNoteKind,
  TutorStreamEvent,
} from "@/lib/types";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type FloatingMenu = {
  anchor: PdfAnchor;
  page: number;
  text: string;
  x: number;
  y: number;
};

const promptActions: Array<{
  icon: typeof TextQuote;
  label: string;
  mode: PromptMode;
  shortLabel: string;
}> = [
  {
    mode: "explain",
    shortLabel: "Explain",
    label: "Explain line",
    icon: TextQuote,
  },
  {
    mode: "deconstruct",
    shortLabel: "Deconstruct",
    label: "Deconstruct formula",
    icon: FlaskConical,
  },
  {
    mode: "summarize",
    shortLabel: "Summarize",
    label: "Summarize concept",
    icon: Highlighter,
  },
  {
    mode: "derivation",
    shortLabel: "Derive",
    label: "Develop derivation",
    icon: Sigma,
  },
  {
    mode: "intuition",
    shortLabel: "Intuition",
    label: "Build intuition",
    icon: Atom,
  },
  {
    mode: "problem-solving",
    shortLabel: "Solve",
    label: "Problem-solving guide",
    icon: FileSearch,
  },
];

const toolbarItems: Array<{
  icon: typeof BookOpen;
  label: string;
  tool: ReaderTool;
}> = [
  { tool: "contents", label: "Table of contents", icon: BookOpen },
  { tool: "search", label: "Search PDF and research", icon: Search },
  { tool: "highlights", label: "Research highlights", icon: Highlighter },
  { tool: "notes", label: "Notes panel", icon: MessageSquareText },
  { tool: "bookmarks", label: "Page bookmarks", icon: Bookmark },
  { tool: "history", label: "AI analysis history", icon: Bot },
  { tool: "progress", label: "Reading progress timeline", icon: Activity },
  { tool: "topology", label: "Research graph", icon: Network },
  { tool: "notebook", label: "Research notebook", icon: NotebookPen },
];

function PhysicsLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-spin rounded-full border border-cyan-300/50 border-t-transparent" />
        <div className="absolute inset-2 animate-[spin_1.2s_linear_infinite_reverse] rounded-full border border-violet-300/60 border-b-transparent" />
        <Atom className="absolute inset-[17px] h-5 w-5 text-cyan-200" />
      </div>
      <div className="hud-label text-cyan-200/70">{label}</div>
    </div>
  );
}

function cleanTutorResponse(text: string) {
  return text
    .replaceAll("<!-- ASNEB_COMPLETE -->", "")
    .replace(/<!--\s*ASNEB(?:_COMPLETE)?[^>]*>?$/i, "")
    .trimStart();
}

async function readTutorStream(
  response: Response,
  onEvent: (event: TutorStreamEvent) => void,
) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("text/event-stream")) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(payload.error ?? `Tutor request failed with HTTP ${response.status}.`);
  }
  if (!response.body) {
    throw new Error("The tutor stream opened without a readable response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: Extract<TutorStreamEvent, { type: "complete" }> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      const event = JSON.parse(data) as TutorStreamEvent;
      onEvent(event);
      if (event.type === "complete") {
        completed = event;
      }
      if (event.type === "error") {
        throw new Error(event.message);
      }
    }

    if (done) break;
  }

  if (!completed) {
    throw new Error("The tutor stream ended before reporting a completed response.");
  }
  return completed;
}

function AiPanel({
  completed,
  continuationCount,
  error,
  fallback,
  mode,
  onClose,
  open,
  provider,
  response,
  selectedText,
  status,
  streaming,
}: {
  completed: boolean;
  continuationCount: number;
  error: string;
  fallback: boolean;
  mode: PromptMode | null;
  onClose: () => void;
  open: boolean;
  provider: string;
  response: string;
  selectedText: string;
  status: string;
  streaming: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="fixed inset-0 z-50 flex w-full flex-col border-l border-cyan-300/20 bg-[#07101d]/95 shadow-[-24px_0_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:left-auto sm:w-[420px] xl:relative xl:z-20 xl:w-[390px] xl:shrink-0"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 29, stiffness: 270 }}
        >
          <div className="border-b border-slate-700/35 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-cyan-300/25 bg-cyan-400/[0.08] p-2">
                  <Bot className="h-4 w-4 text-cyan-200" />
                </div>
                <div>
                  <div className="hud-label text-[0.53rem]">Tutor Subsystem</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    Unicorn Analysis
                  </div>
                </div>
              </div>
              <button
                aria-label="Close AI assistant"
                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedText && (
              <div className="rounded-lg border border-violet-300/20 bg-violet-400/[0.05] p-3.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                  <div className="hud-label text-[0.49rem]">
                    Selected Evidence // {mode ?? "analysis"}
                  </div>
                </div>
                <p className="mt-3 line-clamp-5 text-xs leading-5 text-slate-400">
                  {selectedText}
                </p>
              </div>
            )}

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      error
                        ? "bg-rose-300"
                        : completed
                          ? "bg-emerald-300"
                          : "animate-pulse bg-cyan-300"
                    }`}
                  />
                  <div className="hud-label text-[0.49rem]">
                    {streaming ? "Synthesizing response" : "Analysis output"}
                  </div>
                </div>
                {completed && (
                  <span className="flex items-center gap-1 text-[0.58rem] font-semibold uppercase tracking-wider text-emerald-200/80">
                    <CheckCircle2 className="h-3 w-3" />
                    Response completed
                  </span>
                )}
              </div>
              {(streaming || error || fallback || continuationCount > 0) && (
                <div
                  className={`mb-4 rounded-md border px-3 py-2 text-[0.68rem] leading-5 ${
                    error
                      ? "border-rose-300/20 bg-rose-400/[0.06] text-rose-100/80"
                      : fallback
                        ? "border-amber-300/20 bg-amber-400/[0.06] text-amber-100/75"
                        : "border-cyan-300/20 bg-cyan-400/[0.05] text-cyan-100/75"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {streaming ? (
                      <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    ) : error ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{error || status}</span>
                  </div>
                </div>
              )}
              {!response && streaming ? (
                <div className="py-16">
                  <PhysicsLoader label="Resolving concept" />
                </div>
              ) : (
                <div className="markdown-body text-[0.82rem] leading-6 text-slate-300">
                  <ReactMarkdown
                    rehypePlugins={[rehypeKatex]}
                    remarkPlugins={[remarkGfm, remarkMath]}
                  >
                    {response ||
                      "Select a passage inside the PDF to begin an analysis."}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-700/35 px-4 py-3">
            <div className="flex items-center justify-between text-[0.63rem] text-slate-600">
              <span className="font-mono uppercase tracking-widest">
                {provider || "Tutor standby"}
              </span>
              <span
                className={`flex items-center gap-1.5 ${
                  error
                    ? "text-rose-300/75"
                    : completed
                      ? "text-emerald-300/70"
                      : "text-cyan-300/70"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    error
                      ? "bg-rose-300"
                      : completed
                        ? "bg-emerald-300"
                        : "animate-pulse bg-cyan-300"
                  }`}
                />
                {error ? "ERROR" : completed ? "COMPLETE" : streaming ? "GENERATING" : "STANDBY"}
              </span>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function getSelectionAnchor(range: Range, content: HTMLElement): PdfAnchor | null {
  const contentRect = content.getBoundingClientRect();
  if (!contentRect.width || !contentRect.height) {
    return null;
  }

  const prefix = range.cloneRange();
  prefix.selectNodeContents(content);
  prefix.setEnd(range.startContainer, range.startOffset);
  const start = prefix.toString().length;
  const end = start + range.toString().length;
  const rects = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 1 && rect.height > 1)
    .map((rect) => ({
      left: Math.max(0, (rect.left - contentRect.left) / contentRect.width),
      top: Math.max(0, (rect.top - contentRect.top) / contentRect.height),
      width: Math.min(1, rect.width / contentRect.width),
      height: Math.min(1, rect.height / contentRect.height),
    }));

  return rects.length ? { start, end, rects } : null;
}

async function extractOutline(
  pdf: PDFDocumentProxy,
): Promise<OutlineEntry[]> {
  const outline = await pdf.getOutline();
  if (!outline?.length) {
    return [];
  }

  const entries: OutlineEntry[] = [];
  const visit = async (
    nodes: Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>,
  ) => {
    for (const node of nodes ?? []) {
      let page = 1;
      try {
        const destination =
          typeof node.dest === "string"
            ? await pdf.getDestination(node.dest)
            : node.dest;
        if (destination?.[0]) {
          page = (await pdf.getPageIndex(destination[0])) + 1;
        }
      } catch {
        page = 1;
      }
      entries.push({ title: node.title, page });
      if (node.items?.length) {
        await visit(node.items);
      }
    }
  };

  await visit(outline);
  return entries;
}

export function PhysicsReader({ bookId }: { bookId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const progressIdRef = useRef<string | null>(null);
  const restoredPageRef = useRef(1);
  const progressWriteRef = useRef<Promise<void>>(Promise.resolve());
  const indexRunRef = useRef(0);
  const queryHandledRef = useRef(false);
  const [book, setBook] = useState<BookRecord | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [pageWidth, setPageWidth] = useState(760);
  const [loading, setLoading] = useState(true);
  const [pdfError, setPdfError] = useState("");
  const [progressReady, setProgressReady] = useState(false);
  const [floatingMenu, setFloatingMenu] = useState<FloatingMenu | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [aiMode, setAiMode] = useState<PromptMode | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiProvider, setAiProvider] = useState("");
  const [aiStatus, setAiStatus] = useState("Tutor standby.");
  const [aiError, setAiError] = useState("");
  const [aiCompleted, setAiCompleted] = useState(false);
  const [aiFallback, setAiFallback] = useState(false);
  const [aiContinuationCount, setAiContinuationCount] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<ReaderTool>("contents");
  const [toolOpen, setToolOpen] = useState(false);
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [focusedHighlightId, setFocusedHighlightId] = useState<string | null>(
    null,
  );
  const research = useResearchData(bookId);

  useEffect(() => {
    async function loadReader() {
      const pb = getPocketBase();

      try {
        const userId = await hydratePocketBaseAuth(pb);
        const currentBook = await runPocketBaseRequest(
          "Load authenticated PDF",
          () => pb.collection("books").getOne<BookRecord>(bookId),
        );
        setBook(currentBook);
        setFileUrl(pb.files.getURL(currentBook, currentBook.file));

        try {
          const progressRows = await runPocketBaseRequest(
            "Load authenticated reading progress",
            () =>
              pb
                .collection("reading_progress")
                .getList<ReadingProgressRecord>(1, 1, {
                  filter: pb.filter("book = {:bookId} && user = {:userId}", {
                    bookId,
                    userId,
                  }),
                }),
          );
          const progress = progressRows.items[0];
          if (progress) {
            progressIdRef.current = progress.id;
            restoredPageRef.current = Math.max(1, progress.last_page);
            setActivePage(Math.max(1, progress.last_page));
          }
        } catch (progressError) {
          logPocketBaseError("Restore reading location", progressError);
        }

        setProgressReady(true);
      } catch (loadError) {
        logPocketBaseError("Hydrate PDF reader", loadError);

        if (!getAuthenticatedUserId(pb)) {
          router.replace("/login");
          return;
        }

        setPdfError("This document could not be loaded from the observatory.");
      } finally {
        setLoading(false);
      }
    }

    void loadReader();
  }, [bookId, router]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const updateWidth = () => {
      if (scrollRef.current) {
        setPageWidth(
          Math.max(290, Math.min(820, scrollRef.current.clientWidth - 36)),
        );
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  const scrollToPage = useCallback((page: number, behavior: ScrollBehavior) => {
    pageRefs.current
      .get(page)
      ?.scrollIntoView({ behavior, block: "start" });
  }, []);

  const navigateTo = useCallback(
    (page: number, highlightId?: string) => {
      const safePage = Math.max(1, Math.min(numPages || page, page));
      setActivePage(safePage);
      window.setTimeout(() => scrollToPage(safePage, "smooth"), 20);
      if (highlightId) {
        setFocusedHighlightId(highlightId);
        window.setTimeout(() => setFocusedHighlightId(null), 2300);
      }
    },
    [numPages, scrollToPage],
  );

  useEffect(() => {
    if (!numPages) {
      return;
    }
    const page = Math.min(restoredPageRef.current, numPages);
    setActivePage(page);
    const timeout = window.setTimeout(() => scrollToPage(page, "auto"), 80);
    return () => window.clearTimeout(timeout);
  }, [numPages, scrollToPage]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !numPages) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              right.intersectionRatio - left.intersectionRatio,
          )[0];
        if (visible) {
          setActivePage(Number((visible.target as HTMLElement).dataset.page));
        }
      },
      { root, threshold: [0.32, 0.55, 0.78] },
    );
    pageRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [numPages]);

  useEffect(() => {
    if (!progressReady || !book) {
      return;
    }
    const timeout = window.setTimeout(() => {
      progressWriteRef.current = progressWriteRef.current
        .then(async () => {
          const pb = getPocketBase();
          if (!getAuthenticatedUserId(pb)) {
            return;
          }
          if (progressIdRef.current) {
            await runPocketBaseRequest("Update authenticated reading progress", () =>
              pb
                .collection("reading_progress")
                .update(progressIdRef.current!, { last_page: activePage }),
            );
            return;
          }
          const record = await runPocketBaseRequest(
            "Create authenticated reading progress",
            () =>
              pb
                .collection("reading_progress")
                .create<ReadingProgressRecord>(
                  withAuthenticatedUser(pb, {
                    book: book.id,
                    last_page: activePage,
                  }),
                ),
          );
          progressIdRef.current = record.id;
        })
        .catch((saveError) =>
          logPocketBaseError("Persist reading location", saveError),
        );
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [activePage, book, progressReady]);

  useEffect(() => {
    function updateSelection() {
      window.setTimeout(() => {
        const selection = window.getSelection();
        if (
          !selection ||
          selection.isCollapsed ||
          !selection.rangeCount ||
          !viewerRef.current ||
          !selection.anchorNode ||
          !viewerRef.current.contains(selection.anchorNode)
        ) {
          setFloatingMenu(null);
          return;
        }
        const text = selection.toString().trim();
        const range = selection.getRangeAt(0);
        const pageElement =
          range.commonAncestorContainer.parentElement?.closest<HTMLElement>(
            "[data-page]",
          ) ??
          (range.commonAncestorContainer instanceof HTMLElement
            ? range.commonAncestorContainer.closest<HTMLElement>("[data-page]")
            : null);
        const content =
          pageElement?.querySelector<HTMLElement>("[data-pdf-page-content]");
        const anchor = content ? getSelectionAnchor(range, content) : null;
        if (!text || !anchor || !pageElement) {
          setFloatingMenu(null);
          return;
        }
        const rect = range.getBoundingClientRect();
        setFloatingMenu({
          anchor,
          page: Number(pageElement.dataset.page),
          text,
          x: Math.max(175, Math.min(window.innerWidth - 175, rect.left + rect.width / 2)),
          y: Math.max(86, rect.top - 10),
        });
      }, 0);
    }
    document.addEventListener("mouseup", updateSelection);
    document.addEventListener("touchend", updateSelection);
    return () => {
      document.removeEventListener("mouseup", updateSelection);
      document.removeEventListener("touchend", updateSelection);
    };
  }, []);

  const analyzeSelection = useCallback(
    async (mode: PromptMode, text: string, page = activePage) => {
      const pb = getPocketBase();
      setFloatingMenu(null);
      setPanelOpen(true);
      setAiMode(mode);
      setAiText(text);
      setAiResponse("");
      setAiProvider("");
      setAiStatus("Opening tutor stream.");
      setAiError("");
      setAiCompleted(false);
      setAiFallback(false);
      setAiContinuationCount(0);
      setStreaming(true);

      try {
        const response = await fetch("/api/explain", {
          method: "POST",
          headers: {
            Authorization: pb.authStore.token,
            Accept: "text/event-stream",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode, text }),
        });
        const data = await readTutorStream(response, (event) => {
          if (event.type === "delta") {
            setAiResponse((current) => cleanTutorResponse(current + event.text));
          } else if (event.type === "reset") {
            setAiResponse(cleanTutorResponse(event.text));
          } else if (event.type === "status") {
            setAiStatus(event.message);
            if (event.phase === "continuing") {
              setAiContinuationCount((current) => current + 1);
            }
            if (event.phase === "fallback") {
              setAiFallback(true);
            }
          } else if (event.type === "complete") {
            setAiResponse(event.analysis);
            setAiProvider(`${event.provider} // ${event.model}`);
            setAiCompleted(event.completed);
            setAiFallback(event.fallback);
            setAiContinuationCount(event.continuationCount);
            setAiStatus(
              event.fallback
                ? "Response completed with a concise fallback analysis."
                : "Response completed and archived.",
            );
          } else if (event.type === "error") {
            if (event.partial) {
              setAiResponse(cleanTutorResponse(event.partial));
            }
            setAiError(event.message);
            setAiStatus("Tutor response could not be completed reliably.");
          }
        });
        if (!data.completed || !data.analysis) {
          throw new Error("The tutor did not report a complete analysis.");
        }
        await research.saveAnalysis({
          mode,
          page,
          provider: data.provider,
          response: data.analysis,
          selectedText: text,
        });
      } catch (analysisError) {
        console.error("[ASNEB] Tutor analysis request failed", analysisError);
        setAiError(
          analysisError instanceof Error
            ? analysisError.message
            : "The tutor subsystem could not respond.",
        );
        setAiStatus("Tutor response could not be completed reliably.");
        setAiCompleted(false);
      } finally {
        setStreaming(false);
      }
    },
    [activePage, research],
  );

  function openStoredAnalysis(analysis: AiAnalysisRecord) {
    setAiMode(analysis.mode);
    setAiText(analysis.selected_text);
    setAiResponse(analysis.response);
    setAiProvider(`${analysis.provider} // archived`);
    setAiStatus("Archived response loaded.");
    setAiError("");
    setAiCompleted(true);
    setAiFallback(false);
    setAiContinuationCount(0);
    setStreaming(false);
    setPanelOpen(true);
  }

  function addSelectionNote(kind: ResearchNoteKind) {
    if (!floatingMenu) {
      return;
    }
    const defaultText =
      kind === "note"
        ? ""
        : `${kind === "citation" ? "Citation" : "Formula snapshot"}: ${
            floatingMenu.text
          }`;
    const content =
      kind === "note"
        ? window.prompt("Attach a research note to this evidence:", "")
        : defaultText;
    if (content?.trim()) {
      void research.addNote({
        anchor: floatingMenu.anchor,
        content,
        kind,
        page: floatingMenu.page,
      });
    }
    setFloatingMenu(null);
    window.getSelection()?.removeAllRanges();
  }

  async function handleDocumentLoad(pdf: PDFDocumentProxy) {
    setNumPages(pdf.numPages);
    setOutline(await extractOutline(pdf));
    const run = ++indexRunRef.current;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (run !== indexRunRef.current) {
        return;
      }
      try {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        await research.indexDocumentPage(pageNumber, text);
        await new Promise((resolve) => window.setTimeout(resolve, 8));
      } catch (indexError) {
        console.error("[ASNEB] PDF page indexing failed", {
          page: pageNumber,
          error: indexError,
        });
      }
    }
  }

  useEffect(() => {
    return () => {
      indexRunRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (queryHandledRef.current) {
      return;
    }
    const page = Number(searchParams.get("page"));
    if (!highlightId && Number.isFinite(page) && page > 0 && numPages) {
      queryHandledRef.current = true;
      navigateTo(page);
      return;
    }
    if (!highlightId || !research.currentHighlights.length) {
      return;
    }
    const highlight = research.currentHighlights.find(
      (item) => item.id === highlightId,
    );
    if (!highlight) {
      return;
    }
    queryHandledRef.current = true;
    navigateTo(highlight.page, highlight.id);
    if (searchParams.get("ask") === "1") {
      void analyzeSelection("explain", highlight.selected_text, highlight.page);
    }
  }, [
    analyzeSelection,
    navigateTo,
    numPages,
    research.currentHighlights,
    searchParams,
  ]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActiveTool("search");
        setToolOpen(true);
      }
      if (event.key.toLowerCase() === "b") {
        void research.toggleBookmark(activePage);
      }
      if (event.key.toLowerCase() === "n") {
        setActiveTool("notes");
        setToolOpen(true);
      }
      if (event.key.toLowerCase() === "f") {
        setFullscreen((value) => !value);
      }
      if (event.key === "ArrowLeft" && activePage > 1) {
        navigateTo(activePage - 1);
      }
      if (event.key === "ArrowRight" && activePage < numPages) {
        navigateTo(activePage + 1);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activePage, navigateTo, numPages, research]);

  function toggleTool(tool: ReaderTool) {
    setActiveTool(tool);
    setToolOpen((open) => (activeTool === tool ? !open : true));
  }

  function signOut() {
    getPocketBase().authStore.clear();
    router.replace("/login");
  }

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-space text-slate-200">
      <AmbientBackground compact />
      <header className="relative z-30 flex h-[64px] shrink-0 items-center gap-3 border-b border-slate-700/35 bg-slate-950/60 px-3 backdrop-blur-xl sm:px-4">
        <button
          aria-label="Return to observatory"
          className="rounded-lg border border-slate-700/35 bg-slate-900/35 p-2 text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-200"
          onClick={() => router.push("/dashboard")}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="hidden sm:block">
          <Brand condensed />
        </div>
        <div className="mx-1 h-7 w-px bg-slate-700/40" />
        <div className="min-w-0 flex-1">
          <div className="hud-label hidden text-[0.48rem] sm:block">
            Active Analysis Document
          </div>
          <div className="truncate text-xs font-semibold text-slate-200 sm:mt-1 sm:text-sm">
            {book?.title ?? "Calibrating reader..."}
          </div>
        </div>
        <div className="hidden items-center gap-1 rounded-lg border border-slate-700/35 bg-slate-900/35 p-1 sm:flex">
          <button
            aria-label="Previous page"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-30"
            disabled={activePage <= 1}
            onClick={() => navigateTo(activePage - 1)}
            type="button"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-[78px] px-2 text-center font-mono text-[0.67rem] tracking-wider text-slate-300">
            {activePage} / {numPages || "--"}
          </div>
          <button
            aria-label="Next page"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-30"
            disabled={!numPages || activePage >= numPages}
            onClick={() => navigateTo(activePage + 1)}
            type="button"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          aria-label="Toggle page bookmark"
          className={`hidden rounded-lg border p-2 transition sm:block ${
            research.currentBookmarks.some((item) => item.page === activePage)
              ? "border-amber-300/40 bg-amber-300/[0.1] text-amber-200"
              : "border-slate-700/35 bg-slate-900/35 text-slate-400 hover:text-amber-200"
          }`}
          onClick={() => void research.toggleBookmark(activePage)}
          type="button"
        >
          <Bookmark className="h-4 w-4" />
        </button>
        <button
          aria-label={fullscreen ? "Exit focus mode" : "Enter focus mode"}
          className="hidden rounded-lg border border-slate-700/35 bg-slate-900/35 p-2 text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-200 sm:block"
          onClick={() => setFullscreen((value) => !value)}
          type="button"
        >
          {fullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
        <button
          aria-label="Open AI assistant"
          className="rounded-lg border border-cyan-300/30 bg-cyan-400/[0.08] p-2 text-cyan-200 transition hover:bg-cyan-400/[0.14] hover:shadow-neon"
          onClick={() => setPanelOpen(true)}
          type="button"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <button
          aria-label="Sign out"
          className="hidden rounded-lg border border-slate-700/35 bg-slate-900/35 p-2 text-slate-500 transition hover:border-rose-300/30 hover:text-rose-200 sm:block"
          onClick={signOut}
          type="button"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        {!fullscreen && (
          <aside className="hidden w-[52px] shrink-0 flex-col items-center overflow-y-auto border-r border-slate-700/30 bg-slate-950/40 py-3 md:flex">
            {toolbarItems.map(({ icon: Icon, label, tool }) => (
              <button
                aria-label={label}
                className={`mb-1.5 rounded-lg border p-2 transition ${
                  toolOpen && activeTool === tool
                    ? "border-cyan-300/30 bg-cyan-400/[0.09] text-cyan-200"
                    : "border-transparent text-slate-600 hover:border-slate-700/50 hover:text-slate-300"
                }`}
                key={tool}
                onClick={() => toggleTool(tool)}
                title={label}
                type="button"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
            <div className="mt-auto h-12 w-px shrink-0 bg-gradient-to-b from-cyan-300/50 to-transparent" />
          </aside>
        )}

        <ResearchPanel
          activePage={activePage}
          analyses={research.analyses}
          book={book}
          bookmarks={research.bookmarks}
          currentAnalyses={research.currentAnalyses}
          currentBookmarks={research.currentBookmarks}
          currentHighlights={research.currentHighlights}
          currentNotes={research.currentNotes}
          highlights={research.highlights}
          indexedPages={research.pages}
          notes={research.notes}
          numPages={numPages}
          onAddStickyNote={(content) =>
            void research.addNote({ content, kind: "sticky", page: activePage })
          }
          onAsk={(text) => void analyzeSelection("explain", text)}
          onClose={() => setToolOpen(false)}
          onDeleteHighlight={(id) => void research.deleteHighlight(id)}
          onDeleteNote={(id) => void research.deleteNote(id)}
          onNavigate={navigateTo}
          onOpenAnalysis={openStoredAnalysis}
          onToggleBookmark={(page) => void research.toggleBookmark(page)}
          onUpdateHighlightNote={research.updateHighlightNote}
          onUpdateNote={research.updateNote}
          open={toolOpen}
          outline={outline}
          tool={activeTool}
        />

        <section className="relative flex min-w-0 flex-1 flex-col">
          {!fullscreen && (
            <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-700/25 bg-slate-950/25 px-4">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                <span className="hud-label text-[0.47rem] text-emerald-200/70">
                  Text layer armed // research persistence online
                </span>
              </div>
              <div className="hidden font-mono text-[0.58rem] tracking-widest text-slate-600 sm:block">
                CTRL+K SEARCH // B BOOKMARK // N NOTES // F FOCUS
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-3 py-5 sm:px-5"
          >
            <div ref={viewerRef} className="pdf-document mx-auto w-fit">
              {loading ? (
                <div className="flex min-h-[68vh] min-w-[280px] items-center justify-center">
                  <PhysicsLoader label="Loading research paper" />
                </div>
              ) : pdfError ? (
                <div className="glass-panel flex min-h-[360px] w-[min(90vw,620px)] flex-col items-center justify-center rounded-xl p-8 text-center">
                  <FileText className="h-8 w-8 text-rose-300/70" />
                  <p className="mt-5 text-sm leading-6 text-slate-300">{pdfError}</p>
                  <Button
                    className="mt-5"
                    onClick={() => router.push("/dashboard")}
                    variant="ghost"
                  >
                    Return to observatory
                  </Button>
                </div>
              ) : (
                <Document
                  file={fileUrl}
                  loading={<PhysicsLoader label="Mapping PDF geometry" />}
                  onLoadError={(error) => {
                    console.error("[ASNEB] PDF renderer failed", error);
                    setPdfError("The PDF renderer could not map this document.");
                  }}
                  onLoadSuccess={(pdf) => void handleDocumentLoad(pdf)}
                >
                  {Array.from({ length: numPages }, (_, index) => {
                    const page = index + 1;
                    const shouldRender = Math.abs(page - activePage) <= 3;
                    const pageHighlights = research.currentHighlights.filter(
                      (highlight) => highlight.page === page,
                    );
                    const pageNotes = research.currentNotes.filter(
                      (note) => note.page === page,
                    );
                    return (
                      <div
                        className="mb-5 scroll-mt-4"
                        data-page={page}
                        key={page}
                        ref={(element) => {
                          if (element) {
                            pageRefs.current.set(page, element);
                          } else {
                            pageRefs.current.delete(page);
                          }
                        }}
                      >
                        <div className="mb-2 flex items-center gap-2 font-mono text-[0.57rem] tracking-[0.18em] text-cyan-200/50">
                          <span>FRAME {String(page).padStart(3, "0")}</span>
                          <span className="h-px flex-1 bg-gradient-to-r from-cyan-300/20 to-transparent" />
                        </div>
                        <div
                          className="relative overflow-hidden bg-white/[0.03]"
                          data-pdf-page-content
                          style={{ minHeight: Math.round(pageWidth * 1.294), width: pageWidth }}
                        >
                          {shouldRender ? (
                            <>
                              <Page
                                loading={
                                  <div
                                    className="flex items-center justify-center bg-white/5"
                                    style={{
                                      height: Math.round(pageWidth * 1.294),
                                      width: pageWidth,
                                    }}
                                  >
                                    <LoaderCircle className="h-6 w-6 animate-spin text-cyan-300/50" />
                                  </div>
                                }
                                pageNumber={page}
                                renderAnnotationLayer
                                renderTextLayer
                                width={pageWidth}
                              />
                              <HighlightLayer
                                focusedHighlightId={focusedHighlightId}
                                highlights={pageHighlights}
                                notes={pageNotes}
                                onSelectHighlight={(highlightId) => {
                                  setFocusedHighlightId(highlightId);
                                  setActiveTool("highlights");
                                  setToolOpen(true);
                                }}
                              />
                            </>
                          ) : (
                            <div
                              className="flex items-center justify-center border border-slate-700/20 bg-slate-950/20"
                              style={{ height: Math.round(pageWidth * 1.294) }}
                            >
                              <div className="hud-label text-slate-700">
                                Deferred frame // {String(page).padStart(3, "0")}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Document>
              )}
            </div>
          </div>
        </section>

        <AiPanel
          completed={aiCompleted}
          continuationCount={aiContinuationCount}
          error={aiError}
          fallback={aiFallback}
          mode={aiMode}
          onClose={() => setPanelOpen(false)}
          open={panelOpen}
          provider={aiProvider}
          response={aiResponse}
          selectedText={aiText}
          status={aiStatus}
          streaming={streaming}
        />
      </div>

      <AnimatePresence>
        {floatingMenu && (
          <motion.div
            className="fixed z-[70] max-w-[calc(100vw-16px)] rounded-lg border border-cyan-300/35 bg-[#07121f]/95 p-1.5 shadow-[0_0_32px_rgba(0,212,255,0.2)] backdrop-blur-2xl"
            initial={{ opacity: 0, scale: 0.94, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 4 }}
            style={
              {
                left: floatingMenu.x,
                top: floatingMenu.y,
                transform: "translate(-50%, -100%)",
              } as CSSProperties
            }
          >
            <div className="flex max-w-[min(96vw,760px)] flex-wrap items-center gap-1">
              {promptActions.map(({ icon: Icon, label, mode, shortLabel }) => (
                <button
                  className="flex items-center gap-1.5 rounded-md px-2 py-2 text-[0.62rem] font-semibold text-slate-300 transition hover:bg-cyan-400/[0.1] hover:text-cyan-100"
                  key={mode}
                  onClick={() =>
                    void analyzeSelection(mode, floatingMenu.text, floatingMenu.page)
                  }
                  title={label}
                  type="button"
                >
                  <Icon className="h-3.5 w-3.5 text-cyan-300" />
                  <span className="hidden sm:inline">{shortLabel}</span>
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-slate-700/55" />
              <button
                aria-label="Attach note"
                className="rounded-md p-2 text-amber-200 transition hover:bg-amber-300/[0.1]"
                onClick={() => addSelectionNote("note")}
                title="Attach note"
                type="button"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
              </button>
              <button
                aria-label="Save citation"
                className="rounded-md p-2 text-slate-300 transition hover:bg-cyan-300/[0.1]"
                onClick={() => addSelectionNote("citation")}
                title="Save citation"
                type="button"
              >
                <Quote className="h-3.5 w-3.5" />
              </button>
              <button
                aria-label="Save formula snapshot"
                className="rounded-md p-2 text-violet-200 transition hover:bg-violet-300/[0.1]"
                onClick={() => addSelectionNote("formula")}
                title="Save formula snapshot"
                type="button"
              >
                <Sigma className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 flex items-center gap-1 border-t border-slate-700/45 pt-1">
              <span className="hud-label mr-1 px-1 text-[0.44rem]">Highlight</span>
              {highlightColors.map(({ color, label, solid }) => (
                <button
                  aria-label={`Highlight ${label}`}
                  className={`h-5 w-5 rounded-md border border-white/25 transition hover:scale-110 ${solid}`}
                  key={color}
                  onClick={() => {
                    void research.addHighlight({
                      anchor: floatingMenu.anchor,
                      color: color as HighlightColor,
                      page: floatingMenu.page,
                      selectedText: floatingMenu.text,
                    });
                    setFloatingMenu(null);
                    window.getSelection()?.removeAllRanges();
                  }}
                  title={label}
                  type="button"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
