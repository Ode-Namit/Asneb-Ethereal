"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Folder,
  FolderOpen,
  Gauge,
  Home,
  Layers3,
  LoaderCircle,
  LogOut,
  Menu,
  MoreVertical,
  MoveRight,
  NotebookPen,
  Orbit,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { SortSelect } from "@/components/ui/sort-select";
import {
  appendAuthenticatedUser,
  getAuthenticatedUserId,
  getPocketBase,
  hydratePocketBaseAuth,
  logPocketBaseError,
  runPocketBaseRequest,
  withAuthenticatedUser,
} from "@/lib/pocketbase";
import { getPocketBaseSort, sortByOption } from "@/lib/sorting";
import type { BookRecord, FolderRecord, ReadingProgressRecord } from "@/lib/types";
import { useUserSortPreference } from "@/lib/use-sort-preference";

type Selection =
  | { type: "folder"; id: string }
  | { type: "book"; id: string }
  | null;

type Notice = {
  message: string;
  tone: "error" | "info" | "success";
};

type LibraryTarget = Exclude<Selection, null>;

const PDF_UPLOAD_MAX_BYTES = 262144000;

function collectNestedFolderIds(rootId: string, folders: FolderRecord[]) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parent && ids.has(folder.parent) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
}

function normalizeParent(value: string | null | undefined) {
  return value || null;
}

function formatUploadSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdfUpload(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function getUniqueUploadFiles(files: File[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatSignalDate(value?: string) {
  if (!value) {
    return "No recent signal";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function isDuplicateFolderName(
  folders: FolderRecord[],
  name: string,
  parent: string | null,
  excludeId?: string,
) {
  const normalizedName = name.trim().toLowerCase();
  return folders.some(
    (folder) =>
      folder.id !== excludeId &&
      folder.name.trim().toLowerCase() === normalizedName &&
      normalizeParent(folder.parent) === parent,
  );
}

function isDuplicateBookTitle(
  books: BookRecord[],
  title: string,
  folder: string | null,
  excludeId?: string,
) {
  const normalizedTitle = title.trim().toLowerCase();
  return books.some(
    (book) =>
      book.id !== excludeId &&
      book.title.trim().toLowerCase() === normalizedTitle &&
      normalizeParent(book.folder) === folder,
  );
}

function targetKey(target: LibraryTarget) {
  return `${target.type}:${target.id}`;
}

function isSameTarget(first: LibraryTarget, second: LibraryTarget) {
  return first.type === second.type && first.id === second.id;
}

function mergeLibraryTargets(targets: LibraryTarget[]) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = targetKey(target);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function collectActionTargets(
  targets: LibraryTarget[],
  folders: FolderRecord[],
  books: BookRecord[],
) {
  const selectedFolderIds = new Set(
    targets.filter((target) => target.type === "folder").map((target) => target.id),
  );
  const childFolderIds = new Set<string>();

  for (const folderId of selectedFolderIds) {
    for (const nestedId of collectNestedFolderIds(folderId, folders)) {
      if (nestedId !== folderId) {
        childFolderIds.add(nestedId);
      }
    }
  }

  return mergeLibraryTargets(targets).filter((target) => {
    if (target.type === "folder") {
      return !childFolderIds.has(target.id);
    }

    const book = books.find((item) => item.id === target.id);
    return !book?.folder || !childFolderIds.has(book.folder);
  });
}

function FolderTreeItem({
  folder,
  folders,
  activeFolder,
  onSelect,
  level = 0,
}: {
  folder: FolderRecord;
  folders: FolderRecord[];
  activeFolder: string | null;
  onSelect: (folderId: string) => void;
  level?: number;
}) {
  const children = folders.filter((child) => child.parent === folder.id);
  const containsActive = useMemo(() => {
    let currentId = activeFolder;

    while (currentId) {
      if (currentId === folder.id) {
        return true;
      }
      currentId = folders.find((item) => item.id === currentId)?.parent ?? null;
    }

    return false;
  }, [activeFolder, folder.id, folders]);
  const [expanded, setExpanded] = useState(containsActive || level < 1);

  useEffect(() => {
    if (containsActive) {
      setExpanded(true);
    }
  }, [containsActive]);

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md border px-1 py-1 transition ${
          activeFolder === folder.id
            ? "border-cyan-300/30 bg-cyan-400/[0.1] text-cyan-100"
            : "border-transparent text-slate-400 hover:bg-slate-800/45 hover:text-slate-200"
        }`}
        style={{ marginLeft: level * 10 }}
      >
        <button
          aria-label={expanded ? "Collapse folder" : "Expand folder"}
          className="flex h-6 w-5 items-center justify-center"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {children.length > 0 ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-1 w-1 rounded-full bg-slate-700" />
          )}
        </button>
        <button
          className="flex min-w-0 flex-1 items-center gap-2 py-1 pr-1 text-left text-xs"
          onClick={() => onSelect(folder.id)}
          type="button"
        >
          {expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-cyan-300/80" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-cyan-300/60" />
          )}
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {expanded &&
        children.map((child) => (
          <FolderTreeItem
            key={child.id}
            activeFolder={activeFolder}
            folder={child}
            folders={folders}
            level={level + 1}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

function Sidebar({
  activeFolder,
  books,
  folders,
  isOpen,
  onClose,
  onOpenBook,
  onOpenAccountSettings,
  onSelectFolder,
  onSignOut,
  readingProgress,
}: {
  activeFolder: string | null;
  books: BookRecord[];
  folders: FolderRecord[];
  isOpen: boolean;
  onClose: () => void;
  onOpenBook: (bookId: string) => void;
  onOpenAccountSettings: () => void;
  onSelectFolder: (folderId: string | null) => void;
  onSignOut: () => void;
  readingProgress: ReadingProgressRecord[];
}) {
  const roots = folders.filter((folder) => !folder.parent);
  const latestProgress = useMemo(() => {
    const existingBookIds = new Set(books.map((book) => book.id));
    return readingProgress
      .filter((progress) => existingBookIds.has(progress.book))
      .sort(
        (left, right) =>
          new Date(right.updated || right.created).getTime() -
          new Date(left.updated || left.created).getTime(),
      )[0];
  }, [books, readingProgress]);
  const latestProgressBook = latestProgress
    ? books.find((book) => book.id === latestProgress.book)
    : undefined;
  const latestBook = useMemo(
    () =>
      [...books].sort(
        (left, right) =>
          new Date(right.updated || right.created).getTime() -
          new Date(left.updated || left.created).getTime(),
      )[0],
    [books],
  );
  const pulseBook = latestProgressBook ?? latestBook;
  const pulseTitle =
    pulseBook?.title ??
    (folders.length ? "Realms are waiting for a PDF" : "Awaiting first reading signal");
  const pulseSignal = latestProgress
    ? `Page ${latestProgress.last_page}`
    : pulseBook
      ? "Ready to begin"
      : "No vessel yet";
  const pulseDetail = latestProgress
    ? `Last signal ${formatSignalDate(latestProgress.updated || latestProgress.created)}`
    : pulseBook
      ? `Latest vessel ${formatSignalDate(pulseBook.updated || pulseBook.created)}`
      : "Upload a PDF to awaken memory flow.";
  const libraryContext = `${books.length} ${
    books.length === 1 ? "vessel" : "vessels"
  } // ${folders.length} ${folders.length === 1 ? "realm" : "realms"}`;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.button
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-slate-950/75 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            type="button"
          />
        )}
      </AnimatePresence>
      <aside
        className={`floating-glass fixed inset-y-0 left-0 z-40 flex w-[282px] flex-col overflow-hidden border-r border-pearl/10 px-4 py-5 shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <Brand />
          <button
            aria-label="Close sidebar"
            className="text-slate-500 hover:text-white lg:hidden"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-9 flex min-h-0 flex-1 flex-col">
          <div className="hud-label px-2">Realm Topology</div>
          <button
            className={`mt-3 flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition ${
              activeFolder === null
                ? "border-cyan-300/30 bg-cyan-400/[0.1] text-cyan-100"
                : "border-transparent text-slate-400 hover:bg-slate-800/45 hover:text-slate-200"
            }`}
            onClick={() => onSelectFolder(null)}
            type="button"
          >
            <Home className="h-3.5 w-3.5 text-cyan-300" />
            Root Sanctuary
          </button>
          <div className="asneb-sidebar-scroll mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
            {roots.map((folder) => (
              <FolderTreeItem
                key={folder.id}
                activeFolder={activeFolder}
                folder={folder}
                folders={folders}
                onSelect={(folderId) => onSelectFolder(folderId)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 shrink-0 space-y-3">
          <div className="rounded-lg border border-pearl/10 bg-pearl/[0.035] p-3.5">
            <div className="hud-label text-[0.5rem]">Account / Settings</div>
            <button
              className="mt-3 flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left text-xs text-slate-400 transition hover:border-aureate/25 hover:bg-aureate/[0.07] hover:text-pearl"
              onClick={onOpenAccountSettings}
              type="button"
            >
              <Settings className="h-3.5 w-3.5 text-aureate/75" />
              Account Settings
            </button>
          </div>
          <div className="spatial-panel overflow-hidden rounded-lg border border-cyan-300/20 bg-cyan-400/[0.045] p-3.5 shadow-neon">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-cyan-300">
                <Activity className="h-3.5 w-3.5" />
                <span className="hud-label text-[0.5rem]">Reading Pulse</span>
              </div>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.7)]" />
            </div>

            <button
              className="mt-3 block w-full rounded-md border border-transparent p-1.5 text-left transition hover:border-cyan-300/25 hover:bg-pearl/[0.04] disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent"
              disabled={!pulseBook}
              onClick={() => pulseBook && onOpenBook(pulseBook.id)}
              type="button"
            >
              <div className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                {pulseTitle}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-mono text-[0.62rem] font-semibold uppercase tracking-widest text-aureate">
                  {pulseSignal}
                </span>
                <span className="text-[0.58rem] text-slate-500">
                  {pulseDetail}
                </span>
              </div>
            </button>

            <div className="mt-3 flex items-center gap-1">
              <span className="h-px flex-1 bg-gradient-to-r from-cyan-300/70 via-violet-300/45 to-transparent" />
              <span className="h-1 w-1 rounded-full bg-aureate/80 shadow-halo" />
              <span className="h-px flex-1 bg-gradient-to-r from-aureate/50 to-transparent" />
            </div>
            <div className="mt-3 flex items-center gap-2 text-[0.6rem] uppercase tracking-wider text-slate-600">
              <BookOpen className="h-3 w-3 text-cyan-300/60" />
              <span>{libraryContext}</span>
            </div>
          </div>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-slate-500 transition hover:bg-slate-800/45 hover:text-slate-200"
            onClick={onSignOut}
            type="button"
          >
            <LogOut className="h-3.5 w-3.5" />
            Close Session
          </button>
        </div>
      </aside>
    </>
  );
}

function CreateFolderDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    setLoading(true);
    await onCreate(name.trim());
    setLoading(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="glass-panel panel-corner relative w-full max-w-md rounded-xl p-5"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="hud-label">Realm Craft</div>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Create memory realm
                </h3>
              </div>
              <button
                aria-label="Close modal"
                className="rounded-md p-1 text-slate-500 hover:text-white"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form className="mt-6" onSubmit={handleSubmit}>
              <input
                autoFocus
                className="w-full rounded-lg border border-slate-700/50 bg-slate-950/55 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:shadow-neon"
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Dawn readings"
                value={name}
              />
              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={onClose} type="button" variant="ghost">
                  Cancel
                </Button>
                <Button disabled={loading || !name.trim()} type="submit">
                  <Plus className="h-3.5 w-3.5" />
                  Create Realm
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DeleteConfirmationDialog({
  deleting,
  description,
  name,
  onCancel,
  onConfirm,
  open,
}: {
  deleting: boolean;
  description: string;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="glass-panel panel-corner relative w-full max-w-md rounded-xl p-5"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-rose-300/25 bg-rose-400/[0.08] p-2">
                <AlertTriangle className="h-4 w-4 text-rose-200" />
              </div>
              <div>
                <div className="hud-label text-rose-200/75">Permanent Release</div>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Delete this memory object permanently?
                </h3>
              </div>
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-200">{name}</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">{description}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button disabled={deleting} onClick={onCancel} type="button" variant="ghost">
                Cancel
              </Button>
              <Button disabled={deleting} onClick={onConfirm} type="button" variant="danger">
                {deleting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {deleting ? "Deleting..." : "Delete permanently"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AccountSettingsDialog({
  onClose,
  onDeleteAccount,
  open,
}: {
  onClose: () => void;
  onDeleteAccount: () => void;
  open: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="glass-panel panel-corner relative w-full max-w-md rounded-xl p-5"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="hud-label">Account / Settings</div>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Account settings
                </h3>
              </div>
              <button
                aria-label="Close settings"
                className="rounded-md p-1 text-slate-500 hover:text-white"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 rounded-lg border border-rose-300/20 bg-rose-400/[0.055] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
                <div>
                  <div className="text-sm font-semibold text-rose-100">
                    Danger zone
                  </div>
                  <p className="mt-2 text-xs leading-6 text-rose-100/70">
                    Delete the current account and permanently remove its library,
                    PDFs, notes, highlights, reading progress, bookmarks, and
                    companion history.
                  </p>
                </div>
              </div>
              <Button
                className="mt-4 w-full justify-center"
                onClick={onDeleteAccount}
                type="button"
                variant="danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete account
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DeleteAccountDialog({
  deleting,
  error,
  onCancel,
  onConfirm,
  open,
  success,
}: {
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  open: boolean;
  success: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmation("");
    }
  }, [open]);

  const confirmed = confirmation === "DELETE";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 px-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="glass-panel panel-corner relative w-full max-w-md rounded-xl p-5"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-rose-300/25 bg-rose-400/[0.08] p-2">
                <AlertTriangle className="h-4 w-4 text-rose-200" />
              </div>
              <div>
                <div className="hud-label text-rose-200/75">Permanent deletion</div>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Delete account?
                </h3>
              </div>
            </div>

            <p className="mt-5 text-xs leading-6 text-slate-400">
              This permanently removes the authenticated user account and all
              user data, including books, uploaded PDFs, folders, reading
              progress, notes, highlights, bookmarks, indexed pages, and AI
              companion history. This cannot be undone.
            </p>

            <label className="mt-5 block text-xs font-semibold text-slate-300">
              Type DELETE to confirm
              <input
                autoFocus
                className="mt-2 w-full rounded-lg border border-rose-300/25 bg-slate-950/55 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-rose-300/60"
                disabled={deleting || success}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="DELETE"
                value={confirmation}
              />
            </label>

            {error && (
              <div className="mt-4 rounded-lg border border-rose-300/25 bg-rose-400/[0.08] px-3 py-2 text-xs leading-5 text-rose-100/85">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-4 rounded-lg border border-emerald-300/25 bg-emerald-400/[0.08] px-3 py-2 text-xs leading-5 text-emerald-100/85">
                Account deleted. Redirecting...
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                disabled={deleting || success}
                onClick={onCancel}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={!confirmed || deleting || success}
                onClick={() => void onConfirm()}
                type="button"
                variant="danger"
              >
                {deleting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {deleting ? "Deleting..." : "Delete account"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FolderPickerItem({
  disabledIds,
  folder,
  folders,
  level = 0,
  onSelect,
  selectedFolder,
}: {
  disabledIds: Set<string>;
  folder: FolderRecord;
  folders: FolderRecord[];
  level?: number;
  onSelect: (folderId: string) => void;
  selectedFolder: string | null;
}) {
  const children = folders.filter((child) => child.parent === folder.id);
  const disabled = disabledIds.has(folder.id);
  const [expanded, setExpanded] = useState(level < 1);

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md border px-1 py-1 transition ${
          selectedFolder === folder.id
            ? "border-aureate/40 bg-aureate/[0.12] text-pearl"
            : disabled
              ? "border-transparent text-slate-700"
              : "border-transparent text-slate-400 hover:bg-pearl/[0.06] hover:text-slate-100"
        }`}
        style={{ marginLeft: level * 10 }}
      >
        <button
          aria-label={expanded ? "Collapse realm" : "Expand realm"}
          className="flex h-6 w-5 items-center justify-center"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {children.length > 0 ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-1 w-1 rounded-full bg-slate-700" />
          )}
        </button>
        <button
          className="flex min-w-0 flex-1 items-center gap-2 py-1 pr-1 text-left text-xs disabled:cursor-not-allowed"
          disabled={disabled}
          onClick={() => onSelect(folder.id)}
          type="button"
        >
          <Folder className="h-3.5 w-3.5 shrink-0 text-aureate/70" />
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {expanded &&
        children.map((child) => (
          <FolderPickerItem
            key={child.id}
            disabledIds={disabledIds}
            folder={child}
            folders={folders}
            level={level + 1}
            onSelect={onSelect}
            selectedFolder={selectedFolder}
          />
        ))}
    </div>
  );
}

function MoveDialog({
  books,
  folders,
  moving,
  onClose,
  onMove,
  open,
  targets,
}: {
  books: BookRecord[];
  folders: FolderRecord[];
  moving: boolean;
  onClose: () => void;
  onMove: (folderId: string | null) => Promise<void>;
  open: boolean;
  targets: LibraryTarget[];
}) {
  const [targetFolder, setTargetFolder] = useState<string | null>(null);
  const roots = folders.filter((folder) => !folder.parent);
  const firstTarget = targets[0] ?? null;
  const disabledIds = useMemo(
    () => {
      const blocked = new Set<string>();
      for (const target of targets) {
        if (target.type === "folder") {
          for (const folderId of collectNestedFolderIds(target.id, folders)) {
            blocked.add(folderId);
          }
        }
      }
      return blocked;
    },
    [folders, targets],
  );
  const name =
    targets.length > 1
      ? `${targets.length} selected memory objects`
      : firstTarget?.type === "folder"
        ? folders.find((folder) => folder.id === firstTarget.id)?.name ??
          "Selected realm"
        : books.find((book) => book.id === firstTarget?.id)?.title ?? "Selected PDF";

  useEffect(() => {
    if (!open || !firstTarget) {
      setTargetFolder(null);
      return;
    }
    if (targets.length > 1) {
      setTargetFolder(null);
      return;
    }
    if (firstTarget.type === "folder") {
      setTargetFolder(
        normalizeParent(folders.find((folder) => folder.id === firstTarget.id)?.parent),
      );
      return;
    }
    setTargetFolder(
      normalizeParent(books.find((book) => book.id === firstTarget.id)?.folder),
    );
  }, [books, firstTarget, folders, open, targets.length]);

  async function submitMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onMove(targetFolder);
  }

  return (
    <AnimatePresence>
      {open && firstTarget && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.form
            className="glass-panel panel-corner relative w-full max-w-md rounded-xl p-5"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onSubmit={(event) => void submitMove(event)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="hud-label">Realm Transfer</div>
                <h3 className="mt-2 text-lg font-semibold text-white">Move to realm</h3>
              </div>
              <button
                aria-label="Close modal"
                className="rounded-md p-1 text-slate-500 hover:text-white"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 truncate text-sm font-semibold text-slate-200">{name}</p>
            <div className="mt-5 max-h-72 overflow-y-auto rounded-lg border border-pearl/10 bg-slate-950/30 p-2">
              <button
                className={`mb-1 flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition ${
                  targetFolder === null
                    ? "border-aureate/40 bg-aureate/[0.12] text-pearl"
                    : "border-transparent text-slate-400 hover:bg-pearl/[0.06] hover:text-slate-100"
                }`}
                onClick={() => setTargetFolder(null)}
                type="button"
              >
                <Home className="h-3.5 w-3.5 text-aureate/75" />
                Root Sanctuary
              </button>
              {roots.map((folder) => (
                <FolderPickerItem
                  key={folder.id}
                  disabledIds={disabledIds}
                  folder={folder}
                  folders={folders}
                  onSelect={setTargetFolder}
                  selectedFolder={targetFolder}
                />
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button disabled={moving} onClick={onClose} type="button" variant="ghost">
                Cancel
              </Button>
              <Button disabled={moving} type="submit">
                {moving ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MoveRight className="h-3.5 w-3.5" />
                )}
                {moving ? "Moving..." : "Move To"}
              </Button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RenameDialog({
  currentName,
  onClose,
  onRename,
  open,
  renaming,
  target,
}: {
  currentName: string;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
  open: boolean;
  renaming: boolean;
  target: LibraryTarget | null;
}) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    setName(currentName);
  }, [currentName, open]);

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    await onRename(name.trim());
  }

  return (
    <AnimatePresence>
      {open && target && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.form
            className="glass-panel panel-corner relative w-full max-w-md rounded-xl p-5"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onSubmit={(event) => void submitRename(event)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="hud-label">Name Reflection</div>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Rename {target.type === "folder" ? "realm" : "PDF"}
                </h3>
              </div>
              <button
                aria-label="Close modal"
                className="rounded-md p-1 text-slate-500 hover:text-white"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              autoFocus
              className="mt-6 w-full rounded-lg border border-pearl/15 bg-slate-950/45 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-aureate/60 focus:shadow-halo"
              maxLength={target.type === "folder" ? 120 : 180}
              onChange={(event) => setName(event.target.value)}
              placeholder={target.type === "folder" ? "Realm name" : "PDF title"}
              value={name}
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button disabled={renaming} onClick={onClose} type="button" variant="ghost">
                Cancel
              </Button>
              <Button disabled={renaming || !name.trim()} type="submit">
                {renaming ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
                {renaming ? "Renaming..." : "Rename"}
              </Button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DashboardWorkspace() {
  const router = useRouter();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [readingProgress, setReadingProgress] = useState<ReadingProgressRecord[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [selections, setSelections] = useState<LibraryTarget[]>([]);
  const [lastSelectedTarget, setLastSelectedTarget] = useState<LibraryTarget | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDropActive, setUploadDropActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [sortOrder, setSortOrder] = useUserSortPreference();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [telemetryOnline, setTelemetryOnline] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draggedItem, setDraggedItem] = useState<LibraryTarget | null>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [accountDeleteDialogOpen, setAccountDeleteDialogOpen] = useState(false);
  const [accountDeleting, setAccountDeleting] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState("");
  const [accountDeleteSuccess, setAccountDeleteSuccess] = useState(false);

  function showNotice(message: string, tone: Notice["tone"] = "info") {
    setNotice({ message, tone });
  }

  const loadLibrary = useCallback(async () => {
    const pb = getPocketBase();

    try {
      const userId = await hydratePocketBaseAuth(pb);
      const filter = pb.filter("user = {:userId}", { userId });
      const [folderRows, bookRows, progressRows] = await Promise.all([
        runPocketBaseRequest("List authenticated folders", () =>
          pb.collection("folders").getFullList<FolderRecord>({
            filter,
            sort: getPocketBaseSort(sortOrder, "name"),
          }),
        ),
        runPocketBaseRequest("List authenticated books", () =>
          pb.collection("books").getFullList<BookRecord>({
            filter,
            sort: getPocketBaseSort(sortOrder, "title"),
          }),
        ),
        runPocketBaseRequest("List authenticated reading pulse", () =>
          pb.collection("reading_progress").getFullList<ReadingProgressRecord>({
            filter,
            sort: "-updated",
          }),
        ),
      ]);
      setFolders(folderRows);
      setBooks(bookRows);
      setReadingProgress(progressRows);
      setTelemetryOnline(true);
    } catch (error) {
      logPocketBaseError("Hydrate dashboard library", error);
      setTelemetryOnline(false);

      if (!getAuthenticatedUserId(pb)) {
        router.replace("/login");
        return;
      }

      showNotice("Library telemetry is unavailable. Check the PocketBase link.", "error");
    } finally {
      setLoading(false);
    }
  }, [router, sortOrder]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const currentFolders = useMemo(
    () =>
      sortByOption(
        folders.filter(
          (folder) =>
            (folder.parent || null) === activeFolder &&
            folder.name.toLowerCase().includes(search.toLowerCase()),
        ),
        sortOrder,
        (folder) => folder.name,
      ),
    [activeFolder, folders, search, sortOrder],
  );

  const currentBooks = useMemo(
    () =>
      sortByOption(
        books.filter(
          (book) =>
            (book.folder || null) === activeFolder &&
            book.title.toLowerCase().includes(search.toLowerCase()),
        ),
        sortOrder,
        (book) => book.title,
      ),
    [activeFolder, books, search, sortOrder],
  );

  const currentItems = useMemo<LibraryTarget[]>(
    () => [
      ...currentFolders.map((folder) => ({ type: "folder" as const, id: folder.id })),
      ...currentBooks.map((book) => ({ type: "book" as const, id: book.id })),
    ],
    [currentBooks, currentFolders],
  );
  const selectedCount = selections.length;
  const hasSelection = selectedCount > 0;
  const selection: Selection = selectedCount === 1 ? selections[0] : null;

  const breadcrumbs = useMemo(() => {
    const path: FolderRecord[] = [];
    let cursor = folders.find((folder) => folder.id === activeFolder);

    while (cursor) {
      path.unshift(cursor);
      cursor = folders.find((folder) => folder.id === cursor?.parent);
    }

    return path;
  }, [activeFolder, folders]);

  function clearLibrarySelection() {
    setSelections([]);
    setLastSelectedTarget(null);
  }

  function isTargetSelected(target: LibraryTarget) {
    return selections.some((selected) => isSameTarget(selected, target));
  }

  function selectLibraryItem(
    event: MouseEvent<HTMLButtonElement>,
    target: LibraryTarget,
  ) {
    event.stopPropagation();

    if (event.shiftKey && lastSelectedTarget) {
      const startIndex = currentItems.findIndex((item) =>
        isSameTarget(item, lastSelectedTarget),
      );
      const endIndex = currentItems.findIndex((item) => isSameTarget(item, target));

      if (startIndex >= 0 && endIndex >= 0) {
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        const range = currentItems.slice(start, end + 1);
        setSelections((current) =>
          event.ctrlKey || event.metaKey
            ? mergeLibraryTargets([...current, ...range])
            : range,
        );
        setLastSelectedTarget(target);
        return;
      }
    }

    if (event.ctrlKey || event.metaKey) {
      setSelections((current) =>
        current.some((selected) => isSameTarget(selected, target))
          ? current.filter((selected) => !isSameTarget(selected, target))
          : [...current, target],
      );
      setLastSelectedTarget(target);
      return;
    }

    setSelections([target]);
    setLastSelectedTarget(target);
  }

  function selectFolder(folderId: string | null) {
    setActiveFolder(folderId);
    clearLibrarySelection();
    setSidebarOpen(false);
  }

  async function createFolder(name: string) {
    const pb = getPocketBase();

    try {
      const data = withAuthenticatedUser(pb, {
        name,
        ...(activeFolder ? { parent: activeFolder } : {}),
      });
      await runPocketBaseRequest("Create authenticated folder", () =>
        pb.collection("folders").create<FolderRecord>(data),
      );
      setFolderDialogOpen(false);
      showNotice("Memory realm created.", "success");
      await loadLibrary();
    } catch (error) {
      logPocketBaseError("Create folder workflow", error);
      showNotice("The new realm could not be created.", "error");
    }
  }

  async function uploadFiles(files: File[]) {
    if (uploading) {
      showNotice("An upload is already in motion.", "info");
      return;
    }

    const selectedFiles = getUniqueUploadFiles(files);
    const duplicateCount = files.length - selectedFiles.length;
    if (!selectedFiles.length) {
      return;
    }

    const invalidFiles = selectedFiles.filter((file) => !isPdfUpload(file));
    const oversizedFiles = selectedFiles.filter(
      (file) => file.size > PDF_UPLOAD_MAX_BYTES,
    );
    const uploadableFiles = selectedFiles.filter(
      (file) => isPdfUpload(file) && file.size <= PDF_UPLOAD_MAX_BYTES,
    );
    const skippedMessages = [
      ...(duplicateCount
        ? [`${duplicateCount} duplicate selection${duplicateCount === 1 ? "" : "s"} skipped.`]
        : []),
      ...(invalidFiles.length
        ? [
            `${invalidFiles.length} non-PDF file${
              invalidFiles.length === 1 ? "" : "s"
            } skipped.`,
          ]
        : []),
      ...(oversizedFiles.length
        ? [
            `${oversizedFiles.length} oversized PDF${
              oversizedFiles.length === 1 ? "" : "s"
            } skipped. Limit: ${formatUploadSize(PDF_UPLOAD_MAX_BYTES)}.`,
          ]
        : []),
    ];

    if (!uploadableFiles.length) {
      if (skippedMessages.length) {
        showNotice(skippedMessages.join(" "), "error");
      }
      return;
    }

    const pb = getPocketBase();
    let uploadedCount = 0;
    const failedNames: string[] = [];

    setUploading(true);
    setUploadProgress({ completed: 0, total: uploadableFiles.length });
    try {
      for (const file of uploadableFiles) {
        const formData = new FormData();
        formData.append("title", file.name.replace(/\.pdf$/i, ""));
        formData.append("file", file);
        if (activeFolder) {
          formData.append("folder", activeFolder);
        }

        try {
          appendAuthenticatedUser(pb, formData);
          await runPocketBaseRequest("Upload authenticated PDF", () =>
            pb.collection("books").create<BookRecord>(formData),
          );
          uploadedCount += 1;
        } catch (error) {
          failedNames.push(file.name);
          logPocketBaseError(`Upload PDF workflow: ${file.name}`, error);
        } finally {
          setUploadProgress((current) => ({
            ...current,
            completed: current.completed + 1,
          }));
        }
      }

      if (uploadedCount > 0) {
        await loadLibrary();
      }

      if (failedNames.length) {
        showNotice(
          `Uploaded ${uploadedCount} of ${uploadableFiles.length} PDF${
            uploadableFiles.length === 1 ? "" : "s"
          }. ${failedNames.length} failed.${
            skippedMessages.length ? ` ${skippedMessages.join(" ")}` : ""
          }`,
          "error",
        );
        return;
      }

      showNotice(
        `${uploadedCount} PDF${
          uploadedCount === 1 ? "" : "s"
        } settled into the sanctuary.${
          skippedMessages.length ? ` ${skippedMessages.join(" ")}` : ""
        }`,
        "success",
      );
    } finally {
      setUploading(false);
      setUploadProgress({ completed: 0, total: 0 });
    }
  }

  async function uploadPdf(event: ChangeEvent<HTMLInputElement>) {
    await uploadFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function allowUploadDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = uploading ? "none" : "copy";
    if (!uploading) {
      setUploadDropActive(true);
    }
  }

  async function dropUploadFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setUploadDropActive(false);
    await uploadFiles(Array.from(event.dataTransfer.files ?? []));
  }

  async function deleteSelection() {
    if (!hasSelection || deleting) {
      return;
    }

    const pb = getPocketBase();
    const actionTargets = collectActionTargets(selections, folders, books).filter(
      (target) =>
        target.type === "folder"
          ? folders.some((folder) => folder.id === target.id)
          : books.some((book) => book.id === target.id),
    );

    if (!actionTargets.length) {
      return;
    }

    const previousFolders = folders;
    const previousBooks = books;
    const previousActiveFolder = activeFolder;
    const previousSelections = selections;
    const previousLastSelectedTarget = lastSelectedTarget;
    const nestedFolderIds = new Set<string>();
    const removedBookIds = new Set<string>();

    for (const target of actionTargets) {
      if (target.type === "folder") {
        for (const folderId of collectNestedFolderIds(target.id, folders)) {
          nestedFolderIds.add(folderId);
        }
      } else {
        removedBookIds.add(target.id);
      }
    }

    for (const book of books) {
      if (book.folder && nestedFolderIds.has(book.folder)) {
        removedBookIds.add(book.id);
      }
    }

    setDeleting(true);
    setFolders((current) => current.filter((folder) => !nestedFolderIds.has(folder.id)));
    setBooks((current) => current.filter((book) => !removedBookIds.has(book.id)));
    clearLibrarySelection();
    if (activeFolder && nestedFolderIds.has(activeFolder)) {
      setActiveFolder(null);
    }
    try {
      let deletedBooks = 0;
      let deletedFolders = 0;

      for (const target of actionTargets) {
        const response = await fetch("/api/library/delete", {
          method: "POST",
          headers: {
            Authorization: pb.authStore.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(target),
        });
        const payload = (await response.json()) as {
          error?: string;
          summary?: { books?: number; folders?: number };
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Recursive deletion failed.");
        }
        deletedBooks += payload.summary?.books ?? 0;
        deletedFolders += payload.summary?.folders ?? 0;
      }

      setDeleteDialogOpen(false);
      showNotice(
        `${actionTargets.length === 1 ? "Memory object" : "Selected memory objects"} removed. ${deletedBooks} PDF${
          deletedBooks === 1 ? "" : "s"
        } and ${deletedFolders} folder${
          deletedFolders === 1 ? "" : "s"
        } deleted.`,
        "success",
      );
    } catch (error) {
      logPocketBaseError("Delete library record workflow", error);
      setFolders(previousFolders);
      setBooks(previousBooks);
      setActiveFolder(previousActiveFolder);
      setSelections(previousSelections);
      setLastSelectedTarget(previousLastSelectedTarget);
      showNotice(
        error instanceof Error
          ? `The selected record could not be removed: ${error.message}`
          : "The selected record could not be removed.",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  }

  function getSelectedName() {
    if (!selection) {
      return "";
    }
    return selection.type === "folder"
      ? folders.find((folder) => folder.id === selection.id)?.name ?? ""
      : books.find((book) => book.id === selection.id)?.title ?? "";
  }

  async function renameSelection(name: string) {
    if (!selection || renaming) {
      return;
    }
    const target =
      selection.type === "folder"
        ? folders.find((folder) => folder.id === selection.id)
        : books.find((book) => book.id === selection.id);
    if (!target) {
      return;
    }

    const nextName = name.trim();
    if (!nextName) {
      showNotice("A name is required.", "error");
      return;
    }

    if (
      selection.type === "folder" &&
      isDuplicateFolderName(
        folders,
        nextName,
        normalizeParent((target as FolderRecord).parent),
        target.id,
      )
    ) {
      showNotice("A realm with that name already exists here.", "error");
      return;
    }

    if (
      selection.type === "book" &&
      isDuplicateBookTitle(
        books,
        nextName,
        normalizeParent((target as BookRecord).folder),
        target.id,
      )
    ) {
      showNotice("A PDF with that title already exists here.", "error");
      return;
    }

    const previousFolders = folders;
    const previousBooks = books;
    setRenaming(true);
    if (selection.type === "folder") {
      setFolders((current) =>
        current.map((folder) =>
          folder.id === selection.id ? { ...folder, name: nextName } : folder,
        ),
      );
    } else {
      setBooks((current) =>
        current.map((book) =>
          book.id === selection.id ? { ...book, title: nextName } : book,
        ),
      );
    }

    try {
      const pb = getPocketBase();
      await runPocketBaseRequest("Rename library object", () =>
        selection.type === "folder"
          ? pb.collection("folders").update(selection.id, { name: nextName })
          : pb.collection("books").update(selection.id, { title: nextName }),
      );
      setRenameDialogOpen(false);
      showNotice("Name updated across the sanctuary.", "success");
    } catch (error) {
      logPocketBaseError("Rename library object workflow", error);
      setFolders(previousFolders);
      setBooks(previousBooks);
      showNotice("The name could not be updated.", "error");
    } finally {
      setRenaming(false);
    }
  }

  async function moveLibraryTargets(targets: LibraryTarget[], targetFolder: string | null) {
    if (moving) {
      return;
    }

    const actionTargets = collectActionTargets(targets, folders, books).filter((target) =>
      target.type === "folder"
        ? folders.some((folder) => folder.id === target.id)
        : books.some((book) => book.id === target.id),
    );
    if (!actionTargets.length) {
      return;
    }

    const folderTarget = targetFolder || null;
    const selectedFolderNames = new Set<string>();
    const selectedBookTitles = new Set<string>();

    for (const target of actionTargets) {
      if (target.type === "folder") {
        const folder = folders.find((item) => item.id === target.id);
        if (!folder) {
          return;
        }
        const folderNameKey = folder.name.trim().toLowerCase();
        if (selectedFolderNames.has(folderNameKey)) {
          showNotice("Selected realms include duplicate names for this destination.", "error");
          return;
        }
        selectedFolderNames.add(folderNameKey);
        const blocked = collectNestedFolderIds(target.id, folders);
        if (folderTarget && blocked.has(folderTarget)) {
          showNotice("A realm cannot be moved inside itself or its descendants.", "error");
          return;
        }
        if (isDuplicateFolderName(folders, folder.name, folderTarget, folder.id)) {
          showNotice("A realm with that name already exists at the destination.", "error");
          return;
        }
      } else {
        const book = books.find((item) => item.id === target.id);
        if (!book) {
          return;
        }
        const bookTitleKey = book.title.trim().toLowerCase();
        if (selectedBookTitles.has(bookTitleKey)) {
          showNotice("Selected PDFs include duplicate titles for this destination.", "error");
          return;
        }
        selectedBookTitles.add(bookTitleKey);
        if (isDuplicateBookTitle(books, book.title, folderTarget, book.id)) {
          showNotice("A PDF with that title already exists at the destination.", "error");
          return;
        }
      }
    }

    const previousFolders = folders;
    const previousBooks = books;
    const folderTargetIds = new Set(
      actionTargets
        .filter((target) => target.type === "folder")
        .map((target) => target.id),
    );
    const bookTargetIds = new Set(
      actionTargets.filter((target) => target.type === "book").map((target) => target.id),
    );

    setMoving(true);
    setFolders((current) =>
      current.map((folder) =>
        folderTargetIds.has(folder.id) ? { ...folder, parent: folderTarget ?? "" } : folder,
      ),
    );
    setBooks((current) =>
      current.map((book) =>
        bookTargetIds.has(book.id) ? { ...book, folder: folderTarget ?? "" } : book,
      ),
    );

    try {
      const pb = getPocketBase();
      for (const target of actionTargets) {
        await runPocketBaseRequest("Move library object", () =>
          target.type === "folder"
            ? pb.collection("folders").update(target.id, { parent: folderTarget })
            : pb.collection("books").update(target.id, { folder: folderTarget }),
        );
      }
      setMoveDialogOpen(false);
      showNotice(
        actionTargets.length === 1
          ? "Moved into the selected realm."
          : `${actionTargets.length} selected objects moved into the chosen realm.`,
        "success",
      );
    } catch (error) {
      logPocketBaseError("Move library object workflow", error);
      setFolders(previousFolders);
      setBooks(previousBooks);
      showNotice("The selected object could not be moved.", "error");
    } finally {
      setMoving(false);
      setDraggedItem(null);
    }
  }

  async function moveSelection(targetFolder: string | null) {
    if (!hasSelection) {
      return;
    }
    await moveLibraryTargets(selections, targetFolder);
  }

  function startDrag(event: DragEvent<HTMLButtonElement>, target: LibraryTarget) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-asneb-library-object", JSON.stringify(target));
    if (!isTargetSelected(target)) {
      setSelections([target]);
      setLastSelectedTarget(target);
    }
    setDraggedItem(target);
  }

  function getDraggedTargets(target: LibraryTarget) {
    return isTargetSelected(target) ? selections : [target];
  }

  function allowFolderDrop(event: DragEvent<HTMLButtonElement>, folderId: string) {
    if (!draggedItem) {
      return;
    }
    const dragTargets = getDraggedTargets(draggedItem);
    const blocked = dragTargets.some(
      (target) =>
        target.type === "folder" &&
        collectNestedFolderIds(target.id, folders).has(folderId),
    );
    if (blocked) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  async function dropIntoFolder(event: DragEvent<HTMLButtonElement>, folderId: string) {
    event.preventDefault();
    if (!draggedItem) {
      return;
    }
    await moveLibraryTargets(getDraggedTargets(draggedItem), folderId);
  }

  function signOut() {
    getPocketBase().authStore.clear();
    router.replace("/login");
  }

  function openAccountDeleteDialog() {
    setAccountDeleteError("");
    setAccountDeleteSuccess(false);
    setAccountDeleteDialogOpen(true);
  }

  function closeAccountDeleteDialog() {
    if (accountDeleting || accountDeleteSuccess) {
      return;
    }
    setAccountDeleteDialogOpen(false);
    setAccountDeleteError("");
  }

  async function deleteAccount() {
    const pb = getPocketBase();
    setAccountDeleting(true);
    setAccountDeleteError("");
    setAccountDeleteSuccess(false);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: pb.authStore.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "The account could not be deleted.");
      }

      setAccountDeleteSuccess(true);
      showNotice("Account deleted. Redirecting...", "success");
      window.setTimeout(() => {
        pb.authStore.clear();
        router.replace("/signup");
      }, 650);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The account could not be deleted.";
      setAccountDeleteError(message);
      showNotice(message, "error");
    } finally {
      setAccountDeleting(false);
    }
  }

  return (
    <main className="spatial-root relative min-h-screen overflow-hidden bg-space text-slate-200">
      <AmbientBackground compact />
      <Sidebar
        activeFolder={activeFolder}
        books={books}
        folders={folders}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenBook={(bookId) => router.push(`/reader/${bookId}`)}
        onOpenAccountSettings={() => setAccountSettingsOpen(true)}
        onSelectFolder={selectFolder}
        onSignOut={signOut}
        readingProgress={readingProgress}
      />

      <div className="spatial-layer relative z-10 min-h-screen lg:pl-[282px]">
        <header className="floating-glass flex h-[72px] items-center gap-3 border-b border-pearl/10 px-4 sm:px-6">
          <button
            aria-label="Open navigation"
            className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-2 text-slate-300 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            type="button"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="relative hidden flex-1 sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              className="w-full max-w-md rounded-lg border border-slate-700/30 bg-slate-950/30 py-2 pl-9 pr-3 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search this realm..."
              value={search}
            />
          </div>
          <div
            className={`ml-auto hidden items-center gap-2 rounded-full border px-3 py-1.5 sm:flex ${
              telemetryOnline
                ? "border-emerald-300/20 bg-emerald-400/[0.06]"
                : "border-amber-300/20 bg-amber-400/[0.06]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 animate-pulse rounded-full ${
                telemetryOnline ? "bg-emerald-300" : "bg-amber-300"
              }`}
            />
            <span
              className={`hud-label text-[0.48rem] ${
                telemetryOnline ? "text-emerald-200" : "text-amber-200"
              }`}
            >
              {telemetryOnline
                ? "PocketBase Memory Active"
                : "PocketBase Memory Waking"}
            </span>
          </div>
          <button
            aria-label="More options"
            className="rounded-md p-2 text-slate-500 hover:text-slate-200"
            type="button"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </header>

        <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="hud-label">Celestial Library // Local Memory</div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                Ethereal Reading Sanctuary
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                <button
                  className="flex items-center gap-1.5 transition hover:text-cyan-200"
                  onClick={() => selectFolder(null)}
                  type="button"
                >
                  <Home className="h-3.5 w-3.5" />
                  Home
                </button>
                {breadcrumbs.map((folder) => (
                  <span className="flex items-center gap-1" key={folder.id}>
                    <ChevronRight className="h-3 w-3 text-slate-700" />
                    <button
                      className="transition hover:text-cyan-200"
                      onClick={() => selectFolder(folder.id)}
                      type="button"
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => router.push("/notebook")} variant="ghost">
                <NotebookPen className="h-3.5 w-3.5" />
                Memory Atlas
              </Button>
              <Button onClick={() => setFolderDialogOpen(true)} variant="ghost">
                <Plus className="h-3.5 w-3.5" />
                New Realm
              </Button>
              <Button
                disabled={!hasSelection || moving}
                onClick={() => setMoveDialogOpen(true)}
                variant="ghost"
              >
                {moving ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MoveRight className="h-3.5 w-3.5" />
                )}
                Move To
              </Button>
              <Button
                disabled={selectedCount !== 1 || renaming}
                onClick={() => setRenameDialogOpen(true)}
                variant="ghost"
              >
                {renaming ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
                Rename
              </Button>
              <div
                className={`rounded-lg transition ${
                  uploadDropActive
                    ? "shadow-neon ring-1 ring-cyan-300/40"
                    : ""
                }`}
                onDragEnter={allowUploadDrop}
                onDragLeave={() => setUploadDropActive(false)}
                onDragOver={allowUploadDrop}
                onDrop={(event) => void dropUploadFiles(event)}
              >
                <Button
                  className={uploadDropActive ? "border-cyan-300/60" : ""}
                  disabled={uploading}
                  onClick={() => uploadRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading
                    ? uploadProgress.total
                      ? `Uploading ${uploadProgress.completed}/${uploadProgress.total}`
                      : "Uploading..."
                    : uploadDropActive
                      ? "Drop PDFs"
                      : "Upload PDFs"}
                </Button>
              </div>
              <Button
                disabled={!hasSelection || deleting}
                onClick={() => setDeleteDialogOpen(true)}
                variant="danger"
              >
                {deleting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {deleting ? "Deleting..." : "Delete"}
              </Button>
              <input
                ref={uploadRef}
                accept="application/pdf"
                className="hidden"
                onChange={(event) => void uploadPdf(event)}
                multiple
                type="file"
              />
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Layers3,
                label: "Memory Realms",
                value: folders.length,
                note: "Nested places of thought",
              },
              {
                icon: BookOpen,
                label: "Reading Vessels",
                value: books.length,
                note: "Indexed PDF documents",
              },
              {
                icon: Gauge,
                label: "Companion",
                value: "AI",
                note: "Reflective guide ready",
              },
            ].map(({ icon: Icon, label, value, note }) => (
              <motion.div
                key={String(label)}
                className="glass-panel spatial-panel cinematic-reveal relative overflow-hidden rounded-xl p-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="absolute -right-6 -top-8 h-20 w-20 rounded-full bg-cyan-400/[0.05] blur-xl" />
                <Icon className="h-4 w-4 text-cyan-300/80" />
                <div className="mt-5 text-2xl font-semibold tracking-[-0.05em] text-white">
                  {value}
                </div>
                <div className="hud-label mt-2 text-[0.48rem]">{label}</div>
                <div className="mt-2 text-[0.68rem] text-slate-600">{note}</div>
              </motion.div>
            ))}
          </div>

          {notice && (
            <button
              className={`fixed right-5 top-20 z-50 flex max-w-[min(92vw,420px)] items-center gap-2 rounded-lg border px-4 py-3 text-left text-xs shadow-2xl backdrop-blur-xl transition ${
                notice.tone === "error"
                  ? "border-rose-300/25 bg-rose-400/[0.06] text-rose-100/90 hover:bg-rose-400/[0.1]"
                  : notice.tone === "success"
                    ? "border-emerald-300/25 bg-emerald-400/[0.06] text-emerald-100/90 hover:bg-emerald-400/[0.1]"
                    : "border-cyan-300/20 bg-cyan-400/[0.05] text-cyan-100/85 hover:bg-cyan-400/[0.09]"
              }`}
              onClick={() => setNotice(null)}
              type="button"
            >
              {notice.tone === "error" ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              ) : notice.tone === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
              )}
              {notice.message}
            </button>
          )}

          <section
            className="mt-8"
            onClick={(event) => {
              if (event.currentTarget === event.target) {
                clearLibrarySelection();
              }
            }}
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="hud-label">Current Realm</div>
              <div className="h-px flex-1 bg-gradient-to-r from-slate-700/60 to-transparent" />
              {selectedCount > 1 && (
                <div className="rounded-full border border-cyan-300/20 bg-cyan-400/[0.07] px-3 py-1 font-mono text-[0.58rem] uppercase tracking-[0.22em] text-cyan-100/85">
                  {selectedCount} selected
                </div>
              )}
              <div className="font-mono text-[0.62rem] tracking-widest text-slate-600">
                {currentFolders.length + currentBooks.length} OBJECTS
              </div>
              <SortSelect
                label="Sort current realm"
                onChange={setSortOrder}
                value={sortOrder}
              />
            </div>

            {loading ? (
              <div className="flex min-h-[250px] items-center justify-center">
                <Orbit className="h-8 w-8 animate-spin text-cyan-300/80" />
              </div>
            ) : currentFolders.length === 0 && currentBooks.length === 0 ? (
              <div className="glass-panel spatial-panel flex min-h-[270px] flex-col items-center justify-center rounded-xl border-dashed text-center">
                <Database className="h-8 w-8 text-cyan-300/45" strokeWidth={1.2} />
                <h2 className="mt-5 text-base font-semibold text-slate-200">
                  This realm is quiet.
                </h2>
                <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500">
                  Create a nested realm or upload a PDF to begin a new thread of
                  memory.
                </p>
              </div>
            ) : (
              <div
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                onClick={(event) => {
                  if (event.currentTarget === event.target) {
                    clearLibrarySelection();
                  }
                }}
              >
                {currentFolders.map((folder, index) => (
                  <motion.button
                    key={folder.id}
                    draggable
                    className={`glass-panel spatial-panel group relative min-h-[152px] overflow-hidden rounded-xl p-4 text-left transition duration-300 hover:border-cyan-300/50 hover:shadow-neon ${
                      isTargetSelected({ type: "folder", id: folder.id })
                        ? "border-cyan-100/90 bg-cyan-300/[0.16] shadow-[0_0_38px_rgba(103,232,249,0.24)] ring-2 ring-cyan-100/45"
                        : ""
                    }`}
                    aria-pressed={isTargetSelected({ type: "folder", id: folder.id })}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.035 }}
                    onClick={(event) =>
                      selectLibraryItem(event, { type: "folder", id: folder.id })
                    }
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      selectFolder(folder.id);
                    }}
                    onDragEnd={() => setDraggedItem(null)}
                    onDragOver={(event) => allowFolderDrop(event, folder.id)}
                    onDragStartCapture={(event) =>
                      startDrag(event, { type: "folder", id: folder.id })
                    }
                    onDrop={(event) => void dropIntoFolder(event, folder.id)}
                    type="button"
                  >
                    {isTargetSelected({ type: "folder", id: folder.id }) && (
                      <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border border-cyan-100/45 bg-slate-950/75 px-2 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-cyan-50 shadow-[0_0_18px_rgba(103,232,249,0.28)] backdrop-blur-md">
                        <CheckCircle2 className="h-3 w-3 text-cyan-100" />
                        Selected
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/[0.07] p-2.5">
                        <Folder className="h-5 w-5 text-cyan-300" strokeWidth={1.3} />
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-700 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                    </div>
                    <div className="mt-6 truncate text-sm font-semibold text-slate-200">
                      {folder.name}
                    </div>
                    <div className="hud-label mt-2 text-[0.45rem] text-slate-600">
                      Memory realm
                    </div>
                  </motion.button>
                ))}
                {currentBooks.map((book, index) => (
                  <motion.button
                    key={book.id}
                    draggable
                    className={`glass-panel spatial-panel group relative min-h-[152px] overflow-hidden rounded-xl p-4 text-left transition duration-300 hover:border-violet-300/50 hover:shadow-violet ${
                      isTargetSelected({ type: "book", id: book.id })
                        ? "border-violet-100/90 bg-violet-300/[0.16] shadow-[0_0_38px_rgba(167,139,250,0.26)] ring-2 ring-violet-100/45"
                        : ""
                    }`}
                    aria-pressed={isTargetSelected({ type: "book", id: book.id })}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: (index + currentFolders.length) * 0.035,
                    }}
                    onClick={(event) =>
                      selectLibraryItem(event, { type: "book", id: book.id })
                    }
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      router.push(`/reader/${book.id}`);
                    }}
                    onDragEnd={() => setDraggedItem(null)}
                    onDragStartCapture={(event) =>
                      startDrag(event, { type: "book", id: book.id })
                    }
                    type="button"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-violet-400/[0.06] blur-2xl" />
                    {isTargetSelected({ type: "book", id: book.id }) && (
                      <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border border-violet-100/45 bg-slate-950/75 px-2 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-violet-50 shadow-[0_0_18px_rgba(167,139,250,0.3)] backdrop-blur-md">
                        <CheckCircle2 className="h-3 w-3 text-violet-100" />
                        Selected
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div className="rounded-lg border border-violet-300/20 bg-violet-400/[0.07] p-2.5">
                        <FileText
                          className="h-5 w-5 text-violet-300"
                          strokeWidth={1.3}
                        />
                      </div>
                      <Sparkles className="h-4 w-4 text-violet-300/50 transition group-hover:text-violet-200" />
                    </div>
                    <div className="relative mt-6 line-clamp-1 text-sm font-semibold text-slate-200">
                      {book.title}
                    </div>
                    <div className="hud-label relative mt-2 text-[0.45rem] text-slate-600">
                      PDF // Reflection Ready
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <AccountSettingsDialog
        onClose={() => setAccountSettingsOpen(false)}
        onDeleteAccount={openAccountDeleteDialog}
        open={accountSettingsOpen}
      />
      <DeleteAccountDialog
        deleting={accountDeleting}
        error={accountDeleteError}
        onCancel={closeAccountDeleteDialog}
        onConfirm={deleteAccount}
        open={accountDeleteDialogOpen}
        success={accountDeleteSuccess}
      />
      <CreateFolderDialog
        onClose={() => setFolderDialogOpen(false)}
        onCreate={createFolder}
        open={folderDialogOpen}
      />
      <MoveDialog
        books={books}
        folders={folders}
        moving={moving}
        onClose={() => setMoveDialogOpen(false)}
        onMove={moveSelection}
        open={moveDialogOpen && hasSelection}
        targets={selections}
      />
      <RenameDialog
        currentName={getSelectedName()}
        onClose={() => setRenameDialogOpen(false)}
        onRename={renameSelection}
        open={renameDialogOpen && Boolean(selection)}
        renaming={renaming}
        target={selection}
      />
      <DeleteConfirmationDialog
        deleting={deleting}
        description={
          selectedCount > 1
            ? "This removes every selected realm/PDF, including nested realms, PDFs, and all linked memory fragments, bookmarks, notes, companion reflections, progress coordinates, and indexed pages."
            : selection?.type === "folder"
            ? "This removes the selected realm, every nested realm, each PDF inside it, and all linked memory fragments, bookmarks, notes, companion reflections, progress coordinates, and indexed pages."
            : "This removes the PDF from PocketBase storage and clears its linked memory fragments, bookmarks, notes, companion reflections, progress coordinates, and indexed pages."
        }
        name={
          selectedCount > 1
            ? `${selectedCount} selected objects`
            : selection?.type === "folder"
            ? folders.find((folder) => folder.id === selection.id)?.name ??
              "Selected realm"
            : books.find((book) => book.id === selection?.id)?.title ?? "Selected PDF"
        }
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => void deleteSelection()}
        open={deleteDialogOpen && hasSelection}
      />
    </main>
  );
}
