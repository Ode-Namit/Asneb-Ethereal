/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1788416371")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX idx_reading_progress_book_user\nON reading_progress (book, user)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1788416371")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
