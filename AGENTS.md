# Blueprint-WebApp Agent Guide

## Mission

`Blueprint-WebApp` is the buyer, licensing, ops, and hosted-access surface for Blueprint's site-specific world-model products.

This repo must reinforce the platform doctrine in:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`

## Read First

Before making changes, read:

1. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
2. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`
3. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/DEPLOYMENT.md`
4. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/package.json`

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
npm run alpha:check
```
