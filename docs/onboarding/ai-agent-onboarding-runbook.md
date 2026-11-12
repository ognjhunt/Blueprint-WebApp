# AI Agent Onboarding Runbook

Audience: Codex, Claude and any other coding agent working in this repo.

## Mission

Help a site turn a video of one job into a job packet that approved deployment
companies can evaluate without a visit, and show the site where its job stands
and the responses. The frame is the shared block of `PLATFORM_CONTEXT.md`
(owner direction 2026-11-12). Today a deployment company receives a summary of
a job only; a site's video and simulation stay private until the owner sets a
new permission.

## Read Order

1. `AGENTS.md`
2. `PLATFORM_CONTEXT.md`
3. the nearest nested `AGENTS.md`
4. `docs/architecture/command-safety-matrix.md` before any command with live side effects
5. `docs/architecture/ai-onboarding-map.md` and `docs/architecture/source-of-truth-map.md` for orientation

Do not use `docs/archive/` to decide what to build or how to word anything.

## Source-Of-Truth Rules

- Repo files define doctrine, code contracts, policies and implementation state.
- Notion is workspace, review and visibility.
- Firebase/Firestore, Stripe, Render, Redis, GitHub, provider APIs and app logs own their live domains.
- Capture truth comes from the uploaded video and its provenance and rights records, not generated summaries.
- Generated outputs are support artifacts only.
- The Paperclip org is retired (`AUTONOMOUS_ORG.md`). No Paperclip role approves anything.

## Safe Start

```bash
git status --short
```

Inspect untracked or dirty files before editing. Preserve unrelated work.

Do not run live sends, production deploys, Render env imports, provider writes,
payment mutations or Paperclip repair scripts unless the task explicitly
authorizes that side effect. Ask the owner first before sending email to
outside people, charging money or deleting retained data.

## Notion Rules

Use supported Notion connector/API paths. Do not scrape Notion HTML, private
Notion APIs or browser cookies. Fetch before updating, preserve child pages and
databases, and mark missing figures as source-needed, never invented.

## Words

"Deployment company" (not vendor, integrator or OEM), "job packet", "first
look", "simulation of your site", "early trial", "responses". Say only what is
true today: V1 is by hand, no price is stated, no deployment company is named,
nothing promises a response.

## Done Definition

An agent is done only when the requested change exists, validation ran (or the
reason it could not is stated), and remaining privacy, rights or money gaps are
explicit.
