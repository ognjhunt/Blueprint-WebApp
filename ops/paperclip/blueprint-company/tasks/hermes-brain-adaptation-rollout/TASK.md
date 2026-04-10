---
name: Hermes Brain Adaptation Rollout
project: blueprint-webapp
assignee: webapp-codex
recurring: false
---

Execute the same-stack rollout for Blueprint's gbrain-pattern adaptation.

Primary source docs:

- `docs/gbrain-pattern-adaptation-plan-2026-04-10.md`
- `docs/hermes-kb-design.md`
- `docs/ai-tooling-adoption-implementation-2026-04-07.md`
- `docs/ai-skills-governance-2026-04-07.md`
- `AUTONOMOUS_ORG.md`

This is an implementation-lane adaptation task, not permission to add new services or replace canonical systems.

## Required Work

- harden the Hermes KB contract so reusable Blueprint research compounds safely
- define Blueprint-native KB page archetypes and template changes without turning the repo into a generic personal memex
- add support for attaching KB pages into startup packs and runtime startup context
- keep Paperclip, Notion, Firestore, and package/runtime truth as the only canonical systems
- convert the highest-leverage research loops to brain-first behavior
- leave exact file-level proof for each landed slice

## Done When

- the KB contract clearly explains what is reusable derivative knowledge versus canonical truth
- startup packs can reference KB pages in addition to repo docs and ops docs
- at least the market-intel and demand-intel lanes have a documented brain-first lookup and writeback rule
- no part of the rollout adds a new primary service or second operational datastore
- any remaining work is captured as explicit Paperclip follow-up issues

## Human-Only Boundaries

- approving a new primary service
- changing canonical source-of-truth systems
- rights, privacy, approvals, pricing, legal, commercialization, or package/runtime truth decisions

## Closeout

When this task is complete:

- leave a concise proof-bearing note with exact files changed
- state which phases of the adaptation plan landed and which remain
- if a later phase is still needed, create the smallest truthful follow-up issue instead of implying the rollout is complete
