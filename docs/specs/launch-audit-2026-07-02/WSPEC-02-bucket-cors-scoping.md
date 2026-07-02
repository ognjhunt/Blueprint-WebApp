# WSPEC-02: Scope bucket CORS away from `*`

- Status: Proposed
- Priority: **P1 — major**
- Area: `cors.json`

## Problem

`cors.json` grants GET to any origin:

```json
[{ "origin": ["*"], "method": ["GET"], "maxAgeSeconds": 3600 }]
```

Any website can fetch objects from the bucket in a user's browser context. Combined with
WSPEC-01 (no repo-managed Storage rules), capture/package artifacts may be effectively
public. Even with tight rules, wildcard CORS needlessly widens the exposure surface for
tokened/signed URLs embedded in third-party pages.

## Proposed fix

1. Replace `*` with the explicit product origins (production domain(s), staging, and
   localhost dev ports), mirroring the server's own CORS whitelist
   (`server/index.ts:167-191`) so there is one origin source of truth.
2. Document the `gsutil cors set` / `gcloud storage buckets update` apply step in
   DEPLOYMENT.md, and record which bucket(s) this file governs.
3. If any asset genuinely must be world-readable (public marketing media), move it to a
   dedicated public bucket/path rather than widening CORS on the capture bucket.

## Acceptance criteria

- [ ] `cors.json` lists only Blueprint-controlled origins.
- [ ] Deployment docs identify the governed bucket(s) and the apply command.
- [ ] Public marketing assets, if any, are separated from capture/package storage.
