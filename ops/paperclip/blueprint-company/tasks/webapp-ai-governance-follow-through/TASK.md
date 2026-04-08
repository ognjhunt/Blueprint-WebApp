---
name: WebApp AI Governance Follow-Through
project: blueprint-webapp
assignee: webapp-codex
recurring: false
---

Execute the implementation-lane follow-through for the new AI-tooling governance rules in `Blueprint-WebApp`.

Primary source docs:

- `docs/ai-tooling-adoption-implementation-2026-04-07.md`
- `docs/ai-skills-governance-2026-04-07.md`
- `AGENTS.md`
- `CLAUDE.md`
- `PLATFORM_CONTEXT.md`
- `WORLD_MODEL_STRATEGY_CONTEXT.md`

This is repo-specific implementation follow-through, not greenfield architecture planning.

## Required Work

- audit repo-local AI-facing instruction surfaces for consistency with the new governance rules
- identify any remaining files that still imply:
  - Claude-only guidance where the guidance should be shared
  - permission to introduce new primary services by default
  - generic boilerplate or greenfield-SaaS assumptions that conflict with the current stack
- tighten repo docs, task files, or code-adjacent guidance where needed so the current Firebase, Firestore, Stripe, Render, Redis, Notion, and Paperclip stack remains explicit
- propose only same-stack follow-through work
- leave validation evidence with exact file paths touched

## Done When

- the implementation lane has no ambiguous repo-level instruction surface left for stack choice
- all proposed follow-through remains inside the current service footprint
- any remaining follow-up is represented by explicit Paperclip issues

## Human-Only Boundaries

- approving any new primary service
- changing source-of-truth systems
- rights, privacy, pricing, legal, or commercialization judgment

## Closeout

When this task is complete:

- leave a concise proof-bearing note with exact files reviewed or changed
- explicitly state whether any stack-choice ambiguity remains
- if ambiguity remains, block the task and create the smallest truthful follow-up issue
