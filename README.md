# ASNEB : Unicorn

ASNEB : Unicorn is a private, cinematic physics research workstation: a nested PDF archive, continuous reader, persistent reading tracker, and selection-aware Gemini tutor built with Next.js and PocketBase.

## Stack

- Next.js 14 App Router, TypeScript, and Tailwind CSS
- PocketBase auth, collections, and PDF storage
- `react-pdf` with selectable text-layer rendering
- Gemini Flash streaming responses
- Framer Motion, Markdown rendering, and KaTeX equations

PocketBase is the canonical backend. The visual system merges the supplied scientific UI brief into the PocketBase architecture: deep-space surfaces, HUD-style typography, glass panels, quantum accents, subtle motion, responsive drawers, and a fullscreen mobile AI panel.

## Configure PocketBase

1. Download and start PocketBase:

   ```bash
   ./pocketbase serve
   ```

2. Apply the bundled migrations:

   ```bash
   ./pocketbase migrate up
   ```

3. Open the PocketBase Admin UI at `http://127.0.0.1:8090/_/`.
4. Review the collections and API rules in [`pocketbase/collections.md`](./pocketbase/collections.md).
5. Keep the `users` collection creation rule locked. Signup is intentionally routed through the Next.js API so `ALLOWED_USERS` cannot be bypassed from the browser.

## Configure the app

1. Copy `.env.example` to `.env.local`.
2. Set PocketBase superuser credentials, the private comma-separated email allowlist, and your Gemini key:

   ```env
   NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
   POCKETBASE_SUPERUSER_EMAIL=admin@example.com
   POCKETBASE_SUPERUSER_PASSWORD=replace-with-a-long-password
   ALLOWED_USERS=researcher@example.com
   GEMINI_API_KEY=replace-with-your-gemini-key
   GEMINI_MODEL=gemini-2.5-flash
   GEMINI_RETRY_ATTEMPTS=4
   TUTOR_MAX_OUTPUT_TOKENS=8192
   TUTOR_MAX_CONTINUATIONS=4
   TUTOR_EVIDENCE_CHAR_BUDGET=14000
   ```

3. Install dependencies and start Next.js:

   ```bash
   npm install
   npm run dev
   ```

4. Visit `http://localhost:3000/signup` for the first authorized account.

## Core behaviors

- Folder trees can nest indefinitely through the optional `parent` relation.
- The dashboard uploads PDFs directly into PocketBase `books` records with `FormData`.
- Book and folder deletion use `/api/library/delete`, verify the current user token,
  clear relation-constrained research records first, remove stored PDFs, and safely
  recurse through nested folders.
- The reader renders every PDF text layer, tracks the most visible page, restores the last saved location, and debounces progress writes.
- Selecting PDF text opens a floating analysis menu with explain, deconstruct,
  summarize, derivation, intuition, and problem-solving actions.
- `/api/explain` validates the active PocketBase auth token and streams typed SSE
  tutor events. Gemini is retried with exponential backoff before optional Groq,
  OpenRouter, or Ollama fallback providers are used.
- Tutor responses request an 8192-token output budget by default, shorten oversized
  evidence while preserving equation context, continue cut-off responses, repair
  unfinished Markdown boundaries, and archive only completed analyses.
- PDF highlights preserve normalized positional anchors, colors, and autosaved notes.
- The reader toolbar exposes document navigation, search, highlights, notes, bookmarks, AI history, progress, topology, and a combined notebook.
- PDF text is indexed in the background for current-book and global search.
- `/notebook` exposes global highlights, notes, analyses, filters, statistics, daily streaks, and quick actions.
