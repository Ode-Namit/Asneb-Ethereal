# ASNEB : Ethereal Reading OS

ASNEB is an ethereal, local-first reading sanctuary for PDFs, memory fragments,
notes, reading progress, and streaming AI companion reflections. It keeps the
PocketBase-backed architecture intact while softening the experience into a
floating library for deep reading.

## Stack

- Next.js 14 App Router, TypeScript, and Tailwind CSS
- PocketBase auth, collections, PDF storage, and local-first persistence
- `react-pdf` selectable text-layer rendering
- Streaming AI companion responses through Gemini, optional fallbacks, and SSE
- Three.js, React Three Fiber, Framer Motion, Markdown rendering, and KaTeX equations

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start PocketBase:

   ```bash
   ./pocketbase serve
   ```

3. Apply migrations:

   ```bash
   ./pocketbase migrate up
   ```

4. Copy `.env.example` to `.env.local` and fill in the values below.

5. Start Next.js:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000/signup`.

On Windows PowerShell, use `npm.cmd run dev` if script execution policy blocks
`npm`.

## Environment

```env
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_SUPERUSER_EMAIL=admin@example.com
POCKETBASE_SUPERUSER_PASSWORD=replace-with-a-long-password
MAX_PUBLIC_USERS=5

# Single-key mode
GEMINI_API_KEY=replace-with-your-gemini-key

# Rotation mode. If present, this takes priority over GEMINI_API_KEY.
GEMINI_API_KEYS=key1,key2,key3

GEMINI_MODEL=gemini-2.5-flash
GEMINI_RETRY_ATTEMPTS=4
TUTOR_MAX_OUTPUT_TOKENS=8192
TUTOR_MAX_CONTINUATIONS=4
TUTOR_EVIDENCE_CHAR_BUDGET=14000

# Optional fallback providers
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-2.5-flash
OLLAMA_BASE_URL=
OLLAMA_MODEL=
```

## PocketBase Auth

- Public signup is enabled through `/api/auth/signup`; browser-side public user
  creation should remain locked in PocketBase.
- `MAX_PUBLIC_USERS` caps total accounts. The default is `5`; once reached,
  signup returns `Maximum account capacity reached.`
- Persistent sessions use the PocketBase auth store and are refreshed on app
  entry.
- Logout clears the local PocketBase auth store.

## Email, OTP, And Recovery

PocketBase SMTP must be configured for email OTP and password recovery.

- The bundled migration enables `users` OTP with 6-digit codes and a 5-minute
  expiration.
- The login screen supports password auth and email OTP auth.
- The OTP UI includes resend protection and an expiration timer.
- `/forgot-password` requests PocketBase email password recovery.
- `/reset-password?token=...` confirms the PocketBase reset token.

For deployed environments, configure the PocketBase password reset email
template so its action URL points at your app's reset route:

```txt
https://your-app.example.com/reset-password?token={TOKEN}
```

For local development:

```txt
http://localhost:3000/reset-password?token={TOKEN}
```

## AI Companion

`/api/explain` validates the active PocketBase token and streams typed SSE
events back to the reader. The reader sends selected passage text plus contextual
signals: current PDF title, current page, nearest outline section, surrounding
indexed page text, nearby memory fragments, notes, and recent companion history.

Supported modes include explain, learning, deconstruct, summarize, insights,
derivation, intuition, theorem, formula, advanced analysis, reflection, and
problem solving.

Gemini supports both:

- `GEMINI_API_KEY=single_key`
- `GEMINI_API_KEYS=key1,key2,key3`

When `GEMINI_API_KEYS` exists, ASNEB rotates keys server-side, tracks cooldowns,
balances in-flight requests, and fails over on quota or temporary Gemini errors.
Keys are never exposed to the frontend. Streaming responses are preserved.

## Cinematic 3D Experience

ASNEB renders a lazy-loaded React Three Fiber celestial scene inside the shared
ambient background. It adds drifting particles, aurora planes, volumetric light
shafts, atmospheric fog, pointer/scroll-reactive camera motion, and floating
dream-architecture rings without changing PocketBase data flow.

The UI layer uses shared spatial classes for floating glass panels, depth-aware
hover states, cinematic reveals, immersive reader focus mode, luminous companion
responses, and framed PDF page surfaces. The 3D scene is client-only, capped to a
moderate device pixel ratio, avoids antialiasing overhead, and disables itself
when `prefers-reduced-motion: reduce` is active.

## Library Behavior

- Realms map to the existing `folders` collection.
- PDFs map to the existing `books` collection and keep PocketBase file storage
  references unchanged.
- Uploads, highlights, notes, bookmarks, AI reflections, indexed pages, and
  reading progress remain user-scoped.
- Rename updates only `folders.name` or `books.title`.
- Move updates only `folders.parent` or `books.folder`.
- Folder moves prevent cyclic nesting and duplicate names at the destination.
- Book moves prevent duplicate titles inside the destination realm.
- Delete still routes through `/api/library/delete` and clears related records
  before removing books/folders.

## Compatibility

ASNEB remains compatible with:

- Local PocketBase deployments
- Vercel-hosted Next.js deployments
- Cloudflare Tunnel in front of either PocketBase or Next.js
- Local-first usage as long as PocketBase is reachable from the browser
