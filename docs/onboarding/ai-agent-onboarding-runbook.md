# AI Agent Onboarding Runbook

Status: Active for Blueprint-WebApp agent onboarding.
Owner: `blueprint-cto` with Chief of Staff and Notion Manager Agent.
Audience: Codex, Claude, Hermes-backed Paperclip agents, Notion agents, and external coding agents operating in this repo.
Review cadence: Monthly and after any agent source-of-truth failure.

## Mission

An AI agent in `Blueprint-WebApp` exists to improve buyer, licensing, ops, hosted-access, and autonomous-org surfaces without weakening capture provenance, rights/privacy truth, hosted-session truth, or execution accountability.

## Required Read Order

1. `AGENTS.md`
2. `README.md`
3. `PLATFORM_CONTEXT.md`
4. `WORLD_MODEL_STRATEGY_CONTEXT.md`
5. `AUTONOMOUS_ORG.md`
6. `DEPLOYMENT.md`
7. `docs/architecture/source-of-truth-map.md`
8. `docs/architecture/command-safety-matrix.md`
9. `docs/architecture/ai-onboarding-map.md`
10. `docs/architecture/refactor-hotspots.md`
11. relevant nested `AGENTS.md`

## Source-Of-Truth Rules

- Repo files define doctrine, code contracts, policies, and implementation state.
- Paperclip defines execution ownership, issue state, routines, blockers, and closeouts.
- Notion is workspace/review/visibility.
- Firebase/Firestore, Stripe, Render, Redis, GitHub, provider APIs, and app logs own their live domains.
- Capture truth comes from raw capture/provenance/rights artifacts, not generated summaries.
- Generated outputs are support artifacts only.

## Safe Start

Every implementation run starts with:

```bash
git status --short
```

Then inspect relevant untracked or dirty files before editing. Preserve unrelated user work.

## Command Safety

Read `docs/architecture/command-safety-matrix.md` before running anything with live or external side effects.

Safe defaults:

```bash
npm run check
scripts/paperclip/validate-agent-kits.sh
```

Run the onboarding unfinished-marker scan from the validation packet before claiming the docs set is clean.

Do not run live sends, production deploys, Render env imports, provider writes, payment mutations, payroll operations, or broad Paperclip repair scripts unless the task explicitly authorizes that side effect.

## Notion Rules

Use supported Notion connector/API paths. Do not scrape Notion HTML, private Notion APIs, or browser cookies.

When editing Notion:

- fetch before updating;
- preserve child pages and databases;
- avoid broad moves/deletes without proven replacement identity;
- mark live KPI gaps as source-needed, not invented values;
- mirror repo docs into Notion for human readability, but keep repo/Paperclip as execution truth.

## Paperclip Rules

For autonomous closeout claims, use `docs/autonomous-loop-evidence-checklist-2026-05-03.md`.

Closeouts must include:

- work performed;
- evidence path;
- verification command/result;
- remaining gaps or blockers;
- owner for follow-up;
- source-of-truth system.

## Product Language Rules

Use Blueprint-native framing:

- capture-first;
- world-model-product-first;
- site-specific world-model packages;
- hosted access;
- rights/privacy/provenance truth;
- qualification/readiness as optional support layers.

Do not reframe the company as qualification-first, model-checkpoint-first, generic marketplace-first, or readiness-report-first.

## High-Risk Files

From `docs/architecture/refactor-hotspots.md`, treat these as high-risk:

- `ops/paperclip/plugins/blueprint-automation/src/worker.ts`
- `server/utils/cityLaunchExecutionHarness.ts`
- `client/src/data/content.ts`
- `server/routes/site-world-sessions.ts`
- `client/src/pages/AdminLeads.tsx`
- `client/src/pages/HostedSessionWorkspace.tsx`
- `server/agents/runtime.ts`
- `server/routes/admin-leads.ts`

Use targeted tests and pure extraction slices before moving side-effecting logic.

## Done Definition

An agent is done only when:

- the requested artifact/change exists;
- source-of-truth boundaries are preserved;
- validation ran or the reason it could not run is explicit;
- Notion/Paperclip mirrors do not overstate live truth;
- remaining legal, HR, security, rights, or live-source gaps are explicit.
