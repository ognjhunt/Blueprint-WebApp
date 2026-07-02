# WSPEC-01: Deploy real Firebase Storage security rules

- Status: Proposed
- Priority: **P0 — launch blocker**
- Area: `storage.rules`, `firebase.json`, upload call sites

## Problem

`storage.rules` is **empty (0 bytes)** and `firebase.json` declares only `firestore` and
`functions` — no `storage` block — so no Storage ruleset is deployed from this repo at
all. Meanwhile the client actively uses Firebase Storage:

- `client/src/lib/firebase.ts:82` — `export const storage = getStorage(app);`
- `client/src/pages/OffWaitlistSignUpFlow.tsx:788-793` — `uploadBytes(...)`
- `client/src/pages/OutboundSignUpFlow.tsx:667-672` — same pattern

Access control for buyer/capturer uploads is therefore unmanaged by the repo; whatever
rules exist in the console (possibly the permissive defaults) are unversioned and
unauditable. Combined with WSPEC-02's wildcard CORS, capture artifacts in this bucket may
be publicly fetchable.

## Why this blocks beta

Capture bundles and buyer artifacts are the crown jewels — rights- and privacy-bound by
doctrine. Shipping a beta where their storage ACL is undefined-in-repo is an unacceptable
privacy/rights posture and likely a direct data exposure.

## Proposed fix

1. Author `storage.rules` with default-deny and explicit path grants, e.g.:
   - `/users/{uid}/**` — read/write only `request.auth.uid == uid`
   - capture/package artifact paths — write via server (Admin SDK) only; client read via
     signed URLs or entitlement-checked rules
   - deny everything else
2. Register it in `firebase.json` (`"storage": { "rules": "storage.rules" }`) so deploys
   include it.
3. Inventory the actual object paths written today (the signup placeholder writes above,
   plus any functions/server writers) and cover each with an explicit rule; prefer
   moving uploads behind server endpoints where entitlements apply.
4. Add a CI check that `storage.rules` is non-empty and passes
   `firebase emulators` rules unit tests (a couple of allow/deny cases).

## Acceptance criteria

- [ ] `storage.rules` deploys with default-deny; unauthenticated read/write of arbitrary paths fails in emulator tests.
- [ ] Every current client upload path still works for its owner and fails cross-user.
- [ ] `firebase deploy` from this repo manages Storage rules (no console drift).
