# PocketBase Collection Configuration

Create these collections in the PocketBase Admin UI before starting the Next.js app. The application uses PocketBase as the single backend for authentication, metadata, file storage, and reading progress.

## 1. `users`

Use the built-in auth collection. Keep the standard auth fields and disable public creation by setting the **Create rule** to locked (`null`). Registration goes through `/api/auth/signup`, where `ALLOWED_USERS` is validated before the server creates the user with PocketBase superuser credentials.

Recommended rules:

| Rule | Expression |
| --- | --- |
| List | `id = @request.auth.id` |
| View | `id = @request.auth.id` |
| Create | Locked |
| Update | `id = @request.auth.id` |
| Delete | `id = @request.auth.id` |

## 2. `folders`

Create a base collection with these fields:

| Field | Type | Configuration |
| --- | --- | --- |
| `name` | Text | Required, min 1, max 120 |
| `parent` | Relation | Single relation to `folders`, optional |
| `user` | Relation | Single relation to `users`, required |

API rules for list, view, update, and delete:

```txt
user = @request.auth.id
```

Create rule:

```txt
@request.auth.id != "" && @request.body.user = @request.auth.id
```

## Research Workstation Collections

Apply the bundled migrations to create the persistent research layer:

```bash
./pocketbase migrate up
```

The migration creates five user-scoped collections. Their list, view, update,
and delete rules are:

```txt
user = @request.auth.id
```

Their create rule is:

```txt
@request.auth.id != "" && @request.body.user = @request.auth.id
```

### `highlights`

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

Stores tutor mode, selected evidence, Markdown response, and provider.

### `document_pages`

Stores background-indexed PDF page text for instant current-document and global
research search.

### Recursive deletion

The dashboard sends authenticated removals through `/api/library/delete`.
The route deletes book-linked `highlights`, `bookmarks`, `notes`, `ai_analyses`,
`reading_progress`, and `document_pages` records before deleting a book. Folder
deletion walks nested folders from the leaves upward and removes contained books
through the same cleanup path. PocketBase removes the PDF storage object when its
owning `books` record is deleted.

## 3. `books`

Create a base collection with these fields:

| Field | Type | Configuration |
| --- | --- | --- |
| `title` | Text | Required, min 1, max 180 |
| `file` | File | Required, max files 1, max size as appropriate, MIME type `application/pdf` |
| `folder` | Relation | Single relation to `folders`, optional |
| `user` | Relation | Single relation to `users`, required |

API rules for list, view, update, and delete:

```txt
user = @request.auth.id
```

Create rule:

```txt
@request.auth.id != "" && @request.body.user = @request.auth.id
```

## 4. `reading_progress`

Create a base collection with these fields:

| Field | Type | Configuration |
| --- | --- | --- |
| `book` | Relation | Single relation to `books`, required |
| `user` | Relation | Single relation to `users`, required |
| `last_page` | Number | Required, integer only, min 1 |

Add a unique index to prevent duplicate progress records:

```sql
CREATE UNIQUE INDEX idx_reading_progress_book_user
ON reading_progress (book, user)
```

API rules for list, view, update, and delete:

```txt
user = @request.auth.id
```

Create rule:

```txt
@request.auth.id != "" && @request.body.user = @request.auth.id
```
