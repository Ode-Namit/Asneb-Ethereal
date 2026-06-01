/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const userScopedRules = {
    "createRule": "@request.auth.id != \"\" && @request.body.user = @request.auth.id",
    "deleteRule": "user = @request.auth.id",
    "listRule": "user = @request.auth.id",
    "updateRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id"
  }

  const folders = app.findCollectionByNameOrId("folders")
  unmarshal(userScopedRules, folders)
  folders.fields.getByName("name").required = true
  folders.fields.getByName("name").max = 120
  folders.fields.getByName("user").required = true
  app.save(folders)

  const books = app.findCollectionByNameOrId("books")
  unmarshal(userScopedRules, books)
  books.fields.getByName("title").required = true
  books.fields.getByName("title").max = 180
  books.fields.getByName("file").required = true
  books.fields.getByName("file").mimeTypes = ["application/pdf"]
  books.fields.getByName("user").required = true
  app.save(books)

  const readingProgress = app.findCollectionByNameOrId("reading_progress")
  unmarshal(userScopedRules, readingProgress)
  readingProgress.fields.getByName("book").required = true
  readingProgress.fields.getByName("user").required = true
  readingProgress.fields.getByName("last_page").required = true
  readingProgress.fields.getByName("last_page").onlyInt = true
  readingProgress.fields.getByName("last_page").min = 1
  app.save(readingProgress)
}, (app) => {
  const lockedRules = {
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }

  const folders = app.findCollectionByNameOrId("folders")
  unmarshal(lockedRules, folders)
  folders.fields.getByName("name").required = false
  folders.fields.getByName("name").max = 0
  folders.fields.getByName("user").required = false
  app.save(folders)

  const books = app.findCollectionByNameOrId("books")
  unmarshal(lockedRules, books)
  books.fields.getByName("title").max = 0
  books.fields.getByName("file").required = false
  books.fields.getByName("file").mimeTypes = []
  books.fields.getByName("user").required = false
  app.save(books)

  const readingProgress = app.findCollectionByNameOrId("reading_progress")
  unmarshal(lockedRules, readingProgress)
  readingProgress.fields.getByName("book").required = false
  readingProgress.fields.getByName("user").required = false
  readingProgress.fields.getByName("last_page").required = false
  readingProgress.fields.getByName("last_page").onlyInt = false
  app.save(readingProgress)
})
