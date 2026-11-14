# Blueprint-WebApp

A site films one recurring job once and sends it here with an email. Blueprint turns the video into a job packet that any robot deployment company can evaluate without visiting: the site's own sentence for the job, the video with its rights recorded, a first look on paper, a simulation of the site with the job's object in it, the success rule and, where one exists, an early trial of openly available robot software. Blueprint sends the packet to deployment companies it has approved and shows the site their responses: who will take the job, who will not, and why. Sharing is the service: a site agrees once, when it sends a job, that Blueprint shares the job with the deployment companies it has approved; there is no share button, no share setting and no pause. A site's name, street address and contact details are never shared without asking the site first. The website change for this is in build. Owner direction of 2026-11-12; see [`PLATFORM_CONTEXT.md`](./PLATFORM_CONTEXT.md).

`Blueprint-WebApp` is the site side: a site starts a job, sends its video, sees the first look, the simulation of its site, where the job stands and the responses. A person who works at the site films the job on their own phone and uploads it in the browser. It also holds ops dashboards and runbooks. It is not the Pipeline, which builds the simulation.

## System Position

Blueprint is a three-repo product system:

1. `BlueprintCapture` is kept only for its `extractFrames` cloud function, which receives every website upload and writes the delivery records the Pipeline starts from. Its phone apps are not in use (see "How Capture Works" in [`PLATFORM_CONTEXT.md`](./PLATFORM_CONTEXT.md)).
2. `BlueprintCapturePipeline` is the packet factory: it turns the video into a simulation of the site with the job's object in it, and runs the early trial.
3. `Blueprint-WebApp` is the site side: job start, video upload, first look, the job's status, responses and status emails.

The site pays nothing. Deployment companies will pay; how is not decided, and no price is stated anywhere. Blueprint pays for preparation and the early trial inside a fixed budget for each site. No person at Blueprint stands between a site's video and an introduction. When a job is ready it is shown to every approved deployment company, and those that asked for job emails are told. People act only where their own decision is the point: a site sends, confirms, asks for an introduction and can withdraw; a company applies and answers; Blueprint approves a company once. The site asks for an introduction with one press for each company it wants to meet; Blueprint then gives each side the other's name and contact details by email. Nothing else shares them. Each introduction is recorded as a billable event. Nothing is charged and no price is stated until the owner sets one. After an introduction both sides are asked, at 14, 45 and 90 days, what happened; the answer is recorded on the job. The website change for this is in build. The only hard stops are privacy, rights and money (see [`AGENTS.md`](./AGENTS.md)). A simulation result is a bounded estimate and never certifies physical performance or safety.

## Current Stack

- Frontend: React, Vite, TypeScript, Wouter, TanStack Query, Tailwind-style utility classes, Radix UI, lucide-react, Remotion surfaces.
- Backend: Express, TypeScript, Firebase Admin, Firestore, Redis when configured.
- Runtime and ops: Render deployment, Notion as workspace/review surface, Resend/Gmail/Slack integrations where explicitly configured. The Paperclip autonomous org is retired (see [`AUTONOMOUS_ORG.md`](./AUTONOMOUS_ORG.md)).
- AI/runtime lanes: OpenAI, Anthropic's own API, Google Gemini (video) and ACP-compatible paths modeled in repo code and env; Codex is the default implementation lane.

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

## Repo Map

- `client/src/app/routes.tsx`: route registry.
- `client/src/pages/`, `client/src/components/`, `client/src/lib/`: the site.
- `client/src/data/`: public content definitions.
- `server/index.ts`: Express bootstrap, middleware, rate limits, CSP, static serving.
- `server/routes.ts`, `server/routes/`: API routes.
- `server/utils/`: business logic and provider utilities.
- `server/agents/`: language-model task runtime and provider selection.
- `scripts/`: local checks, smoke tests, deploy helpers.
- `docs/onboarding/`: AI-agent onboarding.
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

Read [`docs/architecture/command-safety-matrix.md`](./docs/architecture/command-safety-matrix.md) before running scripts that can touch live email, provider APIs, Paperclip, Notion, Firebase, Render, or production-like targets.

## Where Not To Look First

- Do not start with `output/`, `.tmp/`, `dist/`, `coverage/`, or generated graph files when deciding current product truth.
- Do not treat Hermes KB or old generated summaries as canonical.
- Do not start with archived docs or historical specs unless the task is explicitly historical.
- Do not infer live readiness from static fixtures or demo flags.

## Truth Boundaries

- Capture truth comes from the uploaded video, its timestamps, device metadata and provenance.
- Rights, privacy and consent state must remain explicit. Do not invent clearance. No permission recorded so far covers sending a site's video or simulation to a deployment company.
- A job's status says only what has happened: not yet sent, sent and waiting, or the responses given.
- Generated images, videos, summaries, graph reports and AI-authored artifacts are support evidence only. They are not ground truth.

When in doubt, prefer current canonical doctrine and live/runtime evidence over older reports or generated summaries.
