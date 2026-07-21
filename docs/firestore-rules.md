# Firestore rules, schemas, and indexing

## Collections

### `contactRequests`
- **Fields:** `name`, `email`, `company`, `city`, `state`, `message`, `companyWebsite`, `requestSource`, `ops_automation`, `createdAt (server timestamp)`.
- **Purpose:** Captures the durable website contact request without minting a signup token or creating a site record.

## Security rules
Deploy `firestore.rules` to your Firebase project to enable the new collection and keep unauthenticated writes scoped to validated payloads:

```bash
firebase deploy --only firestore:rules
```

Key behaviors:
- `contactRequests`: unauthenticated users can **create** records with the validated payload; reads are restricted to authenticated users; updates/deletes are blocked.
- `users`: authenticated users can create/read/update their own documents.

See [`firestore.rules`](../firestore.rules) for the full rule set.

## Indexing
- If you plan to review contact requests by time or email, add a composite index on `contactRequests` with `email ASC, createdAt DESC`.

Create indexes in the Firebase console (Firestore Database → Indexes) or via `firebase firestore:indexes` if you keep index configs alongside rules.
