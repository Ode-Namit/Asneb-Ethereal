import { NextResponse } from "next/server";
import {
  createServerPocketBase,
  logPocketBaseError,
  runPocketBaseRequest,
} from "@/lib/pocketbase";

export const runtime = "nodejs";

function getMaxPublicUsers() {
  const parsed = Number(process.env.MAX_PUBLIC_USERS ?? "5");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 5;
}

export async function POST(request: Request) {
  let payload: { email?: string; password?: string };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "The security phrase must contain at least 8 characters." },
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

  try {
    const pb = createServerPocketBase();
    await runPocketBaseRequest("Authenticate signup superuser", () =>
      pb
        .collection("_superusers")
        .authWithPassword(adminEmail, adminPassword),
    );
    const maxUsers = getMaxPublicUsers();
    const users = await runPocketBaseRequest("Count public users", () =>
      pb.collection("users").getList(1, 1, { fields: "id" }),
    );
    if (users.totalItems >= maxUsers) {
      return NextResponse.json(
        { error: "Maximum account capacity reached." },
        { status: 403 },
      );
    }
    await runPocketBaseRequest("Create authorized user", () =>
      pb.collection("users").create({
        email,
        password,
        passwordConfirm: password,
        emailVisibility: false,
      }),
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    logPocketBaseError("Signup workflow", error);
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 500;

    return NextResponse.json(
      {
        error:
          status === 400
            ? "That account already exists or the credentials were rejected."
            : "The sanctuary could not create the account.",
      },
      { status },
    );
  }
}
