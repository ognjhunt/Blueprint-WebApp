---
name: AI Tooling Governance Rollout
project: blueprint-webapp
assignee: blueprint-chief-of-staff
recurring: false
---

Roll out the new AI-tooling governance rules for `Blueprint-WebApp` using the current stack and current autonomous-org controls only.

Primary source docs:

- `docs/ai-tooling-adoption-implementation-2026-04-07.md`
- `docs/ai-skills-governance-2026-04-07.md`
- `PLATFORM_CONTEXT.md`
- `WORLD_MODEL_STRATEGY_CONTEXT.md`
- `AUTONOMOUS_ORG.md`

This is a coordination-and-execution task, not an architecture brainstorming task.

The goal is to turn the repo-level governance decision into concrete, traceable work for:

- `webapp-codex`
- `growth-lead`
- `blueprint-chief-of-staff`

## Required Outcome

By completion:

- the no-new-services rule is enforced in repo instructions and active task routing
- `webapp-codex` has explicit implementation follow-through items
- `growth-lead` has explicit growth-loop follow-through items
- `blueprint-chief-of-staff` has explicit routing and enforcement duties
- any remaining work is represented by real Paperclip issues, not implied by prose alone

## Chief Of Staff Checklist

The assignee for this task must:

- read the governance docs and confirm the operating decision is stable
- verify that the repo-level instructions now apply equally across Claude, Codex, and Hermes-backed lanes
- create or update concrete downstream Paperclip issues for `webapp-codex` and `growth-lead`
- use these task templates as the default downstream handoff definitions:
  - `ops/paperclip/blueprint-company/tasks/webapp-ai-governance-follow-through/TASK.md`
  - `ops/paperclip/blueprint-company/tasks/growth-ai-governance-follow-through/TASK.md`
  - `ops/paperclip/blueprint-company/tasks/webapp-creative-image-execution/TASK.md` for image-heavy visual execution handoffs
- make sure each downstream issue points back to the governing docs
- leave one concise proof-bearing note describing what was routed, to whom, and why
- block or escalate any follow-up that would introduce new primary services into `Blueprint-WebApp`

## WebApp Codex Checklist

Create or update a downstream issue for `webapp-codex` using this task template as the default definition:

- `ops/paperclip/blueprint-company/tasks/webapp-ai-governance-follow-through/TASK.md`

The downstream issue should carry this scope:

- audit repo-local AI-facing instruction surfaces for consistency with the new governance rules
- identify any remaining repo files that still imply Claude-only guidance, service drift, or greenfield-boilerplate assumptions
- tighten repo docs, task files, or code-adjacent guidance where needed so the current Firebase, Firestore, Stripe, Render, Redis, Notion, and Paperclip stack remains explicit
- propose only same-stack follow-through work
- leave validation evidence with exact file paths touched

Done when:

- the implementation lane has no ambiguous instruction surface left in this repo for stack choice
- all proposed follow-through stays inside the current service footprint

## Growth Lead Checklist

Create or update a downstream issue for `growth-lead` using this task template as the default definition:

- `ops/paperclip/blueprint-company/tasks/growth-ai-governance-follow-through/TASK.md`

The downstream issue should carry this scope:

- review the exact-site hosted review growth loop against the new AI-tooling governance rules
- confirm that current content, campaign, and distribution loops remain proof-led and do not drift into generic trend-content tactics
- identify any growth docs, routines, or prompts that need tightening so imported skills stay subordinate to Blueprint doctrine
- route concrete follow-up work to the appropriate growth agents if additional tightening is needed
- leave a concise note distinguishing what is already aligned versus what still needs follow-through

Done when:

- growth adoption stays wedge-first, proof-led, and approval-gated
- no downstream growth work depends on new services or unsupported claims

## Human-Only Boundaries

- approving any new primary service
- architecture changes that fork source-of-truth systems
- pricing, legal, privacy, rights, or commercialization judgment
- public claims that extend beyond current product truth

## Completion Rule

Resolve this task only when:

1. the downstream issues for `webapp-codex` and `growth-lead` exist or were explicitly updated
2. the issue comments include proof-bearing routing notes
3. no unresolved ambiguity remains about whether Claude, Codex, and Hermes lanes follow the same repo-level AI-tooling governance

If any part remains unclear, block this task with the missing decision called out explicitly.
