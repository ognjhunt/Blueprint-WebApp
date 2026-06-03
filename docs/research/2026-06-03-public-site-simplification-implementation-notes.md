# Public Site Simplification Implementation Notes

Date: 2026-06-03

## Current Audit

- Worktree starts with one untracked goal prompt: `docs/research/2026-06-03-public-site-simplification-goal-master-prompt.md`.
- `client/src/app/routes.tsx`: 67 public-layout routes, 11 protected routes, 17 `MarketingRedirect` references.
- Header primary nav: 7 links (`Readiness`, `Product`, `Robot teams`, `Site packages`, `Capture`, `Proof`, `Pricing`).
- Footer: 10 product links, 6 company links, 4 support links.
- `scripts/prerender.tsx`: 34 static route entries before dynamic help/site expansion.
- `server/utils/public-artifacts.ts`: 23 static sitemap routes before help/site expansion.
- Large public pages: `Home.tsx` 1106 lines, `Pricing.tsx` 655, `Proof.tsx` 628, `ReadinessPack.tsx` 575, `ExactSiteHostedReview.tsx` 507, `SiteWorlds.tsx` 999.

## Target IA

- Primary buyer story lives at `/` with anchors: `#how-it-works`, `#pricing`, `#proof`, `#request`.
- Keep direct public routes: `/pricing`, `/contact`, `/proof`, `/privacy`, `/terms`.
- Keep direct operational/auth/request routes reachable but hidden/noindex where applicable.
- Hide or redirect secondary marketing routes from primary nav, footer, sitemap, prerender, and machine-readable site-content unless they serve a direct operational path.

## Route Decisions

- Header: `How it works`, `Pricing`, `Proof`, plus `Request readiness review` CTA.
- Footer: compact product/contact/legal columns only.
- Keep `/pricing` as a short planning-range page with three packages.
- Keep `/proof` as a short sample-vs-request proof explainer.
- Redirect secondary marketing pages such as `/readiness`, `/product`, `/for-robot-teams`, `/how-it-works`, `/world-models`, `/agents`, `/capture`, `/sample-deliverables`, `/launch-map`, `/faq`, `/governance`, `/about`, `/updates`, `/careers`, and `/help` toward `/`, `/#how-it-works`, `/#proof`, `/pricing`, or `/contact` as appropriate.
- Keep `/contact/site-operator`, `/capture-app/launch-access`, auth, signup, request console, and hosted-session URLs reachable as direct flows, but not in primary marketing exposure.

## Copy And Asset Decisions

- Core headline: `Know what breaks before the robot pilot.`
- Core buyer question: one real facility, one task suite, one robot profile, one threshold set.
- Use existing generated humanoid readiness assets from `client/public/generated/humanoid-readiness-2026-06-03/`.
- No new generated imagery unless existing assets fail browser verification.
- Proof language stays Public Launch Ready while blocking operational claims about deployment readiness, safety validation, provider runs, rights clearance, payment, fulfillment, or real customers.

## Planned Verification

- Targeted page tests for `Home`, `Pricing`, and `Proof`.
- Route/sitemap/prerender/static output tests discovered by search.
- `npm run check`.
- `npm run build`.
- Local browser verification for `/`, `/pricing`, `/contact?persona=robot-team`, and `/proof` at desktop and mobile.
- `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz` after code changes.

## Implemented Changes

- Rebuilt `/` as the single public buyer story around one real facility, one robot task, one pass bar, workflow, pricing preview, proof boundary, and request CTA.
- Rebuilt `/pricing` as three planning ranges: Site/Task Readiness Review, Hosted Evaluation, and Custom Multi-Site Benchmark.
- Rebuilt `/proof` as a short sample-vs-request proof explainer with evidence hierarchy and claim boundary.
- Reduced header nav to `How it works`, `Pricing`, `Proof`, plus `Request readiness`.
- Reduced footer to product, contact, and legal links.
- Redirected or hid secondary marketing routes from primary exposure: product/readiness/robot-team/world-model/agent/capture/sample/help/company/update/career routes no longer lead public IA.
- Kept direct operational/access routes reachable: `/contact`, `/contact/site-operator`, `/capture-app/launch-access`, auth/signup, request console, and hosted-session start/workspace.
- Simplified `scripts/prerender.tsx`, `server/utils/public-artifacts.ts`, `/api/site-content`, `llms.txt`, and `llms-full.txt` to the KISS public route set.

## Verification Results

- `npx vitest run client/tests/pages/Home.test.tsx client/tests/pages/Pricing.test.tsx client/tests/pages/Proof.test.tsx client/tests/components/site/Header.test.tsx client/tests/pages/Routes.test.ts server/tests/site-content-route.test.ts` passed: 17 tests.
- `npm run check` passed.
- `npm run build` passed.
- `npx vitest run client/tests/build-output.test.ts` passed: 6 tests.
- `BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER=1 npx playwright test e2e/home.spec.ts e2e/redirects.spec.ts e2e/world-models.spec.ts e2e/checkout.spec.ts --reporter=line` passed: 9 tests.
- Browser QA passed for `/`, `/pricing`, `/contact?persona=robot-team`, and `/proof` at 1440x1000 and 390x844: no horizontal overflow, no missing required text, no broken images.
- Browser artifacts: `output/playwright/public-site-kiss-2026-06-03/summary.json`, `summary.md`, and route screenshots.
- Old-route alias check passed locally: `/product -> /`, `/readiness -> /`, `/world-models -> /proof`, `/agents -> /contact`, `/capture -> /capture-app/launch-access`, `/help/article/choose-the-right-path -> /contact`.
