# Blueprint-WebApp AI Guide

Despite the filename, this guide applies to Claude, Codex, Hermes-backed agents, and other AI lanes working in this repo unless a narrower instruction explicitly overrides it.

Use this repo as Blueprint's buyer and ops surface, not as a generic marketing app.

Read first:

1. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
2. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`
3. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AGENTS.md`
4. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/ai-tooling-adoption-implementation-2026-04-07.md`
5. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/ai-skills-governance-2026-04-07.md`

Key rules:

- Keep copy and UX aligned with capture-first, world-model-product-first positioning.
- Treat provenance, rights, privacy, and hosted access as first-class product truths.
- Do not make qualification or one model backend the core story.
- Avoid fake supply, fake readiness, or fabricated operational states.
- Do not use external boilerplates, skill packs, or AI recommendations to implicitly introduce new primary services into this repo.
- Treat the current Firebase, Firestore, Stripe, Render, Redis, Notion, and Paperclip stack as primary unless `blueprint-cto` explicitly approves a change.
- Before claiming autonomous-loop `done`, `blocked`, or `awaiting_human_decision`, apply `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/autonomous-loop-evidence-checklist-2026-05-03.md`.

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

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz` to refresh the staged architecture pilot and publish the canonical root `graphify-out/` outputs
