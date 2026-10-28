# Blueprint-WebApp Agent Guide

This guide applies to everyone working here, human or agent (Claude, Codex,
Hermes). `CLAUDE.md` is a pointer to it.

## Mission

A site sends a video of one recurring job. Blueprint drafts the brief from the
video, builds a simulation of the site, runs the candidate robot policies and
embodiments in it itself, and shows the site a bounded estimate of what works,
or "held — we can't simulate this kind of job yet". Blueprint then works
alongside a deployment company on the real site. This repo is the customer
side: start a job, send video, see the brief, see the result.

The beta is free: no fees, checkout or announced pricing. Starting a job takes
an email and a video.

Shared doctrine: `PLATFORM_CONTEXT.md` (read its preamble). The shared block is
generated from `BlueprintCapturePipeline/doctrine/`; never edit inside it here.

## The Only Hard Stops

Fail closed only for:

- **Privacy:** people in captures are screened, and consent is respected.
- **Rights:** capture permissions, revocation, and licenses.
- **Money:** spending stays inside its budget. Internal budgets are Blueprint's
  controls, never a step for the site.

Everything else keeps going. If something is missing, ambiguous or
unverified, flag it where the person can see it and continue the same job;
ask at most one question at a time, inside that job. Fixing a failure means
fixing its cause; do not add a gate, approval step, review stage or readiness
check unless it protects privacy, rights or money. Delete checks that protect
none of the three.

Ask the owner first before sending email to outside people, charging money,
or deleting retained data. `docs/architecture/command-safety-matrix.md` lists
commands with live side effects.

## Two Truths

- Don't make things up: no invented figures, customers, results or readiness.
  Public figures carry their source (`client/src/data/deploymentMarket.ts`).
- Simulation results are bounded estimates; they never certify physical
  performance or safety. Arm Decision Proof v1 is a separate evidence program
  and the only one that may claim physical validation.

## Stack

Firebase, Firestore, Stripe, Render, Redis, Notion and Paperclip. Don't add a
new primary service without the owner's OK.

## Repo Map

- `client/src/pages/`, `client/src/components/`, `client/src/lib/`: the site
- `server/`: backend routes and integrations
- `scripts/`: checks, smoke tests, launch tooling
- `e2e/`: Playwright coverage

## Commands

```bash
npm install
npm run dev
npm run check            # typecheck
npx vitest run <paths>   # tests for what you changed
npm run test:e2e         # Playwright
npm run build
```

Graphify output in `graphify-out/` is optional reference;
`bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz` refreshes it.
