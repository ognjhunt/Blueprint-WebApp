# Dependency audit exceptions — 2026-07-17

Status of `npm audit --omit=dev` after the 2026-07-17 public-beta closure work:
**0 critical, 0 high, 10 moderate.**

## Remediated in this pass

- **d3-color < 3.1.0 ReDoS (GHSA-36jr-mh4h-2g58, high, 5 findings)** — the
  `react-simple-maps@3` transitive chain was removed with the unused
  `PublicLaunchMap` component. The package and its temporary d3 overrides are
  no longer present in the production dependency graph.

## Accepted exceptions (moderate)

- **uuid < 11.1.1 missing buffer bounds check (GHSA-w5hq-g745-h8pq, moderate,
  10 findings)** — reached only through `firebase-admin` → `@google-cloud/*` →
  `google-gax`/`gaxios`/`teeny-request` and `googleapis` → `googleapis-common`.
  - Exploitability: the advisory requires calling `uuid.v3/v5/v6` with a
    caller-supplied `buf`; the Google client libraries use `v4()` string mode.
    No request-reachable input path feeds an attacker-controlled buffer.
  - Fix path: `npm audit fix --force` would install `googleapis@173` (breaking
    major) and downgrade/major-bump `firebase-admin` chains; not acceptable
    without dedicated regression coverage of Firebase Admin auth/Firestore.
  - Owner: blueprint-cto (dependency governance).
  - Retry condition: re-evaluate when `firebase-admin`/`googleapis` publish
    releases on `uuid >= 11.1.1`, or at the next monthly audit sweep.
  - Compensating control: CI now blocks on `npm audit --omit=dev
    --audit-level=high`, so any escalation of this chain to high/critical
    fails the build.
