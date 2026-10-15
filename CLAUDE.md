# Blueprint-WebApp AI Guide

Despite the filename, this guide applies to Claude, Codex, Hermes-backed agents, and other AI lanes working in this repo unless a narrower instruction explicitly overrides it.

Use this repo as Blueprint's buyer and ops surface, not as a generic marketing app.

**Start with `PLATFORM_CONTEXT.md`'s preamble, above its shared block.** The
shared blocks in `PLATFORM_CONTEXT.md`, `VISION.md`, and
`WORLD_MODEL_STRATEGY_CONTEXT.md` are cross-repo doctrine owned by
`BlueprintCapturePipeline` and byte-locked by `npm run doctrine:verify`. Since
2026-10-14 they name two active programs, the free beta's evaluated,
recommended pilot and Arm Decision Proof v1, so this repo's public surface and
the shared blocks agree. The preamble explains how to change either side.
Never edit inside a shared block, and
never update the lock digest to match a local edit.

Read first:

1. `PLATFORM_CONTEXT.md`
2. `WORLD_MODEL_STRATEGY_CONTEXT.md`
3. `AGENTS.md`
4. `docs/ai-tooling-adoption-implementation-2026-04-07.md`
5. `docs/ai-skills-governance-2026-04-07.md`

Key rules:

- The public site is positioned as an evaluated, recommended pilot (founder
  decision, 2026-10-13): a site shows one recurring task, invited robot teams
  evaluate it in a simulation built from the site's capture, Blueprint
  recommends ONE team whose evaluation on that job passed, and the site books
  it in one step. The beta is completely free for everyone: no site fee, no
  paid private evaluations, balances, top-ups or checkout, and no announced
  future pricing. The physical pilot is agreed directly between the site and
  the robot team; Blueprint takes no cut and charges nothing. Sign-up is open
  for sites (Blueprint also onboards sites by hand); robot teams join by
  invitation after application review. Booking is the site's one approval; do
  not ask sites to compare teams. Avoid "match" wording in public copy.
  Simulation results are bounded estimates and never certify physical
  performance or safety. The historical `entryPrice`/`minTopupUsd` constants in
  `client/src/lib/evaluationPricing.ts` are deprecated and never quoted.
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
- Treat the current Firebase, Firestore, Stripe, Render, Redis, Notion, and Paperclip stack as primary unless the founder explicitly approves a change.
- Before claiming autonomous-loop `done`, `blocked`, or `awaiting_human_decision`, apply `docs/autonomous-loop-evidence-checklist-2026-05-03.md`.

Key commands:

```bash
npm run dev
npm run check
npm run build
npm run test:coverage
npm run test:e2e
```

## Cloud sessions

- A Claude Code cloud session (claude.ai/code) starts with `bash scripts/cloud/bootstrap.sh`, then
  `bash scripts/cloud/doctor.sh`; clear every FAIL before driving a scene. Single-repo sessions
  already run bootstrap in the background from a SessionStart hook, and `. ~/.blueprint-cloud/env.sh`
  gives a shell the Pipeline virtualenv, the pinned uv and the operator door URL.
- The procedure, environment values and constraints live in `docs/runbooks/cloud-scene-runs.md`.
- Host access goes through the Pipeline repo's `scripts/operator_door.py`, never SSH.

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
