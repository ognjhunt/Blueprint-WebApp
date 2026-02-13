# Marketplace Semantic Search

This repo supports a hybrid semantic search for the Marketplace UI:

- **Now (no DB):** in-memory search over placeholder items from `client/src/data/content.ts`
- **Later (Firestore):** vector search over `marketplace_items` using Firestore vector queries

## Endpoint

- `POST /api/marketplace/search`
  - Public (no Firebase auth required)
  - CSRF-protected (call `GET /api/csrf` first, then send `X-CSRF-Token`)

## Firestore Vector Backend (optional)

When the server has Firebase Admin credentials and the Firestore SDK supports vector search (`findNearest`), the search endpoint will prefer Firestore.

### Collection

`marketplace_items/{slug}`

Required fields:

- `type`: `"scene" | "training"`
- `item`: full marketplace item object (scene or training dataset)
- `searchDoc`: canonical text used for embedding + lexical re-ranking
- `searchDocHash`: SHA-256 hash of `searchDoc`
- `embedding`: `number[]`
- `embeddingModel`: string (ex: `text-embedding-3-small`)
- `updatedAt`: server timestamp

### Indexing script

This repo includes a one-time script that writes `marketplace_items` docs and embeddings:

```bash
OPENAI_API_KEY=...
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... }'
tsx scripts/index-marketplace-items.ts
```

### Firestore index

In the Firebase console (Firestore Database -> Indexes), create a **vector index** on:

- Collection: `marketplace_items`
- Field: `embedding`
- Distance: `COSINE`
- Dimensions: must match your embedding model

## Environment variables

Server-side:

- `OPENAI_API_KEY` (enables semantic embeddings; otherwise the backend falls back to lexical scoring)
- `OPENAI_EMBEDDING_MODEL` (optional; defaults to `text-embedding-3-small`)
- `FIREBASE_SERVICE_ACCOUNT_JSON` (optional; enables Firestore Admin + vector search backend)

