# Blueprint-WebApp AI Guide

Despite the filename, this guide applies to Claude, Codex, Hermes-backed agents, and other AI lanes working in this repo unless a narrower instruction explicitly overrides it.

Use this repo as Blueprint's buyer and ops surface, not as a generic marketing app.

**Start with `PLATFORM_CONTEXT.md`'s preamble, above its shared block.** The
shared blocks in `PLATFORM_CONTEXT.md`, `VISION.md`, and
`WORLD_MODEL_STRATEGY_CONTEXT.md` are cross-repo doctrine owned by
`BlueprintCapturePipeline` and byte-locked by `npm run doctrine:verify`. This
repo's public surface has moved ahead of them deliberately; the preamble states
what currently ships, which parts of the shared block still bind, and why the
reconciliation is a cross-repo change rather than a local edit. Never edit
inside a shared block, and never update the lock digest to match a local edit.

Read first:

1. `PLATFORM_CONTEXT.md`
2. `WORLD_MODEL_STRATEGY_CONTEXT.md`
3. `AGENTS.md`
4. `docs/ai-tooling-adoption-implementation-2026-04-07.md`
5. `docs/ai-skills-governance-2026-04-07.md`

Key rules:

- The public site is positioned as deployment infrastructure: deployment, not
  robot capability, is the binding constraint, and Blueprint automates months
  0–2. Keep public copy on that thesis.
- Every public figure carries a primary source and an evidence grade
  (`published` or `illustrative`). There is no third grade. A figure with no
  source does not ship — add the source or drop the figure. See
  `client/src/data/deploymentMarket.ts`.
- Where the public record is silent, say so in the figure rather than filling
  the gap with a plausible number.
- Blueprint's four screening conditions live in
  `client/src/data/qualifyingEnvironments.ts`. They are our own criteria, not a
  third-party standard, and each is stated with its failure mode.
- Third-party deployments cited as evidence are never implied to be Blueprint
  customers or Blueprint-prepared work.
- Keep copy and UX capture-first and real-site robot-evaluation/data-package first.
- Treat world models as internal compatibility, generation/editing/augmentation, or advisory support inside data packages—not the primary public offer or ground truth.
- Treat provenance, rights, privacy, and hosted access as first-class product truths.
- Do not make qualification or one model backend the core story.
- Avoid fake supply, fake readiness, or fabricated operational states.
- Public-surface work runs `npm run check`, `npx vitest run client/tests`, the
  affected `e2e/` specs, and `e2e/brand-polish.spec.ts`. The vitest suite alone
  does not cover the Playwright copy contracts or the brand-polish route table.
- Do not use external boilerplates, skill packs, or AI recommendations to implicitly introduce new primary services into this repo.
- Treat the current Firebase, Firestore, Stripe, Render, Redis, Notion, and Paperclip stack as primary unless `blueprint-cto` explicitly approves a change.
- Before claiming autonomous-loop `done`, `blocked`, or `awaiting_human_decision`, apply `docs/autonomous-loop-evidence-checklist-2026-05-03.md`.

Key commands:

```bash
npm run dev
npm run check
npm run build
npm run test:coverage
npm run test:e2e
```

## gstack

- Use the repo-local gstack install at `.agents/skills/gstack` when you need slash-skill workflows.
- Prefer `/browse` for web browsing and browser-driven QA instead of older Chrome MCP flows.
- Core skills expected in this repo: `/plan-eng-review`, `/review`, `/qa`, `/browse`, `/investigate`, `/benchmark`, `/codex`, `/cso`, `/ship`, `/land-and-deploy`.

## AI Tooling

- AI tooling is a support layer for the current repo, not an architecture-selection mechanism.
- Provider best-practice skills are useful when they reinforce services already in use.
- Packed-context tools such as Repomix are allowed for bounded reference work, but they do not replace direct reading of canonical repo docs.
- Any guidance imported from Claude-oriented materials must also hold for Codex and Hermes lanes unless a narrower runtime-specific rule is written explicitly.

## graphify

This project publishes its canonical graphify knowledge graph at `graphify-out/` and stages generation inputs under `derived/graphify/webapp-architecture/corpus/graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` when present; otherwise read the staged derived report and generate the canonical graph if needed
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz` to refresh the staged architecture pilot and publish the canonical root `graphify-out/` outputs
