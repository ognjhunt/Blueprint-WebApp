# Firestore rules, schemas, and indexing

## Collections

### `contactRequests`
- **Fields:** `name`, `email`, `company`, `city`, `state`, `message`, `companyWebsite`, `token`, `offWaitlistUrl`, `createdAt (server timestamp)`.
- **Purpose:** Captures the full payload from the public contact form, including the generated waitlist token and off-waitlist URL for follow-up.

### `waitlistTokens`
- **Fields (create):** `token`, `email`, `company`, `status`, `createdAt (server timestamp)`.
- **Additional fields (update):** `usedAt`, `usedBy` (when redeemed).
- **Purpose:** Tracks the lifecycle of outbound waitlist invitations.

## Security rules
Deploy `firestore.rules` to your Firebase project to enable the new collection and keep unauthenticated writes scoped to validated payloads:

```bash
firebase deploy --only firestore:rules
```

Key behaviors:
- `contactRequests`: unauthenticated users can **create** records with the validated payload; reads are restricted to authenticated users; updates/deletes are blocked.
- `waitlistTokens`: unauthenticated users can **create** tokens (for the contact form) and **read** tokens (for off-waitlist validation); updates/deletes require authentication.
- `users`: authenticated users can create/read/update their own documents.

See [`firestore.rules`](../firestore.rules) for the full rule set.

## Indexing
- If you plan to review contact requests by time or email, add a composite index on `contactRequests` with `email ASC, createdAt DESC`.
- The existing `waitlistTokens` queries filter on `token` and `status` with equality clauses only, so no composite index is required. Add one if you later sort or filter by timestamp.

Create indexes in the Firebase console (Firestore Database → Indexes) or via `firebase firestore:indexes` if you keep index configs alongside rules.
