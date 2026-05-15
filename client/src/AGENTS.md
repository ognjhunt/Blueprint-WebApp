# Client Agent Guide

This directory owns the React/Vite frontend for public product pages, hosted sessions, buyer flows, auth/account screens, and admin dashboards.

Read root [`AGENTS.md`](../../AGENTS.md), [`PLATFORM_CONTEXT.md`](../../PLATFORM_CONTEXT.md), and [`WORLD_MODEL_STRATEGY_CONTEXT.md`](../../WORLD_MODEL_STRATEGY_CONTEXT.md) before changing product meaning.

Agent discovery: use this file for `client/src/**` details, but root `AGENTS.md`, `docs/architecture/source-of-truth-map.md`, `docs/architecture/public-display-ready-claims-matrix.md`, and `docs/architecture/command-safety-matrix.md` still govern doctrine and command safety.

Local conventions:

- Start route work in `client/src/app/routes.tsx`.
- Keep public copy capture-first and world-model-product-first. Readiness, qualification, and review language should support the buyer workflow, not lead it.
- Treat Public Display Ready and Operational Launch Ready as separate standards. Public routes may look complete, confident, present-tense, and launch-quality even when live backend, provider, city-launch, rights, payment, payout, hosted-session, fulfillment, or support proof remains request-specific.
- Before making a public page sound smaller or unfinished, ask: "does this sentence invent a specific unsupported fact?" If not, polish the product experience instead of turning operational incompleteness into first-screen apology copy.
- Qualify or block only the specific unsupported fact: live availability, customer proof, active supply, cleared rights, payment or payout success, provider execution, city coverage, package access already open, hosted-session fulfillment, or guaranteed support/launch outcome.
- Move sample, request-gated, not-customer-proof, rights, and hosted-availability caveats into proof/detail sections unless the first-screen claim itself would otherwise be false.
- Public `/world-models` routes may still use `siteWorld` internals. Do not rename internal contracts just to match public copy.
- Use `client/src/lib/siteWorldCommercialStatus.ts` for public listing disclosure patterns.
- Do not present planned profiles, demo samples, generated media, or request-scoped proof as cleared supply or launch guarantees.
- Keep secrets out of client code; use `client/src/lib/client-env.ts` for allowed client env access.

Verification:

- Type or shared contract changes: `npm run check`.
- Public asset changes: `npm run audit:assets`.
- User-flow or route changes: targeted component/browser checks first; use `npm run test:e2e` when the route behavior needs browser proof.
