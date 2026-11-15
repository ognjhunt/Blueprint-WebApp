# AI Onboarding Map

Updated 2026-11-12. Fast orientation for a new engineer or agent. The frame is
the shared block of `PLATFORM_CONTEXT.md`; this map only says where things are.

## Where things are

| Surface | Start here | Responsibility |
|---|---|---|
| Routes | `client/src/app/routes.tsx` | Every public, signed-in and admin route, and the redirects for retired URLs. |
| Site side | `client/src/pages/SelfCaptureUpload.tsx`, `client/src/pages/Home.tsx`, `client/src/pages/HowItWorks.tsx` | Start a job with an email and a video; the job's page shows the first look, the simulation of the site and where the job stands. |
| Deployment companies | `client/src/pages/Partners.tsx` | How a deployment company applies and is approved by hand. |
| Operator | `client/src/pages/AdminJobConsole.tsx`, `server/routes/admin-job-console.ts` | Jobs, approvals and what was sent to whom. |
| Pipeline bridge | `server/routes/internal-pipeline.ts` | Records the Pipeline sends back (simulation, early trial). |
| Legal | `client/src/pages/Terms.tsx`, `client/src/pages/Privacy.tsx`, `client/src/lib/legalAcceptance.ts` | Wording people agreed to. Never edit without a new version and the owner. |
| Consent records | `client/src/lib/jobCardAnswerConsent.ts`, `client/src/lib/recordingRightsStatement.ts`, `client/src/lib/siteStartConsent.ts` | Versioned statements a site accepted. |
| Money controls | `server/utils/agentSpendPolicy.ts`, `server/utils/agentSpendLedger.ts` | Spend limits and their owner approvals. |
| Language-model tasks | `server/agents/runtime.ts`, `server/agents/tasks/` | Prompts and provider selection. |
| Paperclip (retired) | `AUTONOMOUS_ORG.md` | Retirement notice only. |

Pages and routes change often; trust `routes.tsx` over this table.

## Entrypoints

- `client/src/main.tsx`: React bootstrap.
- `server/index.ts`: Express bootstrap, raw Stripe webhook route, middleware, CSP, rate limits, static serving.
- `server/routes.ts`: route registration and auth/CSRF boundaries. Read it before editing a route file.
- `server/config/env.ts`: server environment parsing.
- `server/routes/health.ts`: readiness and health checks.

## Onboarding

- `docs/onboarding/ai-agent-onboarding-runbook.md`: agents.
- `docs/onboarding/human-new-hire-start-here.md`: people.
