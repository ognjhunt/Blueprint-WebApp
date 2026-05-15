# Blueprint-WebApp

`Blueprint-WebApp` is Blueprint's buyer, licensing, ops, and hosted-access surface for site-specific world-model products. It is not the capture client and it is not the pipeline that creates the packages; it sells, gates, operates, and exposes the outputs that come from the capture and pipeline repos.

## System Position

Blueprint is a three-repo product system:

1. `BlueprintCapture` collects real-site capture evidence and upload bundles.
2. `BlueprintCapturePipeline` turns those bundles into site-specific world-model packages, hosted-session artifacts, and optional trust or readiness outputs.
3. `Blueprint-WebApp` exposes those packages through buyer pages, licensing, entitlements, hosted sessions, ops dashboards, Paperclip control-plane flows, and launch/runbooks.

The product doctrine is capture-first and world-model-product-first. Qualification, readiness, and review outputs are support layers. They help buyers and operators trust a package, but they are not the center of the company.

## Blueprint OS Quick Start

Use this repo as the definitional operating-system layer for WebApp, onboarding, and policy drafts:

- New humans start at [`docs/onboarding/human-new-hire-start-here.md`](./docs/onboarding/human-new-hire-start-here.md), then their role scorecard and relevant policy drafts.
- AI agents start at [`docs/onboarding/ai-agent-onboarding-runbook.md`](./docs/onboarding/ai-agent-onboarding-runbook.md), then the nearest nested `AGENTS.md`.
- Managers start at [`docs/onboarding/manager-onboarding-checklist.md`](./docs/onboarding/manager-onboarding-checklist.md) and [`docs/onboarding/role-scorecards-and-30-60-90.md`](./docs/onboarding/role-scorecards-and-30-60-90.md).
- Notion mirrors the same journey for review and visibility through `Blueprint Hub` -> `Company Handbook & Onboarding`.

Authority stays split deliberately: repo docs define doctrine and policy drafts, Paperclip owns execution state and closeout proof, Notion keeps the workspace readable, and live systems own their specific facts. Legal, HR, payroll, benefits, confidentiality/IP, and employment-administration material remains draft until counsel/PEO-reviewed systems or signed documents approve it.

## Current Stack

- Frontend: React, Vite, TypeScript, Wouter, TanStack Query, Tailwind-style utility classes, Radix UI, lucide-react, Remotion surfaces.
- Backend: Express, TypeScript, Firebase Admin, Firestore, Stripe and Stripe Connect, Redis for live hosted-session state when configured.
- Runtime and ops: Render deployment, Paperclip autonomous org/control plane, Notion as workspace/review surface, SendGrid/Gmail/Slack integrations where explicitly configured.
- AI/runtime lanes: DeepSeek/OpenAI/Anthropic/ACP-compatible paths modeled in repo code and env; Codex is the default implementation lane.

Do not introduce a new primary service, auth stack, datastore, deployment platform, payment system, or ops record without explicit `blueprint-cto` approval.

## Read First

Before substantial changes, read these in order:

1. [`AGENTS.md`](./AGENTS.md)
2. [`PLATFORM_CONTEXT.md`](./PLATFORM_CONTEXT.md)
3. [`WORLD_MODEL_STRATEGY_CONTEXT.md`](./WORLD_MODEL_STRATEGY_CONTEXT.md)
4. [`AUTONOMOUS_ORG.md`](./AUTONOMOUS_ORG.md)
5. [`DEPLOYMENT.md`](./DEPLOYMENT.md)
6. [`docs/architecture/ai-onboarding-map.md`](./docs/architecture/ai-onboarding-map.md)
7. [`docs/architecture/source-of-truth-map.md`](./docs/architecture/source-of-truth-map.md)
8. [`docs/architecture/command-safety-matrix.md`](./docs/architecture/command-safety-matrix.md)
9. [`docs/architecture/public-display-ready-claims-matrix.md`](./docs/architecture/public-display-ready-claims-matrix.md)
10. [`docs/onboarding/ai-agent-onboarding-runbook.md`](./docs/onboarding/ai-agent-onboarding-runbook.md)
11. [`docs/onboarding/human-new-hire-start-here.md`](./docs/onboarding/human-new-hire-start-here.md)

Use [`graphify-out/GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md) as a structural aid, not as authority.

## Company Handbook & Onboarding

Start here for human and AI onboarding:

- Human new hires: [`docs/onboarding/human-new-hire-start-here.md`](./docs/onboarding/human-new-hire-start-here.md)
- AI agents: [`docs/onboarding/ai-agent-onboarding-runbook.md`](./docs/onboarding/ai-agent-onboarding-runbook.md)
- Managers: [`docs/onboarding/manager-onboarding-checklist.md`](./docs/onboarding/manager-onboarding-checklist.md)
- Role scorecards: [`docs/onboarding/role-scorecards-and-30-60-90.md`](./docs/onboarding/role-scorecards-and-30-60-90.md)
- Notion IA and live audit: [`docs/onboarding/notion-information-architecture.md`](./docs/onboarding/notion-information-architecture.md)

The policy packet lives in [`docs/company/`](./docs/company/). Legal, HR, payroll, benefits, confidentiality/IP, and employment-administration documents are drafts until counsel/PEO review and signed/approved systems say otherwise.

## Repo Map

- `client/src/app/routes.tsx`: public, protected, admin, and legacy route registry.
- `client/src/pages/`: product pages, buyer flows, admin surfaces, hosted-session workspace, account flows.
- `client/src/components/`: shared UI and workflow components.
- `client/src/lib/`: client API helpers, environment access, launch/session helpers, analytics, and product disclosure helpers.
- `client/src/data/`: public content, site-world fixtures, pricing, and marketing definitions.
- `server/index.ts`: Express bootstrap, middleware, rate limits, CSP, static serving.
- `server/routes.ts`: API route composition.
- `server/routes/`: public, admin, internal, marketplace, hosted-session, Stripe, Paperclip, city-launch, and human-reply routes.
- `server/utils/`: business logic, launch/readiness state machines, GTM/city-launch helpers, Paperclip and provider utilities.
- `server/agents/`: autonomous-agent runtime, provider selection, policies, actions, workflows, and closeout contracts.
- `scripts/`: local checks, launch gates, city-launch runners, GTM runners, Paperclip host tooling, graphify refresh, deploy helpers.
- `ops/paperclip/`: Blueprint Paperclip company package, plugin, agent kits, playbooks, reports, and runbooks.
- `docs/company/`: employee handbook and policy packet drafts.
- `docs/onboarding/`: human, manager, AI-agent, role-scorecard, and Notion IA onboarding paths.
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

## Where Not To Look First

- Do not start with `output/`, `ops/paperclip/reports/`, `.tmp/`, `dist/`, `coverage/`, or generated graph files when deciding current product truth.
- Do not treat `ops/paperclip/external/` skill packs as architecture guidance.
- Do not treat Hermes KB, old generated summaries, or graphify output as canonical.
- Do not start with archived docs or historical specs unless the task is explicitly historical.
- Do not infer live readiness from static fixtures or demo flags.

## Truth Boundaries

- Capture truth comes from raw capture bundles, timestamps, poses, device metadata, and provenance.
- Rights, privacy, consent, and commercialization state must remain explicit. Do not invent clearance.
- Hosted-session claims must be backed by session/runtime artifacts, entitlements, and configured runtime paths.
- Buyer claims must distinguish planned profiles, public samples, request-scoped proof, and live pipeline-backed packages.
- Generated images, videos, summaries, graph reports, readiness memos, and AI-authored artifacts are support evidence only. They are not ground truth and must not be presented as capture proof.

When in doubt, prefer current canonical doctrine and live/runtime evidence over older reports or generated summaries.
