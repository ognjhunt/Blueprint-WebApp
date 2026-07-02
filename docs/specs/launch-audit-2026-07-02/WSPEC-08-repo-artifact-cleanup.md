# WSPEC-08: Remove committed run artifacts / junk from the repo

- Status: Proposed
- Priority: **P2 — cleanup**
- Area: repo root

## Problem

The repo root carries committed artifacts and placeholder files that don't belong in a
deployable app repo:

- Empty 0-byte files: `attempted_models`, `failed_attempts`, `model`
- Artifact trees: `output/` (audits, playwright runs, qa, launch-readiness closeouts),
  `outputs/` (proof-packets, a UUID dir), `tmp/` (screenshots, qa runs), `derived/graphify/`
- Large binaries: `pre-proof.png` (~811 KB) and similar proof images
- Assorted dated reports at root (`daily-accountability-*.md`, `demand_intel_weekly_*.md`,
  `founder-brief-*.md`, `blocker-packet-*.md`, `market-intel-*.md`)

These bloat the Render build (`npm ci && npm run build` clones everything), slow
checkouts, and can leak internal ops notes if the repo scope ever widens.

## Proposed fix

1. Move ops/run outputs that must be kept into `docs/ops-archive/` (or a separate
   ops repo/bucket), delete the rest.
2. Delete the 0-byte placeholder files; add `output/`, `outputs/`, `tmp/`, `derived/`
   to `.gitignore`.
3. Root-level dated reports move under `docs/` (they're already duplicated in spirit by
   `docs/` conventions).
4. Optional: a CI guard that fails on newly committed files matching artifact globs.

## Acceptance criteria

- [ ] Repo root contains only source/config; artifact dirs are gitignored.
- [ ] Build output size drops; no ops notes in the deployable tree.
