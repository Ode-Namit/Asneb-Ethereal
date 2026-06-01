import PocketBase, { type RecordModel } from "pocketbase";
import { getPocketBaseUrl } from "@/lib/pocketbase";
import type { BookRecord, FolderRecord } from "@/lib/types";

export const runtime = "edge";

type LibraryObjectType = "book" | "folder";

type DeleteSummary = {
  ai_analyses: number;
  bookmarks: number;
  books: number;
  document_pages: number;
  folders: number;
  highlights: number;
  notes: number;
  reading_progress: number;
};

const relatedBookCollections = [
  "highlights",
  "bookmarks",
  "notes",
  "ai_analyses",
  "reading_progress",
  "document_pages",
] as const;

function emptySummary(): DeleteSummary {
  return {
    ai_analyses: 0,
    bookmarks: 0,
    books: 0,
    document_pages: 0,
    folders: 0,
    highlights: 0,
    notes: 0,
    reading_progress: 0,
  };
}

function extractToken(header: string) {
  return header.replace(/^Bearer\s+/i, "").trim();
}

async function deleteRows(
  pb: PocketBase,
  collection: (typeof relatedBookCollections)[number],
  bookId: string,
  userId: string,
  summary: DeleteSummary,
) {
  const rows = await pb.collection(collection).getFullList<RecordModel>({
    filter: pb.filter("book = {:bookId} && user = {:userId}", { bookId, userId }),
  });

  for (const row of rows) {
    await pb.collection(collection).delete(row.id);
    summary[collection] += 1;
  }
}

async function deleteBook(
  pb: PocketBase,
  bookId: string,
  userId: string,
  summary: DeleteSummary,
) {
  await pb.collection("books").getOne<BookRecord>(bookId);
  for (const collection of relatedBookCollections) {
    await deleteRows(pb, collection, bookId, userId, summary);
  }

  // PocketBase removes the stored PDF when its owning book record is deleted.
  await pb.collection("books").delete(bookId);
  summary.books += 1;
}

function collectFolderIds(rootId: string, folders: FolderRecord[]) {
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

function folderDepth(folder: FolderRecord, folders: FolderRecord[]) {
  let depth = 0;
  let cursor = folder;
  const visited = new Set<string>();
  while (cursor.parent && !visited.has(cursor.parent)) {
    visited.add(cursor.parent);
    const parent = folders.find((item) => item.id === cursor.parent);
    if (!parent) break;
    depth += 1;
    cursor = parent;
  }
  return depth;
}

async function deleteFolder(
  pb: PocketBase,
  folderId: string,
  userId: string,
  summary: DeleteSummary,
) {
  await pb.collection("folders").getOne<FolderRecord>(folderId);
  const userFilter = pb.filter("user = {:userId}", { userId });
  const [folders, books] = await Promise.all([
    pb.collection("folders").getFullList<FolderRecord>({ filter: userFilter }),
    pb.collection("books").getFullList<BookRecord>({ filter: userFilter }),
  ]);
  const folderIds = collectFolderIds(folderId, folders);

  for (const book of books.filter((item) => item.folder && folderIds.has(item.folder))) {
    await deleteBook(pb, book.id, userId, summary);
  }

  const nestedFolders = folders
    .filter((folder) => folderIds.has(folder.id))
    .sort((left, right) => folderDepth(right, folders) - folderDepth(left, folders));
  for (const folder of nestedFolders) {
    await pb.collection("folders").delete(folder.id);
    summary.folders += 1;
  }
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { id?: string; type?: LibraryObjectType };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.id || (body.type !== "book" && body.type !== "folder")) {
    return Response.json({ error: "Select a valid research object." }, { status: 400 });
  }

  const pb = new PocketBase(getPocketBaseUrl());
  pb.autoCancellation(false);
  pb.authStore.save(extractToken(authorization));

  try {
    const auth = await pb.collection("users").authRefresh();
    const userId = auth.record.id;
    const summary = emptySummary();

    if (body.type === "book") {
      await deleteBook(pb, body.id, userId, summary);
    } else {
      await deleteFolder(pb, body.id, userId, summary);
    }

    console.info("[PocketBase] Authenticated recursive delete completed", {
      objectId: body.id,
      objectType: body.type,
      summary,
      userId,
    });
    return Response.json({ summary });
  } catch (error) {
    console.error("[PocketBase] Authenticated recursive delete failed", {
      error,
      objectId: body.id,
      objectType: body.type,
    });
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The selected research object could not be removed.",
      },
      { status: 502 },
    );
  }
}
