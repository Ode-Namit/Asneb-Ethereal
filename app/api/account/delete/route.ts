import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";
import { NextResponse } from "next/server";
import {
  createServerPocketBase,
  logPocketBaseError,
  runPocketBaseRequest,
} from "@/lib/pocketbase";
import type { FolderRecord } from "@/lib/types";

export const runtime = "nodejs";

const accountCollections = [
  "highlights",
  "bookmarks",
  "notes",
  "ai_analyses",
  "document_pages",
  "reading_progress",
  "books",
  "folders",
] as const;

type AccountCollection = (typeof accountCollections)[number];
type DeleteSummary = Record<AccountCollection | "users", number>;

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
    users: 0,
  };
}

function extractToken(header: string) {
  return header.replace(/^Bearer\s+/i, "").trim();
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

async function deleteUserRows(
  pb: PocketBase,
  collection: Exclude<AccountCollection, "folders">,
  userId: string,
  summary: DeleteSummary,
) {
  const rows = await pb.collection(collection).getFullList<RecordModel>({
    fields: "id",
    filter: pb.filter("user = {:userId}", { userId }),
  });

  for (const row of rows) {
    await pb.collection(collection).delete(row.id);
    summary[collection] += 1;
  }
}

async function deleteUserFolders(
  pb: PocketBase,
  userId: string,
  summary: DeleteSummary,
) {
  const folders = await pb.collection("folders").getFullList<FolderRecord>({
    filter: pb.filter("user = {:userId}", { userId }),
  });

  for (const folder of folders.sort(
    (left, right) => folderDepth(right, folders) - folderDepth(left, folders),
  )) {
    await pb.collection("folders").delete(folder.id);
    summary.folders += 1;
  }
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let payload: { confirmation?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (payload.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Type DELETE to confirm account deletion." },
      { status: 400 },
    );
  }

  const adminEmail = process.env.POCKETBASE_SUPERUSER_EMAIL;
  const adminPassword = process.env.POCKETBASE_SUPERUSER_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { error: "PocketBase superuser credentials are not configured." },
      { status: 500 },
    );
  }

  const userPb = createServerPocketBase();
  userPb.authStore.save(extractToken(authorization));

  try {
    const auth = await runPocketBaseRequest("Validate account deletion user", () =>
      userPb.collection("users").authRefresh(),
    );
    const userId = auth.record.id;
    const adminPb = createServerPocketBase();

    await runPocketBaseRequest("Authenticate account deletion superuser", () =>
      adminPb
        .collection("_superusers")
        .authWithPassword(adminEmail, adminPassword),
    );

    const summary = emptySummary();
    for (const collection of accountCollections) {
      if (collection === "folders") {
        await deleteUserFolders(adminPb, userId, summary);
      } else {
        await deleteUserRows(adminPb, collection, userId, summary);
      }
    }

    await adminPb.collection("users").delete(userId);
    summary.users = 1;

    console.info("[PocketBase] Account deletion completed", {
      summary,
      userId,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    logPocketBaseError("Delete account workflow", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The account could not be deleted.",
      },
      { status: 502 },
    );
  }
}
