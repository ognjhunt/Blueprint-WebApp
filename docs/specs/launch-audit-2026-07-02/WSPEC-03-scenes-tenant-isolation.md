# WSPEC-03: Tenant isolation on the `scenes` Firestore collection

- Status: Proposed
- Priority: **P1 — major** (cross-tenant data exposure/tampering)
- Area: `firestore.rules`, `server/routes/contact.ts`

## Problem

`firestore.rules:94-98` lets **any authenticated user read, update, and delete every
scene document**:

```
match /scenes/{id} {
  allow create: if isAuthenticated() && hasValidSceneCreatePayload();
  allow read: if isAuthenticated();
  allow update, delete: if isAuthenticated();
}
```

There is no `request.auth.uid` owner scoping. Any signed-up account (any buyer or
capturer — signup is open) can enumerate, overwrite, or delete other tenants' scenes.
The server also writes into this collection (`server/routes/contact.ts:409`,
`db.collection("scenes").add(...)`), so server-generated records are equally exposed.

## Why this matters for launch

Cross-tenant read is a privacy/rights breach (scene documents describe real customer
sites); cross-tenant update/delete is data-integrity loss for the exact records buyer
workflows depend on. Trivially exploitable by any beta user with the Firestore SDK.

## Proposed fix

1. Add an `ownerUid` (and where relevant `orgId`) field on scene creation — client
   `hasValidSceneCreatePayload()` must require `request.resource.data.ownerUid == request.auth.uid`.
2. Rules become owner/org-scoped:
   - `read, update, delete: if isAuthenticated() && resource.data.ownerUid == request.auth.uid`
     (or org-membership check), plus existing admin/ops role bypass.
3. Backfill `ownerUid` on existing documents (server migration script using whatever
   linkage exists — creator id on the doc, associated request records); documents with
   no derivable owner become admin-only.
4. Server-written scenes (contact flow) get an explicit service owner/org so they don't
   fall into an "unowned readable" bucket.
5. Emulator rules tests: owner can CRUD own scene; other user is denied on each verb.

## Acceptance criteria

- [ ] Rules deny read/update/delete of another user's scene in emulator tests.
- [ ] Creation without a matching `ownerUid` is rejected.
- [ ] Migration leaves zero scene docs readable by all authenticated users.
