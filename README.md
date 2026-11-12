# Blueprint-WebApp

A site films one recurring job once and sends it here with an email. Blueprint turns the video into a job packet that any robot deployment company can evaluate without visiting: the site's own sentence for the job, the video with its rights recorded, a first look on paper, a simulation of the site with the job's object in it, the success rule and, where one exists, an early trial of openly available robot software. Blueprint sends the packet to deployment companies it has approved and shows the site their responses: who will take the job, who will not, and why. Today a deployment company receives a summary of a job only; a site's video and simulation stay private until the owner sets a new permission. Owner direction of 2026-11-12; see [`PLATFORM_CONTEXT.md`](./PLATFORM_CONTEXT.md).

`Blueprint-WebApp` is the site side: a site starts a job, sends its video, sees the first look, the simulation of its site, where the job stands and the responses. A person who works at the site films the job on their own phone and uploads it in the browser. It also holds ops dashboards and runbooks. It is not the Pipeline, which builds the simulation.

## System Position

Blueprint is a three-repo product system:

1. `BlueprintCapture` is kept only for its `extractFrames` cloud function, which receives every website upload and writes the delivery records the Pipeline starts from. Its phone apps are not in use (see "How Capture Works" in [`PLATFORM_CONTEXT.md`](./PLATFORM_CONTEXT.md)).
2. `BlueprintCapturePipeline` is the packet factory: it turns the video into a simulation of the site with the job's object in it, and runs the early trial.
3. `Blueprint-WebApp` is the site side: job start, video upload, first look, the job's status, responses and status emails.

Sites pay nothing. Deployment companies are the customer; how they pay is not decided and no price is stated. Blueprint pays for preparation and the early trial inside a fixed budget for each site. In V1 Blueprint carries each packet to deployment companies by hand, with the owner's go-ahead for every approach. The only hard stops are privacy, rights and money (see [`AGENTS.md`](./AGENTS.md)). A simulation result is a bounded estimate and never certifies physical performance or safety.

## Blueprint OS Quick Start

Use this repo as the definitional operating-system layer for WebApp, onboarding, and policy drafts:

- New humans start at [`docs/onboarding/human-new-hire-start-here.md`](./docs/onboarding/human-new-hire-start-here.md), then their role scorecard and relevant policy drafts.
- AI agents start at [`docs/onboarding/ai-agent-onboarding-runbook.md`](./docs/onboarding/ai-agent-onboarding-runbook.md), then the nearest nested `AGENTS.md`.
- Managers start at [`docs/onboarding/manager-onboarding-checklist.md`](./docs/onboarding/manager-onboarding-checklist.md).
- Notion mirrors the same journey for review and visibility through `Blueprint Hub` -> `Company Handbook & Onboarding`.

Authority stays split deliberately: repo docs define doctrine and policy drafts, Notion keeps the workspace readable, and live systems own their specific facts. Legal, HR, payroll, benefits, confidentiality/IP, and employment-administration material remains draft until counsel/PEO-reviewed systems or signed documents approve it.

## Current Stack

- Frontend: React, Vite, TypeScript, Wouter, TanStack Query, Tailwind-style utility classes, Radix UI, lucide-react, Remotion surfaces.
- Backend: Express, TypeScript, Firebase Admin, Firestore, Stripe, Redis when configured.
- Runtime and ops: Render deployment, Notion as workspace/review surface, Resend/Gmail/Slack integrations where explicitly configured. The Paperclip autonomous org is retired (see [`AUTONOMOUS_ORG.md`](./AUTONOMOUS_ORG.md)).
- AI/runtime lanes: DeepSeek/OpenAI/Anthropic/ACP-compatible paths modeled in repo code and env; Codex is the default implementation lane.

Do not introduce a new primary service, auth stack, datastore, deployment platform, payment system, or ops record without explicit founder approval.

## Read First

Before substantial changes, read these in order:

1. [`AGENTS.md`](./AGENTS.md)
2. [`PLATFORM_CONTEXT.md`](./PLATFORM_CONTEXT.md)
3. [`WORLD_MODEL_STRATEGY_CONTEXT.md`](./WORLD_MODEL_STRATEGY_CONTEXT.md)
4. [`DEPLOYMENT.md`](./DEPLOYMENT.md)
5. [`docs/architecture/ai-onboarding-map.md`](./docs/architecture/ai-onboarding-map.md)
6. [`docs/architecture/source-of-truth-map.md`](./docs/architecture/source-of-truth-map.md)
7. [`docs/architecture/command-safety-matrix.md`](./docs/architecture/command-safety-matrix.md)
8. [`docs/onboarding/ai-agent-onboarding-runbook.md`](./docs/onboarding/ai-agent-onboarding-runbook.md)
9. [`docs/onboarding/human-new-hire-start-here.md`](./docs/onboarding/human-new-hire-start-here.md)

Use [`graphify-out/GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md) as a structural aid, not as authority.

## Company Handbook & Onboarding

Start here for human and AI onboarding:

- Human new hires: [`docs/onboarding/human-new-hire-start-here.md`](./docs/onboarding/human-new-hire-start-here.md)
- AI agents: [`docs/onboarding/ai-agent-onboarding-runbook.md`](./docs/onboarding/ai-agent-onboarding-runbook.md)
- Managers: [`docs/onboarding/manager-onboarding-checklist.md`](./docs/onboarding/manager-onboarding-checklist.md)

The policy packet lives in [`docs/company/`](./docs/company/). Legal, HR, payroll, benefits, confidentiality/IP, and employment-administration documents are drafts until counsel/PEO review and signed/approved systems say otherwise.

## Repo Map

- `client/src/app/routes.tsx`: route registry.
- `client/src/pages/`, `client/src/components/`, `client/src/lib/`: the site.
- `client/src/data/`: public content definitions.
- `server/index.ts`: Express bootstrap, middleware, rate limits, CSP, static serving.
- `server/routes.ts`, `server/routes/`: API routes.
- `server/utils/`: business logic and provider utilities.
- `server/agents/`: language-model task runtime and provider selection.
- `scripts/`: local checks, smoke tests, deploy helpers.
- `ops/paperclip/`: the retired Paperclip company package (stubs) and its host tooling.
- `docs/company/`: employee handbook and policy packet drafts.
- `docs/onboarding/`: onboarding paths.
- `docs/archive/`: history. Not current.
- `e2e/`: Playwright coverage.

## Common Commands

```bash
npm install
npm run dev
npm run check
npm run audit:assets
npm run test:coverage
npm run test:e2e
npm run smoke:launch:local
```

Read [`docs/architecture/command-safety-matrix.md`](./docs/architecture/command-safety-matrix.md) before running scripts that can touch live email, provider APIs, Paperclip, Notion, Stripe, Firebase, Render, or production-like targets.

The required architecture refresh is `npm run graphify:pilot:webapp-architecture -- --no-viz`.
It automatically provisions and reuses the pinned Graphify environment for each checkout;
fresh sessions need no manual install or environment variable. First use needs Python
3.10+ with venv/pip and package-download access. See [Graphify setup](./scripts/graphify/README.md)
for offline reuse, recovery and interpreter overrides.

## Where Not To Look First

- Do not start with `output/`, `ops/paperclip/reports/`, `.tmp/`, `dist/`, `coverage/`, or generated graph files when deciding current product truth.
- `ops/paperclip/reports/` holds only files written at runtime and is ignored by git. The 949 reports that were once committed there (April to June 2026, mostly city-launch runs) were removed from the tree on 2026-11-10; `git show 2f9c773a5:ops/paperclip/reports/<path>` prints any of them. Older docs under `knowledge/`, `docs/` and `ops/paperclip/` still cite those paths as history.
- Do not treat `ops/paperclip/external/` skill packs as architecture guidance.
- Do not treat Hermes KB, old generated summaries, or graphify output as canonical.
- Do not start with archived docs or historical specs unless the task is explicitly historical.
- Do not infer live readiness from static fixtures or demo flags.

## Truth Boundaries

- Capture truth comes from the uploaded video, its timestamps, device metadata and provenance.
- Rights, privacy and consent state must remain explicit. Do not invent clearance. No permission recorded so far covers sending a site's video or simulation to a deployment company.
- A job's status says only what has happened: not yet sent, sent and waiting, or the responses given.
- Generated images, videos, summaries, graph reports and AI-authored artifacts are support evidence only. They are not ground truth.

When in doubt, prefer current canonical doctrine and live/runtime evidence over older reports or generated summaries.
