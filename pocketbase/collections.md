# PocketBase Collection Configuration

ASNEB uses PocketBase as the canonical local-first backend for authentication,
metadata, PDF files, reading progress, notes, highlights, and AI reflection
history.

Apply the bundled migrations first:

```bash
./pocketbase migrate up
```

## `users`

Use the built-in auth collection.

Recommended rules:

| Rule | Expression |
| --- | --- |
| List | `id = @request.auth.id` |
| View | `id = @request.auth.id` |
| Create | Locked |
| Update | `id = @request.auth.id` |
| Delete | `id = @request.auth.id` |

Public account creation goes through `/api/auth/signup`, where the Next.js
server authenticates as a PocketBase superuser, counts existing users, and
enforces `MAX_PUBLIC_USERS`.

The `1780332000_enable_public_auth_otp.js` migration enables email OTP for the
auth collection:

| Setting | Value |
| --- | --- |
| Enabled | `true` |
| Length | `6` |
| Duration | `300` seconds |

Configure SMTP in PocketBase settings before using OTP or password recovery.
For password resets, point the reset email template action URL at:

```txt
http://localhost:3000/reset-password?token={TOKEN}
```

Use your deployed app URL in production.

## `folders`

The UI calls these records realms.

| Field | Type | Configuration |
| --- | --- | --- |
| `name` | Text | Required, min 1, max 120 |
| `parent` | Relation | Single relation to `folders`, optional |
| `user` | Relation | Single relation to `users`, required |

Rules:

```txt
list/view/update/delete: user = @request.auth.id
create: @request.auth.id != "" && @request.body.user = @request.auth.id
```

Moves update only the optional `parent` relation. Rename updates only `name`.

## `books`

The UI calls these records PDFs or reading vessels.

| Field | Type | Configuration |
| --- | --- | --- |
| `title` | Text | Required, min 1, max 180 |
| `file` | File | Required, max files 1, MIME type `application/pdf` |
| `folder` | Relation | Single relation to `folders`, optional |
| `user` | Relation | Single relation to `users`, required |

Rules:

```txt
list/view/update/delete: user = @request.auth.id
create: @request.auth.id != "" && @request.body.user = @request.auth.id
```

Moves update only the optional `folder` relation. Rename updates only `title`,
so PocketBase file references remain intact.

## `reading_progress`

| Field | Type | Configuration |
| --- | --- | --- |
| `book` | Relation | Single relation to `books`, required |
| `user` | Relation | Single relation to `users`, required |
| `last_page` | Number | Required integer, min 1 |

Unique index:

```sql
CREATE UNIQUE INDEX idx_reading_progress_book_user
ON reading_progress (book, user)
```

Rules:

```txt
list/view/update/delete: user = @request.auth.id
create: @request.auth.id != "" && @request.body.user = @request.auth.id
```

## Research Memory Collections

The persistent memory layer is user-scoped. Each collection uses:

```txt
list/view/update/delete: user = @request.auth.id
create: @request.auth.id != "" && @request.body.user = @request.auth.id
```

### `highlights`

The UI calls these memory fragments.

| Field | Type | Configuration |
| --- | --- | --- |
| `user` | Relation | Single relation to `users`, required |
| `book` | Relation | Single relation to `books`, required |
| `page` | Number | Required integer, min 1 |
| `selected_text` | Text | Required |
| `anchor_json` | Text | Required normalized PDF position |
| `color` | Text | Required |
| `note` | Text | Optional annotation |

### `bookmarks`

Stores one persistent page bookmark per user, book, and page.

### `notes`

Stores inline, sticky, citation, and formula notes with optional PDF anchors.

### `ai_analyses`

Stores companion mode, selected passage, Markdown response, and provider.

### `document_pages`

Stores background-indexed PDF page text for current-document and global search.

## Recursive Deletion

The dashboard sends authenticated removals through `/api/library/delete`.
The route deletes book-linked `highlights`, `bookmarks`, `notes`, `ai_analyses`,
`reading_progress`, and `document_pages` records before deleting a book. Realm
deletion walks nested folders from the leaves upward and removes contained books
through the same cleanup path. PocketBase removes the PDF storage object when
its owning `books` record is deleted.
