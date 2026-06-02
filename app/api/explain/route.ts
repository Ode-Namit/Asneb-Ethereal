import {
  generateTutorAnalysis,
  TutorGenerationError,
} from "@/lib/ai/providers";
import { getPocketBaseUrl } from "@/lib/pocketbase";
import type { PromptMode, TutorRequestContext, TutorStreamEvent } from "@/lib/types";

export const runtime = "edge";

const promptModes = new Set<PromptMode>([
  "explain",
  "deconstruct",
  "summarize",
  "derivation",
  "intuition",
  "problem-solving",
  "learning",
  "advanced",
  "theorem",
  "insights",
  "formula",
  "reflection",
]);

async function verifyPocketBaseToken(token: string) {
  const authResponse = await fetch(
    `${getPocketBaseUrl()}/api/collections/users/auth-refresh`,
    {
      method: "POST",
      headers: { Authorization: token },
    },
  );

  if (!authResponse.ok) {
    console.error("[PocketBase] Companion auth refresh failed", {
      path: "/api/collections/users/auth-refresh",
      status: authResponse.status,
    });
    return false;
  }

  return true;
}

function streamTutorAnalysis(
  mode: PromptMode,
  text: string,
  context?: TutorRequestContext,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: TutorStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const result = await generateTutorAnalysis(mode, text, context, send);
        send({ type: "complete", ...result });
      } catch (error) {
        console.error("[ASNEB] Companion streaming providers exhausted", error);
        send({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "The companion did not respond.",
          ...(error instanceof TutorGenerationError && error.partial
            ? { partial: error.partial }
            : {}),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.trim();
  if (!token) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!(await verifyPocketBaseToken(token))) {
    return Response.json({ error: "Session expired." }, { status: 401 });
  }

  let body: { context?: TutorRequestContext; text?: string; mode?: PromptMode };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  const mode = body.mode;
  if (!text || text.length > 50000 || !mode || !promptModes.has(mode)) {
    return Response.json(
      { error: "Select between 1 and 50000 characters and a valid companion mode." },
      { status: 400 },
    );
  }

  if (request.headers.get("accept")?.includes("text/event-stream")) {
    return streamTutorAnalysis(mode, text, body.context);
  }

  try {
    const result = await generateTutorAnalysis(mode, text, body.context);
    if (process.env.NODE_ENV !== "production") {
      console.debug("[ASNEB] Companion API completed", {
        continuationCount: result.continuationCount,
        fallback: result.fallback,
        model: result.model,
        provider: result.provider,
      });
    }
    return Response.json(result);
  } catch (error) {
    console.error("[ASNEB] Companion providers exhausted", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The companion did not respond.",
        ...(error instanceof TutorGenerationError && error.partial
          ? { partial: error.partial }
          : {}),
      },
      { status: 502 },
    );
  }
}
