import type {
  ExplainResponse,
  PromptMode,
  TutorStreamEvent,
} from "@/lib/types";

const COMPLETE_MARKER = "<!-- ASNEB_COMPLETE -->";
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
const DEFAULT_EVIDENCE_CHAR_BUDGET = 14000;
const DEFAULT_MAX_CONTINUATIONS = 4;

const instructions: Record<PromptMode, string> = {
  explain:
    "Explain the selected evidence with precise, accessible definitions. State the physical intuition first, then clarify notation, assumptions, and context.",
  deconstruct:
    "Deconstruct the selected formula, proof, or scientific claim step by step. Define symbols, state assumptions, explain transformations, and connect the result to physical meaning.",
  summarize:
    "Summarize the selected evidence as compact, rigorous bullet points. Preserve formulas, conditions, and scientific distinctions. End with one clear takeaway.",
  derivation:
    "Develop the derivation carefully from the stated assumptions. Show each meaningful algebraic or conceptual step, define symbols, and identify any missing premises.",
  intuition:
    "Build a strong physical intuition for the selected evidence. Use a concrete mental model, state where the analogy stops being exact, and connect it back to the mathematics.",
  "problem-solving":
    "Turn the selected evidence into a problem-solving guide. Identify the givens, the target quantity, the governing principles, a reliable strategy, and common mistakes.",
};

type StreamCallback = (event: TutorStreamEvent) => void;

type ProviderResult = {
  finishReason: string;
  text: string;
};

type Provider = {
  generate: (
    prompt: string,
    onDelta: (text: string) => void,
    maxOutputTokens: number,
  ) => Promise<ProviderResult>;
  model: string;
  name: string;
  retryAttempts: number;
};

class ProviderRequestError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = "ProviderRequestError";
    this.retryable = retryable;
  }
}

export class TutorGenerationError extends Error {
  partial: string;

  constructor(message: string, partial = "") {
    super(message);
    this.name = "TutorGenerationError";
    this.partial = partial;
  }
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function toProviderError(name: string, error: unknown) {
  if (error instanceof ProviderRequestError) {
    return error;
  }
  return new ProviderRequestError(
    `${name} request failed: ${
      error instanceof Error ? error.message : "unknown network failure"
    }`,
    true,
  );
}

function stripCompletionMarker(text: string) {
  return text.replaceAll(COMPLETE_MARKER, "").trim();
}

function countOccurrences(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function hasUnfinishedMarkdown(text: string) {
  const withoutInlineCode = text.replace(/`[^`\n]*`/g, "");
  const fenceCount = countOccurrences(withoutInlineCode, /```/g);
  const displayMathCount = countOccurrences(text, /\$\$/g);
  const bracketMathStarts = countOccurrences(text, /\\\[/g);
  const bracketMathEnds = countOccurrences(text, /\\\]/g);
  return (
    fenceCount % 2 !== 0 ||
    displayMathCount % 2 !== 0 ||
    bracketMathStarts !== bracketMathEnds
  );
}

function hasTerminalSentence(text: string) {
  const cleaned = stripCompletionMarker(text)
    .replace(/```[\s\S]*?```$/g, "")
    .replace(/\$\$[\s\S]*?\$\$$/g, "")
    .trim();
  return /[.!?。！？:;)\]}`'"…]$/.test(cleaned);
}

function isIncomplete(text: string, finishReason: string) {
  const normalizedReason = finishReason.toUpperCase();
  return (
    !text.trim() ||
    normalizedReason.includes("MAX_TOKENS") ||
    normalizedReason.includes("LENGTH") ||
    hasUnfinishedMarkdown(text) ||
    (!text.includes(COMPLETE_MARKER) && !hasTerminalSentence(text))
  );
}

function extractImportantEquationLines(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => /(\$\$?|\\\[|\\\]|\\begin\{|\\frac|\\sum|\\int|=)/.test(line))
    .slice(0, 24)
    .join("\n");
}

function budgetEvidence(text: string) {
  const maxChars = getPositiveInteger(
    process.env.TUTOR_EVIDENCE_CHAR_BUDGET,
    DEFAULT_EVIDENCE_CHAR_BUDGET,
  );
  if (text.length <= maxChars) {
    return { evidence: text, truncated: false };
  }

  const equations = extractImportantEquationLines(text);
  const reserved = Math.min(Math.floor(maxChars * 0.34), equations.length);
  const remaining = maxChars - reserved - 180;
  const headLength = Math.floor(remaining * 0.62);
  const tailLength = remaining - headLength;
  const preservedEquations = equations.slice(0, reserved);

  return {
    evidence: `${text.slice(0, headLength)}

[... middle evidence shortened to preserve the tutor token budget ...]

${preservedEquations ? `Important mathematical context:\n${preservedEquations}\n\n` : ""}${text.slice(
      -tailLength,
    )}`,
    truncated: true,
  };
}

function buildPrompt(mode: PromptMode, text: string) {
  return `You are the ASNEB Unicorn physics research assistant: a rigorous, calm tutor for advanced scientific reading.

## Task
${instructions[mode]}

## Response protocol
- Return polished Markdown with descriptive section headers and clean paragraph spacing.
- Preserve mathematical notation. Put inline mathematics between single dollar delimiters and display equations between double dollar delimiters.
- Close every Markdown code fence and every display equation block.
- Never invent missing context; state uncertainty explicitly.
- Do not stop mid-sentence.
- End the fully completed answer with this exact marker on its own line:
${COMPLETE_MARKER}

## Selected evidence
${text}`;
}

function buildContinuationPrompt(mode: PromptMode, evidence: string, analysis: string) {
  return `You are continuing an ASNEB Unicorn physics tutor response that was cut off.

Continue the answer only. Do not repeat prior paragraphs. Preserve Markdown and LaTeX notation. Close any unfinished code fence or equation block. Finish the current sentence, complete the remaining reasoning for the ${mode} task, and end the finished answer with:
${COMPLETE_MARKER}

Selected evidence context:
${evidence.slice(-5000)}

Tail of the existing answer:
${analysis.slice(-7000)}`;
}

function buildFallbackPrompt(mode: PromptMode, evidence: string) {
  return `You are the ASNEB Unicorn physics research assistant. Prior attempts to produce a long response could not complete reliably.

Provide a concise but complete ${mode} analysis of the selected evidence. Use polished Markdown, preserve important equations, close every Markdown or LaTeX block, and do not stop mid-sentence. Prefer a shorter complete answer over a long unfinished answer. End with:
${COMPLETE_MARKER}

Selected evidence:
${evidence}`;
}

async function* readSse(response: Response) {
  if (!response.body) {
    throw new ProviderRequestError("Streaming response body was unavailable.", true);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";

    for (const event of events) {
      const payload = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (payload) {
        yield payload;
      }
    }

    if (done) {
      break;
    }
  }

  const payload = buffer
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (payload) {
    yield payload;
  }
}

function createGeminiProvider(): Provider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  return {
    name: "gemini",
    model,
    retryAttempts: getPositiveInteger(process.env.GEMINI_RETRY_ATTEMPTS, 4),
    async generate(prompt, onDelta, maxOutputTokens) {
      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            model,
          )}:streamGenerateContent?alt=sse`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.22,
                topP: 0.9,
                maxOutputTokens,
              },
            }),
          },
        );
      } catch (error) {
        throw toProviderError("gemini", error);
      }

      if (!response.ok) {
        throw new ProviderRequestError(
          `gemini returned HTTP ${response.status}.`,
          isRetryableStatus(response.status),
        );
      }

      let text = "";
      let finishReason = "";
      for await (const data of readSse(response)) {
        const payload = JSON.parse(data) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
            finishReason?: string;
          }>;
          error?: { message?: string };
        };
        if (payload.error) {
          throw new ProviderRequestError(
            `gemini stream failed: ${payload.error.message ?? "unknown error"}`,
            true,
          );
        }
        const candidate = payload.candidates?.[0];
        const delta =
          candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
        if (delta) {
          text += delta;
          onDelta(delta);
        }
        finishReason = candidate?.finishReason ?? finishReason;
      }

      if (!text.trim()) {
        throw new ProviderRequestError("gemini returned an empty analysis.", true);
      }
      return { text, finishReason };
    },
  };
}

function createOpenAiCompatibleProvider({
  apiKey,
  endpoint,
  model,
  name,
}: {
  apiKey: string;
  endpoint: string;
  model: string;
  name: string;
}): Provider {
  return {
    name,
    model,
    retryAttempts: 3,
    async generate(prompt, onDelta, maxOutputTokens) {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(name === "openrouter"
              ? {
                  "HTTP-Referer": "https://asneb.local",
                  "X-Title": "ASNEB Unicorn",
                }
              : {}),
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.22,
            max_tokens: maxOutputTokens,
            stream: true,
          }),
        });
      } catch (error) {
        throw toProviderError(name, error);
      }

      if (!response.ok) {
        throw new ProviderRequestError(
          `${name} returned HTTP ${response.status}.`,
          isRetryableStatus(response.status),
        );
      }

      let text = "";
      let finishReason = "";
      for await (const data of readSse(response)) {
        if (data === "[DONE]") {
          continue;
        }
        const payload = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: string };
            finish_reason?: string;
          }>;
        };
        const choice = payload.choices?.[0];
        const delta = choice?.delta?.content ?? "";
        if (delta) {
          text += delta;
          onDelta(delta);
        }
        finishReason = choice?.finish_reason ?? finishReason;
      }

      if (!text.trim()) {
        throw new ProviderRequestError(`${name} returned an empty analysis.`, true);
      }
      return { text, finishReason };
    },
  };
}

function createOllamaProvider(): Provider | null {
  const baseUrl = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL;
  if (!baseUrl || !model) {
    return null;
  }

  return {
    name: "ollama",
    model,
    retryAttempts: 2,
    async generate(prompt, onDelta, maxOutputTokens) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            options: { num_predict: maxOutputTokens, temperature: 0.22 },
            stream: true,
          }),
        });
      } catch (error) {
        throw toProviderError("ollama", error);
      }

      if (!response.ok || !response.body) {
        throw new ProviderRequestError(
          `ollama returned HTTP ${response.status}.`,
          isRetryableStatus(response.status),
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let finishReason = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const payload = JSON.parse(line) as {
            done?: boolean;
            done_reason?: string;
            message?: { content?: string };
          };
          const delta = payload.message?.content ?? "";
          if (delta) {
            text += delta;
            onDelta(delta);
          }
          finishReason = payload.done_reason ?? finishReason;
        }
        if (done) break;
      }

      if (!text.trim()) {
        throw new ProviderRequestError("ollama returned an empty analysis.", true);
      }
      return { text, finishReason };
    },
  };
}

function getProviders() {
  const providers: Provider[] = [];
  const gemini = createGeminiProvider();
  const ollama = createOllamaProvider();

  if (gemini) providers.push(gemini);
  if (process.env.GROQ_API_KEY) {
    providers.push(
      createOpenAiCompatibleProvider({
        name: "groq",
        apiKey: process.env.GROQ_API_KEY,
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      }),
    );
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push(
      createOpenAiCompatibleProvider({
        name: "openrouter",
        apiKey: process.env.OPENROUTER_API_KEY,
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        model: process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash",
      }),
    );
  }
  if (ollama) providers.push(ollama);

  return providers;
}

async function generateWithRetries(
  provider: Provider,
  prompt: string,
  committedText: string,
  onEvent: StreamCallback,
  maxOutputTokens: number,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= provider.retryAttempts; attempt += 1) {
    let attemptText = "";
    try {
      return await provider.generate(
        prompt,
        (delta) => {
          attemptText += delta;
          onEvent({ type: "delta", text: delta });
        },
        maxOutputTokens,
      );
    } catch (error) {
      lastError = error;
      onEvent({ type: "reset", text: committedText });
      const retryable =
        error instanceof ProviderRequestError ? error.retryable : true;
      if (!retryable || attempt === provider.retryAttempts) {
        break;
      }
      const delay = Math.min(5000, 550 * 2 ** (attempt - 1));
      onEvent({
        type: "status",
        phase: "retrying",
        message: `${provider.name} temporary failure. Retrying ${attempt + 1}/${
          provider.retryAttempts
        } in ${delay}ms.`,
      });
      await sleep(delay);
    }
  }

  throw toProviderError(provider.name, lastError);
}

async function generateFromAvailableProvider(
  providers: Provider[],
  prompt: string,
  committedText: string,
  onEvent: StreamCallback,
  maxOutputTokens: number,
) {
  const failures: string[] = [];
  for (const [index, provider] of providers.entries()) {
    if (index > 0) {
      onEvent({
        type: "status",
        phase: "retrying",
        message: `Switching tutor provider to ${provider.name}.`,
      });
    }
    try {
      const result = await generateWithRetries(
        provider,
        prompt,
        committedText,
        onEvent,
        maxOutputTokens,
      );
      return { provider, result };
    } catch (error) {
      failures.push(
        `${provider.name}: ${
          error instanceof Error ? error.message : "unknown provider failure"
        }`,
      );
    }
  }
  throw new ProviderRequestError(`All tutor providers failed. ${failures.join(" ")}`);
}

export async function generateTutorAnalysis(
  mode: PromptMode,
  text: string,
  onEvent: StreamCallback = () => undefined,
): Promise<ExplainResponse> {
  const providers = getProviders();
  if (!providers.length) {
    throw new TutorGenerationError("No AI provider credentials are configured.");
  }

  const { evidence, truncated } = budgetEvidence(text);
  const maxOutputTokens = getPositiveInteger(
    process.env.TUTOR_MAX_OUTPUT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
  );
  const maxContinuations = getPositiveInteger(
    process.env.TUTOR_MAX_CONTINUATIONS,
    DEFAULT_MAX_CONTINUATIONS,
  );

  onEvent({
    type: "status",
    phase: "generating",
    message: truncated
      ? "Evidence budget calibrated. Preserving equations and high-signal context."
      : "Generating tutor analysis.",
  });

  let generated;
  try {
    generated = await generateFromAvailableProvider(
      providers,
      buildPrompt(mode, evidence),
      "",
      onEvent,
      maxOutputTokens,
    );
  } catch (error) {
    throw new TutorGenerationError(
      error instanceof Error ? error.message : "The tutor subsystem did not respond.",
    );
  }

  let analysis = generated.result.text;
  let finishReason = generated.result.finishReason;
  let continuationCount = 0;

  while (
    isIncomplete(analysis, finishReason) &&
    continuationCount < maxContinuations
  ) {
    continuationCount += 1;
    onEvent({
      type: "status",
      phase: "continuing",
      message: `Response boundary detected. Continuing analysis ${continuationCount}/${maxContinuations}.`,
    });
    try {
      const continuation = await generateWithRetries(
        generated.provider,
        buildContinuationPrompt(mode, evidence, analysis),
        analysis,
        onEvent,
        maxOutputTokens,
      );
      analysis += continuation.text;
      finishReason = continuation.finishReason;
    } catch {
      break;
    }
  }

  if (isIncomplete(analysis, finishReason)) {
    onEvent({
      type: "status",
      phase: "fallback",
      message: "Long-form continuation could not complete. Producing a concise complete fallback.",
    });
    onEvent({ type: "reset", text: "" });
    try {
      const fallback = await generateFromAvailableProvider(
        providers,
        buildFallbackPrompt(mode, evidence),
        "",
        onEvent,
        Math.min(maxOutputTokens, 4096),
      );
      if (isIncomplete(fallback.result.text, fallback.result.finishReason)) {
        throw new Error("The condensed fallback also ended before completion.");
      }
      return {
        analysis: stripCompletionMarker(fallback.result.text),
        completed: true,
        continuationCount,
        evidenceTruncated: truncated,
        fallback: true,
        model: fallback.provider.model,
        provider: fallback.provider.name,
      };
    } catch (error) {
      throw new TutorGenerationError(
        `The tutor could not complete a reliable answer. ${
          error instanceof Error ? error.message : "Fallback generation failed."
        }`,
        stripCompletionMarker(analysis),
      );
    }
  }

  return {
    analysis: stripCompletionMarker(analysis),
    completed: true,
    continuationCount,
    evidenceTruncated: truncated,
    fallback: false,
    model: generated.provider.model,
    provider: generated.provider.name,
  };
}
