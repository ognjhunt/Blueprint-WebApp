# AI Onboarding Map

Date: 2026-05-14

Purpose: fast orientation for a new engineer or agent entering `Blueprint-WebApp` without changing product behavior.

## Product Surface Map

| Surface | Primary files | Responsibility |
|---|---|---|
| Public product and buyer routes | `client/src/app/routes.tsx`, `client/src/pages/Home.tsx`, `client/src/pages/ExactSiteHostedReview.tsx`, `client/src/pages/SiteWorlds.tsx`, `client/src/pages/SiteWorldDetail.tsx`, `client/src/pages/Pricing.tsx`, `client/src/pages/Proof.tsx`, `client/src/pages/Contact.tsx` | Explain and route the buyer workflow for capture-backed site-specific world-model products. |
| Site-world/world-model catalog | `client/src/data/siteWorlds.ts`, `client/src/lib/siteWorldCommercialStatus.ts`, `server/routes/site-worlds.ts`, `server/utils/site-worlds.ts`, `server/routes/admin-site-worlds.ts` | List public samples, planned catalog profiles, request-scoped proof, and pipeline-backed packages without overstating readiness. |
| Hosted sessions | `client/src/pages/HostedSessionSetup.tsx`, `client/src/pages/HostedSessionWorkspace.tsx`, `client/src/lib/hostedSession.ts`, `server/routes/site-world-sessions.ts`, `server/types/hosted-session.ts` | Create, load, proxy, and disclose hosted-session access for site-world packages and demo/runtime paths. |
| Buyer intake and request console | `client/src/pages/Contact.tsx`, `client/src/pages/RequestConsole.tsx`, `client/src/lib/structuredIntake.ts`, `server/routes/inbound-request.ts`, `server/routes/requests.ts`, `server/types/inbound-request.ts` | Capture buyer/site/operator context, persist request state, and expose proof/readiness/preview progress. |
| Admin and ops dashboards | `client/src/pages/AdminLeads.tsx`, `client/src/pages/AdminGrowthStudio.tsx`, `client/src/pages/AdminCompanyMetrics.tsx`, `server/routes/admin-leads.ts`, `server/routes/admin-growth.ts`, `server/routes/admin-company-metrics.ts` | Operate request queues, growth loops, company metrics, and admin review surfaces. |
| Licensing, checkout, entitlement | `client/src/hooks/useStripeCheckout.ts`, `server/routes/marketplace.ts`, `server/routes/marketplace-entitlements.ts`, `server/routes/stripe.ts`, `server/routes/stripe-webhooks.ts`, `server/utils/accounting.ts` | Gate payment, entitlement, Stripe Connect, fulfillment, and accounting behavior. |
| Capture/field supply | `client/src/pages/Capture.tsx`, `client/src/pages/CaptureLaunchAccess.tsx`, `client/src/pages/CapturerSignUpFlow.tsx`, `server/routes/creator.ts`, `server/routes/admin-field-ops.ts`, `server/utils/field-ops-automation.ts` | Route capturer signup, launch access, creator ledgers, and field-ops automation. |
| City-launch and GTM | `client/src/pages/CityLanding.tsx`, `client/src/pages/AdminAustinLaunchScorecard.tsx`, `server/routes/city-launch.ts`, `server/utils/cityLaunch*.ts`, `server/utils/exactSiteHostedReviewGtmPilot.ts`, `scripts/city-launch/`, `scripts/gtm/` | Plan and operate city launch, coverage, outbound, scorecards, and Exact-Site Hosted Review GTM loops. |
| Autonomous org and control plane | `AUTONOMOUS_ORG.md`, `server/agents/`, `ops/paperclip/`, `scripts/paperclip/`, `server/routes/paperclip-relay.ts`, `server/routes/internal-human-blockers.ts`, `server/routes/internal-human-replies.ts` | Keep Paperclip issue/routine state, agent runtime behavior, human gates, and founder-reply durability aligned. |
| Company onboarding and policy | `README.md`, `AGENTS.md`, `docs/onboarding/`, `docs/company/`, `docs/architecture/source-of-truth-map.md`, `docs/architecture/command-safety-matrix.md` | Orient humans and AI agents without creating a competing source of truth. Legal/HR/payroll drafts require counsel/PEO review before operational use. |

## Responsibility Boundaries

- Buyer surfaces describe packages, hosted access, pricing, proof, and request paths.
- Licensing surfaces handle entitlement, checkout, usage boundaries, and Stripe/Stripe Connect interactions.
- Hosted-session surfaces launch and proxy runtime experiences only when entitlement/runtime state supports it.
- Ops surfaces manage inbound requests, capture coordination, readiness review, city launch, GTM, and company metrics.
- Control-plane surfaces keep Paperclip, human blockers, reply ingestion, and agent closeouts accountable to evidence.

`Blueprint-WebApp` should not be treated as the source of raw capture truth or as the world-model generation pipeline. It consumes and exposes those outputs.

## Frontend Entrypoints

- `client/src/main.tsx`: React bootstrap.
- `client/src/app/routes.tsx`: central route registry and legacy redirects.
- `client/src/contexts/AuthContext.tsx`: auth context.
- `client/src/lib/queryClient.ts`: client API/query helper.
- `client/src/lib/client-env.ts`: client environment access.
- `client/src/lib/siteWorldCommercialStatus.ts`: buyer-facing listing disclosure rules.
- `client/src/types/inbound-request.ts` and `client/src/types/hostedSession.ts`: shared client-side contracts.

For new public product work, start at `client/src/app/routes.tsx`, then the target page, then any supporting `client/src/lib/` or `client/src/data/` file.

## Backend Entrypoints

- `server/index.ts`: Express app bootstrap, raw Stripe webhook route, middleware, CSP, rate limits, Vite/static serving.
- `server/routes.ts`: API route registration and auth/CSRF boundaries.
- `server/config/env.ts`: server environment parsing.
- `server/routes/health.ts`: readiness and health checks.
- `server/routes/inbound-request.ts`: buyer/site request intake.
- `server/routes/internal-pipeline.ts`: `BlueprintCapturePipeline` bridge ingestion.
- `server/routes/site-worlds.ts`: public site-world catalog API.
- `server/routes/site-world-sessions.ts`: hosted-session create/read/proxy/runtime handling.
- `server/routes/marketplace.ts`, `server/routes/marketplace-entitlements.ts`, `server/routes/stripe.ts`, `server/routes/stripe-webhooks.ts`: checkout, entitlement, and Stripe flows.
- `server/routes/city-launch.ts`: city-launch API surface.
- `server/agents/runtime.ts`, `server/agents/provider-config.ts`, `server/agents/goal-closeout-contract.ts`: agent runtime behavior and closeout policy.

For route behavior, read `server/routes.ts` first to understand middleware and route ordering before editing the route file itself.

## Paperclip And Autonomous Org Entrypoints

- `AUTONOMOUS_ORG.md`: repo-authoritative org structure and loop doctrine.
- `ops/paperclip/README.md`: local and production Paperclip integration runbook.
- `ops/paperclip/blueprint-company/.paperclip.yaml`: company package config.
- `ops/paperclip/blueprint-company/agents/README.md`: employee-kit contract.
- `ops/paperclip/blueprint-company/agents/*/AGENTS.md`: individual lane instructions.
- `ops/paperclip/plugins/blueprint-automation/src/worker.ts`: high-risk plugin worker with many dispatch paths.
- `scripts/paperclip/verify-blueprint-paperclip.sh`: local verification surface.
- `scripts/paperclip/smoke-blueprint-paperclip-automation.sh`: end-to-end Paperclip automation smoke, high side-effect risk.
- `docs/autonomous-loop-evidence-checklist-2026-05-03.md`: required before autonomous closeout claims.

Treat Paperclip as execution and ownership record. Treat Notion as workspace/review/visibility surface. Treat repo doctrine files as definitional repo truth.

## Human And AI Onboarding Entrypoints

- `docs/onboarding/human-new-hire-start-here.md`: first-screen path for a new human.
- `docs/onboarding/ai-agent-onboarding-runbook.md`: first-screen path for Codex, Claude, Hermes-backed Paperclip agents, Notion agents, and external coding agents.
- `docs/onboarding/manager-onboarding-checklist.md`: manager-owned pre-start, day-one, week-one, 30/60/90 checklist.
- `docs/onboarding/role-scorecards-and-30-60-90.md`: role scorecard and ramp outcome model.
- `docs/onboarding/notion-information-architecture.md`: live Notion audit and target Company Handbook & Onboarding surface.
- `docs/company/employee-handbook.md`: policy packet index and employee handbook draft.

Policy docs in `docs/company/` are repo-canonical drafts. Notion mirrors are for human review and navigation. Signed agreements, payroll/PEO records, and counsel-reviewed plan documents remain the authority for employment terms.

## Graphify Hotspots

Current `graphify-out/GRAPH_REPORT.md` is a structural aid generated from the architecture corpus. It reports:

- top connected nodes around hosted sessions and site-world disclosure: `isPlannedCatalogSiteWorld()`, `updateSession()`, `readFreshHostedSession()`, `isPublicSampleSiteWorld()`, `buildFailureDiagnostic()`, `syncPresentationSessionIndex()`, `createSessionRecord()`, `authorizedJsonFetch()`, `isCommercialExemplarSiteWorld()`, `loadHostedSession()`.
- the densest repeated communities are in `server/routes/site-world-sessions.ts`.
- `client/src/pages/HostedSessionWorkspace.tsx`, `client/src/pages/SiteWorldDetail.tsx`, `client/src/lib/siteWorldCommercialStatus.ts`, `server/routes/site-world-sessions.ts`, and `server/utils/site-worlds.ts` are the main orientation files for hosted access and public world-model disclosure.

Use graphify to find navigation hotspots. Do not use it to decide product truth, launch readiness, or live system state.

## Naming Glossary

- `world model`: public-facing product category for a site-specific model or hosted experience built from real capture evidence.
- `site world`: existing internal naming for many data contracts, routes, IDs, files, and runtime objects. Do not rename internals just because public copy says "world models."
- `site-specific world model package`: pipeline-backed downstream output sold or hosted by WebApp.
- `hosted session`: request/runtime surface for interacting with a site-world/world-model package.
- `Exact-Site Hosted Review`: current wedge for one real site, one workflow lane, one package-plus-hosted-review path.
- `qualification` / `readiness`: optional trust and review layers. Useful, but not the primary product story.
- `provenance`: capture source, timestamps, device metadata, poses, and derivation trail.
- `rights` / `privacy` / `consent`: commercialization and access boundaries. These must be explicit and cannot be inferred from listing existence.
