/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const rules = {
    "createRule": "@request.auth.id != \"\" && @request.body.user = @request.auth.id",
    "deleteRule": "user = @request.auth.id",
    "listRule": "user = @request.auth.id",
    "updateRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id"
  }

  const id = () => ({
    "autogeneratePattern": "[a-z0-9]{15}",
    "hidden": false,
    "max": 15,
    "min": 15,
    "name": "id",
    "pattern": "^[a-z0-9]+$",
    "primaryKey": true,
    "required": true,
    "system": true,
    "type": "text"
  })
  const text = (name, required = false) => ({
    "hidden": false,
    "max": 0,
    "min": 0,
    "name": name,
    "required": required,
    "system": false,
    "type": "text"
  })
  const number = (name, required = true) => ({
    "hidden": false,
    "min": 1,
    "name": name,
    "onlyInt": true,
    "required": required,
    "system": false,
    "type": "number"
  })
  const relation = (name, collectionId, required = true) => ({
    "cascadeDelete": false,
    "collectionId": collectionId,
    "hidden": false,
    "maxSelect": 1,
    "minSelect": required ? 1 : 0,
    "name": name,
    "required": required,
    "system": false,
    "type": "relation"
  })
  const created = () => ({
    "hidden": false,
    "name": "created",
    "onCreate": true,
    "onUpdate": false,
    "system": false,
    "type": "autodate"
  })
  const updated = () => ({
    "hidden": false,
    "name": "updated",
    "onCreate": true,
    "onUpdate": true,
    "system": false,
    "type": "autodate"
  })
  const users = "_pb_users_auth_"
  const books = app.findCollectionByNameOrId("books").id

  const highlights = new Collection({
    ...rules,
    "name": "highlights",
    "type": "base",
    "fields": [
      id(),
      relation("user", users),
      relation("book", books),
      number("page"),
      text("selected_text", true),
      text("anchor_json", true),
      text("color", true),
      text("note"),
      created(),
      updated()
    ],
    "indexes": [
      "CREATE INDEX idx_highlights_user_book_page ON highlights (user, book, page)"
    ]
  })
  app.save(highlights)

  const bookmarks = new Collection({
    ...rules,
    "name": "bookmarks",
    "type": "base",
    "fields": [
      id(),
      relation("user", users),
      relation("book", books),
      number("page"),
      text("label"),
      created(),
      updated()
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_bookmarks_user_book_page ON bookmarks (user, book, page)"
    ]
  })
  app.save(bookmarks)

  const notes = new Collection({
    ...rules,
    "name": "notes",
    "type": "base",
    "fields": [
      id(),
      relation("user", users),
      relation("book", books),
      number("page"),
      text("kind", true),
      text("content", true),
      text("anchor_json"),
      created(),
      updated()
    ],
    "indexes": [
      "CREATE INDEX idx_notes_user_book_page ON notes (user, book, page)"
    ]
  })
  app.save(notes)

  const analyses = new Collection({
    ...rules,
    "name": "ai_analyses",
    "type": "base",
    "fields": [
      id(),
      relation("user", users),
      relation("book", books),
      number("page"),
      text("mode", true),
      text("selected_text", true),
      text("response", true),
      text("provider", true),
      created(),
      updated()
    ],
    "indexes": [
      "CREATE INDEX idx_ai_analyses_user_book_created ON ai_analyses (user, book, created)"
    ]
  })
  app.save(analyses)

  const pages = new Collection({
    ...rules,
    "name": "document_pages",
    "type": "base",
    "fields": [
      id(),
      relation("user", users),
      relation("book", books),
      number("page"),
      text("content", true),
      created(),
      updated()
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_document_pages_user_book_page ON document_pages (user, book, page)"
    ]
  })
  app.save(pages)
}, (app) => {
  for (const name of [
    "document_pages",
    "ai_analyses",
    "notes",
    "bookmarks",
    "highlights"
  ]) {
    app.delete(app.findCollectionByNameOrId(name))
  }
})
