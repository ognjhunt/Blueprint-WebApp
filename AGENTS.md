# Blueprint-WebApp Agent Guide

## Mission

`Blueprint-WebApp` is the buyer, licensing, ops, and hosted-access surface for Blueprint's site-specific world-model products.

This repo must reinforce the platform doctrine in:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`

## Read First

Before making changes, read:

1. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md` — repo-authoritative mirror of Blueprint Knowledge for platform doctrine
2. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md` — repo-authoritative mirror of Blueprint Knowledge for world-model strategy
3. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md` — repo-authoritative mirror of Blueprint Knowledge for org structure
4. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/DEPLOYMENT.md`
5. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/package.json`
6. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/ai-tooling-adoption-implementation-2026-04-07.md`
7. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/ai-skills-governance-2026-04-07.md`

## Product Rules

- Keep Blueprint capture-first and world-model-product-first.
- Do not reframe the company as qualification-first or model-checkpoint-first.
- Do not overstate simulated or generated outputs as ground truth.
- Buyer, licensing, hosted-session, and ops flows should stay anchored to real capture provenance.
- Qualification and readiness surfaces are support layers, not the center of the product.

## Repo Map

- `client/src/pages/`: product routes and marketing pages
- `client/src/components/`: reusable UI and workflow components
- `client/src/lib/`: API, client environment, and app helpers
- `server/`: backend routes and runtime integrations
- `scripts/`: smoke checks, sitemap/prerender, launch gates
- `e2e/`: Playwright coverage

## Working Rules

- Preserve truthful product language around hosted sessions, captures, rights, and provenance.
- Prefer edits that strengthen buyer usability, ops clarity, and delivery of real-site outputs.
- Avoid inventing fake supply, fake providers, or fake readiness states in production paths.
- Keep changes aligned with the other Blueprint repos when contracts cross repo boundaries.
- Treat the current Firebase, Firestore, Stripe, Render, Redis, Notion, and Paperclip stack as the default operating stack for this repo.
- Do not use external boilerplates, skill packs, or AI-generated migration suggestions to introduce new primary services unless `blueprint-cto` explicitly approves the change.
- Anything that applies to Claude guidance in this repo also applies to Codex and Hermes-backed agents unless a narrower runtime rule explicitly overrides it.

## Human Gates

- When a blocker is truly human-gated, use the standard packet in `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/programs/human-blocker-packet-standard.md`.
- Follow `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/programs/human-reply-handling-contract.md` for watcher ownership, correlation, and resume handoff after the human replies.
- Default fast path: Slack DM to `Nijel Hunt`.
- Default durable path: email to `ohstnhunt@gmail.com`.
- Disallowed org identity: `hlfabhunt@gmail.com` must never be used for org-facing drafts, sends, or escalation routing.
- Every blocker packet should carry a durable blocker id so reply correlation can survive email threads, Slack threads, and report handoffs.
- Resume execution immediately after the human reply is recorded in the owning issue, report, or run artifact.

## CI Issues

- Treat unresolved CI failures as active diagnosis work by default, not passive monitoring.
- A single fast "already green?" check is allowed first: inspect the referenced failing run and check for a newer successful run on the default branch.
- If no newer green default-branch run exists, switch into investigate mode in the same run: inspect failing jobs or logs, identify the failing step or error class, and leave evidence on the owning issue.
- Only treat a CI issue as monitor-only when the issue explicitly says it is recovery tracking only, a linked issue already owns root-cause remediation, or the failure is confirmed external to repo scope.
- Do not leave an unresolved CI failure open with only a status note that it is still failing; either investigate it or link the blocker that owns the diagnosis.

## Commands

Install:

```bash
npm install
```

Develop:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Typecheck:

```bash
npm run check
```

Unit/integration tests:

```bash
npm run test:coverage
```

E2E:

```bash
npm run test:e2e
```

Targeted smoke:

```bash
npm run smoke:agent
npm run smoke:launch
npm run smoke:launch:local
npm run alpha:check
```

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, prefer `derived/graphify/webapp-architecture/corpus/graphify-out/GRAPH_REPORT.md` for god nodes and community structure.
- If `graphify-out/GRAPH_REPORT.md` exists, you may use it; otherwise fall back to the derived graph workspace above.
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- After modifying code files in this session, run `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz` to refresh the staged architecture pilot and publish the canonical root `graphify-out/` outputs.
