# Inventory

First-principles audit, 2026-11-22. The map the audit hunted over: every route,
screen state, email, API route, timer, provider, flag, admin page and
collection in the WebApp, and every stage, unit, provider, config and door
request in the Pipeline. Each row carries its owner (an owner direction, a
doctrine line, a guard, or nobody), its last change, its test, and whether it
is reachable in production.

Built from the code, not from documents, on WebApp commit `0ee5df6` (the live
site) and Pipeline `7d8b532` (the control plane ran `cbff06b`).

| | WebApp | Pipeline |
|---|---|---|
| Size | 25 page routes and 124 redirects, about 146 screen states, 20 kinds of email, 176 API routes, 14 timers, 21 external services, 249 environment names, 78 collections | 1,621 modules (715,431 lines), 72 shipped unit files, 11 units that move a website job |
| Not needed by the core loop | 35 API routes with no caller; about 9,000 lines that never run; about 10,500 lines of the dropped trial | imports from the website job path reach 81% of the package; 59 import edges into trial code; 206 dead failed units on the host |

Findings that came out of the inventory are in `findings.md` with ids `IW-` and
`IP-`.

## Part 1: Blueprint-WebApp

Audit date 2026-11-22. Repository `Blueprint-WebApp` at commit `0ee5df63` (2026-11-21), the commit the live site runs.
This is the map the later audit phases hunt over. Every list below was derived from the code, then cross-checked.
Findings that were already clear while mapping are in `inventory-webapp.findings.json` (ids `IW-xx`).

### How this was built

- Client routes: parsed `client/src/app/routes.tsx` and `client/src/data/minimalPublicSite.ts`.
- API routes: parsed every `router.<method>(...)` in `server/routes/*.ts`, joined to the mount prefixes in `server/routes.ts`. Nested routers (`account-deletion-admin.ts`, `owned-capture-atlas.ts`) were added by hand.
- Callers: every `/api/...` string in `client/src`, the Pipeline repo, `scripts/` and `e2e/`, matched against each route pattern. Routes with no literal match were then searched by their last path word in client, Pipeline (non-test) and server code. A route marked `NONE found` had no hit in any of them.
- Reachability: a scratch import-graph script from the three entry points `client/src/main.tsx`, `server/index.ts` and `server/worker.ts`, resolving relative and `@/` imports. It was run twice: counting every import, and counting only runtime imports (`import type` ignored, since TypeScript erases it). Scripts: scratchpad `agents/inventory-webapp/reach.mjs` and `reach_rt.mjs`.
- Last change: `git log -1 --format=%cs -- <path>` per file.
- Production: the live site runs this commit. Server env values are managed in the Render dashboard and are not in the repo, so a flag's production value is `unknown` unless `render.yaml` sets it.
- Production counts: aggregate document counts from the orchestrator's read-only baseline (`scratchpad/baseline/firestore-collection-counts.json`). No document content was read.

Owner column: an owner direction or doctrine line quoted from a code comment near the thing, a guard, or `nobody found`. Most server routes carry no owner line (157 of 170).

### 1. Client routes

The router (`client/src/main.tsx` -> `appRoutes`) has **150 entries**: 25 routes that render a page component, 1 fallback (404), and 124 redirect routes (69 in `routes.tsx`, 55 from `minimalMarketingRedirects`).
The server keeps a second, overlapping list of 301 redirects in `server/index.ts` (`legacyPublicRedirects`, about 50 entries) and serves the SPA for every pattern in `appRoutePatterns()`.

#### 1a. Routes that render a page

| Path | Component | Shell | Who can reach it | Screen states | Last change | Test | Live |
|---|---|---|---|---|---|---|---|
| `/` | Home.tsx; PilotPreview.tsx | site | public | 1 static screen, plus cookie banner and legal-update banner overlays | 2026-11-20 | e2e/home.spec.ts, e2e/site-led-public.spec.ts | yes |
| `/how-it-works` | HowItWorks.tsx | site | public | 1 static | 2026-11-20 | e2e/site-led-public.spec.ts | yes |
| `/jobs` | Partners.tsx; PartnerApplication.tsx; SampleJob.tsx | site | public (deployment company prospect) | application form: idle, sending, saved, error (PartnerApplication.tsx:15); native required-field errors; sample job tabs | 2026-11-20 | e2e/onboarding-p1.spec.ts | yes |
| `/partners` | Partners.tsx (same as /jobs) | site | public | same as /jobs | 2026-11-20 | e2e/redirects.spec.ts | yes |
| `/beta` | Beta.tsx | site | public | 1 static (Questions page) | 2026-11-20 | e2e/pricing.spec.ts | yes |
| `/capture-upload/:token` | SelfCaptureUpload.tsx (1291 lines); SiteAnswer.tsx; TaskBriefReview.tsx; OwnerRecordingWithdrawal.tsx | bare | site (signed private link, no account) | link: checking, invalid, held (holdReason site_account_required, footage_before_account, recording_consent_withdrawn), valid. Upload: idle, uploading, failed, processing_pending, held, done. Brief unconfirmed. Outlook phase (jobOutlook.ts:5): reading, building, testing, result, no_test, ended_by_site, waiting_on_site, with 20 reasons (jobOutlook.ts:8-13). First look: ready, cannot_assess. Responses: none yet, sent to N, replies, introducible, already introduced, introduction cancelled/failed. Settings: change description, stop using my video, withdraw. About 40 distinct screens. | 2026-11-20 | e2e/site-answer.spec.ts, e2e/site-answer-journey.spec.ts, e2e/site-private-link-reliability.spec.ts | yes |
| `/job-outcome/thanks` | JobOutcomeThanks.tsx | bare | anyone with an outcome email link | answer={state}, already={state}, plain Thanks (3) | 2026-11-12 | e2e/job-outcomes.spec.ts | yes |
| `/claim/:token` | ClaimSite.tsx | bare | site (signed claim link) | loading, invalid, ready (create or sign-in mode), verify, claimed (5) | 2026-11-20 | none found in e2e; client/tests unverified | yes |
| `/contact/robot-team` | Contact.tsx; TaskBrowse.tsx; RobotTeamEarlyAccess.tsx | site | public apply view; signed-in deployment company library | signed-out apply; library loading, ready, error, terms (TaskBrowse.tsx:19); access applied, approved, approved-unverified, declined, staff; empty; search no match; past view (about 12) | 2026-11-20 | e2e/onboarding-p1.spec.ts, e2e/job-companies.spec.ts (qa:operator only) | yes |
| `/jobs/:jobId` | CompanyJob.tsx | bare | deployment company (approved; server decides) | loading, ready, missing (404 with access applied/approved/none), signed_out, error, terms (CompanyJob.tsx:58); simulation not ready / ready; answer none, interested, not a fit, need more details, tested can do / cannot yet (about 12) | 2026-11-20 | e2e/job-companies.spec.ts (qa:operator only); client/tests/pages/CompanyJob.test.tsx | yes |
| `/contact/site-operator` | Contact.tsx; SiteCaptureStart.tsx; CaptureRecorder.tsx; FilmLinkHandoff.tsx | site | public (site start) | idle, working, done (desktop QR handoff or phone recorder) (SiteCaptureStart.tsx:53); details open; file chosen; validation errors; lost first send recovered; signed-in site; signed-in non-site; staff (about 10) | 2026-11-20 | e2e/contact.spec.ts, e2e/description-first-intake.spec.ts, e2e/site-intake-*.spec.ts | yes |
| `/sign-in` | Login.tsx | bare | public | fresh, field errors, auth error, Google unavailable, returnTo (about 5) | 2026-11-20 | e2e/login.spec.ts | yes |
| `/signup` | BusinessSignUpFlow.tsx -> RobotTeamSignUpFlow.tsx or redirect to /contact/site-operator | bare | public | site: redirect; invitation valid, invitation expired/revoked, no invitation (4) | 2026-11-11 | e2e/signup-simple.spec.ts, e2e/onboarding.spec.ts | yes |
| `/signup/business` | BusinessSignUpFlow.tsx | bare | public | same as /signup | 2026-11-11 | e2e/signup-simple.spec.ts | yes |
| `/onboarding` | OnboardingChecklist.tsx (36 lines) | bare | signed-in (ProtectedRoute) | one loading line, then forwards to /app or the job library (retired checklist, AuthContext.tsx:318) | 2026-11-20 | e2e/onboarding.spec.ts | yes |
| `/forgot-password` | ForgotPassword.tsx | bare | public | fresh, sending, submitted (3) | 2026-10-09 | none found | yes |
| `/privacy` | Privacy.tsx | site | public | 1 static | 2026-11-20 | e2e/privacy-pages.spec.ts | yes |
| `/terms` | Terms.tsx | site | public | 1 static | 2026-11-20 | e2e/pricing.spec.ts | yes |
| `/privacy/previous` | PrivacyPrevious.tsx | site | public | 1 static | 2026-11-20 | e2e/site-led-public.spec.ts | yes |
| `/terms/previous` | TermsPrevious.tsx | site | public | 1 static | 2026-11-20 | e2e/site-led-public.spec.ts | yes |
| `/settings` | workspace/Settings.tsx; UpdatePreferencesForm.tsx; AccountDeletion.tsx | bare | signed-in (site or company) (ProtectedRoute) | site, company, setup=1 (change type), privacy=1 (deletion), verify-email prompt, save failed (about 6) | 2026-11-20 | e2e/workspace-account-setup.spec.ts, e2e/account-deletion.spec.ts | yes |
| `/admin/robot-team-access` | AdminRobotTeamAccess.tsx | site | admin/ops role (requireRoles ADMIN_ROLES = admin, ops) | applications list, approve/decline, invite form; invitation idle, sending, queued, sent, needs_attention, error (AdminRobotTeamAccess.tsx:86); reviewed job recommendation lookup (about 8) | 2026-11-19 | client/tests/admin-team-invitation-status.test.tsx | yes |
| `/admin/jobs` | AdminJobConsole.tsx; components/admin/*.tsx | bare | admin/ops role (requireRoles ADMIN_ROLES = admin, ops) | job list; job detail (?job=); workflow evidence panel; companies console (sends, responses, hold); robot fit console; site measurements console; account deletion queue (about 7) | 2026-11-17 | e2e/job-companies.spec.ts (qa:operator only) | yes |
| `/app` | workspace/Overview.tsx | bare | signed-in (site or company) (ProtectedRoute) | setup required, site with jobs, site no jobs, withdrawn job, company, verify email (about 6) | 2026-11-20 | e2e/workspace-account-setup.spec.ts | yes |
| `/app/captures` | app/Captures.tsx (655 lines) | bare | admin/ops role (requireRoles ADMIN_ROLES = admin, ops) | capture list; upload progress; upload received; 3D scene plan/authorize/execute with states active, authorization_required, authorized, capture_accepted, completed, failed, not_planned, partial, rejected_or_recapture_required, validating, revoked (about 12) | 2026-11-14 | none found | yes |
| (fallback) | NotFound.tsx | bare | anyone | 1 static | 2026-11-20 | e2e/redirects.spec.ts | yes |

Page components on disk that no route renders: `PrivacyAnnounced`, `PrivacyEarlier`, `PrivacyFormer`, `PrivacyOlder`, `PrivacyPrior`, `TermsAnnounced`, `TermsEarlier`, `TermsFormer`, `TermsOlder`, `TermsPrior` (10 files, 2,586 lines). They are frozen legal texts pinned by hash in `client/src/lib/legalAcceptance.ts:249-260` (guard: legal record of what earlier users accepted). Keep; they are not dead by accident.

#### 1b. Redirect routes

All public. Each renders `MarketingRedirect` (client) and most also have a server 301. Grouped by the retired system they serve.

| Path | Target | Defined in | Retired system it serves | Test |
|---|---|---|---|---|
| `/launch-map` | `/contact/site-operator` | routes.tsx:213 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | client/tests/lib/canvasSurface.test.ts |
| `/capture` | `/contact/site-operator` | routes.tsx:216 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | client/tests/lib/canvasSurface.test.ts |
| `/capture-app` | `/contact/site-operator` | routes.tsx:222 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | client/tests/lib/canvasSurface.test.ts |
| `/capture-app/account` | `/contact/site-operator` | routes.tsx:223 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | client/tests/lib/canvasSurface.test.ts |
| `/capture-app/launch-access` | `/contact/site-operator` | routes.tsx:224 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | none found |
| `/capture-jobs` | `/contact/site-operator` | routes.tsx:225 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | none found |
| `/capture-network` | `/contact/site-operator` | routes.tsx:226 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | none found |
| `/capturer` | `/contact/site-operator` | routes.tsx:227 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | client/tests/build-output.test.ts |
| `/capturers` | `/contact/site-operator` | routes.tsx:228 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | none found |
| `/capturer-access` | `/contact/site-operator` | routes.tsx:229 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | none found |
| `/become-a-capturer` | `/contact/site-operator` | routes.tsx:230 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | none found |
| `/for-capturers` | `/contact/site-operator` | routes.tsx:231 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | none found |
| `/earn` | `/contact/site-operator` | routes.tsx:232 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | none found |
| `/city/:citySlug` | `/contact/site-operator or /contact/robot-team (by ?persona)` | routes.tsx:235 | old marketing URL | none found |
| `/world-models` | `/partners` | routes.tsx:238 | marketplace / world-model pages | client/tests/build-output.test.ts |
| `/world-models/:slug` | `/partners` | routes.tsx:239 | marketplace / world-model pages | client/tests/build-output.test.ts |
| `/world-models/:slug/start` | `/partners` | routes.tsx:240 | marketplace / world-model pages | client/tests/build-output.test.ts |
| `/world-models/:slug/workspace` | `/partners` | routes.tsx:241 | marketplace / world-model pages | client/tests/build-output.test.ts |
| `/site-worlds` | `/partners` | routes.tsx:244 | marketplace / world-model pages | client/tests/pages/CompanyJob.test.tsx |
| `/site-worlds/:slug` | `/partners` | routes.tsx:245 | marketplace / world-model pages | client/tests/pages/CompanyJob.test.tsx |
| `/site-worlds/:slug/start` | `/partners` | routes.tsx:246 | marketplace / world-model pages | client/tests/pages/CompanyJob.test.tsx |
| `/site-worlds/:slug/workspace` | `/partners` | routes.tsx:247 | marketplace / world-model pages | client/tests/pages/CompanyJob.test.tsx |
| `/for-robot-integrators` | `/partners` | routes.tsx:250 | old marketing URL | none found |
| `/product` | `/#how-it-works` | routes.tsx:253 | old marketing URL | none found |
| `/readiness` | `/#how-it-works` | routes.tsx:254 | retired operator or buyer review pages | client/tests/pages/SelfCaptureUpload.test.tsx |
| `/readiness-pack` | `/#how-it-works` | routes.tsx:255 | retired operator or buyer review pages | none found |
| `/agents` | `/contact/site-operator or /contact/robot-team (by ?persona)` | routes.tsx:256 | old marketing URL | none found |
| `/policy-shortlist` | `/beta` | routes.tsx:257 | early trial / paid evaluations | e2e/redirects.spec.ts |
| `/robot-match` | `/beta` | routes.tsx:258 | early trial / paid evaluations | e2e/redirects.spec.ts |
| `/policy-improvement-run` | `/beta` | routes.tsx:259 | early trial / paid evaluations | e2e/redirects.spec.ts |
| `/post-training-data-package` | `/beta` | routes.tsx:260 | early trial / paid evaluations | e2e/redirects.spec.ts |
| `/post-training-policy-improvement-package` | `/beta` | routes.tsx:261 | early trial / paid evaluations | e2e/redirects.spec.ts |
| `/data-packages` | `/beta` | routes.tsx:262 | early trial / paid evaluations | e2e/pricing.spec.ts |
| `/sample-evaluation` | `/#how-it-works` | routes.tsx:263 | early trial / paid evaluations | e2e/redirects.spec.ts |
| `/sample-deliverables` | `/#how-it-works` | routes.tsx:264 | old marketing URL | none found |
| `/case-studies` | `/#how-it-works` | routes.tsx:265 | old marketing URL | client/tests/fixtures/siteAnswer.ts |
| `/contact` | `/contact/site-operator or /contact/robot-team (by ?persona)` | routes.tsx:266 | old marketing URL | client/tests/analytics.test.ts |
| `/help` | `/contact/site-operator` | routes.tsx:271 | old marketing URL | e2e/redirects.spec.ts |
| `/help/contact` | `/contact/site-operator` | routes.tsx:272 | old marketing URL | none found |
| `/help/category/:categorySlug` | `/contact/site-operator` | routes.tsx:273 | old marketing URL | none found |
| `/help/article/:articleSlug` | `/contact/site-operator` | routes.tsx:274 | old marketing URL | none found |
| `/exact-site-hosted-review` | `/#how-it-works` | routes.tsx:275 | early trial / paid evaluations | none found |
| `/book-exact-site-review` | `/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=task-evaluation-run&source=book-exact-site-review` | routes.tsx:276 | early trial / paid evaluations | none found |
| `/docs` | `/#how-it-works` | routes.tsx:277 | old marketing URL | client/tests/lib/siteCaptureDraft.reliability.test.ts |
| `/updates` | `/` | routes.tsx:278 | old marketing URL | none found |
| `/blog` | `/` | routes.tsx:279 | old marketing URL | client/tests/fixtures/siteAnswer.ts |
| `/careers` | `/contact/site-operator or /contact/robot-team (by ?persona)` | routes.tsx:280 | old marketing URL | none found |
| `/solutions` | `/#how-it-works` | routes.tsx:283 | old marketing URL | none found |
| `/quality-standard` | `/#how-it-works` | routes.tsx:284 | old marketing URL | none found |
| `/qualified-opportunities` | `/#how-it-works` | routes.tsx:285 | marketplace / world-model pages | none found |
| `/qualified-opportunities-guide` | `/#how-it-works` | routes.tsx:286 | marketplace / world-model pages | none found |
| `/pilot-exchange` | `/#how-it-works` | routes.tsx:289 | old marketing URL | none found |
| `/pilot-exchange-guide` | `/#how-it-works` | routes.tsx:290 | old marketing URL | none found |
| `/environments` | `/#how-it-works` | routes.tsx:291 | old marketing URL | e2e/redirects.spec.ts |
| `/marketplace` | `/partners` | routes.tsx:292 | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/portal` | `/sign-in` | routes.tsx:295 | old marketing URL | none found |
| `/login` | `/sign-in` | routes.tsx:297 | old marketing URL | none found |
| `/signup/robot-team` | `/signup/business?buyerType=robot_team&source=signup-route` | routes.tsx:300 | old signup / onboarding | none found |
| `/signup/site-operator` | `/signup/business?buyerType=site_operator&source=signup-route` | routes.tsx:301 | old signup / onboarding | none found |
| `/signup/capturer` | `/contact/site-operator` | routes.tsx:302 | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | none found |
| `/admin/leads` | `/admin/jobs?job=:requestId` | routes.tsx:315 | old marketing URL | client/tests/lib/canvasSurface.test.ts |
| `/admin/leads/:requestId` | `/admin/jobs?job=:requestId` | routes.tsx:316 | old marketing URL | client/tests/lib/canvasSurface.test.ts |
| `/ops` | `/admin/jobs?job=:requestId` | routes.tsx:317 | retired operator or buyer review pages | client/tests/lib/canvasSurface.test.ts |
| `/ops/supply` | `/admin/jobs?job=:requestId` | routes.tsx:318 | retired operator or buyer review pages | client/tests/pages/Routes.test.ts |
| `/ops/evidence` | `/admin/jobs?job=:requestId` | routes.tsx:319 | retired operator or buyer review pages | client/tests/pages/Routes.test.ts |
| `/ops/handoff` | `/admin/jobs?job=:requestId` | routes.tsx:320 | retired operator or buyer review pages | client/tests/pages/Routes.test.ts |
| `/dashboard` | `/app` | routes.tsx:323 | old signup / onboarding | none found |
| `/join` | `/signup/business` | routes.tsx:330 | old signup / onboarding | none found |
| `/off-waitlist-signup` | `/signup/business` | routes.tsx:324 | old signup / onboarding | none found |
| `/pricing` | `/beta` | minimalPublicSite.ts | pricing / refunds | client/tests/contexts/AuthProviderFirebaseLoad.test.tsx |
| `/for-site-operators` | `/contact/site-operator` | minimalPublicSite.ts | old marketing URL | none found |
| `/for-robot-teams` | `/contact/robot-team` | minimalPublicSite.ts | old marketing URL | e2e/site-led-public.spec.ts |
| `/robot-team/eval` | `/contact/robot-team` | minimalPublicSite.ts | old marketing URL | none found |
| `/vision` | `/` | minimalPublicSite.ts | old marketing URL | e2e/site-led-public.spec.ts |
| `/faq` | `/beta` | minimalPublicSite.ts | old marketing URL | e2e/redirects.spec.ts |
| `/proof` | `/#how-it-works` | minimalPublicSite.ts | old marketing URL | none found |
| `/governance` | `/privacy` | minimalPublicSite.ts | old marketing URL | e2e/site-led-public.spec.ts |
| `/capture-visit` | `/contact/site-operator` | minimalPublicSite.ts | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | none found |
| `/site-task` | `/contact/site-operator` | minimalPublicSite.ts | old marketing URL | none found |
| `/robot-intake` | `/contact/robot-team` | minimalPublicSite.ts | old marketing URL | none found |
| `/beta/capturer-guide` | `/contact/site-operator` | minimalPublicSite.ts | capture app / outside capturers / filming visits (routes.tsx:206 comment, 2026-11-11) | e2e/redirects.spec.ts |
| `/jobs-we-support` | `/how-it-works` | minimalPublicSite.ts | old marketing URL | e2e/redirects.spec.ts |
| `/about` | `/beta#who-we-are` | minimalPublicSite.ts | old marketing URL | e2e/redirects.spec.ts |
| `/internal/opportunity-board` | `/` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/internal/opportunity-board/:id` | `/` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/internal/opportunity-board/:id/anonymous` | `/` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/internal/opportunity-board/:id/package` | `/` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/internal/opportunity-board/:id/offer` | `/` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/internal/opportunity-board/:id/offers` | `/` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/partners/deployment` | `/partners` | minimalPublicSite.ts | old marketing URL | e2e/redirects.spec.ts |
| `/partners/technology` | `/partners` | minimalPublicSite.ts | old marketing URL | e2e/redirects.spec.ts |
| `/sites` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/sites/:slug` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/beta/buyer-guide` | `/partners` | minimalPublicSite.ts | old marketing URL | e2e/redirects.spec.ts |
| `/requests/:requestId` | `/` | minimalPublicSite.ts | retired operator or buyer review pages | none found |
| `/requests/:requestId/evidence` | `/` | minimalPublicSite.ts | retired operator or buyer review pages | none found |
| `/requests/:requestId/qualification` | `/` | minimalPublicSite.ts | retired operator or buyer review pages | none found |
| `/requests/:requestId/preview` | `/` | minimalPublicSite.ts | retired operator or buyer review pages | none found |
| `/app/history` | `/` | minimalPublicSite.ts | old marketing URL | e2e/redirects.spec.ts |
| `/app/library` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/app/opportunities` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | none found |
| `/app/opportunities/:opportunityId` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | none found |
| `/app/evaluations/:evaluationId` | `/partners` | minimalPublicSite.ts | early trial / paid evaluations | none found |
| `/app/runs` | `/partners` | minimalPublicSite.ts | early trial / paid evaluations | client/tests/lib/authReturnPath.test.ts |
| `/app/runs/new` | `/partners` | minimalPublicSite.ts | early trial / paid evaluations | e2e/redirects.spec.ts |
| `/app/advanced/runs/new` | `/partners` | minimalPublicSite.ts | early trial / paid evaluations | e2e/redirects.spec.ts |
| `/app/runs/:runId` | `/partners` | minimalPublicSite.ts | early trial / paid evaluations | client/tests/lib/authReturnPath.test.ts |
| `/app/runs/:runId/policy-candidate/new` | `/partners` | minimalPublicSite.ts | early trial / paid evaluations | client/tests/lib/authReturnPath.test.ts |
| `/app/packs` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/app/packs/policy-packet` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/app/packs/:sourceLaunchId/evaluate` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/app/packs/:sourceLaunchId/policy-canary` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/app/packs/:siteId` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/app/policies` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | none found |
| `/app/data` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | none found |
| `/app/entitlements` | `/partners` | minimalPublicSite.ts | marketplace / world-model pages | e2e/redirects.spec.ts |
| `/admin/company-metrics` | `/` | minimalPublicSite.ts | retired operator or buyer review pages | e2e/redirects.spec.ts |
| `/ops/spend` | `/` | minimalPublicSite.ts | retired operator or buyer review pages | client/tests/lib/canvasSurface.test.ts |
| `/internal/design-system` | `/` | minimalPublicSite.ts | retired operator or buyer review pages | client/tests/lib/canvasSurface.test.ts |
| `/app/tasks` | `/app` | minimalPublicSite.ts | old marketing URL | e2e/redirects.spec.ts |
| `/app/tasks/new` | `/contact/site-operator` | minimalPublicSite.ts | old marketing URL | none found |
| `/app/tasks/:taskId` | `/app` | minimalPublicSite.ts | old marketing URL | e2e/redirects.spec.ts |
| `/readiness-brief/:briefToken` | `/` | minimalPublicSite.ts | retired operator or buyer review pages | none found |
| `/refunds` | `/terms` | minimalPublicSite.ts | pricing / refunds | e2e/privacy-pages.spec.ts |

#### 1c. Cross-check against `docs/qa/launch-copy-audit/inventory.md`

That file lists 95 captured screens (96 table rows; one row is `llms.txt`). Every page route above has at least one captured screen except four: `/admin/jobs` and `/admin/robot-team-access` (staff pages, outside its customer scope), `/signup` (only `/signup/business` was captured; same component) and `/partners` (same component as `/jobs`). No recording state of `/capture-upload/:token` was captured (camera blocked).
It also lists two things the code no longer matches:
- `/onboarding` 'reachable from header Finish onboarding when onboarding unfinished'. Since 2026-11-20 the page only forwards (`client/src/contexts/AuthContext.tsx:318`) and no component links `/onboarding` (grep of `client/src` finds only the route and the AuthContext pattern).
- `/refunds` is listed as a screen. It is now a redirect to `/terms` (`client/src/data/minimalPublicSite.ts:66`, owner 2026-11-21).

#### 1d. Screens and states

Counting each page route's distinct states from the table above (approximate where marked 'about'): Home 1, How it works 1, Find jobs 4, Questions 1, site job page about 40, outcome thanks 3, claim 5, company library about 12, site start about 10, company job page about 12, sign-in 5, signup 4, onboarding 1, forgot password 3, legal 4, settings 6, admin access 8, admin jobs 7, your jobs 6, captures 12, 404 1. **About 146 states across 23 distinct page components.** The site job page alone holds over a quarter of them.

### 2. Emails

Transport: `server/utils/email.ts` `sendEmail` via Resend (`RESEND_API_KEY`). Customer emails use `CUSTOMER_JOB_EMAIL_IDENTITY` (`server/utils/emailLayout.ts:26`): from `hello@tryblueprint.io` (name `Blueprint`), Reply-To `hello@tryblueprint.io`.
Outbox emails are written to Firestore `captureOutbox` and delivered by the outbox pump in the **web** process every 60 s (`server/utils/captureOutbox.ts:614`, `server/index.ts:530`). The kinds list was cut from 43 to 13 by the owner on 2026-11-19 (`captureOutbox.ts:58`); 37 retired kinds are cancelled at dispatch (`captureOutbox.ts:126`).

| # | Email (kind / subject) | Builder | Trigger | Started by | Recipient | Can turn off | Owner | Last change | Test | Live |
|---|---|---|---|---|---|---|---|---|---|---|
| E1 | task_received | taskLifecycleNotifications.ts | site submits a job with a video | person (site) | site contact | no (transactional) | owner 2026-11-19 (captureOutbox.ts:64) | see builder | server/tests/*task-lifecycle* | yes (if RESEND_API_KEY set) |
| E2 | fresh_link | site-task-brief.ts:924 | site asks for a new private link from an expired one | person (site) | site contact | no | captureOutbox.ts:66 | see builder | server/tests (unverified) | yes (if RESEND_API_KEY set) |
| E3 | job_sent | jobAutoSend.ts / jobCompanies.ts:318 | job goes to approved companies (auto-send sweep) | timer (worker, 60 s) | site contact | no | package E, E4 (captureOutbox.ts:68) | see builder | server/tests job-auto-send (unverified name) | yes (if RESEND_API_KEY set) |
| E4 | company_answered | jobCompanies.ts | a company answers Interested / Not a fit / Need more details / Tested | person (company) or admin recording an emailed answer | site contact | no | captureOutbox.ts:70 | see builder | e2e/job-companies.spec.ts | yes (if RESEND_API_KEY set) |
| E5 | introduction_made_site | jobIntroductions.ts / jobIntroductionGate.ts | site presses Introduce us; held until company email sent | person (site) | site contact | no | package E, E6 | see builder | server/tests (introductions) | yes (if RESEND_API_KEY set) |
| E6 | introduction_made_company | jobIntroductionGate.ts | same press | person (site) | company contact | no | package E, E6 | see builder | server/tests (introductions) | yes (if RESEND_API_KEY set) |
| E7 | site_action_needed | siteActionNeeded.ts:143 | job cannot continue without the site (new video, sentence) | system (Pipeline state) | site contact | no | owner 2026-11-19 | see builder | server/tests (unverified) | yes (if RESEND_API_KEY set) |
| E8 | robot_team_access_approved | robotTeamAccessEmails.ts:30 | admin approves a company application or invites one | person (admin) | company applicant | no | doctrine: Blueprint approves each company once | see builder | client/tests/admin-team-invitation-status.test.tsx | yes (if RESEND_API_KEY set) |
| E9 | robot_team_new_task | jobAutoSend.ts / robotTeamAccessEmails.ts:159 | new listed job, to approved companies that asked for job emails | timer (worker, 60 s) | company | yes: unsubscribe link (email-suppression.ts:39, scope optional_updates) | package E, E4 | see builder | server/tests (unverified) | yes (if RESEND_API_KEY set) |
| E10 | job_clarification | jobClarifications.ts:70 | site answers a company's question | person (site) | company | no | captureOutbox.ts:76 | see builder | server/tests (unverified) | yes (if RESEND_API_KEY set) |
| E11 | job_outcome_question | jobOutcomes.ts:154 | 14, 45, 90 days after an introduction | timer (worker, 15 min) | site and company | no | package E, E8 | see builder | e2e/job-outcomes.spec.ts | yes (if RESEND_API_KEY set) |
| E12 | job_withdrawn_company | withdrawalCompanyNotice.ts | site withdraws a job that was sent | person (site) | companies sent the job | no | recording statement (captureOutbox.ts:82) | see builder | server/tests (unverified) | yes (if RESEND_API_KEY set) |
| E13 | account_notice | accountNotice.ts:137 | Terms / Privacy update notice | person (operator script npm run email:account-notice) | account holders | no (legal notice) | captureOutbox.ts:62 | see builder | server/tests (unverified) | yes (if RESEND_API_KEY set) |
| E14 | 'We received your request' | inbound-request.ts:2289 | an inbound request that is not a site with a private link (e.g. robot-team or legacy intake) | person (submitter) | submitter | no | nobody found | see builder | server/tests inbound-request (unverified) | yes (if RESEND_API_KEY set) |
| E15 | 'You've been asked to film a job for Blueprint' (email or SMS) | filmLinkHandoff.ts:73 / sms.ts (Twilio) | site names someone else to film at intake, or presses send film link | person (site) | the filmer | no | nobody found | see builder | e2e/contact.spec.ts (unverified) | yes (if RESEND_API_KEY set) |
| E16 | 'Reset your Blueprint password' | passwordResetEmail.ts:9 | POST /api/password-reset | person | account holder | no | nobody found | see builder | server/tests password-reset (unverified) | yes (if RESEND_API_KEY set) |
| E17 | Firebase email verification | Firebase Auth (client: accountAuth.ts:43, RobotTeamSignUpFlow.tsx:46, Settings.tsx:99, Overview.tsx:76) | account created or 'resend' pressed | person | account holder | no | nobody found | see builder | none | yes (if RESEND_API_KEY set) |
| E18 | Ops: intake notice and retries | intakeOpsNotice.ts:178,306 | every new intake; retry/escalation | person + timer (beta ops monitor, 5 min) | ops (CONTACT_TO, default ops@tryblueprint.io) | n/a internal | nobody found | see builder | server/tests intake-ops (unverified) | yes (if RESEND_API_KEY set) |
| E19 | Ops: [ALERT] preparation alerts | websitePreparationOpsAlerts.ts:144 | job preparation over budget / stuck | system | ops | n/a | nobody found | see builder | server/tests (unverified) | yes (if RESEND_API_KEY set) |
| E20 | Ops: beta monitor alerts | betaOpsMonitor.ts:103,255,403 | outbox backlog, terminal failures, unknown outcomes, worker heartbeat stale, jobs waiting on grant | timer (5 min) | ops | n/a | founder decision 2026-10-14 (render.yaml) | see builder | server/tests beta-ops (unverified) | yes (if RESEND_API_KEY set) |

Also sent, not email: Slack messages (`server/utils/slack.ts`: capture privacy escalation, screening call needed, footage needs review, robot-team access application) and SMS film-link handoff (`server/utils/sms.ts`, Twilio).
Production count: `captureOutbox` holds 143 documents (baseline aggregate).

### 3. API routes

| # | Method | Path | Handler | Auth | Caller | Owner | Last change (file) | Server tests importing module | Live |
|---|---|---|---|---|---|---|---|---|---|
| A1 | GET | `/api/account-deletion` | account-deletion.ts:30 | Firebase ID token | client: AccountDeletion.tsx | nobody found | 2026-10-19 | 1 | yes |
| A2 | POST | `/api/account-invitations/inspect` | account-invitations.ts:17 | public + CSRF | client: accountInvitation.ts (built path) | nobody found | 2026-11-20 | 1 | yes |
| A3 | POST | `/api/account-invitations/redeem` | account-invitations.ts:25 | public + CSRF | client: accountInvitation.ts (built path) | nobody found | 2026-11-20 | 1 | yes |
| A4 | GET | `/api/admin/jobs` | admin-job-console.ts:49 | Firebase + admin/ops role | client: AdminJobConsole.tsx, jobConsole.ts | nobody found | 2026-11-17 | 7 | yes |
| A5 | GET | `/api/admin/jobs/:requestId` | admin-job-console.ts:64 | Firebase + admin/ops role | client: AdminJobConsole.tsx, jobConsole.ts | nobody found | 2026-11-17 | 7 | yes |
| A6 | GET | `/api/admin/jobs/:requestId/simulation.zip` | admin-job-console.ts:83 | Firebase + admin/ops role | link built by server/utils/jobConsoleData.ts for the job console | nobody found | 2026-11-17 | 7 | yes |
| A7 | GET | `/api/admin/jobs/:requestId/scene-preview-view` | admin-job-console.ts:123 | Firebase + admin/ops role | link built by server/utils/jobConsoleData.ts:452 | nobody found | 2026-11-17 | 7 | yes |
| A8 | GET | `/api/admin/jobs/:requestId/site-measurements` | admin-job-console.ts:154 | Firebase + admin/ops role | client: SiteMeasurementsConsole.tsx, siteMeasurements.ts | nobody found | 2026-11-17 | 7 | yes |
| A9 | POST | `/api/admin/jobs/:requestId/site-measurements/source-document` | admin-job-console.ts:183 | Firebase + admin/ops role | client: SiteMeasurementsConsole.tsx (built path) | nobody found | 2026-11-17 | 7 | yes |
| A10 | GET | `/api/admin/jobs/:requestId/site-measurements/exports/:digest` | admin-job-console.ts:224 | Firebase + admin/ops role | client: SiteMeasurementsConsole.tsx (built path) | nobody found | 2026-11-17 | 7 | yes |
| A11 | GET | `/api/admin/jobs/:requestId/robot-fit` | admin-job-console.ts:248 | Firebase + admin/ops role | client: RobotFitConsole.tsx | nobody found | 2026-11-17 | 7 | yes |
| A12 | POST | `/api/admin/jobs/:requestId/robot-fit/ranking` | admin-job-console.ts:263 | Firebase + admin/ops role | client: RobotFitConsole.tsx (built path) | nobody found | 2026-11-17 | 7 | yes |
| A13 | GET | `/api/admin/jobs/:requestId/companies` | admin-job-console.ts:296 | Firebase + admin/ops role | client: JobCompaniesConsole.tsx, jobCompanies.ts | nobody found | 2026-11-17 | 7 | yes |
| A14 | POST | `/api/admin/jobs/:requestId/companies/sends` | admin-job-console.ts:315 | Firebase + admin/ops role | client: jobCompanies.ts / JobCompaniesConsole.tsx | nobody found | 2026-11-17 | 7 | yes |
| A15 | POST | `/api/admin/jobs/:requestId/companies/sends/:sendId/void` | admin-job-console.ts:335 | Firebase + admin/ops role | client: jobCompanies.ts | nobody found | 2026-11-17 | 7 | yes |
| A16 | POST | `/api/admin/jobs/:requestId/companies/responses` | admin-job-console.ts:360 | Firebase + admin/ops role | client: jobCompanies.ts / JobCompaniesConsole.tsx | nobody found | 2026-11-17 | 7 | yes |
| A17 | POST | `/api/admin/jobs/:requestId/companies/hold` | admin-job-console.ts:381 | Firebase + admin/ops role | client: jobCompanies.ts | nobody found | 2026-11-17 | 7 | yes |
| A18 | GET | `/api/admin/robot-team-access` | admin-robot-team-access.ts:35 | Firebase + admin/ops role | client: AdminRobotTeamAccess.tsx | nobody found | 2026-11-19 | 1 | yes |
| A19 | POST | `/api/admin/robot-team-access/:id/decision` | admin-robot-team-access.ts:65 | Firebase + admin/ops role | client: AdminRobotTeamAccess.tsx | nobody found | 2026-11-19 | 1 | yes |
| A20 | POST | `/api/admin/robot-team-access/invites` | admin-robot-team-access.ts:99 | Firebase + admin/ops role | client: AdminRobotTeamAccess.tsx | nobody found | 2026-11-19 | 1 | yes |
| A21 | POST | `/api/admin/robot-team-access/:id/invitation` | admin-robot-team-access.ts:125 | Firebase + admin/ops role | client: AdminRobotTeamAccess.tsx | nobody found | 2026-11-19 | 1 | yes |
| A22 | POST | `/api/admin/robot-teams/recommendations/:requestId/decision` | admin-robot-teams.ts:58 | Firebase + admin/ops role | client: AdminRobotTeamAccess.tsx:291 | nobody found | 2026-11-14 | 2 | yes |
| A23 | GET | `/api/admin/robot-teams/recommendations/:requestId` | admin-robot-teams.ts:84 | Firebase + admin/ops role | client: AdminRobotTeamAccess.tsx | nobody found | 2026-11-14 | 2 | yes |
| A24 | GET | `/api/admin/robot-teams/proposals` | admin-robot-teams.ts:104 | Firebase + admin/ops role | NONE found | nobody found | 2026-11-14 | 2 | yes |
| A25 | POST | `/api/admin/robot-teams/proposals/:proposalId` | admin-robot-teams.ts:128 | Firebase + admin/ops role | NONE found | nobody found | 2026-11-14 | 2 | yes |
| A26 | GET | `/api/admin/robot-teams` | admin-robot-teams.ts:167 | Firebase + admin/ops role | NONE found (client, Pipeline, scripts) | nobody found | 2026-11-14 | 2 | yes |
| A27 | GET | `/api/admin/robot-teams/:teamId/supply-agreement` | admin-robot-teams.ts:240 | Firebase + admin/ops role | NONE found | nobody found | 2026-11-14 | 2 | yes |
| A28 | POST | `/api/admin/robot-teams/:teamId/supply-agreement` | admin-robot-teams.ts:263 | Firebase + admin/ops role | NONE found | nobody found | 2026-11-14 | 2 | yes |
| A29 | POST | `/api/admin/robot-teams/:teamId/supply-agreement/withdraw` | admin-robot-teams.ts:289 | Firebase + admin/ops role | NONE found | nobody found | 2026-11-14 | 2 | yes |
| A30 | POST | `/api/analytics/ingest` | analytics-ingest.ts:9 | public + CSRF | client: analytics.ts | nobody found | 2026-04-02 | 0 | yes |
| A31 | POST | `/api/capture-uploads` | capture-uploads.ts:815 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A32 | GET | `/api/capture-uploads` | capture-uploads.ts:952 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A33 | GET | `/api/capture-uploads/:sessionId` | capture-uploads.ts:972 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A34 | GET | `/api/capture-uploads/:sessionId/testbed` | capture-uploads.ts:995 | Firebase ID token | NONE found (client lib captureUploads.ts has no testbed call) | nobody found | 2026-11-14 | 2 | yes |
| A35 | POST | `/api/capture-uploads/:sessionId/reconstructions/atlas/authorize` | capture-uploads.ts:1039 | Firebase ID token | NONE found | nobody found | 2026-11-14 | 2 | yes |
| A36 | POST | `/api/capture-uploads/:sessionId/reconstructions/atlas/plan` | capture-uploads.ts:1105 | Firebase ID token | NONE found | nobody found | 2026-11-14 | 2 | yes |
| A37 | POST | `/api/capture-uploads/:sessionId/reconstructions/plan` | capture-uploads.ts:1196 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A38 | POST | `/api/capture-uploads/:sessionId/reconstructions/:planId/authorize` | capture-uploads.ts:1279 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A39 | POST | `/api/capture-uploads/:sessionId/reconstructions/:planId/execute` | capture-uploads.ts:1361 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A40 | GET | `/api/capture-uploads/:sessionId/reconstructions/:planId` | capture-uploads.ts:1434 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A41 | GET | `/api/capture-uploads/:sessionId/lifecycle` | capture-uploads.ts:1465 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A42 | POST | `/api/capture-uploads/:sessionId/lifecycle` | capture-uploads.ts:1479 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A43 | POST | `/api/capture-uploads/:sessionId/parts/:partNumber/authorize` | capture-uploads.ts:1722 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A44 | POST | `/api/capture-uploads/:sessionId/parts/:partNumber` | capture-uploads.ts:1803 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A45 | POST | `/api/capture-uploads/:sessionId/file` | capture-uploads.ts:1846 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A46 | POST | `/api/capture-uploads/:sessionId/complete` | capture-uploads.ts:1983 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A47 | POST | `/api/capture-uploads/:sessionId/process` | capture-uploads.ts:2119 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A48 | DELETE | `/api/capture-uploads/:sessionId` | capture-uploads.ts:2130 | Firebase ID token | client: captureUploads.ts | nobody found | 2026-11-14 | 2 | yes |
| A49 | GET | `/api/company-media/jobs/:jobId/video.mp4` | company-media.ts:89 | signed ticket in URL | signed link minted by server (websiteCompanyClip.ts) for CompanyJob page | file header: package E, E3 | 2026-11-12 | 3 | yes |
| A50 | GET | `/api/company-media/jobs/:jobId/simulation.zip` | company-media.ts:130 | signed ticket in URL | signed link minted by server (websiteCompanySimulation.ts) | file header: package E, E3 | 2026-11-12 | 3 | yes |
| A51 | GET | `/api/growth/email/unsubscribe` | email-preferences.ts:104 | public | link in new-job emails (email-suppression.ts:39) | nobody found | 2026-11-20 | 1 | yes |
| A52 | POST | `/api/errors` | errors.ts:35 | public + CSRF | client: errorTracking.ts | nobody found | 2026-07-21 | 0 | yes |
| A53 | GET | `/api/experiments/assignments` | experiments.ts:31 | public | client: experiments.ts | nobody found | 2026-11-13 | 0 | yes |
| A54 | GET | `/health` | health.ts:49 | public | Render healthCheckPath, uptime probe, deploy.yml | nobody found | 2026-11-10 | 1 | yes |
| A55 | GET | `/health/worker` | health.ts:76 | public | uptime probe (scripts/ops/uptime-probe.mjs) | nobody found | 2026-11-10 | 1 | yes |
| A56 | GET | `/health/outbox` | health.ts:103 | public | deploy/ops scripts (2 references) | nobody found | 2026-11-10 | 1 | yes |
| A57 | GET | `/health/ready` | health.ts:122 | public | deploy.yml post-deploy check | nobody found | 2026-11-10 | 1 | yes |
| A58 | GET | `/health/status` | health.ts:198 | public | operators by hand (docs/runbooks/beta-monitoring.md:273); token HEALTH_STATUS_TOKEN | nobody found | 2026-11-10 | 1 | yes |
| A59 | POST | `/api/inbound-request` | inbound-request.ts:2394 | public + CSRF | client: SiteCaptureStart.tsx, siteCaptureDraft.ts | nobody found | 2026-11-20 | 21 | yes |
| A60 | POST | `/api/internal/pipeline/account-spend-overhead` | internal-account-spend-overhead.ts:13 | Pipeline signed request | pipeline: provider_spend_alerts.py | owner decision 2026-11-20 | 2026-11-19 | 1 | yes |
| A61 | POST | `/api/internal/pipeline/beta-policy-screening-holds` | internal-beta-policy-screening.ts:28 | Pipeline signed request | pipeline: scene_stage_holds.py | nobody found | 2026-11-14 | 0 | yes |
| A62 | POST | `/api/internal/pipeline/creator-captures/:captureId/reconstruction` | internal-capture-reconstruction.ts:36 | Pipeline signed request | unverified (Pipeline '/reconstruction' in 5 files) | nobody found | 2026-09-22 | 1 | yes |
| A63 | POST | `/api/internal/pipeline/capture-testbeds` | internal-capture-testbeds.ts:35 | Pipeline signed request | NONE in Pipeline non-test code (2 test files) | nobody found | 2026-11-02 | 3 | yes |
| A64 | POST | `/api/internal/pipeline/creator-captures/:captureId/capture-owner` | internal-capture-worlds.ts:119 | Pipeline signed request | pipeline: capture_original_owner_observer.py | nobody found | 2026-11-20 | 13 | yes |
| A65 | POST | `/api/internal/pipeline/creator-captures/:captureId/visual-scene` | internal-capture-worlds.ts:157 | Pipeline signed request | NONE found | nobody found | 2026-11-20 | 13 | yes |
| A66 | POST | `/api/internal/pipeline/creator-captures/:captureId/scene-preview` | internal-capture-worlds.ts:202 | Pipeline signed request | pipeline: website_scene_preview.py | owner ask 2026-11-07 | 2026-11-20 | 13 | yes |
| A67 | POST | `/api/internal/pipeline/creator-captures/:captureId/company-clip` | internal-capture-worlds.ts:223 | Pipeline signed request | pipeline: website_task_context.py | package E, E3 | 2026-11-20 | 13 | yes |
| A68 | POST | `/api/internal/pipeline/creator-captures/:captureId/company-simulation` | internal-capture-worlds.ts:249 | Pipeline signed request | pipeline: website_company_simulation.py | package E, E9 | 2026-11-20 | 13 | yes |
| A69 | POST | `/api/internal/pipeline/creator-captures/:captureId/atlas-preview` | internal-capture-worlds.ts:421 | Pipeline signed request | pipeline: website_atlas_preview_http.py | nobody found | 2026-11-20 | 13 | yes |
| A70 | POST | `/api/internal/pipeline/creator-captures/:captureId/task-item-evidence` | internal-capture-worlds.ts:454 | Pipeline signed request | pipeline: website_task_evidence.py | nobody found | 2026-11-20 | 13 | yes |
| A71 | POST | `/api/internal/pipeline/creator-captures/:captureId/agent-execution-offer` | internal-capture-worlds.ts:532 | Pipeline signed request | pipeline: agent_execution_offer.py | nobody found | 2026-11-20 | 13 | yes |
| A72 | POST | `/api/internal/pipeline/creator-captures/:captureId/task-context` | internal-capture-worlds.ts:572 | Pipeline signed request | pipeline: website_task_context.py | nobody found | 2026-11-20 | 13 | yes |
| A73 | POST | `/api/internal/pipeline/owned-captures/:captureId/atlas-configuration` | internal-capture-worlds.ts:280 | Pipeline signed request | pipeline: atlas_privacy_screen.py | nobody found | 2026-11-20 | 13 | yes |
| A74 | POST | `/api/internal/pipeline/owned-captures/:captureId/preparation-spend` | internal-capture-worlds.ts:280 | Pipeline signed request | pipeline: website_task_context.py | nobody found | 2026-11-20 | 13 | yes |
| A75 | POST | `/api/internal/pipeline/owned-captures/:captureId/preparation-settlement` | internal-capture-worlds.ts:280 | Pipeline signed request | pipeline: atlas_spend_settlement.py | nobody found | 2026-11-20 | 13 | yes |
| A76 | POST | `/api/internal/pipeline/creator-captures/:captureId/scene-sponsorship` | internal-capture-worlds.ts:308 | Pipeline signed request | pipeline: website_preparation_terminal.py | nobody found | 2026-11-20 | 13 | yes |
| A77 | POST | `/api/internal/pipeline/creator-captures/:captureId/prepared-scene` | internal-capture-worlds.ts:308 | Pipeline signed request | pipeline: website_scene_handoff.py | nobody found | 2026-11-20 | 13 | yes |
| A78 | POST | `/api/internal/pipeline/creator-captures/:captureId/preparation-spend` | internal-capture-worlds.ts:308 | Pipeline signed request | pipeline: website_task_context.py | nobody found | 2026-11-20 | 13 | yes |
| A79 | POST | `/api/internal/pipeline/creator-captures/:captureId/preparation-settlement` | internal-capture-worlds.ts:308 | Pipeline signed request | pipeline: atlas_spend_settlement.py | nobody found | 2026-11-20 | 13 | yes |
| A80 | POST | `/api/internal/pipeline/creator-captures/:captureId/atlas-configuration` | internal-capture-worlds.ts:308 | Pipeline signed request | pipeline: atlas_privacy_screen.py | nobody found | 2026-11-20 | 13 | yes |
| A81 | POST | `/api/internal/job-evidence-publications` | internal-job-evidence.ts:6 | Pipeline signed request | pipeline: job_evidence_webapp_sync.py, test_job_evidence.py | nobody found | 2026-10-21 | 1 | yes |
| A82 | POST | `/api/internal/pipeline/task-evaluation-scene-intents/:intentId/owner-success-proposal` | internal-owner-success-proposal.ts:11 | Pipeline signed request | pipeline: website_owner_success_confirmation.py | nobody found | 2026-11-03 | 1 | yes |
| A83 | POST | `/api/internal/pipeline/attachments` | internal-pipeline.ts:1005 | Pipeline signed request | unverified (generic word) | owner, 2026-11-11 | 2026-11-19 | 2 | yes |
| A84 | POST | `/api/internal/pipeline/buyer-artifact-access-check` | internal-pipeline.ts:1531 | Pipeline signed request | NONE in Pipeline non-test code (1 test file) | nobody found | 2026-11-19 | 2 | yes |
| A85 | POST | `/api/internal/pipeline/rights-privacy-revocation` | internal-pipeline.ts:1736 | Pipeline signed request | NONE in Pipeline non-test code (1 test file) | nobody found | 2026-11-19 | 2 | yes |
| A86 | GET | `/api/internal/pipeline/status/:requestId` | internal-pipeline.ts:1820 | Pipeline signed request | unverified (generic word) | nobody found | 2026-11-19 | 2 | yes |
| A87 | GET | `/api/internal/pipeline/hosted-readiness/:siteSubmissionId` | internal-pipeline.ts:1907 | Pipeline signed request | NONE found | nobody found | 2026-11-19 | 2 | yes |
| A88 | POST | `/api/internal/pipeline/task-evaluation-scene-intents/:intentId/execution-window-extensions` | internal-scene-execution-window.ts:11 | Pipeline signed request | pipeline: task_evaluation_scene_execution_window_door.py | nobody found | 2026-10-31 | 1 | yes |
| A89 | POST | `/api/internal/task-evaluation-launch-preparations` | internal-task-evaluation-launch-preparations.ts:50 | Pipeline signed request | pipeline: submit_task_evaluation_preparation_via_webapp.py | nobody found | 2026-11-14 | 1 | yes |
| A90 | GET | `/api/internal/task-evaluation-launch-preparations/:preparationId` | internal-task-evaluation-launch-preparations.ts:76 | Pipeline signed request | pipeline: task_evaluation_sam31_preparation_execution.py | nobody found | 2026-11-14 | 1 | yes |
| A91 | POST | `/api/internal/task-evaluation-launch-submissions` | internal-task-evaluation-launch-submissions.ts:24 | Pipeline signed request | pipeline: submit_task_evaluation_launch.py, submit_task_evaluation_launch_via_webapp.py | nobody found | 2026-11-14 | 1 | yes |
| A92 | POST | `/api/internal/pipeline/task-evaluation-launch-publication-readiness` | internal-task-evaluation-launches.ts:17 | Pipeline signed request | NONE found | nobody found | 2026-11-14 | 2 | yes |
| A93 | POST | `/api/internal/pipeline/task-evaluation-launches` | internal-task-evaluation-launches.ts:110 | Pipeline signed request | pipeline: task_evaluation_release_retention.py and others (13 files) | nobody found | 2026-11-14 | 2 | yes |
| A94 | POST | `/api/internal/pipeline/task-evaluation-launch-progress` | internal-task-evaluation-launches.ts:343 | Pipeline signed request | NONE found | nobody found | 2026-11-14 | 2 | yes |
| A95 | POST | `/api/internal/pipeline/test-jobs` | internal-test-jobs.ts:118 | Pipeline signed request | pipeline: internal_test_job_door.py | file header: owner, 2026-11-15 | 2026-11-15 | 3 | yes |
| A96 | POST | `/api/internal/pipeline/creator-captures/:captureId/task-target-choice` | internal-website-preparation.ts:31 | Pipeline signed request | pipeline: website_target_background_worker.py | nobody found | 2026-10-29 | 3 | yes |
| A97 | POST | `/api/internal/pipeline/creator-captures/:captureId/preparation-status` | internal-website-preparation.ts:53 | Pipeline signed request | pipeline: website_preparation_status_http.py | nobody found | 2026-10-29 | 3 | yes |
| A98 | POST | `/api/job-facts/:token` | job-facts.ts:20 | signed link token | client: JobFacts.tsx | PACKAGE_E E1 | 2026-11-12 | 1 | yes |
| A99 | GET | `/api/job-outcomes/:token` | job-outcomes.ts:45 | signed link token | link in job_outcome_question emails (jobOutcomes.ts) | file header: PACKAGE_E E8 | 2026-11-20 | 2 | yes |
| A100 | POST | `/api/job-outcomes/:token` | job-outcomes.ts:54 | signed link token | confirm form served by GET /api/job-outcomes/:token | file header: PACKAGE_E E8 | 2026-11-20 | 2 | yes |
| A101 | GET | `/api/job-workflow/owner/:token` | job-workflow.ts:66 | signed link token | NONE in client (only a comment, simulationProof.ts:9); e2e site-private-link-reliability.spec.ts:30 mocks it | nobody found | 2026-11-19 | 2 | yes |
| A102 | GET | `/api/job-workflow/admin/:requestId` | job-workflow.ts:87 | Firebase + admin/ops role | client: JobWorkflowPanel.tsx | nobody found | 2026-11-19 | 2 | yes |
| A103 | POST | `/api/job-workflow/admin/:requestId/evidence/:evidenceId/:action` | job-workflow.ts:123 | Firebase + admin/ops role | client: JobWorkflowPanel.tsx (built path, unverified) | nobody found | 2026-11-19 | 2 | yes |
| A104 | GET | `/api/location-autocomplete` | location-autocomplete.ts:46 | public | client: LocationAutocomplete.tsx | nobody found | 2026-11-19 | 1 | yes |
| A105 | GET | `/api/location-autocomplete/country` | location-autocomplete.ts:92 | public | client: LocationAutocomplete.tsx | nobody found | 2026-11-19 | 1 | yes |
| A106 | GET | `/api/operator-status/current` | operator-status.ts:37 | Firebase ID token | NONE found | nobody found | 2026-10-13 | 1 | yes |
| A107 | POST | `/api/password-reset` | password-reset.ts:22 | public + CSRF | client: ForgotPassword.tsx | nobody found | 2026-10-09 | 1 | yes |
| A108 | POST | `/api/robot-team-access/apply` | robot-team-access.ts:60 | public + CSRF | client: robotTeamAccess.ts | nobody found | 2026-11-20 | 5 | yes |
| A109 | POST | `/api/robot-team-access/invitation` | robot-team-access.ts:109 | public + CSRF | client: robotTeamAccess.ts | owner, 2026-11-19 | 2026-11-20 | 5 | yes |
| A110 | POST | `/api/robot-team-access/accept-terms` | robot-team-access.ts:133 | Firebase ID token | client: CompanyTermsPrompt.tsx | nobody found | 2026-11-20 | 5 | yes |
| A111 | GET | `/api/robot-team-access/me` | robot-team-access.ts:152 | public + CSRF | client: robotTeamAccess.ts | nobody found | 2026-11-20 | 5 | yes |
| A112 | GET | `/api/self-capture/uploads/:token/status` | self-capture-uploads.ts:562 | signed link token | client: SelfCaptureUpload.tsx, SiteCaptureStart.tsx | nobody found | 2026-11-20 | 18 | yes |
| A113 | POST | `/api/self-capture/uploads/:token/recording-consent` | self-capture-uploads.ts:572 | signed link token | client: SelfCaptureUpload.tsx, SiteAnswer.tsx | nobody found | 2026-11-20 | 18 | yes |
| A114 | GET | `/api/self-capture/uploads/:token/withdrawal` | self-capture-uploads.ts:645 | signed link token | client: OwnerRecordingWithdrawal.tsx | nobody found | 2026-11-20 | 18 | yes |
| A115 | POST | `/api/self-capture/uploads/:token/withdrawal` | self-capture-uploads.ts:660 | signed link token | client: OwnerRecordingWithdrawal.tsx | nobody found | 2026-11-20 | 18 | yes |
| A116 | POST | `/api/self-capture/uploads/:token/advisory-retry` | self-capture-uploads.ts:682 | signed link token | NONE found | nobody found | 2026-11-20 | 18 | yes |
| A117 | POST | `/api/self-capture/uploads/:token/processing-retry` | self-capture-uploads.ts:690 | signed link token | client: selfCaptureVideo.ts | owner decision 2026-11-11 | 2026-11-20 | 18 | yes |
| A118 | POST | `/api/self-capture/uploads/:token/self-capture` | self-capture-uploads.ts:782 | signed link token | client: SiteCaptureStart.tsx / CaptureRecorder.tsx (built path) | nobody found | 2026-11-20 | 18 | yes |
| A119 | POST | `/api/self-capture/uploads/:token` | self-capture-uploads.ts:862 | signed link token | client: selfCaptureVideo.ts | nobody found | 2026-11-20 | 18 | yes |
| A120 | GET | `/api/self-capture/uploads/:token/parts` | self-capture-uploads.ts:1010 | signed link token | client: CaptureRecorder.tsx | nobody found | 2026-11-20 | 18 | yes |
| A121 | PUT | `/api/self-capture/uploads/:token/parts/:index` | self-capture-uploads.ts:1043 | signed link token | client: CaptureRecorder.tsx | nobody found | 2026-11-20 | 18 | yes |
| A122 | POST | `/api/self-capture/uploads/:token/parts/complete` | self-capture-uploads.ts:1124 | signed link token | client: CaptureRecorder.tsx | nobody found | 2026-11-20 | 18 | yes |
| A123 | POST | `/api/self-capture/uploads/:token/supplement` | self-capture-uploads.ts:1324 | signed link token | client: SelfCaptureUpload.tsx | nobody found | 2026-11-20 | 18 | yes |
| A124 | POST | `/api/self-capture/uploads/:token/items/:itemId/image` | self-capture-uploads.ts:1364 | signed link token | NONE found in client (unverified) | nobody found | 2026-11-20 | 18 | yes |
| A125 | GET | `/api/site-claim/:token` | site-claim.ts:21 | signed link token | client: ClaimSite.tsx | nobody found | 2026-11-20 | 1 | yes |
| A126 | GET | `/api/site-content` | site-content.ts:103 | public | public agent API (llms.txt readers); no client caller | nobody found | 2026-11-20 | 1 | yes |
| A127 | POST | `/api/site-task-brief/:token/run-closure` | site-task-brief.ts:131 | signed link token | NONE found | nobody found | 2026-11-20 | 24 | yes |
| A128 | GET | `/api/site-task-brief/:token/clarification` | site-task-brief.ts:148 | signed link token | client: TaskClarification.tsx | nobody found | 2026-11-20 | 24 | yes |
| A129 | POST | `/api/site-task-brief/:token/clarification` | site-task-brief.ts:157 | signed link token | client: TaskClarification.tsx | nobody found | 2026-11-20 | 24 | yes |
| A130 | POST | `/api/site-task-brief/:token/task-target-choice` | site-task-brief.ts:169 | signed link token | client: TaskDestinationChoice.tsx, TaskTargetChoice.tsx | nobody found | 2026-11-20 | 24 | yes |
| A131 | POST | `/api/site-task-brief/:token/success-thresholds` | site-task-brief.ts:201 | signed link token | client: SuccessThresholds.tsx | nobody found | 2026-11-20 | 24 | yes |
| A132 | POST | `/api/site-task-brief/:token/clarifications` | site-task-brief.ts:233 | signed link token | client: SiteAnswer.tsx | nobody found | 2026-11-20 | 24 | yes |
| A133 | POST | `/api/site-task-brief/:token/introductions` | site-task-brief.ts:254 | signed link token | client: SiteAnswer.tsx | nobody found | 2026-11-20 | 24 | yes |
| A134 | GET | `/api/site-task-brief/:token` | site-task-brief.ts:603 | signed link token | client: SelfCaptureUpload.tsx | nobody found | 2026-11-20 | 24 | yes |
| A135 | GET | `/api/site-task-brief/:token/follow-up` | site-task-brief.ts:656 | signed link token | e2e only (reliability-program-intake.spec.ts); no client caller | nobody found | 2026-11-20 | 24 | yes |
| A136 | POST | `/api/site-task-brief/:token/follow-up` | site-task-brief.ts:718 | signed link token | e2e only (reliability-program-intake.spec.ts); no client caller | nobody found | 2026-11-20 | 24 | yes |
| A137 | GET | `/api/site-task-brief/:token/film-link` | site-task-brief.ts:771 | signed link token | client: FilmLinkHandoff.tsx | nobody found | 2026-11-20 | 24 | yes |
| A138 | POST | `/api/site-task-brief/:token/film-link/send` | site-task-brief.ts:812 | signed link token | client: FilmLinkHandoff.tsx | nobody found | 2026-11-20 | 24 | yes |
| A139 | POST | `/api/site-task-brief/:token/fresh-link` | site-task-brief.ts:913 | signed link token | client: SelfCaptureUpload.tsx (built path) | nobody found | 2026-11-20 | 24 | yes |
| A140 | POST | `/api/site-task-brief/:token/task-statement` | site-task-brief.ts:947 | signed link token | client: SelfCaptureUpload.tsx (built path) | nobody found | 2026-11-20 | 24 | yes |
| A141 | POST | `/api/site-task-brief/:token/confirm` | site-task-brief.ts:971 | signed link token | client: TaskBriefReview.tsx | nobody found | 2026-11-20 | 24 | yes |
| A142 | GET | `/api/site-task-brief/:token/status` | site-task-brief.ts:1177 | signed link token | client: SelfCaptureUpload.tsx | nobody found | 2026-11-20 | 24 | yes |
| A143 | GET | `/api/site-task-brief/:token/items` | site-task-brief.ts:1461 | signed link token | NONE found in client | nobody found | 2026-11-20 | 24 | yes |
| A144 | POST | `/api/site-task-brief/:token/items` | site-task-brief.ts:1492 | signed link token | NONE found in client | nobody found | 2026-11-20 | 24 | yes |
| A145 | DELETE | `/api/site-task-brief/:token/items/:itemId` | site-task-brief.ts:1521 | signed link token | NONE found in client | nobody found | 2026-11-20 | 24 | yes |
| A146 | GET | `/api/site-task-brief/:token/measurements` | site-task-brief.ts:1543 | signed link token | NONE in client (only a comment, siteMeasurements.ts:292) | nobody found | 2026-11-20 | 24 | yes |
| A147 | PUT | `/api/site-task-brief/:token/measurements` | site-task-brief.ts:1558 | signed link token | NONE in client (only a comment, siteMeasurements.ts:292) | nobody found | 2026-11-20 | 24 | yes |
| A148 | POST | `/api/site-worlds/tasks/:taskId/interest` | site-worlds.ts:42 | Firebase ID token | client: CompanyJob.tsx | nobody found | 2026-11-20 | 9 | yes |
| A149 | GET | `/api/site-worlds/jobs/:taskId` | site-worlds.ts:101 | optional Firebase; access decided in handler | client: CompanyJob.tsx | nobody found | 2026-11-20 | 9 | yes |
| A150 | GET | `/api/site-worlds/tasks/:taskId/thumbnail` | site-worlds.ts:116 | optional Firebase; access decided in handler | link built by server (teamJobAccess.ts) | nobody found | 2026-11-20 | 9 | yes |
| A151 | GET | `/api/site-worlds/tasks` | site-worlds.ts:140 | optional Firebase; access decided in handler | client: TaskBrowse.tsx | nobody found | 2026-11-20 | 9 | yes |
| A152 | GET | `/api/site-worlds/tasks/:taskId` | site-worlds.ts:153 | optional Firebase; access decided in handler | client: TaskBrowse.tsx / CompanyJob.tsx (built path) | nobody found | 2026-11-20 | 9 | yes |
| A153 | GET | `/api/website-atlas-preview-downloads/:requestId/:captureId` | website-atlas-preview-downloads.ts:10 | signed ticket in URL | signed link minted by server (websiteAtlasPreview.ts) | nobody found | 2026-10-29 | 1 | yes |
| A154 | GET | `/api/website-atlas-preview-views/:requestId/:captureId/:file(scene.ply\|settings.json)` | website-atlas-preview-views.ts:35 | signed ticket in URL | signed link minted by server (websiteAtlasPreviewView.ts) | nobody found | 2026-11-17 | 5 | yes |
| A155 | GET | `/api/website-destination-pictures/:requestId/:captureId/place.png` | website-destination-pictures.ts:21 | signed ticket in URL | signed link minted by server (websiteDestinationPicture.ts) | nobody found | 2026-11-13 | 2 | yes |
| A156 | GET | `/api/workspace/setup` | workspace.ts:154 | Firebase ID token | client: SiteCaptureStart.tsx | nobody found | 2026-11-20 | 6 | yes |
| A157 | GET | `/api/workspace/deployment-embodiments` | workspace.ts:165 | Firebase ID token | only DeploymentEmbodimentShortlist.tsx, which nothing imports | nobody found | 2026-11-20 | 6 | yes |
| A158 | POST | `/api/workspace/capture-start` | workspace.ts:268 | Firebase ID token | client: SiteCaptureStart.tsx, siteCaptureDraft.ts | nobody found | 2026-11-20 | 6 | yes |
| A159 | GET | `/api/workspace` | workspace.ts:420 | Firebase ID token | client: workspace.ts | nobody found | 2026-11-20 | 6 | yes |
| A160 | POST | `/api/workspace/claim` | workspace.ts:480 | Firebase ID token | client: siteClaim.ts (built path) | nobody found | 2026-11-20 | 6 | yes |
| A161 | POST | `/api/workspace/tasks/:taskId/task-link` | workspace.ts:548 | Firebase ID token | client: workspace/Overview.tsx | nobody found | 2026-11-20 | 6 | yes |
| A162 | PATCH | `/api/workspace/update-preferences` | workspace.ts:613 | Firebase ID token | client: workspace/Settings.tsx | nobody found | 2026-11-20 | 6 | yes |
| A163 | PATCH | `/api/workspace/profile` | workspace.ts:626 | Firebase ID token | client: workspace/Settings.tsx | nobody found | 2026-11-20 | 6 | yes |
| A164 | POST | `/api/workspace/tasks/:taskId/recording-consent/withdraw` | workspace.ts:642 | Firebase ID token | NONE found in client | nobody found | 2026-11-20 | 6 | yes |
| A165 | POST | `/api/workspace/setup` | workspace.ts:170 | Firebase ID token | client: WorkspaceSetup | nobody found | 2026-11-20 | 6 | yes |
| A166 | POST | `/api/account-deletion/admin/:id/review` | account-deletion-admin.ts:30 | Firebase + admin/ops role | client: AccountDeletionQueue.tsx | nobody found | 2026-10-19 | 0 | yes |
| A167 | POST | `/api/capture-uploads/:sessionId/reconstructions/atlas/:planId/:operation` | owned-capture-atlas.ts:39 | public + CSRF | NONE found | nobody found | 2026-10-29 | 1 | yes |
| A168 | GET | `/api/capture-uploads/:sessionId/reconstructions/atlas/:planId` | owned-capture-atlas.ts:60 | public + CSRF | NONE found | nobody found | 2026-10-29 | 1 | yes |
| A169 | GET | `/api/capture-uploads/:sessionId/reconstructions/atlas/:planId/bundle` | owned-capture-atlas.ts:74 | public + CSRF | NONE found | nobody found | 2026-10-29 | 1 | yes |
| A170 | GET | `/api/account-deletion/admin` | account-deletion-admin.ts:24 | public + CSRF | client: AccountDeletionQueue.tsx | nobody found | 2026-10-19 | 1 | yes |
| A171 | POST | `/api/account-deletion` | account-deletion.ts:34 | Firebase ID token | client: accountDeletion lib / AccountDeletion.tsx | nobody found | 2026-10-19 | 1 | yes |
| A172 | POST | `/api/growth/email/unsubscribe` | email-preferences.ts:105 | public | confirm form served by GET unsubscribe | nobody found | 2026-11-20 | 1 | yes |
| A173 | GET | `/health/live` | health.ts:60 | public | NONE found | nobody found | 2026-11-10 | 1 | yes |
| A174 | GET | `/api/job-workflow/owner/:token/evidence/:publicationDigest` | job-workflow.ts:67 | signed link token | NONE in client | nobody found | 2026-11-19 | 1 | yes |
| A175 | POST | `/api/job-workflow/admin/:requestId/evidence` | job-workflow.ts:90 | Firebase + admin/ops role | client: JobWorkflowPanel.tsx | nobody found | 2026-11-19 | 1 | yes |
| A176 | GET | `/api/self-capture/uploads/:token` | self-capture-uploads.ts:563 | signed link token | client: SelfCaptureUpload.tsx | nobody found | 2026-11-20 | 1 | yes |

Retired capture-app routes answering 410 before any auth (`server/utils/retiredCapturerRoutes.ts:13`, owner 2026-11-11): 14 patterns, among them `/v1/creator`, `/v1/stripe`, `/api/admin/field-ops`, `/api/workspace/tasks/:taskId/capture` and the bundle upload routes. Live: yes (they answer 410).
Server-only paths in `server/index.ts`: `/__/auth` (Firebase auth proxy), `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/api/csrf`, `/api/growth/webhooks/resend` (Resend delivery webhook).

#### 3a. Routes with no caller (35)

No literal or built-path caller in `client/src`, the Pipeline (non-test code) or `scripts/`. Each is a deletion candidate; the later phases should confirm against production request logs before removal (no request logs were read here).

| Route | Handler | Note |
|---|---|---|
| `GET /api/admin/robot-teams/proposals` | admin-robot-teams.ts:104 | NONE found |
| `POST /api/admin/robot-teams/proposals/:proposalId` | admin-robot-teams.ts:128 | NONE found |
| `GET /api/admin/robot-teams` | admin-robot-teams.ts:167 | NONE found (client, Pipeline, scripts) |
| `GET /api/admin/robot-teams/:teamId/supply-agreement` | admin-robot-teams.ts:240 | NONE found |
| `POST /api/admin/robot-teams/:teamId/supply-agreement` | admin-robot-teams.ts:263 | NONE found |
| `POST /api/admin/robot-teams/:teamId/supply-agreement/withdraw` | admin-robot-teams.ts:289 | NONE found |
| `GET /api/capture-uploads/:sessionId/testbed` | capture-uploads.ts:995 | NONE found (client lib captureUploads.ts has no testbed call) |
| `POST /api/capture-uploads/:sessionId/reconstructions/atlas/authorize` | capture-uploads.ts:1039 | NONE found |
| `POST /api/capture-uploads/:sessionId/reconstructions/atlas/plan` | capture-uploads.ts:1105 | NONE found |
| `POST /api/internal/pipeline/capture-testbeds` | internal-capture-testbeds.ts:35 | NONE in Pipeline non-test code (2 test files) |
| `POST /api/internal/pipeline/creator-captures/:captureId/visual-scene` | internal-capture-worlds.ts:157 | NONE found |
| `POST /api/internal/pipeline/buyer-artifact-access-check` | internal-pipeline.ts:1531 | NONE in Pipeline non-test code (1 test file) |
| `POST /api/internal/pipeline/rights-privacy-revocation` | internal-pipeline.ts:1736 | NONE in Pipeline non-test code (1 test file) |
| `GET /api/internal/pipeline/hosted-readiness/:siteSubmissionId` | internal-pipeline.ts:1907 | NONE found |
| `POST /api/internal/pipeline/task-evaluation-launch-publication-readiness` | internal-task-evaluation-launches.ts:17 | NONE found |
| `POST /api/internal/pipeline/task-evaluation-launch-progress` | internal-task-evaluation-launches.ts:343 | NONE found |
| `GET /api/job-workflow/owner/:token` | job-workflow.ts:66 | NONE in client (only a comment, simulationProof.ts:9); e2e site-private-link-reliability.spec.ts:30 mocks it |
| `GET /api/operator-status/current` | operator-status.ts:37 | NONE found |
| `POST /api/self-capture/uploads/:token/advisory-retry` | self-capture-uploads.ts:682 | NONE found |
| `POST /api/self-capture/uploads/:token/items/:itemId/image` | self-capture-uploads.ts:1364 | NONE found in client (unverified) |
| `POST /api/site-task-brief/:token/run-closure` | site-task-brief.ts:131 | NONE found |
| `GET /api/site-task-brief/:token/follow-up` | site-task-brief.ts:656 | e2e only (reliability-program-intake.spec.ts); no client caller |
| `POST /api/site-task-brief/:token/follow-up` | site-task-brief.ts:718 | e2e only (reliability-program-intake.spec.ts); no client caller |
| `GET /api/site-task-brief/:token/items` | site-task-brief.ts:1461 | NONE found in client |
| `POST /api/site-task-brief/:token/items` | site-task-brief.ts:1492 | NONE found in client |
| `DELETE /api/site-task-brief/:token/items/:itemId` | site-task-brief.ts:1521 | NONE found in client |
| `GET /api/site-task-brief/:token/measurements` | site-task-brief.ts:1543 | NONE in client (only a comment, siteMeasurements.ts:292) |
| `PUT /api/site-task-brief/:token/measurements` | site-task-brief.ts:1558 | NONE in client (only a comment, siteMeasurements.ts:292) |
| `GET /api/workspace/deployment-embodiments` | workspace.ts:165 | only DeploymentEmbodimentShortlist.tsx, which nothing imports |
| `POST /api/workspace/tasks/:taskId/recording-consent/withdraw` | workspace.ts:642 | NONE found in client |
| `POST /api/capture-uploads/:sessionId/reconstructions/atlas/:planId/:operation` | owned-capture-atlas.ts:39 | NONE found |
| `GET /api/capture-uploads/:sessionId/reconstructions/atlas/:planId` | owned-capture-atlas.ts:60 | NONE found |
| `GET /api/capture-uploads/:sessionId/reconstructions/atlas/:planId/bundle` | owned-capture-atlas.ts:74 | NONE found |
| `GET /health/live` | health.ts:60 | NONE found |
| `GET /api/job-workflow/owner/:token/evidence/:publicationDigest` | job-workflow.ts:67 | NONE in client |

### 4. Crons, timers, schedulers, workers

| # | What | Where it runs | How often | Reads | Writes / sends | Gate | Owner | Last change | Test | Live |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Outbox pump (customer emails, brief-review recovery, coverage-queue tick) | web process (server/index.ts:530) | 60 s (captureOutbox.ts:614) | captureOutbox, siteTaskBriefs, captureCoverageReviews | sends all outbox emails via Resend; may start Gemini/OpenAI coverage reviews | off if BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER=1; leader lease | captureOutbox.ts:604 comment | 2026-11-21 (captureOutbox.ts) | server/tests outbox (several) | yes |
| T2 | Beta ops monitor | web process (server/index.ts:536) | 5 min, env BLUEPRINT_BETA_OPS_MONITOR_INTERVAL_MS (betaOpsMonitor.ts:471) | captureOutbox, opsHeartbeats, intake notices, jobs waiting on grant | ops emails, Slack, opsOutboxFailureAlerts | same scheduler switch; leader lease | founder decision 2026-10-14 (render.yaml:22) | see git | server/tests beta-ops | yes |
| T3 | Task Evaluation launch forwarder (+ tickCoverageReviews) | worker (server/worker.ts:46) | 60 s, env TASK_EVALUATION_LAUNCH_FORWARD_WORKER_INTERVAL_MS (taskEvaluationLaunchForwardWorker.ts:184) | taskEvaluationLaunches, captureCoverageReviews | forwards job launches to the Pipeline control plane; coverage reviews | BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_WORKER_ENABLED | #1300 2026-11-14: website job launch path stays | see git | server/tests task-evaluation-launch-* | yes |
| T4 | Website capture withdrawal worker | worker (worker.ts:47) | 60 s (websiteCaptureWithdrawal.ts:238) | withdrawal requests | Pipeline withdrawal calls, company notices | none | privacy guard | see git | server/tests withdrawal | yes |
| T5 | Website capture deletion worker | worker (worker.ts:49) | 60 s (websiteCaptureDeletion.ts:390) | deletion queue | Storage deletes, websiteCaptureDeletionReceipts | none | privacy guard (comment worker.ts:48) | see git | server/tests deletion | yes |
| T6 | Job window sweep | worker (worker.ts:52) | 60 s, first at 15 s (websiteJobWindowSweep.ts:480) | inboundRequests job windows | ends expired jobs; site told | leader lease | comment worker.ts:50 | see git | server/tests job-window | yes |
| T7 | Automatic send to approved companies | worker (worker.ts:54) | 60 s, first at 20 s (jobAutoSend.ts:140) | listed jobs, robotTeamAccess | companySends, job_sent and robot_team_new_task emails | leader lease | package E, E4 | see git | server/tests job-auto-send | yes |
| T8 | Job outcome questions | worker (worker.ts:56) | 15 min (jobOutcomes.ts:183) | introductions | job_outcome_question emails | leader lease | package E, E8 | see git | e2e/job-outcomes.spec.ts | yes |
| T9 | Worker heartbeat | worker (worker.ts:58) | 60 s (workerHeartbeat.ts:20) | - | opsHeartbeats | none | comment worker.ts:57 | see git | server/tests heartbeat | yes |
| T10 | Automation leader lease | web + worker | interval (automationLeaderLease.ts) | opsAutomationLeases | lease doc | per-process without Redis (render.yaml:22) | founder decision 2026-10-14 | see git | server/tests lease | yes |
| T11 | Render cron blueprint-uptime-probe | Render cron | */10 * * * * (render.yaml:66) | /health, /version.json, /health/worker, paperclip.tryblueprint.io healthz | Slack on failure | none | render.yaml comment | see git | scripts/ops/uptime-probe.test.ts | yes |
| T12 | GitHub uptime workflow | GitHub Actions | cron */10 (runs every 2-5 h in practice, per uptime.yml:7) | same probe | fails the run, emails repo owner | none | uptime.yml comment | see git | - | yes |
| T13 | Client: OwnerRecordingWithdrawal poll | browser, site job page | setInterval (OwnerRecordingWithdrawal.tsx) | withdrawal status | - | while open | - | see git | e2e/site-answer.spec.ts | yes |
| T14 | Client: job status poll | browser, site job page | STATUS_POLL_TIMEOUT_MS 15 s (SelfCaptureUpload.tsx:94) | /api/self-capture/uploads/:token/status | - | while open | #1349 removed the trial-run poll 2026-11-20 | 2026-11-20 | e2e/site-private-link-reliability.spec.ts | yes |

Not found: no `node-cron`, no Cloud Scheduler or Firebase Functions in this repo; Render cron is the only scheduled job outside the two processes. The `render.yaml` worker comment says it is 'explicitly constrained to Task Evaluation launch reconciliation; unrelated ops processors stay off', but `server/worker.ts:45-58` starts all seven loops unconditionally; see IW-03.

### 5. External providers and services

| # | Provider | What it is for | Cost per call | Env key names | Where | Live |
|---|---|---|---|---|---|---|
| X1 | Firebase Auth / Firestore / Storage (Google) | accounts, all records, site videos | usage-billed (reads/writes/storage) | FIREBASE_SERVICE_ACCOUNT_JSON, VITE_FIREBASE_* | client/src/lib/firebaseAdmin.ts, firebase.ts | yes |
| X2 | Firebase App Check (reCAPTCHA) | bot check on intake | free tier | VITE_FIREBASE_APPCHECK_SITE_KEY, BLUEPRINT_APP_CHECK_MODE | server/middleware/appCheck.ts | unknown (mode off/monitor/enforce) |
| X3 | Resend | all email | per email above free tier | RESEND_API_KEY, RESEND_API_KEY_FILE, RESEND_FROM_EMAIL, RESEND_FROM_NAME, RESEND_WEBHOOK_SECRET | server/utils/email.ts | yes |
| X4 | OpenAI | agent tasks (brief reading, follow-up, robot-fit ranking), embeddings | yes, per token | OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_EMBEDDING_MODEL | server/agents/adapters/openai-responses.ts; retrieval/embeddings.ts (unreachable) | yes |
| X5 | Anthropic | agent tasks via Agent SDK | yes, per token | ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN | server/agents/adapters/anthropic-agent-sdk.ts | unknown |
| X6 | Google Gemini | site video evidence (video understanding) | yes, per token | GEMINI_API_KEY, GOOGLE_GENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_AI_STUDIO_API_KEY | server/agents/adapters/gemini-video.ts | unknown; BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED |
| X7 | World Labs | 3D world from video (capture app era) | yes, per world | WORLDLABS_API_KEY, WORLDLABS_API_BASE_URL, WORLDLABS_DEFAULT_MODEL | server/utils/worldlabs.ts, worldReconstruction.ts | no at runtime: only a type import reaches it (IW-05) |
| X8 | Google Maps / Places | location autocomplete on site start | yes, per request | VITE_GOOGLE_MAPS_API_KEY, GOOGLE_PLACES_API_KEY, GOOGLE_API_KEY | server/routes/location-autocomplete.ts, LocationAutocomplete.tsx | yes |
| X9 | Photon (komoot) | fallback geocoder | free | - | location-autocomplete.ts | yes |
| X10 | Twilio | SMS film-link handoff | yes, per SMS | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER | server/utils/sms.ts | unknown |
| X11 | Slack | ops alerts | free | SLACK_WEBHOOK_URL, SLACK_INBOUND_WEBHOOK_URL, SLACK_BOT_TOKEN | server/utils/slack.ts | unknown |
| X12 | Google Cloud KMS | field encryption key | per operation | FIELD_ENCRYPTION_KMS_KEY_NAME, FIELD_ENCRYPTION_MASTER_KEY | server/utils/field-encryption.ts | unknown |
| X13 | Redis | rate limits and lease when scaled | per instance | REDIS_URL, RATE_LIMIT_REDIS_URL | server/utils/rate-limit-redis.ts | no (waived, render.yaml:26) |
| X14 | Backblaze B2 | storage provider option | per GB | see storage-provider.ts | server/utils/storage-provider.ts | unknown |
| X15 | Sentry | client error tracking | plan | VITE_SENTRY_DSN, VITE_ENABLE_ERROR_TRACKING | client/src/lib/errorTracking.ts | unknown |
| X16 | PostHog / Google Analytics | analytics after consent | plan | VITE_PUBLIC_POSTHOG_HOST, VITE_GA_MEASUREMENT_ID | client/src/components/Analytics.tsx | unknown |
| X17 | Parallel web search | agent web search | yes | see web-search.ts | server/utils/web-search.ts | no: file unreachable |
| X18 | Calendly / founder call link | booking link in company approval email | free | BLUEPRINT_CALENDLY_URL, BLUEPRINT_FOUNDER_CALL_URL | server/utils/bookingLink.ts, robotTeamAccessEmails.ts | unknown |
| X19 | Pipeline control plane (paperclip.tryblueprint.io) | job launch, capture forwarding, reconstruction, job evidence | drives paid compute downstream | PIPELINE_SYNC_TOKEN, CAPTURE_UPLOAD_INTAKE_FORWARD_URL/TOKEN, TASK_EVALUATION_LAUNCH_URL, ROBOT_EVAL_JOB_REQUEST_FORWARD_URL/TOKEN, RECONSTRUCTION_PIPELINE_BASE_URL, CAPTURE_LIFECYCLE_PIPELINE_BASE_URL, JOB_EVIDENCE_PIPELINE_URL | server/utils/*Forward*.ts | yes |
| X20 | OpenClaw / ACP harness / Firehose | old agent runtimes | - | OPENCLAW_BASE_URL, ACP_HARNESS_URL, FIREHOSE_BASE_URL | server/agents/provider-config.ts, server/config/env.ts | unknown; likely vestigial (IW-12) |
| X21 | Dream Labs policy endpoint | robot software interface (early trial) | - | hard-coded https://api.dreamlabs.ai/v1/get_action | server/utils/policyIntegration.ts:123 | reachable code (via robotTeamSupply.ts, internal-capture-worlds.ts) |

### 6. Feature flags and environment switches

249 distinct env names are read in `client/src` and `server` (non-test). 17 are `VITE_*` (baked into the client at build). 142 appear in neither `render.yaml` nor the two Render env manifests (`render.required.env.example`, `render.optional.env.example`).
Production value: `render.yaml` sets only `BLUEPRINT_READINESS_REDIS_WAIVED=1` (web) and `BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1`, `BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER=true` (worker), `UPTIME_BASE_URL`, `UPTIME_CONTROL_PLANE_HEALTH_URL` (cron). Everything else is dashboard-managed: `unknown`. A name in the required manifest is expected to be set (`required manifest`).

| Name | Default in code | Read in (first of n files) | Files | Documented | Production |
|---|---|---|---|---|---|
| `ACP_DEFAULT_HARNESS` | "codex" | server/agents/provider-config.ts | 2 | optional manifest | unknown |
| `ACP_HARNESS_URL` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `ALLOWED_ORIGINS` | - | server/index.ts | 1 | none | unknown |
| `ANTHROPIC_API_KEY` | - | server/agents/adapters/anthropic-agent-sdk.ts | 2 | optional manifest | unknown |
| `ANTHROPIC_BASE_URL` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `ANTHROPIC_CUSTOM_HEADERS` | "" | server/agents/adapters/anthropic-agent-sdk.ts | 1 | none | unknown |
| `ANTHROPIC_DEFAULT_MODEL` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `ANTHROPIC_EFFORT` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `ANTHROPIC_TIMEOUT_MS` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `API_BODY_LIMIT` | - | server/index.ts | 1 | none | unknown |
| `APP_STORAGE_PROVIDER` | - | server/utils/storage-provider.ts | 1 | none | unknown |
| `APP_URL` | "https://tryblueprint.io" | server/routes/admin-robot-team-access.ts | 12 | required manifest | expected set (required manifest) |
| `B2_AUTH_CACHE_TTL_MS` | 30 | server/utils/storage-provider.ts | 1 | none | unknown |
| `B2_PUBLIC_BASE_URL` | "" | server/utils/storage-provider.ts | 1 | required manifest | expected set (required manifest) |
| `B2_UPLOAD_URL_CACHE_TTL_MS` | 10 | server/utils/storage-provider.ts | 1 | none | unknown |
| `BACKBLAZE_B2_PUBLIC_BASE_URL` | - | server/utils/storage-provider.ts | 1 | required manifest | expected set (required manifest) |
| `BASE_URL` | - | server/utils/launch-readiness.ts | 1 | render.yaml, required manifest, optional manifest | set by render.yaml |
| `BLUEPRINT_5XX_ALERT_MIN_RATIO` | - | server/utils/opsProcessAlerts.ts | 1 | none | unknown |
| `BLUEPRINT_5XX_ALERT_THRESHOLD` | - | server/utils/opsProcessAlerts.ts | 1 | none | unknown |
| `BLUEPRINT_5XX_ALERT_WINDOW_MS` | - | server/utils/opsProcessAlerts.ts | 1 | none | unknown |
| `BLUEPRINT_ADMIN_EMAIL_ALLOWLIST` | - | server/utils/access-control.ts | 2 | none | unknown |
| `BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK` | - | server/utils/access-control.ts | 1 | none | unknown |
| `BLUEPRINT_AGENT_EXECUTION_TTL_MS` | - | server/utils/agentRunRecord.ts | 1 | none | unknown |
| `BLUEPRINT_AGENT_HEARTBEAT_TTL_MS` | - | server/utils/agentRunRecord.ts | 1 | none | unknown |
| `BLUEPRINT_AGENT_RESERVATION_TTL_MS` | - | server/utils/agentRunRecord.ts | 1 | none | unknown |
| `BLUEPRINT_ALL_AUTOMATION_ENABLED` | - | server/config/env.ts | 1 | required manifest | expected set (required manifest) |
| `BLUEPRINT_ANALYTICS_INGEST_ENABLED` | - | server/routes/analytics-ingest.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_ANTHROPIC_AGENT_MAX_OUTPUT_TOKENS` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `BLUEPRINT_APP_CHECK_MODE` | - | server/middleware/appCheck.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER` | "" | server/agents/provider-config.ts | 1 | none | unknown |
| `BLUEPRINT_BETA_ALLOWED_MARKETS` | - | server/utils/beta-cohort-policy.ts | 1 | none | unknown |
| `BLUEPRINT_BETA_ALLOWED_SITE_TYPES` | - | server/utils/beta-cohort-policy.ts | 1 | none | unknown |
| `BLUEPRINT_BETA_COHORT_DAILY_LIMIT` | - | server/utils/beta-cohort-policy.ts | 1 | none | unknown |
| `BLUEPRINT_BETA_DEFAULT_COHORT` | - | server/utils/beta-cohort-policy.ts | 1 | none | unknown |
| `BLUEPRINT_BETA_ENABLED` | - | server/utils/beta-cohort-policy.ts | 1 | none | unknown |
| `BLUEPRINT_BETA_INVITE_CAP` | - | server/utils/beta-cohort-policy.ts | 1 | none | unknown |
| `BLUEPRINT_BETA_KILL_SWITCH` | - | server/utils/beta-cohort-policy.ts | 1 | none | unknown |
| `BLUEPRINT_BETA_OPS_MONITOR_ENABLED` | "" | server/utils/betaOpsMonitor.ts | 1 | none | unknown |
| `BLUEPRINT_BETA_OPS_MONITOR_INTERVAL_MS` | - | server/utils/betaOpsMonitor.ts | 1 | none | unknown |
| `BLUEPRINT_CALENDLY_URL` | - | server/utils/bookingLink.ts | 1 | none | unknown |
| `BLUEPRINT_CAPTURE_BUCKET` | - | server/utils/captureCoverageReview.ts | 2 | none | unknown |
| `BLUEPRINT_CAPTURE_STORAGE_BUCKET` | "blueprint-8c1ca.appspot.com" | server/utils/captureUploadIdentity.ts | 1 | none | unknown |
| `BLUEPRINT_CITY_LAUNCH_FROM_EMAIL` | "" | server/utils/email.ts | 1 | none | unknown |
| `BLUEPRINT_CITY_LAUNCH_FROM_NAME` | - | server/utils/email.ts | 1 | none | unknown |
| `BLUEPRINT_CITY_LAUNCH_REPLY_TO` | - | server/utils/email.ts | 1 | none | unknown |
| `BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION` | "" | server/utils/email.ts | 1 | none | unknown |
| `BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP` | - | server/config/bootstrap-env.ts | 1 | none | unknown |
| `BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER` | - | server/index.ts | 1 | none | unknown |
| `BLUEPRINT_E2E` | - | client/src/lib/firebaseAdmin.ts | 2 | none | unknown |
| `BLUEPRINT_E2E_ALLOW_LIVE_FIREBASE` | - | client/src/lib/firebaseAdmin.ts | 1 | none | unknown |
| `BLUEPRINT_E2E_STATIC` | - | server/index.ts | 1 | none | unknown |
| `BLUEPRINT_E2E_STATIC_DIR` | - | server/index.ts | 1 | none | unknown |
| `BLUEPRINT_EMAIL_DELIVERY_REQUIRED` | - | server/utils/launch-readiness.ts | 1 | none | unknown |
| `BLUEPRINT_EMAIL_TEST_REDIRECT` | - | server/utils/email.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_EMAIL_TEST_REDIRECT_UNTIL` | - | server/utils/email.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_ENV_FILE` | - | server/config/bootstrap-env.ts | 1 | none | unknown |
| `BLUEPRINT_FFMPEG_PATH` | - | server/agents/adapters/video-audio-strip.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_FIRESTORE_PREFER_REST` | - | client/src/lib/firebaseAdmin.ts | 1 | none | unknown |
| `BLUEPRINT_FOUNDER_CALL_URL` | "" | server/utils/robotTeamAccessEmails.ts | 1 | none | unknown |
| `BLUEPRINT_FOUNDER_EMAIL` | - | server/utils/email.ts | 1 | none | unknown |
| `BLUEPRINT_FOUNDER_SLACK_USER_ID` | "" | server/utils/slack.ts | 1 | none | unknown |
| `BLUEPRINT_HOSTED_SESSION_LIVE_PREFIX` | "hosted-session-live" | server/utils/hosted-session-live-store.ts | 1 | none | unknown |
| `BLUEPRINT_HOSTED_SESSION_LIVE_TTL_SECONDS` | 60 | server/utils/hosted-session-live-store.ts | 1 | none | unknown |
| `BLUEPRINT_HUMAN_BLOCKER_SLACK_USER_ID` | - | server/utils/slack.ts | 1 | none | unknown |
| `BLUEPRINT_INTAKE_DAILY_LIMIT` | - | server/utils/betaAbuseCaps.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_INTAKE_EMAIL_DAILY_LIMIT` | - | server/utils/betaAbuseCaps.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_INTAKE_EMAIL_PER_RECIPIENT_DAILY_LIMIT` | - | server/utils/betaAbuseCaps.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_INTAKE_OPS_NOTICE_ESCALATE_AFTER_MS` | - | server/utils/intakeOpsNotice.ts | 1 | none | unknown |
| `BLUEPRINT_INTAKE_OPS_NOTICE_MAX_ATTEMPTS` | - | server/utils/intakeOpsNotice.ts | 1 | none | unknown |
| `BLUEPRINT_INTAKE_OPS_NOTICE_RETRY_AFTER_MS` | - | server/utils/intakeOpsNotice.ts | 1 | none | unknown |
| `BLUEPRINT_INTAKE_PER_EMAIL_DAILY_LIMIT` | - | server/utils/betaAbuseCaps.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT` | - | server/utils/betaAbuseCaps.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_INVITEE_ALLOWLIST` | - | server/utils/inviteeAllowlist.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_LOCAL_LAUNCH_SMOKE` | - | server/utils/launch-readiness.ts | 1 | none | unknown |
| `BLUEPRINT_LOCAL_WEBAPP_ROUTE_PROOF_AUTH_TOKEN` | "" | server/middleware/verifyFirebaseToken.ts | 1 | none | unknown |
| `BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `BLUEPRINT_OPENAI_AGENT_MAX_INPUT_TOKENS` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_OPS_AUTOMATION_FORCE_LEADER` | "" | server/utils/automationLeaderLease.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_OPS_EMAIL_ALLOWLIST` | - | server/utils/access-control.ts | 2 | none | unknown |
| `BLUEPRINT_OUTBOX_BACKLOG_ALERT_AGE_MS` | - | server/utils/betaOpsMonitor.ts | 1 | none | unknown |
| `BLUEPRINT_OUTBOX_BACKLOG_ALERT_COUNT` | - | server/utils/betaOpsMonitor.ts | 1 | none | unknown |
| `BLUEPRINT_OUTBOX_HEALTH_STALLED_AGE_MS` | - | server/utils/captureOutboxHealth.ts | 1 | none | unknown |
| `BLUEPRINT_PIPELINE_SYNC_REQUIRED` | - | server/utils/launch-readiness.ts | 1 | none | unknown |
| `BLUEPRINT_PROVIDER_NO_FUNDS_COOLDOWN_MS` | "" | server/agents/provider-funds.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_READINESS_REDIS_WAIVED` | - | server/utils/launch-readiness.ts | 1 | render.yaml | set by render.yaml |
| `BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET` | - | server/utils/captureUploadToken.ts | 4 | optional manifest | unknown |
| `BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS` | "" | server/utils/robotTeamEarlyAccess.ts | 1 | none | unknown |
| `BLUEPRINT_SESSION_UI_TOKEN_SECRET` | - | server/utils/captureUploadToken.ts | 4 | none | unknown |
| `BLUEPRINT_SITE_ASSESSMENT_DAILY_USD_CAP` | - | server/utils/betaAbuseCaps.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_SITE_ASSESSMENT_REVIEW_USD_CAP` | - | server/utils/betaAbuseCaps.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED` | - | server/config/env.ts | 1 | none | unknown |
| `BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED` | - | server/config/env.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_SITE_VIDEO_EVIDENCE_MODEL` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_STORAGE_PROVIDER` | - | server/utils/storage-provider.ts | 1 | required manifest | expected set (required manifest) |
| `BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER` | "" | server/worker.ts | 1 | render.yaml, required manifest | set by render.yaml |
| `BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_WORKER_ENABLED` | - | server/utils/taskEvaluationLaunchForwardWorker.ts | 1 | required manifest | expected set (required manifest) |
| `BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_MAX_CLOCK_SKEW_MS` | - | server/utils/taskEvaluationLaunchSubmissionAuth.ts | 1 | required manifest | expected set (required manifest) |
| `BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_RATE_LIMIT_MAX` | - | server/utils/taskEvaluationLaunchSubmissionAuth.ts | 1 | required manifest | expected set (required manifest) |
| `BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_RATE_LIMIT_WINDOW_MS` | - | server/utils/taskEvaluationLaunchSubmissionAuth.ts | 1 | required manifest | expected set (required manifest) |
| `BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_SECRET` | "" | server/utils/taskEvaluationLaunchSubmissionAuth.ts | 1 | required manifest | expected set (required manifest) |
| `BLUEPRINT_TRUST_CF_CONNECTING_IP` | - | server/utils/clientIp.ts | 1 | none | unknown |
| `BLUEPRINT_TRUST_PROXY_HOPS` | - | server/utils/clientIp.ts | 1 | none | unknown |
| `BLUEPRINT_UPLOAD_DAILY_MB_LIMIT` | - | server/utils/betaAbuseCaps.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_UPLOAD_PER_JOB_DAILY_MB_LIMIT` | - | server/utils/betaAbuseCaps.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_VOICE_BOOKING_URL` | - | server/utils/bookingLink.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_WEBSITE_AGENTS_API_POLICY_JSON` | "null" | server/utils/websiteSceneSponsorship.ts | 1 | none | unknown |
| `BLUEPRINT_WEBSITE_AGENTS_API_TASK_DIGESTS` | "[]" | server/utils/websiteSceneSponsorship.ts | 1 | none | unknown |
| `BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON` | "[]" | server/utils/websiteAtlasAuthorization.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON` | "null" | server/utils/websiteAtlasAuthorization.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON` | "null" | server/utils/websiteAtlasAuthorization.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS` | "[]" | server/utils/websiteSceneSponsorship.ts | 1 | none | unknown |
| `BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_TASK_DIGESTS` | "[]" | server/utils/websiteSceneSponsorship.ts | 1 | none | unknown |
| `BLUEPRINT_WEBSITE_PREPARATION_FIRST_STATUS_ALERT_MS` | - | server/utils/websitePreparationWatch.ts | 1 | none | unknown |
| `BLUEPRINT_WEBSITE_PREPARATION_STUCK_ALERT_MS` | - | server/utils/websitePreparationWatch.ts | 1 | none | unknown |
| `BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON` | "null" | server/utils/websiteSceneSponsorship.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_WEBSITE_WITHDRAWAL_ACK_TIMEOUT_MS` | - | server/utils/websiteCaptureDeletion.ts | 1 | optional manifest | unknown |
| `BLUEPRINT_WORKER_HEARTBEAT_CHECK_ENABLED` | - | server/utils/betaOpsMonitor.ts | 1 | none | unknown |
| `BLUEPRINT_WORKER_HEARTBEAT_ENABLED` | - | server/utils/workerHeartbeat.ts | 1 | none | unknown |
| `BLUEPRINT_WORKER_HEARTBEAT_STALE_AFTER_MS` | - | server/utils/workerHeartbeat.ts | 1 | none | unknown |
| `CAPTURE_LIFECYCLE_FORWARD_TIMEOUT_MS` | - | server/utils/captureLifecycleForwarding.ts | 1 | none | unknown |
| `CAPTURE_LIFECYCLE_PIPELINE_BASE_URL` | - | server/utils/captureLifecycleForwarding.ts | 3 | optional manifest | unknown |
| `CAPTURE_UPLOAD_INTAKE_FORWARD_CLIENT_ID` | - | server/utils/captureLifecycleForwarding.ts | 3 | none | unknown |
| `CAPTURE_UPLOAD_INTAKE_FORWARD_REQUIRED` | - | server/utils/captureUploadForwarding.ts | 1 | none | unknown |
| `CAPTURE_UPLOAD_INTAKE_FORWARD_TIMEOUT_MS` | - | server/utils/captureUploadForwarding.ts | 1 | none | unknown |
| `CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN` | - | server/utils/captureLifecycleForwarding.ts | 4 | optional manifest | unknown |
| `CAPTURE_UPLOAD_INTAKE_FORWARD_URL` | - | server/utils/captureLifecycleForwarding.ts | 4 | optional manifest | unknown |
| `CAPTURE_UPLOAD_PART_SIZE_BYTES` | - | server/routes/capture-uploads.ts | 1 | none | unknown |
| `CODEX_AUTH_FILE` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `CODEX_DEFAULT_MODEL` | "gpt-5.4-mini" | server/agents/provider-config.ts | 2 | optional manifest | unknown |
| `CODEX_LOCAL_AVAILABLE` | "" | server/agents/provider-config.ts | 1 | none | unknown |
| `CODEX_LOCAL_COMMAND` | "codex" | server/agents/provider-config.ts | 1 | none | unknown |
| `COMPANY_MEDIA_DEADLINE_MS` | - | server/routes/company-media.ts | 1 | none | unknown |
| `COMPANY_MEDIA_IDLE_TIMEOUT_MS` | - | server/routes/company-media.ts | 1 | none | unknown |
| `CONTACT_TO` | "ops@tryblueprint.io" | server/utils/intakeOpsNotice.ts | 1 | none | unknown |
| `DEV` | - | client/src/components/site/SiteCaptureStart.tsx | 3 | none | unknown |
| `FIELD_ENCRYPTION_KMS_KEY_NAME` | - | server/utils/launch-readiness.ts | 1 | required manifest | expected set (required manifest) |
| `FIELD_ENCRYPTION_MASTER_KEY` | - | server/utils/launch-readiness.ts | 1 | required manifest | expected set (required manifest) |
| `FIREBASE_PROJECT_ID` | "blueprint-8c1ca" | server/utils/firebaseAuthProxy.ts | 1 | required manifest | expected set (required manifest) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | - | client/src/lib/firebaseAdmin.ts | 2 | required manifest | expected set (required manifest) |
| `FIREBASE_STORAGE_BUCKET` | "blueprint-8c1ca.appspot.com" | client/src/lib/firebaseAdmin.ts | 17 | required manifest, optional manifest | expected set (required manifest) |
| `FIREBASE_STORAGE_EMULATOR_HOST` | - | client/src/lib/firebaseAdmin.ts | 1 | none | unknown |
| `FIRESTORE_EMULATOR_HOST` | - | client/src/lib/firebaseAdmin.ts | 1 | none | unknown |
| `FUNCTION_TARGET` | - | client/src/lib/firebaseAdmin.ts | 1 | none | unknown |
| `GEMINI_API_KEY` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `GEMINI_VIDEO_MODEL` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `GOOGLE_AI_STUDIO_API_KEY` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `GOOGLE_APPLICATION_CREDENTIALS` | - | client/src/lib/firebaseAdmin.ts | 2 | none | unknown |
| `GOOGLE_CLOUD_PROJECT` | - | client/src/lib/firebaseAdmin.ts | 1 | none | unknown |
| `GOOGLE_GENAI_API_KEY` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `GOOGLE_GENERATIVE_AI_API_KEY` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `HEALTH_STATUS_TOKEN` | "" | server/routes/health.ts | 1 | none | unknown |
| `INTAKE_OWNER_EMAIL` | "ops@tryblueprint.io" | server/routes/inbound-request.ts | 1 | optional manifest | unknown |
| `IS_PULL_REQUEST` | - | server/utils/betaOpsMonitor.ts | 6 | none | unknown |
| `JOB_EVIDENCE_PIPELINE_URL` | - | server/utils/jobEvidenceContract.ts | 1 | none | unknown |
| `K_SERVICE` | - | client/src/lib/firebaseAdmin.ts | 1 | none | unknown |
| `LOG_LEVEL` | - | server/logger.ts | 1 | none | unknown |
| `MODE` | "development" | client/src/lib/client-env.ts | 3 | optional manifest | unknown |
| `NODE_ENV` | "development" | client/src/components/ErrorBoundary.tsx | 26 | render.yaml, required manifest | set by render.yaml |
| `OPENAI_API_KEY` | - | server/agents/adapters/openai-responses.ts | 4 | required manifest, optional manifest | expected set (required manifest) |
| `OPENAI_BASE_URL` | - | server/utils/openaiApiHost.ts | 1 | none | unknown |
| `OPENAI_DEFAULT_MODEL` | "gpt-5.4" | server/agents/provider-config.ts | 2 | optional manifest | unknown |
| `OPENAI_EMBEDDING_MODEL` | "text-embedding-3-small" | server/retrieval/embeddings.ts | 1 | none | unknown |
| `OPENAI_REASONING_EFFORT` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `OPENAI_TIMEOUT_MS` | - | server/agents/provider-config.ts | 1 | optional manifest | unknown |
| `OPENCLAW_BASE_URL` | - | server/agents/provider-config.ts | 1 | none | unknown |
| `OPENCLAW_DEFAULT_MODEL` | "openai/gpt-5.4" | server/agents/provider-config.ts | 2 | none | unknown |
| `PAPERCLIP_ENV_FILE` | - | server/config/bootstrap-env.ts | 1 | none | unknown |
| `PIPELINE_SYNC_ALLOWED_GCS_PREFIXES` | "" | server/utils/pipelineSyncSecurity.ts | 1 | none | unknown |
| `PIPELINE_SYNC_ALLOW_LEGACY_BEARER` | - | server/utils/pipelineSyncSecurity.ts | 1 | none | unknown |
| `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS` | "" | server/routes/internal-pipeline.ts | 1 | none | unknown |
| `PIPELINE_SYNC_GCS_BUCKET` | "" | server/utils/pipelineSyncSecurity.ts | 1 | none | unknown |
| `PIPELINE_SYNC_MAX_CLOCK_SKEW_MS` | - | server/utils/pipelineSyncSecurity.ts | 1 | none | unknown |
| `PIPELINE_SYNC_TOKEN` | "" | server/utils/captureUploadToken.ts | 6 | required manifest | expected set (required manifest) |
| `PORT` | 5000 | server/index.ts | 2 | required manifest | expected set (required manifest) |
| `RATE_LIMIT_AUTH_MAX` | 20 | server/index.ts | 1 | none | unknown |
| `RATE_LIMIT_AUTH_WINDOW_MS` | 15 | server/index.ts | 1 | none | unknown |
| `RATE_LIMIT_MAX` | 300 | server/index.ts | 1 | required manifest | expected set (required manifest) |
| `RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS` | - | server/utils/rate-limit-redis.ts | 1 | none | unknown |
| `RATE_LIMIT_REDIS_URL` | - | server/utils/launch-readiness.ts | 2 | optional manifest | unknown |
| `RATE_LIMIT_WINDOW_MS` | 15 | server/index.ts | 1 | required manifest | expected set (required manifest) |
| `RECONSTRUCTION_FORWARD_CLIENT_ID` | - | server/utils/reconstructionForwarding.ts | 1 | none | unknown |
| `RECONSTRUCTION_FORWARD_TIMEOUT_MS` | - | server/utils/reconstructionForwarding.ts | 1 | none | unknown |
| `RECONSTRUCTION_FORWARD_TOKEN` | - | server/utils/reconstructionForwarding.ts | 1 | none | unknown |
| `RECONSTRUCTION_PIPELINE_BASE_URL` | - | server/utils/reconstructionForwarding.ts | 1 | none | unknown |
| `REDIS_URL` | - | server/utils/hosted-session-live-store.ts | 3 | render.yaml, optional manifest | set by render.yaml |
| `RENDER_GIT_COMMIT` | - | server/utils/captureOutbox.ts | 2 | none | unknown |
| `RENDER_INSTANCE_ID` | - | server/utils/captureOutbox.ts | 1 | none | unknown |
| `RENDER_SERVICE_ID` | - | server/utils/captureOutbox.ts | 1 | required manifest, optional manifest | expected set (required manifest) |
| `RENDER_SERVICE_NAME` | - | server/utils/opsProcessAlerts.ts | 1 | none | unknown |
| `RESEND_API_KEY` | - | server/utils/email.ts | 1 | required manifest | expected set (required manifest) |
| `RESEND_API_KEY_FILE` | - | server/utils/email.ts | 1 | none | unknown |
| `RESEND_FROM_EMAIL` | "" | server/utils/email.ts | 1 | required manifest | expected set (required manifest) |
| `RESEND_FROM_NAME` | "Blueprint" | server/utils/email.ts | 1 | optional manifest | unknown |
| `ROBOT_EVAL_JOB_REQUEST_FORWARD_CLIENT_ID` | "blueprint-webapp" | server/utils/jobEvidenceContract.ts | 1 | none | unknown |
| `ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN` | "" | server/routes/internal-task-evaluation-launches.ts | 5 | required manifest, optional manifest | expected set (required manifest) |
| `ROBOT_EVAL_JOB_REQUEST_FORWARD_URL` | "" | server/utils/jobEvidenceContract.ts | 3 | required manifest, optional manifest | expected set (required manifest) |
| `SELF_CAPTURE_BUNDLE_PLAN_BODY_LIMIT` | "8mb" | server/index.ts | 1 | none | unknown |
| `SELF_CAPTURE_MAX_BUNDLE_BYTES` | - | server/utils/siteCaptureBundle.ts | 1 | none | unknown |
| `SELF_CAPTURE_MAX_BUNDLE_FILES` | - | server/utils/siteCaptureBundle.ts | 1 | none | unknown |
| `SELF_CAPTURE_MAX_BUNDLE_SIDECAR_BYTES` | - | server/utils/siteCaptureBundle.ts | 1 | none | unknown |
| `SELF_CAPTURE_MAX_PART_BYTES` | - | server/routes/self-capture-uploads.ts | 1 | none | unknown |
| `SELF_CAPTURE_MAX_UPLOAD_BYTES` | - | server/routes/self-capture-uploads.ts | 1 | none | unknown |
| `SITEMAP_LASTMOD_DATE` | - | server/utils/public-artifacts.ts | 1 | none | unknown |
| `SLACK_BOT_TOKEN` | "" | server/utils/slack.ts | 1 | none | unknown |
| `SLACK_INBOUND_WEBHOOK_URL` | - | server/utils/intakeOpsNotice.ts | 3 | none | unknown |
| `SLACK_WEBHOOK_URL` | "" | server/utils/intakeOpsNotice.ts | 4 | render.yaml, required manifest | set by render.yaml |
| `SOLUTIONS_OWNER_EMAIL` | "ops@tryblueprint.io" | server/routes/inbound-request.ts | 1 | none | unknown |
| `SOURCE_DATE_EPOCH` | - | server/utils/public-artifacts.ts | 1 | none | unknown |
| `STORAGE_PROVIDER` | - | server/utils/storage-provider.ts | 1 | required manifest | expected set (required manifest) |
| `TASK_EVALUATION_LAUNCH_FORWARD_MAX_ATTEMPTS` | 20 | server/utils/taskEvaluationLaunchForwardWorker.ts | 2 | required manifest | expected set (required manifest) |
| `TASK_EVALUATION_LAUNCH_FORWARD_REQUIRED` | "" | server/utils/taskEvaluationLaunchContract.ts | 1 | required manifest | expected set (required manifest) |
| `TASK_EVALUATION_LAUNCH_FORWARD_RETRY_BASE_MS` | 60_000 | server/utils/taskEvaluationLaunchForwardWorker.ts | 1 | none | unknown |
| `TASK_EVALUATION_LAUNCH_FORWARD_WORKER_INTERVAL_MS` | 60_000 | server/utils/taskEvaluationLaunchForwardWorker.ts | 1 | none | unknown |
| `TASK_EVALUATION_LAUNCH_PROFILES_JSON` | - | server/utils/taskEvaluationLaunchContract.ts | 1 | required manifest | expected set (required manifest) |
| `TASK_EVALUATION_LAUNCH_PROFILES_URL` | "" | server/utils/taskEvaluationLaunchContract.ts | 1 | required manifest | expected set (required manifest) |
| `TASK_EVALUATION_LAUNCH_STORE_READINESS_CACHE_MS` | - | server/utils/taskEvaluationLaunchStore.ts | 1 | none | unknown |
| `TASK_EVALUATION_LAUNCH_STORE_TIMEOUT_MS` | - | server/utils/taskEvaluationLaunchStore.ts | 1 | required manifest | expected set (required manifest) |
| `TASK_EVALUATION_LAUNCH_URL` | - | server/utils/taskEvaluationLaunchContract.ts | 2 | required manifest | expected set (required manifest) |
| `TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET` | "" | server/utils/taskEvaluationResultDownloadTicket.ts | 1 | required manifest | expected set (required manifest) |
| `TASK_EVALUATION_RUN_FORWARD_CLIENT_ID` | - | server/utils/jobEvidenceContract.ts | 1 | required manifest | expected set (required manifest) |
| `TASK_EVALUATION_RUN_FORWARD_TIMEOUT_MS` | 10_000 | server/utils/taskEvaluationLaunchContract.ts | 1 | none | unknown |
| `TASK_EVALUATION_RUN_FORWARD_TOKEN` | - | server/utils/jobEvidenceContract.ts | 1 | required manifest | expected set (required manifest) |
| `TASK_EVALUATION_RUN_PLAN_URL` | - | server/utils/jobEvidenceContract.ts | 1 | none | unknown |
| `TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON` | "{}" | server/utils/taskEvaluationSceneIntake.ts | 1 | optional manifest | unknown |
| `TWILIO_ACCOUNT_SID` | "" | server/utils/sms.ts | 1 | optional manifest | unknown |
| `TWILIO_AUTH_TOKEN` | "" | server/utils/sms.ts | 1 | optional manifest | unknown |
| `TWILIO_PHONE_NUMBER` | "" | server/utils/sms.ts | 1 | optional manifest | unknown |
| `VITEST` | - | server/config/bootstrap-env.ts | 1 | none | unknown |
| `VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH` | - | client/src/lib/operatorQaAuth.ts | 2 | none | unknown |
| `VITE_ENABLE_ERROR_TRACKING` | - | client/src/lib/errorTracking.ts | 1 | optional manifest | unknown |
| `VITE_ENABLE_ERROR_TRACKING_SMOKE_TEST` | - | client/src/lib/errorTracking.ts | 1 | optional manifest | unknown |
| `VITE_FIREBASE_API_KEY` | - | client/src/lib/firebase.ts | 1 | required manifest | expected set (required manifest) |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | - | client/src/lib/client-env.ts | 2 | optional manifest | unknown |
| `VITE_FIREBASE_APP_ID` | - | client/src/lib/firebase.ts | 1 | required manifest | expected set (required manifest) |
| `VITE_FIREBASE_AUTH_DOMAIN` | - | client/src/lib/firebase.ts | 1 | required manifest | expected set (required manifest) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | - | client/src/lib/firebase.ts | 1 | required manifest | expected set (required manifest) |
| `VITE_FIREBASE_PROJECT_ID` | - | client/src/lib/firebase.ts | 1 | required manifest | expected set (required manifest) |
| `VITE_FIREBASE_STORAGE_BUCKET` | "" | client/src/lib/firebase.ts | 2 | required manifest | expected set (required manifest) |
| `VITE_GOOGLE_API_KEY` | - | client/src/lib/client-env.ts | 1 | none | unknown |
| `VITE_GOOGLE_APP_ID` | - | client/src/lib/client-env.ts | 1 | optional manifest | unknown |
| `VITE_GOOGLE_CLIENT_ID` | - | client/src/lib/client-env.ts | 1 | optional manifest | unknown |
| `VITE_GOOGLE_MAPS_API_KEY` | - | client/src/lib/client-env.ts | 1 | optional manifest | unknown |
| `VITE_PUBLIC_APP_URL` | "https://tryblueprint.io" | client/src/lib/client-env.ts | 6 | required manifest | expected set (required manifest) |
| `VITE_PUBLIC_POSTHOG_HOST` | - | server/index.ts | 1 | optional manifest | unknown |
| `VITE_SENTRY_DSN` | - | client/src/lib/errorTracking.ts | 1 | optional manifest | unknown |

### 7. Admin and operator pages

| Page | Who | What it shows | What it does (API) | Last change | Test | Live |
|---|---|---|---|---|---|---|
| /admin/jobs (AdminJobConsole.tsx) | admin, ops | every job: state, workflow evidence, the companies it went to, sends, responses, robot fit, site measurements, simulation download, scene preview, account deletion queue | GET /api/admin/jobs[/:id]; record a send / void it; record an emailed response; hold (stop showing to companies); robot-fit ranking (paid model call); site measurements source document; job-workflow evidence questions; account-deletion review | 2026-11-17 | e2e/job-companies.spec.ts via npm run qa:operator (CI) | yes |
| /admin/robot-team-access (AdminRobotTeamAccess.tsx) | admin, ops | company applications and their status; invitation delivery status; a reviewed job recommendation | approve / decline (sends approval email); invite a team you spoke with; refresh invitation link; decide a robot-team recommendation | 2026-11-19 | client/tests/admin-team-invitation-status.test.tsx | yes |
| /app/captures (app/Captures.tsx) | admin, ops (staff tool since 2026-11-20, routes.tsx:332) | staff capture uploads (phone, 360, mesh), their lifecycle and 3D scene plans with estimated and actual cost | create upload, upload parts, complete, process, delete; plan / authorize / execute a reconstruction (forwards to Pipeline: paid compute) | 2026-11-14 | none found | yes |
| /admin/leads, /admin/leads/:id, /ops, /ops/supply, /ops/evidence, /ops/handoff | admin, ops | redirect to /admin/jobs | - | 2026-11-21 | e2e/redirects.spec.ts (partly) | yes |
| Account deletion queue (components/admin/AccountDeletionQueue.tsx) | admin, ops (inside /admin/jobs) | privacy requests | GET/POST /api/account-deletion/admin | see git | e2e/account-deletion.spec.ts (requester side) | yes |
| Admin robot-team registry API (no page) | admin | - | GET /api/admin/robot-teams, proposals, supply agreements: no page calls them (section 3a) | see git | server/tests | yes (API only) |

### 8. Firestore collections and Storage paths

| Collection | Code files (reachable) | Writers (sample) | Holds personal data | Production docs (baseline) | Retired system |
|---|---|---|---|---|---|
| `__blueprintHealth` | 1 (1) | - | no / unverified | not counted | - |
| `accountDeletionRequests` | 1 (1) | - | yes: uid/email | not counted | - |
| `agentCheckpoints` | 1 (1) | - | no / unverified | 0 | - |
| `agentRuns` | 6 (6) | runtime.ts | maybe: prompts with job text | 2478 | - |
| `agentRuntimeEvents` | 1 (1) | - | no / unverified | 0 | - |
| `agentSessions` | 1 (1) | runtime.ts | no / unverified | 0 | - |
| `automationCursors` | 2 (2) | automationBatch.ts | no / unverified | 26 | - |
| `betaCohortAdmissions` | 1 (1) | beta-cohort-policy.ts | maybe: email | 41 | screening campaigns (unverified) |
| `billableEvents` | 2 (2) | - | no / unverified | not counted | - |
| `buyerOutcomes` | 1 (1) | buyerOutcomes.ts | no / unverified | 0 | - |
| `calls` | 3 (2) | - | no / unverified | 0 | screening calls (unverified) |
| `captureCoverageRequeueAudits` | 1 (0) | - | no / unverified | not counted | unreachable writer |
| `captureCoverageReviews` | 4 (3) | - | no / unverified | 55 | - |
| `captureOutbox` | 14 (14) | captureOutbox.ts, inboundRequestCommit.ts | yes: recipient email; introduction bodies cleared after send | 143 | - |
| `captureSiteTaskTestbeds` | 1 (1) | - | no / unverified | 0 | - |
| `captureSupplements` | 8 (8) | captureSupplement.ts | site media refs | 0 | - |
| `captureTaskEvaluationRuns` | 2 (2) | - | no / unverified | 95 | early trial |
| `captureUploadSessions` | 36 (36) | capture-uploads.ts, websiteScenePreview.ts | yes: uploader uid, file metadata | 34 | - |
| `capture_submissions` | 1 (1) | internal-pipeline.ts | no / unverified | 5 | - |
| `clarifications` | 1 (1) | - | yes: site/company text | 0 | - |
| `companySends` | 3 (3) | jobAutoSend.ts | company id | 0 | - |
| `companyViews` | 2 (2) | companyJobViews.ts | company uid | not counted | - |
| `creatorCaptures` | 1 (1) | - | no / unverified | 0 | capture app |
| `deliveryReceipts` | 1 (1) | - | no / unverified | 0 | - |
| `durableDailyCapReceipts` | 1 (1) | - | no / unverified | not counted | - |
| `durableDailyCaps` | 1 (1) | durableDailyCaps.ts | no / unverified | not counted | - |
| `email_suppressions` | 3 (3) | - | yes: email | 4 | - |
| `evaluationRuns` | 2 (2) | - | no / unverified | 37 | early trial / paid evaluations |
| `experiment_rollouts` | 1 (1) | - | no / unverified | 2 | - |
| `exports` | 1 (1) | - | no / unverified | 0 | - |
| `footageProposals` | 2 (1) | grantedBriefRestore.ts | site media refs | 0 | - |
| `growthCampaigns` | 1 (1) | resend-webhook.ts | maybe | 58 | outreach campaigns |
| `growth_campaign_events` | 1 (1) | resend-webhook.ts | yes: recipient | 403 | outreach campaigns |
| `growth_events` | 1 (1) | growth-events.ts | maybe: event payloads | 1247 | - |
| `inboundRequests` | 73 (70) | admin-robot-teams.ts, inbound-request.ts | yes: site name, address, contact, job text | 76 | - |
| `introductions` | 5 (5) | jobIntroductionGate.ts | yes: both sides' identity | 0 | - |
| `jobEvidencePublications` | 1 (1) | - | no / unverified | 0 | - |
| `jobEvidenceRequests` | 3 (3) | - | no / unverified | 0 | - |
| `marketplaceEntitlements` | 1 (1) | - | buyer ids | 39 | paid evaluations / marketplace |
| `operatingGraphState` | 1 (1) | operatingGraph.ts | no / unverified | not counted | - |
| `opsActionLogs` | 1 (1) | ops-action-logs.ts | maybe | 4834 | - |
| `opsAlertSignals` | 1 (1) | - | no / unverified | 5 | - |
| `opsAlerts` | 1 (1) | ops-alerts.ts | no / unverified | 4 | - |
| `opsAutomationLeases` | 1 (1) | automationLeaderLease.ts | no / unverified | not counted | - |
| `opsHeartbeats` | 1 (1) | - | no / unverified | not counted | - |
| `opsOutboxFailureAlerts` | 1 (1) | betaOpsMonitor.ts | no / unverified | not counted | - |
| `opsOwnerSuccessHoldAlerts` | 1 (1) | - | no / unverified | not counted | - |
| `opsWebsiteEvaluationHoldAlerts` | 1 (1) | - | no / unverified | not counted | - |
| `opsWebsiteJobOverBudgetAlerts` | 3 (3) | websitePreparationOpsAlerts.ts, websiteSceneSponsorship.ts | no / unverified | 0 | - |
| `opsWebsiteSceneIntakeAlerts` | 1 (1) | - | no / unverified | not counted | - |
| `pilotOpsAlerts` | 1 (0) | pilotOpsAlerts.ts | no / unverified | not counted | pilots (unreachable writer) |
| `pipelinePayloadQuarantine` | 1 (1) | - | no / unverified | not counted | - |
| `pipelineUnknownCodes` | 1 (1) | unknownPipelineCode.ts | no / unverified | not counted | - |
| `progressEvents` | 1 (1) | - | no / unverified | 0 | - |
| `rankings` | 1 (1) | - | no / unverified | 0 | - |
| `revisions` | 1 (1) | - | no / unverified | 0 | - |
| `robotTeamAccess` | 14 (14) | workspace.ts, companyTerms.ts | yes: company contact | 1 | - |
| `robotTeamCapabilityProposals` | 1 (1) | robotTeamRegistry.ts | no / unverified | not counted | - |
| `robotTeamInterest` | 6 (6) | admin-robot-teams.ts | company id | 0 | - |
| `robotTeams` | 4 (3) | robotTeamRegistry.ts | no / unverified | not counted | - |
| `shards` | 1 (1) | - | no / unverified | not counted | - |
| `siteAssessmentJobs` | 3 (3) | - | no / unverified | 21 | - |
| `siteRobotFit` | 1 (1) | - | no / unverified | not counted | - |
| `siteTaskBriefs` | 24 (22) | site-task-brief.ts, captureCoverageReview.ts | yes: job description | 57 | - |
| `siteTaskFollowups` | 1 (1) | site-task-brief.ts | yes: site answers | 7 | - |
| `siteTaskItemInventories` | 13 (12) | taskItemInventory.ts | maybe: object descriptions | 27 | - |
| `siteTaskMeasurements` | 1 (1) | - | no / unverified | not counted | - |
| `siteTaskQualifications` | 1 (1) | siteTaskQualificationReceipt.ts | no / unverified | 0 | - |
| `stats` | 1 (1) | - | no / unverified | not counted | - |
| `supplyAgreementEvents` | 1 (1) | - | no / unverified | not counted | robot-team supply (no caller) |
| `taskEvaluationLaunchPreparations` | 1 (1) | - | no / unverified | not counted | early trial naming |
| `taskEvaluationLaunches` | 1 (1) | - | no / unverified | 524 | early trial naming (current launch path per #1300) |
| `taskEvaluationPolicyRuns` | 6 (6) | - | no / unverified | 121 | early trial |
| `taskEvaluationSceneIntakes` | 6 (6) | - | no / unverified | 23 | early trial naming |
| `taskTargetChoiceHistory` | 1 (1) | websiteTaskTargetChoice.ts | no / unverified | 0 | - |
| `taskThumbnails` | 1 (1) | site-worlds.ts | no / unverified | 0 | - |
| `users` | 6 (6) | workspace.ts | yes: email, name | 456 | - |
| `websiteCaptureDeletionReceipts` | 1 (1) | websiteCaptureDeletion.ts | no / unverified | not counted | - |

Rules-only collections (in `firestore.rules`, no code reference found): `action_ledger`, `contactRequests`, `humanBlockerDispatches`, `humanBlockerThreads`, `humanReplyEvents`, `leadRoutingConfig`, `notes`, `operatingGraphEvents`, `publishedMarketplaceInventory`, `scenes`. These are Paperclip-era and marketplace-era leftovers; most are `allow read, write: if false`.

Storage paths (`storage.rules`, last change 2026-11-13; shared with the Capture repo, last writer wins, `storage.rules:144`):

| Path | Client writable by | Size bound | Written by current code | Personal data | Retired system |
|---|---|---|---|---|---|
| scenes/{scene}/captures/{capture}/raw/** | signed-in owner of the capture submission | 20 GiB per object | yes: site videos land here via server-signed uploads | yes: site video | rule exists for the Android capture app (storage.rules:145-153) |
| captures/{uid}/** | any signed-in user, own uid | 500 MB per object | yes: staff capture uploads (capture-uploads.ts) | yes | capture app era |
| capture-artifacts/{uid}/** | any signed-in user, own uid | 500 MB | no reference in code (storage-provider.ts:218 prefix list only) | maybe | capture app |
| users/{uid}/**, accounts/{uid}/** | any signed-in user, own uid | ownerFileUpload | no client writer found | maybe | old onboarding uploads |
| blueprints/{id}/** | owner of a Firestore blueprint record | 100 MB | no reference except storage-provider.ts:213 | maybe | original Blueprint product |
| menus/{file} | any signed-in user (owner metadata) | 10 MB, no count limit | no reference except storage-provider.ts:214 | maybe | original Blueprint product |
| marketplace-artifacts/{entitlement}/** | admin only (read with entitlement) | - | no | buyer data | paid evaluations / marketplace |

### 9. Tests

Unit and integration: Vitest (`vitest.config.ts`) over `client/tests` (106 files), `client/src/lib/*.test.ts`, `server/tests` (340 files) and `scripts/**/*.test.*`. CI runs only changed-file tests plus required safety checks (`node scripts/release/checks.mjs test`, `.github/workflows/ci.yml:227`). Rules tests: `npm run test:rules` (emulator, CI yes).
Baseline (orchestrator, this commit): `npm run check` exit 0 in 27 s; `npx vitest run client/tests` exit 0 in 48 s; `npm run test:core-journey` exit 0 in 67 s; `npm run build` exit 1 without client Firebase config and exit 0 with `BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1` (`scratchpad/baseline/summary.log`).

| Playwright config | Specs | Covers | In CI | Last change |
|---|---|---|---|---|
| playwright.config.ts | every e2e spec except the 8 ignored + workspace + job-companies | public pages, redirects, sign-in, signup, job outcomes, site answer, splat viewer, cookie consent, pricing copy | yes: `npm run test:e2e` (ci.yml e2e job, scope full) | 2026-11-14 |
| playwright.answer-journey.config.ts | site-answer-journey.spec.ts | email and video in, shared automatically, a company answers, the site asks for an introduction (emulators) | yes: `npm run test:core-journey` (ci.yml:204) | 2026-11-11 |
| (qa:operator) scripts/qa/run-operator-surfaces.ts | job-companies.spec.ts | admin records sends, responses, hold; company opens a job | yes (ci.yml) | - |
| playwright.workspace.config.ts | workspace-account-setup.spec.ts | settings and account type | yes | 2026-11-14 |
| playwright.invited-beta.config.ts | invited-site-beta.spec.ts | invited site journey with fixture APIs | yes | 2026-10-06 |
| playwright.site-reliability.config.ts | site-private-link-reliability.spec.ts, site-intake-first.spec.ts | private links, retained capture handoff | yes | 2026-10-26 |
| playwright.reliability-intake.config.ts | reliability-program-intake.spec.ts | intake recovery, cross-tab authority | yes | 2026-11-14 |
| playwright.privacy.config.ts | account-deletion, cookie-consent, privacy-pages | consent, privacy requests | yes | 2026-10-19 |
| playwright.result-consumer.config.ts | invited-site-beta.spec.ts | same spec as invited-beta (duplicate config) | no (only via invited-beta, which spreads it) | 2026-11-14 |
| playwright.intake.config.ts | site-intake-recovery.spec.ts (264 lines) | lost create response, country, email hints | NO | 2026-10-08 |
| playwright.intake-backend.config.ts | site-intake-backend-reliability.spec.ts (159 lines) | intake backend reliability | NO | 2026-10-08 |
| playwright.intake-durability.config.ts | site-intake-durability.spec.ts (262 lines) | local draft durability, fenced writers | NO | 2026-10-08 |

E2E specs (28 files). Last change and size:

| Spec | Lines | Last change | Run by |
|---|---|---|---|
| e2e/account-deletion.spec.ts | 87 | 2026-11-20 | privacy |
| e2e/contact.spec.ts | 143 | 2026-11-20 | default |
| e2e/cookie-consent.spec.ts | 81 | 2026-11-20 | privacy (also default) |
| e2e/description-first-intake.spec.ts | 147 | 2026-11-20 | default |
| e2e/home.spec.ts | 25 | 2026-11-21 | default |
| e2e/invited-site-beta.spec.ts | 174 | 2026-11-20 | invited-beta |
| e2e/job-companies.spec.ts | 174 | 2026-11-20 | qa:operator |
| e2e/job-outcomes.spec.ts | 27 | 2026-11-20 | default |
| e2e/login.spec.ts | 12 | 2026-11-11 | default |
| e2e/onboarding-p1.spec.ts | 297 | 2026-11-20 | default |
| e2e/onboarding.spec.ts | 17 | 2026-11-11 | default |
| e2e/pricing.spec.ts | 55 | 2026-11-20 | default |
| e2e/privacy-pages.spec.ts | 35 | 2026-11-20 | privacy (also default) |
| e2e/redirects.spec.ts | 193 | 2026-11-20 | default |
| e2e/reliability-program-intake.spec.ts | 369 | 2026-11-20 | reliability-intake |
| e2e/signup-simple.spec.ts | 47 | 2026-11-20 | default |
| e2e/site-answer-journey.spec.ts | 443 | 2026-11-20 | core-journey |
| e2e/site-answer.spec.ts | 424 | 2026-11-20 | default |
| e2e/site-intake-backend-reliability.spec.ts | 159 | 2026-11-20 | NOT IN CI |
| e2e/site-intake-durability.spec.ts | 262 | 2026-11-20 | NOT IN CI |
| e2e/site-intake-first.spec.ts | 60 | 2026-11-20 | site-reliability |
| e2e/site-intake-recovery.spec.ts | 264 | 2026-11-20 | NOT IN CI |
| e2e/site-led-public.spec.ts | 99 | 2026-11-20 | default |
| e2e/site-private-link-reliability.spec.ts | 549 | 2026-11-20 | site-reliability |
| e2e/splat-viewer.spec.ts | 249 | 2026-11-12 | default |
| e2e/workspace-account-setup.spec.ts | 241 | 2026-11-20 | workspace |

Note: `pricing.spec.ts` is named for retired pricing; it now checks that historical pricing URLs land on the free beta page.

### 10. Remains of retired systems

Counted by file name (source files only, tests separate), then by keyword mentions across `client/src`, `server`, `scripts`, `e2e`, `client/tests`. 'Reachable' is from the three entry points (any import).

| Retired system | Source files by name | Lines | Reachable | Test files | Test lines | Files mentioning keyword | Mentions | What still imports it | Live |
|---|---|---|---|---|---|---|---|---|---|
| Early trial of robot software in the simulation (dropped 2026-11-14) | 34 | 10514 | 34 | 16 | 6426 | 87 (TaskEvaluation) + 24 (policy canary / policyIntegration) | 670 + 118 | server/routes.ts mounts 5 internal routers (internal-task-evaluation-*, internal-scene-execution-window, internal-owner-success-proposal); worker.ts starts the launch forwarder; robotTeamSupply.ts imports policyIntegration.ts; jobOutlook phases 'testing'/'result'. Part of this is the current job-launch path renamed from the trial (#1300), so not all of it is removable. | yes |
| Screening campaigns | 6 | 683 | 6 | 4 | 713 | 112 | 897 | internal-beta-policy-screening.ts mounted at routes.ts:71; betaPolicyScreeningHold.ts; sceneScreening.ts; client data screeningProgressGrader.ts | yes |
| Paid evaluations, checkout, pricing, entitlements | 5 | 518 | 4 | 2 | 166 | 80 | 514 | evaluationPricing.ts (173 lines) imported by nothing; entitlementExpiry.ts reachable; Firestore marketplaceEntitlements has 39 docs; storage marketplace-artifacts rule; /pricing and /refunds redirects | partly |
| Capture app and outside capturers | 5 | 1797 | 5 | 1 | 79 | 66 | 203 | retiredCapturerRoutes.ts (410 answers, keep); siteCaptureBundle*.ts (1,502 lines) for 'app_bundle_completion'; captureDispatch.ts; 14 client redirect routes; storage rule for Android app uploads up to 20 GiB | yes |
| Blueprint filming visits | 0 | 0 | 0 | 0 | 0 | 32 | 58 | mentions only (copy, comments, frozen legal pages, COMPANY address note in data/company.ts:20) | copy only |
| Old onboarding checklist | 2 | 50 | 2 | 1 | 17 | 5 | 11 | route /onboarding -> OnboardingChecklist.tsx (forwards only); siteOnboarding.ts used by BusinessSignUpFlow; firebase.ts:230 onboardingStep/onboardingProgress fields | yes (forwarder) |
| Marketplace / world-model pages | 10 | 2536 | 9 | 0 | 0 | 82 | 365 | site-worlds route (serves the current company job library, so the name is old, the use is current); deploymentMarket.ts (1,068 lines) runtime-dead; siteWorlds.ts unimported; worldModelProfiles/worldlabs/worldReconstruction runtime-dead; 8 world-model/site-worlds redirect routes | partly |
| Paperclip agent roles | 0 | 0 | 0 | 0 | 0 | 10 | 24 | provider-privacy.ts:224 (DeepSeek note), bootstrap-env.ts:75 reads ../.paperclip-blueprint.env, web-search.ts session id 'blueprint-paperclip', agentCostTelemetry.ts paperclip_issue_id; uptime probe hits paperclip.tryblueprint.io (the control-plane host still carries the name) | host name live |
| Notion sync | 0 | 0 | 0 | 0 | 0 | 9 | 24 | no code; Privacy.tsx:154 (live) and 6 frozen versions list Notion as a processor 'Internal operations and support records'; scripts/qa/brand-polish.ts checklist | copy only |

Early-trial files by name (all reachable through the import graph): `client/src/lib/robotTeamTestSubmission.ts` (1,123, runtime-dead: only a type import), `server/utils/taskEvaluationSceneIntake.ts` (1,176), `taskEvaluationRunContract.ts` (991), `taskEvaluationLaunchPreparationContract.ts` (886), `evaluationReadyRunContract.ts` (865), `taskEvaluationLaunchContract.ts` (603), `taskEvaluationLaunchSubmission.ts` (509), `policyCanaryWebappSyncContract.ts` (441), `configuredSceneOfferingContract.ts` (424), `internal-task-evaluation-launches.ts` (421), `jobManagedEvaluation.ts` (393), `websiteOwnerSuccessConfirmation.ts` (393), `runResultScoring.ts` (257), `taskEvaluationLaunchForwardWorker.ts` (225), `policyIntegration.ts` (214), and 19 smaller ones.

### 11. Code not reachable from the entry points

Source files counted: 577 TypeScript files in `client/src` and `server` (tests excluded).

- **Any import counted:** 31 files, 5255 lines unreachable.
- **Runtime imports only** (`import type` ignored): 46 files with runtime code, 11553 lines, plus 11 type-only modules (2,503 lines) that are fine to keep.
- Of the runtime-dead lines, 2,586 are the 10 frozen legal pages kept on purpose. That leaves about **8,970 lines in 36 files** that no entry point runs.

| File | Lines | Imported by (any, incl. tests and scripts) | Retired system |
|---|---|---|---|
| `client/src/types/inbound-request.ts` | 1194 | client/src/data/siteWorlds.ts, client/src/lib/firebase.ts | - |
| `client/src/lib/robotTeamTestSubmission.ts` | 1123 | client/src/lib/robotTeamTestSubmission.test.ts, client/src/types/hostedSession.ts | early trial |
| `client/src/data/deploymentMarket.ts` | 1068 | client/src/data/qualifyingEnvironments.ts | marketplace / robot match |
| `server/utils/worldlabs.ts` | 759 | server/tests/world-reconstruction.test.ts, server/tests/worldlabs-atlas-refusal.test.ts | capture app world purchase (World Labs) |
| `server/utils/worldReconstruction.ts` | 525 | server/routes/internal-capture-worlds.ts, server/tests/capture-review-gate.test.ts | capture app world purchase (World Labs) |
| `server/data/robotTeamSeed.ts` | 514 | server/tests/robot-team-seed.test.ts, scripts/seed-robot-teams.ts | pilots / robot-team registry seed |
| `client/src/pages/PrivacyEarlier.tsx` | 367 | nothing | frozen legal page (keep) |
| `client/src/pages/PrivacyFormer.tsx` | 359 | nothing | frozen legal page (keep) |
| `client/src/pages/PrivacyOlder.tsx` | 359 | nothing | frozen legal page (keep) |
| `server/utils/web-search.ts` | 359 | server/tests/web-search.test.ts | - |
| `client/src/pages/PrivacyPrior.tsx` | 356 | nothing | frozen legal page (keep) |
| `client/src/pages/PrivacyAnnounced.tsx` | 354 | nothing | frozen legal page (keep) |
| `client/src/lib/robotMatch.ts` | 308 | server/tests/deployment-coverage.test.ts, server/tests/robot-match.test.ts | marketplace / robot match |
| `server/utils/worldModelProfiles.ts` | 270 | server/tests/world-model-profiles.test.ts, server/utils/worldReconstruction.ts | capture app world purchase (World Labs) |
| `client/src/data/qualifyingEnvironments.ts` | 222 | client/src/data/siteTaskQualification.ts | marketplace / robot match |
| `server/utils/robotTeamIdentity.ts` | 203 | server/tests/pilot-recommendation-evidence.test.ts, scripts/ops/report-robot-team-identity-splits.ts | pilots / robot-team registry seed |
| `server/utils/captureCoverageRequeue.ts` | 200 | server/tests/coverage-review-requeue.test.ts, scripts/requeue-capture-coverage-review.ts | - |
| `client/src/components/ui/dropdown-menu.tsx` | 199 | nothing | - |
| `client/src/lib/capabilityBands.ts` | 193 | client/src/lib/deploymentCoverage.ts, client/src/lib/robotMatch.ts | marketplace / robot match |
| `client/src/data/siteWorlds.ts` | 179 | nothing | marketplace / robot match |
| `client/src/lib/evaluationPricing.ts` | 173 | nothing | paid evaluations |
| `client/src/pages/TermsOlder.tsx` | 164 | nothing | frozen legal page (keep) |
| `client/src/pages/TermsFormer.tsx` | 163 | nothing | frozen legal page (keep) |
| `client/src/pages/TermsPrior.tsx` | 163 | nothing | frozen legal page (keep) |
| `server/utils/captureReviewGate.ts` | 154 | server/tests/capture-review-gate.test.ts, server/utils/worldReconstruction.ts | - |
| `client/src/pages/TermsEarlier.tsx` | 153 | nothing | frozen legal page (keep) |
| `client/src/pages/TermsAnnounced.tsx` | 148 | nothing | frozen legal page (keep) |
| `server/utils/siteMatchRun.ts` | 137 | server/tests/deployment-coverage.test.ts, server/tests/funnel-brief-to-supply.test.ts | marketplace / robot match |
| `client/src/lib/deploymentCoverage.ts` | 133 | client/src/lib/robotMatch.ts, server/tests/deployment-coverage.test.ts | marketplace / robot match |
| `client/src/components/workspace/DeploymentEmbodimentShortlist.tsx` | 129 | nothing | marketplace / robot match |
| `server/utils/worldlabsFrames.ts` | 107 | server/utils/worldReconstruction.ts | capture app world purchase (World Labs) |
| `server/utils/grantedBriefRestore.ts` | 87 | server/tests/granted-brief-restore.test.ts, scripts/restore-granted-brief.ts | - |
| `server/utils/pilotOpsAlerts.ts` | 82 | server/tests/pilot-recommendation-evidence.test.ts | pilots / robot-team registry seed |
| `server/utils/capabilityFigures.ts` | 81 | server/tests/capability-figures.test.ts, server/tests/robot-team-seed.test.ts | pilots / robot-team registry seed |
| `server/retrieval/embeddings.ts` | 79 | server/tests/embeddings-cooldown-retries.test.ts, server/tests/embeddings-cooldown-retries.test.ts | - |
| `server/utils/pipeline-dashboard.ts` | 78 | server/utils/worldlabs.ts, server/utils/worldlabsFrames.ts | capture app world purchase (World Labs) |
| `client/src/components/workspace/RobotConfigurationVisual.tsx` | 70 | client/src/components/workspace/DeploymentEmbodimentShortlist.tsx | marketplace / robot match |
| `server/utils/taskUpdateCommitment.ts` | 68 | server/tests/capture-coverage-source.test.ts | - |
| `server/utils/contactTargeting.ts` | 62 | server/tests/contact-targeting-alerts.test.ts | - |
| `client/src/lib/jobCardAnswerConsent.ts` | 58 | server/tests/site-answer-journey.test.ts | - |
| `client/src/components/ui/avatar.tsx` | 49 | nothing | - |
| `server/utils/inferenceProgrammeAdmission.ts` | 27 | server/tests/capture-coverage-budget.test.ts, server/utils/captureCoverageInferenceBudget.ts | - |
| `client/src/types/robotDescription.ts` | 24 | nothing | - |
| `client/src/lib/taskVideos.ts` | 23 | nothing | - |
| `server/utils/taskThumbnail.ts` | 23 | server/tests/onboarding-p1.test.ts | - |
| `server/utils/outboxWentOut.ts` | 7 | nothing | - |

Scripts: 25 files under `scripts/` (2,648 lines) are referenced by nothing in `package.json`, workflows, `render.yaml`, other scripts or runbooks (some are `.test.ts` files that Vitest picks up by glob, so they do run).

### Firestore aggregates wanted

For the orchestrator's one reviewed read-only script. Counts and durations only, no personal fields.

1. `captureOutbox`: count grouped by `kind` and `status`; for `status=sent`, median and p90 of `sentAt - createdAt`. Shows which of the 13 kinds ever went out and how many retired kinds sit `cancelled`.
2. `companySends`, `introductions`, `billableEvents`, `robotTeamAccess`: count; `robotTeamAccess` grouped by `status` (applied / approved / declined). Baseline already shows companySends 0, introductions 0, robotTeamAccess 1.
3. `inboundRequests`: count grouped by `request.buyerType` and by job outlook phase (the field read by `server/utils/jobOutlook.ts`); median of first-company-send time minus `createdAt` where a send exists.
4. `taskEvaluationLaunches` (524 docs) and `taskEvaluationPolicyRuns` (121): count with `createdAt` after 2026-11-14 (the trial drop date). Non-zero means trial-era writers still run.
5. `marketplaceEntitlements` (39 docs): max `createdAt`, and count with an unexpired expiry field. Tells whether the paid-evaluation data can be retired.
6. `agentRuns` (2,478): count per `task` name and per month since 2026-10-01, and the sum of any recorded cost field. Tells which paid model tasks still run.
7. `growthCampaigns` (58) / `growth_campaign_events` (403): max `createdAt`. Tells whether outreach campaigns are still writing.
8. `users` (456): count with `onboardingStep` set, grouped by value (old onboarding checklist residue).

### Totals

| Thing | Count |
|---|---|
| Client route entries | 150 (25 page routes + 1 fallback, 124 redirects) |
| Distinct page components routed | 23 |
| Screens / states (approximate) | about 146 |
| Emails the system can send | 20 (13 outbox kinds + 3 direct customer emails + Firebase verification + 3 ops alert families) |
| API routes (method + path) | 176 in routers, plus 14 retired 410 patterns and 7 server-only paths |
| API routes with no caller | 35 |
| Timers / workers / crons | 14 |
| External providers | 21 |
| Env names read (flags and config) | 249 (17 VITE_*) |
| Admin / operator pages | 3 pages + 6 redirect routes + 1 embedded queue |
| Firestore collections in code | 78 (+ 10 rules-only) |
| Storage path rules | 7 (+ deny-all) |
| Playwright configs / e2e specs | 12 / 28 (3 configs, 685 spec lines not in CI) |
| Unreachable code, any import | 31 files, 5255 lines |
| Unreachable code, runtime | 46 files, 11553 lines (about 8,970 excluding frozen legal pages) |

## Part 2: BlueprintCapturePipeline

Audit date 2026-11-22. Repository `BlueprintCapturePipeline` at HEAD `7d8b532` (2026-11-20).
The control plane runs release `cbff06b` (door `status.active_release`, saved 15:01Z).
HEAD is 6 commits and 22 files ahead of it (`git log --oneline cbff06b..HEAD | wc -l` -> 6).

This is the map the later phases hunt over. It is built from code and deploy files first,
then checked against the door (read subcommands only: `status` saved copy, `units`, `usage`,
`journal`, `cat` of one unit-failure record) and the docs.

Nothing here read a site's video, frames, name, address, contact details or job sentence.
Host data below is counts, states, times, sizes and money only.

Scratch scripts and raw outputs (not part of the deliverable):
`/tmp/claude-0/-home-user/e3989091-e008-5b78-a9cb-b7c31a5efdb8/scratchpad/agents/inventory-pipeline/`
(`graph.py`, `reach.py`, `fam.py`, `boundary.py`, `testonly.py`, `tests_area.py`, `units_md.py`,
`door-units.json`, `door-usage.txt`).

### 0. The short version

- The website job path is real and small at the top: 11 units move a job. But its import closure
  is huge. Starting from the units that move a website job, Python imports reach **1,317 of 1,621
  modules and 581,873 of 715,431 lines (81%)**. Retired systems ride along inside that closure.
- Trial code (the early trial of robot software, dropped 2026-11-14) is still imported by live
  code along **59 import edges from 41 live modules into 22 trial modules**. G1, Astra, episode
  compilation, the rigid probe and RunPod have the same pattern. Exact edges are in section 8.
- The host carries **207 failed units**. 206 are one-off experiment units from 2026-09-26 to
  2026-10-27 that were never cleared. The one real failure is the **GPU spend guard: 4,844
  failures since 2026-11-13**, because the retired RunPod is still queried while its key exists.
- **No company simulation package exists for any capture on the host.** The Atlas preview pass
  at 15:17Z counted `company_simulation_no_source: 4, company_simulation_not_permitted: 2`
  and zero current packages.
- Retired lanes still hold at least **67 GiB** of host disk (door `usage`), and three armed
  timers fire for lanes no website job feeds.
- The nightly full test lane has been **red four nights running** (2026-11-18 to 11-21),
  each night on a different single test.
- Several docs that agents are told to trust name files that were deleted on 2026-11-15, and
  `docs/SYSTEM_MAP.md` still says faces are blurred in every frame sent to World Labs, which the
  code no longer does for jobs under the current Privacy Policy.

### 1. The website job path, stage by stage

Sources: `docs/SYSTEM_MAP.md` (2026-11-19) for the skeleton, then each claim checked in code.
"Retry" says whether the stage uses `job_retry_policy` (the one rule AGENTS.md requires) or its own.
Modules that import `job_retry_policy` (grep): `atlas_refined_splat_retry, atlas_scene_automation,
clean_plate_removal_analysis_gemini, control_plane_stall_alarm, deterministic_refusal, hard_stops,
pubsub_handoff_listener, rigid_robot_free_probe_runner, scene_packet, scene_packet_queue,
scene_run_restore, task_evaluation_scene_launch_recovery, team_scene_packet_worker,
website_atlas_preview, website_build_choice, website_destination_choice, website_gemini_receipts,
website_preparation_retry, website_preparation_status, website_preparation_terminal,
website_rules_reopen, website_scene_handoff`.

| # | Stage | Entry module (lines, test files importing it, last change) | Unit that drives it | Needs | Produces | Provider, paid? | Retry | Deadline | Who consumes the output |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Upload hand-off | WebApp upload -> Cloud Function `functions/storage_trigger.py` (`on_storage_finalize`) -> Pub/Sub `capture_bridge_handoff` | (Cloud Function; GCP) | `raw/capture_upload_complete.json` | Pub/Sub message | GCP Pub/Sub, Storage (metered by GCP, $100/month ceiling) | Pub/Sub redelivery, then host retry (row 2) | none here | listener (row 2) |
| 2 | Frames, privacy screen, preparation | `pubsub_handoff_listener` (2,139 lines, 44 tests, 2026-11-15) -> `run_e2e` -> `site_package_orchestrator` -> `website_capture_preparation` (183, 13, 2026-11-18); privacy gate `site_package_orchestrator._privacy_postprocess_gate`; retry `website_preparation_retry` (610, 9, 2026-11-17) | `blueprint-pubsub-handoff-listener.timer` (every 1 min after inactive; service `TimeoutStartSec=6h`, batch slice) | Pub/Sub message, raw capture, signed WebApp context, a job sentence (`require_task_named`, `website_capture_preparation.py:15`) | `pubsub-handoffs/<bucket>/scenes/<scene>/captures/<capture>/pipeline/*` | Gemini (clean-plate analysis, removal visibility, whole-view review, via `website_gemini_receipts.retained_gemini_call`), Meta hosted SAM 3.1 (`meta_sam31`), OpenAI; all paid, admitted per `scripts/paid_api_call_sites.json` | `job_retry_policy` via `website_preparation_retry` | the grant's expiry (`website_preparation_terminal.retained_window_end`) | Atlas step (row 3), scene handoff (row 4) |
| 3 | Reconstruction (room) | `website_atlas_preview` (1,172, 26, 2026-11-19) -> `website_atlas_pipeline` (1,782, 35) -> `website_worldlabs` (208, 1); face blur `atlas_privacy_screen.face_blur_required` (314, 7, 2026-11-20) | `blueprint-website-atlas-preview.timer` (60 s after inactive, `TimeoutStartSec=2h`); `blueprint-website-atlas-provider-poll.{timer,path}` (read-only poll) | `pipeline/atlas/preview_job.json`, Atlas grant | Atlas bundle; served by intake `GET /api/live-pipeline/website-atlas-previews/<capture>/bundle` | World Labs Atlas, paid (November: 9 attempts, $11.85, door `capacity.provider_spend.world_labs`) | `job_retry_policy` (section 2 of `docs/architecture/job-retry-and-deadlines.md`) | 7 days (`MAXIMUM_JOB_SECONDS`, ends `atlas_preview_expired`) | site's job page (scene preview), scene handoff |
| 4 | Object isolation and scene preparation | `website_scene_handoff` (1,299, 36, 2026-11-19) -> `website_task_preparation` (1,995, 43) -> `website_task_masks` (1,205, 24) with `meta_sam31` | inside rows 2 and 3 (listener and Atlas pass) | Atlas result, prepared capture | prepared scene, room package (ships flagged when a non-wall blocker hits, `website_scene_handoff.goes_on`) | Meta SAM 3.1, Gemini, OpenAI (paid) | `job_retry_policy`; "ship the room package" rule (section 8 of the retry doc) | job window | WebApp (scene intent, row 5) |
| 5 | Scene intent intake | `live_pipeline_intake_service` (1,861, 25, 2026-11-16) + `task_evaluation_scene_intake_http` (210, 1) + `task_evaluation_scene_intake` (585, 75, 2026-11-19) | `blueprint-pipeline-intake.service` (always on, 127.0.0.1:8765 behind Caddy) | signed intent from WebApp | `task-evaluation-scene-intents/<intent>/intent.json` | none | n/a (WebApp retries the POST until the window ends) | job window | scene progression |
| 6 | Simulation build: preparation | `task_evaluation_scene_progression` (1,163, 23, 2026-11-16) -> `task_evaluation_scene_preparation_service`; `task_evaluation_launch_preparation_worker` (1,844, 29, 2026-11-10) | `...-scene-progression.timer` (1 min), `...-launch-preparation.{path,timer}` (2 min) | intent, prepared capture | preparation queues, `completed-scene-preparation/` (19.4 GiB on host) | B2 artifact store (paid storage, not metered per job) | progression: `task_evaluation_scene_launch_recovery` uses `job_retry_policy`; preparation worker: own rule (no `job_retry_policy` import) | intent `authority_expired` / execution window | activation (row 7) |
| 7 | Simulation build: paid object and scene configuration | `task_evaluation_launch_activation_worker` (1,858, 14) -> `task_evaluation_launch_dispatcher` (2,001, 33) -> `paid_resource_allocator gpu-canary` (942, 47) -> `vast_provider_adapter` (10,327, 46); on the GPU `scripts/task_evaluation_scene_configuration_provider_runner.py` -> `task_evaluation_scene_configuration_artisan_driver` -> `task_object_artisan_process` | `...-launch-activation.{path,timer}` (1 h), `...-launch-dispatcher.path` (`TimeoutStartSec=9h`) | activation intent, prepared references | configured scene in B2 | Vast GPU, OpenAI ARTISAN ($12/object cap) or Anthropic (only if the host prefers it and the Privacy version allows it, `artisan_provider_choice.py:39`); paid | own rules: intent's signed `max_retries` and `max_paid_attempts`; no `job_retry_policy` import in activation or dispatcher | `TimeoutStartSec` 255 min / 9 h; intent window | reconciler, completion |
| 8 | Teardown proof | `task_evaluation_launch_reconciler` (1,309, 12) | `...-launch-reconciler.timer` (2 min) | launch state, spend-guard inventory | provider-zero receipt | Vast read (free) | own (exit 2 while proving) | none | money ledgers |
| 9 | Team scene half (source of the company simulation) | `team_scene_packet_worker` (1,838, 27, 2026-11-16) -> `team_scene_packet` (1,495, 20) | `blueprint-team-scene-packet.path` | completed preparation | `team-scene-packets/status/<key>.json`, `task-evaluation-inputs/team-scene-halves` | none (CPU) | `job_retry_policy` | none found | company simulation package (row 11); robot fit table |
| 10 | First look on paper | WebApp (Gemini site assessment; door spend row `overhead:webapp.site_assessment` $6.01 in November) | WebApp | video, job sentence | first look | Gemini/OpenAI from the WebApp, paid | WebApp | WebApp window sweep | the site |
| 11 | Packet publication and company simulation package | `website_company_clip` (930, 5, 2026-11-15), `website_company_simulation` (1,992, 17, 2026-11-20), `website_company_look` (135, 1); served by `website_atlas_preview_http` (204, 7) | inside the Atlas preview pass (`website_atlas_preview.company_clip_tick`, `company_simulation_tick`, `website_atlas_preview.py:1106,1121`) | team scene half (row 9), rights statement | silent clip; deterministic zip `scene.usda` + `success_rule.json`; WebApp told via signed `company-simulation` operation | none (local CPU, `pxr`) | own: every 60 s pass, forever, no backoff | none | approved deployment companies on the website |
| 12 | Held-job sentences | `scene_stage_maintenance` (437, 5), `scene_stage_holds` | `blueprint-scene-stage-maintenance.timer` (1 min) | job window, scene state | WebApp `POST /api/internal/pipeline/beta-policy-screening-holds` (old name) | none | n/a | job window | the site (a held job's sentence) |

Measured state of row 11 at 2026-11-22T15:17Z (door `journal blueprint-website-atlas-preview.service`, aggregate line):
`{"company_clip_current": 2, "company_clip_no_source": 1, "company_clip_not_permitted": 2, "company_clip_refused": 1, "company_simulation_no_source": 4, "company_simulation_not_permitted": 2, "needs_input": 1, "ready": 4, "scene_preview_current": 4, ...}`.
So zero company simulation packages are current. The team-scene packet queue is empty
(`capacity.stall.checks.team_scene_packets.dispositions: {}`). Scene progression holds 52 intents:
`execution_window 9, rights 30, terminal 13` (`capacity.stall.checks.scene_progression`).

Website-path stages that use their own retry rule, not `job_retry_policy`: launch preparation,
launch activation, launch dispatcher (intent `max_retries`), reconciler, company clip and company
simulation (every pass, forever). AGENTS.md says a new stage controller must use `job_retry_policy`;
these predate that rule or are free passes.

### 2. Every systemd unit and timer

68 unit files in `deploy/systemd` (33 services, 23 timers, 11 path watchers, 1 slice).
63 are in `DEFAULT_DEPLOYED_SYSTEMD_UNITS` (`scripts/deploy_control_plane_commit.py:429`); the 5
operator-door units are installed by `deploy/operator-door/install.sh`. 16 services have
`OnFailure=` (grep). Host state is from `door units` at about 15:10Z.

Class: **W** moves a website job. **G** guard or housekeeping (money, disk, paging).
**P** privacy (withdrawal). **D** operator door. **H** installed and armed (or off on purpose)
but no website job feeds it. **R** paused lane, disarmed every release. **M** manual. **S** slice.
Cadence for timers is `OnBootSec;repeat` from the unit file.

| Unit | Class | Cadence | OnFailure | Host (active/sub) | Last change | Purpose |
|---|---|---|---|---|---|---|
| `blueprint-completed-replay-cache-gc.service` | G |  |  | inactive/dead | 2026-11-03 | reclaim replay working copies |
| `blueprint-completed-replay-cache-gc.timer` | G | 2min;5min |  | active/waiting | 2026-09-08 | reclaim replay working copies |
| `blueprint-control-plane-capacity.service` | G |  | yes | inactive/dead | 2026-11-10 | capacity, stall alarm, spend alerts, paging |
| `blueprint-control-plane-capacity.timer` | G | 5min;10min |  | active/waiting | 2026-09-05 | (timer) |
| `blueprint-control-plane-preflight.service` | G |  |  | inactive/dead | 2026-11-03 | chain preflight; "not a health signal yet" (SYSTEM_MAP, tracker D-04) |
| `blueprint-control-plane-preflight.timer` | G | 10min;30min |  | active/waiting | 2026-11-02 | (timer) |
| `blueprint-control-plane-release-lifecycle.service` | G |  |  | inactive/dead | 2026-11-04 | retire superseded release trees |
| `blueprint-control-plane-release-lifecycle.timer` | G | 20min;1h |  | active/waiting | 2026-11-04 | (timer) |
| `blueprint-control-plane-state-backup.service` | G |  | yes | inactive/dead | 2026-11-11 | back up job state and money records (stall check says `state_backup: not_configured`) |
| `blueprint-control-plane-state-backup.timer` | G | 10min;15min |  | active/waiting | 2026-11-11 | (timer) |
| `blueprint-control-plane-storage-gc.service` | G |  |  | inactive/dead | 2026-11-20 | storage GC, evidence offload |
| `blueprint-control-plane-storage-gc.timer` | G | 15min;1h |  | active/waiting | 2026-09-05 | (timer) |
| `blueprint-gpu-spend-guard.service` | G |  | yes | failing every run (see 2.2) | 2026-11-10 | money guard and orphan reaper (Vast, RunPod, DigitalOcean, GCP) |
| `blueprint-gpu-spend-guard.timer` | G | 1min;15s;1min |  | active/running | 2026-10-30 | (timer) |
| `blueprint-off-host-reaper-heartbeat.service` | G |  | yes | inactive/dead | 2026-11-11 | heartbeat for the off-host Vast reaper |
| `blueprint-off-host-reaper-heartbeat.timer` | G | 1min;2min |  | active/waiting | 2026-11-11 | (timer) |
| `blueprint-operator-door-hold-sweep.service` | D |  |  | inactive/dead | 2026-11-03 | door hold sweep |
| `blueprint-operator-door-hold-sweep.timer` | D | 1min;1min |  | active/waiting | 2026-09-27 | (timer) |
| `blueprint-operator-door-runner.path` | D | watch |  | active/waiting | 2026-09-23 | door spool runner trigger |
| `blueprint-operator-door-runner.service` | D |  |  | inactive/dead | 2026-11-03 | door spool runner |
| `blueprint-operator-door.service` | D |  |  | active/running | 2026-11-03 | operator door (127.0.0.1:8767) |
| `blueprint-owner-approved-deletion-plan.service` | M |  |  | not loaded | 2026-11-12 | plan owner-approved deletions (by hand) |
| `blueprint-owner-approved-deletion.service` | M |  |  | not loaded | 2026-11-12 | apply owner-approved deletions (by hand) |
| `blueprint-pipeline-intake.service` | W |  | yes | active/running | 2026-11-16 | signed intake :8765 |
| `blueprint-provider-billing-reconciler.service` | G |  |  | inactive/dead | 2026-11-03 | billing evidence (pulled by the guard) |
| `blueprint-provider-billing-reconciler.timer` | G | 2m;10m |  | inactive/dead (off on purpose, runbook §7) | 2026-09-27 | (timer) |
| `blueprint-pubsub-handoff-listener.service` | W |  | yes | activating | 2026-11-10 | frames, privacy screen, preparation, retries |
| `blueprint-pubsub-handoff-listener.timer` | W | 30s;1min |  | active/running | 2026-09-27 | (timer) |
| `blueprint-rigid-robot-free-probe-runner.path` | H | watch |  | active/waiting | 2026-10-27 | $1 robot-free GPU probe; a website half queues none (SYSTEM_MAP step 11) |
| `blueprint-rigid-robot-free-probe-runner.service` | H |  | yes | inactive/dead | 2026-11-10 | (service) |
| `blueprint-rigid-robot-free-probe-runner.timer` | H | 2min;5min |  | active/waiting | 2026-10-27 | (timer; queue `pending: 0`) |
| `blueprint-scene-project-spend-refresh.service` | G |  |  | inactive/dead | 2026-11-03 | scene spend exposure |
| `blueprint-scene-stage-maintenance.service` | W |  | yes | inactive/dead | 2026-11-14 | held-job sentences; can enqueue a rigid probe |
| `blueprint-scene-stage-maintenance.timer` | W | 2min;1min |  | active/waiting | 2026-11-14 | (timer) |
| `blueprint-task-evaluation-episode-compilation-remote.path` | H | watch |  | active/waiting | 2026-09-29 | robot-team episode compile on Cloud Run, "armed only to drain" (runbook §7) |
| `blueprint-task-evaluation-episode-compilation-remote.service` | H |  |  | inactive/dead | 2026-11-10 | (service) |
| `blueprint-task-evaluation-episode-compilation-remote.timer` | H | 1min;60s |  | active/waiting | 2026-09-29 | (timer) |
| `blueprint-task-evaluation-episode-compilation.path` | R | watch |  | not loaded | 2026-09-29 | host episode compile; disarmed each release |
| `blueprint-task-evaluation-episode-compilation.service` | R |  |  | not loaded | 2026-11-10 | (service) |
| `blueprint-task-evaluation-episode-compilation.timer` | R | 5min;5min |  | not loaded | 2026-09-29 | (timer) |
| `blueprint-task-evaluation-launch-activation.path` | W | watch |  | active/waiting | 2026-09-27 | activate paid scene configuration |
| `blueprint-task-evaluation-launch-activation.service` | W |  | yes | inactive/dead | 2026-11-10 | (service) |
| `blueprint-task-evaluation-launch-activation.timer` | W | 10min;1h |  | active/waiting | 2026-11-02 | (timer) |
| `blueprint-task-evaluation-launch-dispatcher.path` | W | watch |  | active/waiting | 2026-09-27 | paid GPU launch via allocator |
| `blueprint-task-evaluation-launch-dispatcher.service` | W |  | yes | inactive/dead | 2026-11-10 | (service) |
| `blueprint-task-evaluation-launch-preparation.path` | W | watch |  | active/waiting | 2026-09-27 | materialise prepared inputs |
| `blueprint-task-evaluation-launch-preparation.service` | W |  | yes | inactive/dead | 2026-11-10 | (service) |
| `blueprint-task-evaluation-launch-preparation.timer` | W | 2min;2min |  | active/waiting | 2026-09-27 | (timer) |
| `blueprint-task-evaluation-launch-reconciler.service` | W |  |  | inactive/dead | 2026-11-10 | teardown proof |
| `blueprint-task-evaluation-launch-reconciler.timer` | W | 2min;2min |  | active/waiting | 2026-09-27 | (timer) |
| `blueprint-task-evaluation-scene-progression.service` | W |  | yes | inactive/dead | 2026-11-10 | scene intent to preparation |
| `blueprint-task-evaluation-scene-progression.timer` | W | 2min;1min |  | active/waiting | 2026-09-27 | (timer) |
| `blueprint-task-evaluation-terminal-resource-release.path` | H | watch |  | inactive/dead (off on purpose) | 2026-08-11 | release one terminal Vast record; queue empty since 2026-08-12 |
| `blueprint-task-evaluation-terminal-resource-release.service` | H |  |  | inactive/dead | 2026-11-10 | (service) |
| `blueprint-team-scene-packet-remote.path` | H | watch |  | active/waiting | 2026-11-05 | Cloud Run team-scene lane; SYSTEM_MAP lists it as "switched off on purpose", yet it is armed |
| `blueprint-team-scene-packet-remote.service` | H |  |  | inactive/dead | 2026-11-10 | (service) |
| `blueprint-team-scene-packet-remote.timer` | H | 1min;60s |  | active/waiting | 2026-11-05 | (timer) |
| `blueprint-team-scene-packet.path` | W | watch |  | active/waiting | 2026-11-05 | team scene half |
| `blueprint-team-scene-packet.service` | W |  | yes | inactive/dead | 2026-11-10 | (service) |
| `blueprint-unit-failure@.service` | G |  |  | template (16 instances loaded) | 2026-11-10 | OnFailure notifier |
| `blueprint-website-atlas-preview.service` | W |  | yes | activating | 2026-11-10 | room, scene preview, company clip, company simulation package |
| `blueprint-website-atlas-preview.timer` | W | 3min;60s |  | active/running | 2026-10-22 | (timer) |
| `blueprint-website-atlas-provider-poll.path` | W | watch |  | active/waiting | 2026-10-30 | World Labs poll trigger |
| `blueprint-website-atlas-provider-poll.service` | W |  | yes | inactive/dead | 2026-11-10 | read World Labs operations, never spend |
| `blueprint-website-atlas-provider-poll.timer` | W | 2min;60s |  | active/waiting | 2026-10-30 | (timer) |
| `blueprint-website-withdrawal-deletion.service` | P |  | yes | inactive/dead | 2026-11-10 | withdrawal deletion pass |
| `blueprint-website-withdrawal-deletion.timer` | P | 30min;1h |  | active/waiting | 2026-11-10 | (timer) |
| `system-blueprintbatch.slice` | S |  |  | (slice) | 2026-11-10 | `MemoryHigh=5G`, `MemoryMax=5.5G` for 23 batch units |

How a unit starts its module: 14 units go through `task_evaluation_scene_retirement_supervisor --worker <module>`;
its allowlist (`task_evaluation_scene_retirement_supervisor.py:1117`) still names
`task_evaluation_episode_compilation_worker` (paused lane), `task_evaluation_sam31_preparation_execution`
(retired trigger) and `task_evaluation_terminal_resource_release` (off on purpose).

Owner of each class: W = AGENTS.md mission (owner direction 2026-11-12); G = AGENTS.md "Spend limits"
(money) and runbook §1-3; P = privacy hard stop; D = D-08 deploy policy (2026-11-02);
H/R = runbook §7 "Triggers that are off on purpose (D-06)" and "Lanes paused by the 2026-11-12 frame".

#### 2.1 Host units not in the repo

`door units` lists units the repo does not ship: 11 `blueprint-operator-door-hold-expiry-*.timer`
(all `active/waiting`), 11 matching `.service`, `blueprint-existing-policy-canary-watchdog.service`,
and the transient experiment units below. The only door hold is an **expired** hold from 2026-10-02
on `blueprint-agent-run-dispatcher.timer` (`require_explicit_release: true`), a timer whose code
left the repository on 2026-11-15 (#3598). The door still reports `hold_target:
blueprint-agent-run-dispatcher.timer` (`deploy/operator-door/operator_door/status.py:367`).

#### 2.2 Failed units, by cause (door `status.failed_units`, 207 entries)

| Cause | Count | Evidence |
|---|---|---|
| One-off `systemd-run` experiment units, never `reset-failed` | 206 | none of them is a repo unit file; names carry dates 2026-09-26 to 2026-10-27 (112 in October, 25 in September, 70 undated) |
| of which G1 controller / dry / paid runs (`blueprint-g1-841757-*`) | 35 | |
| of which Atlas experiments (`blueprint-atlas-*`, dishwasher, canaries, preflights) | 33 | |
| of which native / G1-adjacent bundle and harness runs | 31 | |
| of which scene-configuration diagnostics (`blueprint-diagnostic-*`, `internal-team-diagnostic-*`) | 29 | |
| of which scene experiments (`scene839873-*`, `scene-release-*`, combined scene) | 23 | |
| of which policy / trial runs (`paired-policy-*`, `approved55-*`, `policy-*`) | 15 | |
| of which ad-hoc deploys, preflight probes, retained deliveries, other | 40 | |
| Installed repo unit failing every run: `blueprint-gpu-spend-guard.service` | 1 | `unit-failures/blueprint-gpu-spend-guard.service.json`: `failure_count 4844`, first `2026-11-13T04:39Z`, last `2026-11-22T15:16:17Z`, `exit_status 2`; journal: `warning: runpod pod query failed (http=0)`, `Main process exited, code=exited, status=2`; spend guard `status: blocked`, `blockers: ["runpod_inventory_query_failed"]`, `provider_zero_verified: false` |

Cause of the guard failure, in code: `scripts/gpu_spend_guard.py:2322-2337`. While a RunPod key file
exists, RunPod is "still read and required"; with no key it is recorded retired and not required.
The owner step in AGENTS.md ("close the RunPod account, then delete the RunPod key file") is still open.
Each guard run consumed about 36 s of CPU (journal `Consumed 36.472s CPU time`) and the timer
restarts it about a minute after it ends, on a 4-CPU host.

#### 2.3 Capacity alerts (door `capacity.alerts`, 18)

4 money alerts (`account_spend_month_50pct`, `account_spend_forecast_reaches_limit_this_month`,
`account_spend_reconciliation_outside_tolerance` for digitalocean, gcp, openai, vast,
`account_spend_unverifiable`), 3 `storage_class_over_budget` (unclassified 112.5 GB of 32.2 GB budget,
work 34.2 of 26.8, release 33.0 of 16.1), `orphan_scratch_large` (61 folders, 63.8 GB),
and 10 `usage_unclassified_root` rows (largest `/opt/blueprint/artisan` 11.1 GB). Capacity level: `warning`.

### 3. External providers

Paid call sites are inventoried by `scripts/paid_api_call_sites.json` (71 sites, 2026-11-18),
checked by `scripts/verify_paid_resource_allocator.py`.

| Provider | For | Paid? | Admitted / metered where | Call sites (class) | November spend seen |
|---|---|---|---|---|---|
| World Labs Atlas | room reconstruction | yes | Atlas grant from WebApp; `paid_spend_meter`; alert lines $60/24 h, $450/month (`provider_spend_alerts`) | 2 admitted, 8 not paid | $11.85, 9 attempts |
| Google Gemini | clean-plate analysis, removal visibility, whole-view review | yes | `website_gemini_receipts.retained_gemini_call` reserves on the WebApp job ledger | 10 admitted, 2 not automatic, 1 not paid | in WebApp ledger (no Google settlement route) |
| Meta hosted SAM 3.1 | object masks | yes | upstream ledger under the website sponsorship | 3 admitted, 5 not paid | not split out |
| OpenAI | ARTISAN object authoring (gpt-6.1-sol), agents SDK, research | yes | `paid_resource_admission`, ARTISAN cap $12/object | 27 admitted, 6 not paid, 1 not automatic | $85.25 month to date |
| Anthropic | ARTISAN on Claude when host prefers and Privacy version allows | yes | admitted | 2 admitted, 1 not paid | not seen |
| NVIDIA NIM | model preflight | yes | admitted | 1 admitted, 1 not automatic | not seen |
| RunPod serverless / pods | retired 2026-11-05 | was | refused by `RUNPOD_PROVIDER_RETIRED` (`paid_resource_admission.py`) | 1 admitted (watchdog) | none; guard still queries inventory |
| Vast.ai | GPU scene configuration, rigid probe | yes | `paid_resource_allocator` only; credit check `provider_credit_admission`; fleet caps in the guard unit | (compute, not API) | $34.52 metered to retired screening on two captures; billing export total `vast: 479.076` (scope `blueprint_beta_100_user_cohort`) |
| DigitalOcean | control-plane host | yes (fixed) | billing reconciler | n/a | billing export `385.8` |
| Google Cloud (Pub/Sub, Storage, Cloud Run) | hand-off, storage, remote CPU lanes | yes | `gcp_monthly_budget_guard`, $100/month | n/a | $61.03 |
| Backblaze B2 | artifact store (`blueprint-task-evaluation-artifacts-prod`) | yes | not metered per job (unverified) | n/a | unknown |
| Parallel FindAll | web research (`parallel_findall.py`) | yes | runbook `parallel-findall-api.md` | not in the call-site file | unknown |
| Lambda Labs | adapter only | n/a | `lambda_provider_adapter` (1,724 lines) is a console script; nothing live imports it | 0 | none |
| Resend | email (WebApp) | yes | WebApp | n/a | n/a |

Account month (door `spend_guard.account_monthly_spend`): $296.54 counted of the $400 November limit
(74%); `complete: false`; forecast reaches the limit on 2026-11-30 (`daily_rate_usd 13.71`, lower bound).
Metered by source: retired screening $34.52, Atlas $11.85, OpenAI settlement $7.23, WebApp overhead
$6.05, paid admission $0.10. Two `itest-*` jobs account for $10.72.

### 4. Config files, feature flags and environment switches

| File | Last change | Read by (production code) | On in production |
|---|---|---|---|
| `config/account_monthly_spend_limit.v1.json` | 2026-11-19 | `account_monthly_spend.py` | yes (status `cap_status: set`, limit 400) |
| `config/website_job_spend_cap.v1.json` | 2026-11-19 | `website_job_spend_cap.py` | yes (installed by deploy) |
| `config/artisan_openai_tool_schemas.v1.json` | 2026-11-15 | `artisan_strict_tool_schemas.py`, a build script | yes (GPU bundle) |
| `config/image_editor_backends.v1.json` | 2026-11-14 | `website_image_completion.py`, artifixer driver (5 readers) | yes |
| `config/blueprint_owned_captures.v1.json` | 2026-11-19 | `company_share_permission.py`, `sharing_statement.py` | yes |
| `config/beta_policy_candidates.v1.json` | 2026-11-07 | no code reads it; only named in the docstring of `website_rigid_feasibility.py:25` ("every embodiment an enabled screening candidate runs on is checked") | no (stale reference) |
| `config/content_agents/*.yaml` (6) | 2026-11-14 | 3 by a build script; 3 `adp009d_*articulated*` by nothing but `adp_content_agents_vast` and tests | build time |
| `config/native_g1_shared_inputs.v1.json` | 2026-11-06 | door `experiment_purge.py` | door only |
| `config/policy_runtimes/*` (2) | 2026-10-31 | nothing in src/scripts/deploy (tests only) | no |
| `config/trial/*` (5, 124 KB) | 2026-11-14 | nothing in src/scripts/deploy (tests and fixtures only) | no |
| `configs/g1_*` (5) | 2026-09-24/27 | G1 modules only (`native_g1_checkpoint_cache`, `native_g1_pi_tokenizer_assets`, `task_evaluation_embodiment_registry`) | no website use |
| `configs/production_pipeline.env.example` | 2026-07-22 | nothing | no |
| `contracts/shared-doctrine.lock.json` | 2026-11-20 | `scripts/verify_shared_doctrine.py` | CI |
| `deploy/systemd/pipeline-control-plane.env.example` | | 100 example keys | template for `/etc/blueprint/pipeline-control-plane.env` (host values not read) |

Flags. The 2026-11-05 inventory (`docs/audits/2026-11-inventory.json`, 17 days old) classified 495
Pipeline flags: KEEP-LIVE 271, KEEP-GUARD 211, REMOVE-CANDIDATE 21, DORMANT-INTENDED 2. Today
`src/blueprint_pipeline` reads 187 distinct `BLUEPRINT_*` names directly through `os.environ`/`getenv`
(grep; helpers that wrap the read are not counted), and 48 names contain ENABLE/ALLOW/DISABLE.
Switches a repo deploy file sets: `BLUEPRINT_VAST_CREDIT_GUARD_ENABLED=true` (4 units),
`BLUEPRINT_RIGID_ROBOT_FREE_PROBE_ENABLED=1` (rigid probe unit), `PRIVACY_PIPELINE_ENABLED=true`,
`RETRIEVAL_REQUIRE_PRIVACY_SAFE_VIDEO=true` (2 units each). Switches only commented in the env example
(production value unknown, host file not read): `BLUEPRINT_ALLOW_SIMULATOR_EXECUTION` (read by the
RunPod and Lambda adapters and `live_pipeline_setup`), `BLUEPRINT_ALLOW_LIVE_AGENTS_SDK_OPERATORS`,
`BLUEPRINT_ALLOW_LIVE_CODEX_SDK_OPERATORS`, `BLUEPRINT_ALLOW_CODEX_CLI_HOST_OAUTH`,
`BLUEPRINT_ALLOW_PACKAGE_DELIVERY_UPLOAD`, `BLUEPRINT_ALLOW_ROLLOUT_VISION_LABELING`,
`BLUEPRINT_MUJOCO_ALLOW_FETCH_G1_ASSETS`, `BLUEPRINT_ALLOW_TASK_EVALUATION_LAUNCH_TRIGGER`,
`BLUEPRINT_LIVE_PIPELINE_INTAKE_ALLOW_LEGACY_BEARER` (example `false`), `BLUEPRINT_WEBSITE_ATLAS_ROUTE`.
Unit env still names retired roots: `BLUEPRINT_CONTROL_PLANE_GC_QUEUE_ROOTS` includes
`task-evaluation-policy-canary-dispatches` and `BLUEPRINT_CONTROL_PLANE_DISK_ROLE_TARGETS` includes
`policy_canary_dispatch` and `policy_canary_output` (3 units each).

Hand-copied privacy lists: `atlas_privacy_screen.NO_FACE_BLUR_PRIVACY_VERSIONS` lists 2026-11-17.1
through 2026-11-22.1 (`atlas_privacy_screen.py:49`). `artisan_provider_choice.PRIVACY_POLICY_VERSIONS`
lists only 2026-11-13.1, 2026-11-17.1 and 2026-11-18.1 (`artisan_provider_choice.py:39`). The website's
current Privacy version is 2026-11-21.1 (`webapp:client/src/lib/legalAcceptance.ts:198-200`).
The two 2026-11-21/22 entries were added at HEAD by #3684 (`7d8b532`, 2026-11-20). The running release
`cbff06b` lists only 2026-11-17.1 to 2026-11-20.1 (`git diff cbff06b HEAD -- src/blueprint_pipeline/atlas_privacy_screen.py`).
So until the next deploy, production treats a job under the current Privacy Policy as "blur required"
(the fail-safe branch of `face_blur_required`, `atlas_privacy_screen.py:178-196`). That is safe for
privacy, but it is the opposite of what AGENTS.md says happens, and each new Privacy version needs a
Pipeline code change and deploy in two places.

### 5. Operator door request kinds and manual commands

Door `status.door.request_kinds` (installed door, version string `1.0.0`):

| Request kind | Scope | What it changes | Owner rule |
|---|---|---|---|
| `deploy` | deploy | switches the release | D-08 window, activation hold |
| `door-upgrade` | deploy | replaces the door | owner, root `install.sh --upgrade` |
| `unit` | operate | start/stop/restart a unit (refuses retired triggers) | |
| `hold` / `release-hold` | operate | park a timer | |
| `test-job` | operate | starts a test job (may spend) | money |
| `selected-handoff` | operate | recover one hand-off | |
| `extend-scene-execution-window` | operate | moves a scene window (plan, then `--apply`) | owner approval reference |
| `confirm-owner-success-contract` | operate | records a site's success thresholds | owner approval evidence |
| `retire-scene-workspace` / `restore-scene-workspace` | operate | moves a scene workspace | |
| `purge-experiment-folder` | operate | deletes an experiment folder | owner (deleting retained data) |
| `retire-parked-delivery` | operate | retires a parked delivery | owner approval evidence |

Client-only subcommands besides these (`scripts/operator_door.py --help`): `legacy-owner-census`,
`provider-output-resume`, `lane-scratch`, `retire-scene`, `restore-scene`, `pull`. Read subcommands:
`whoami, status, usage, ls, cat, journal, units, show, requests`.

The installed door is older than the repo door: the repo says the trial's worker snapshot "is omitted
from `/status`" (`docs/OPERATOR_DOOR.md`, changed 2026-11-20 in 523df9b) and repo `status.py` has no
`beta_screening` key, yet the installed door's status still returns `beta_screening`
(last observed 2026-11-15, `status: preparation_needed`, 4,262 candidates `unavailable`). The door's
version string has not changed (`deploy/operator-door/operator_door/__init__.py:13`: `1.0.0`), so the
status cannot say which door is installed.

Manual `python -m blueprint_pipeline.*` commands in runbooks, OPERATOR_DOOR.md and AGENTS.md (grep, 41
distinct): money (`account_monthly_spend`, `paid_spend_meter_sources`, `daily_spend_snapshot`,
`provider_billing_audit_retention`, `gpu_provider_key_rotation`, `paid_resource_allocator gpu-canary |
remote-cpu-job | provider-reconstruction | cpu-build`), replays (`task_evaluation_stage_replay`,
`atlas_preview_replay`, `task_evaluation_downstream_replay`, `test_job_matrix`), Atlas
(`website_atlas_preview tick|retry|poll`, `website_atlas_pipeline --source-video`,
`website_atlas_operator`, `atlas_video_inputs survey|prepare`, `atlas_video_extension`), withdrawal
(`website_capture_withdrawal_deletion`, `_automatic`, `_drill`), host (`control_plane_state_backup restore`,
`control_plane_break_glass record`, `task_evaluation_release_retention`, `task_evaluation_scene_lifecycle_plan`),
and retired-lane tools still documented (`internal_team_evaluation_diagnostic stage|serve-policy|run|fixture`,
`groot_oscar_cached_footprint`, `task_evaluation_task_family_native_adapter materialize`). AGENTS.md also
lists `python -m blueprint_pipeline.runtime_service_app` as an entry point; see finding IP-11.

### 6. CLI entry points and scripts

- `pyproject.toml [project.scripts]`: 30 console scripts. They include
  `blueprint-run-runpod-provider-adapter` (retired provider) and `blueprint-run-lambda-provider-adapter`
  (unused provider), `blueprint-capture-pipeline` (`capture_orchestrator`, on the website path through
  `run_e2e`) and WAM/policy worker contracts.
- Modules with a `__main__` guard that nothing else starts: **79 modules, 37,702 lines** are reachable
  only as a hand-run CLI (no unit, door script, deploy script or other script reaches them).
- `scripts/`: 183 entries, 177 runnable files. 33 are named in a CI workflow, 92 in deploy or src, 29 only
  in tests, 6 referenced nowhere (`object_index_yolo_world_runner.py` 2026-03-13,
  `paid_call_site_reachability.py`, `probe_inpaint360_camera_rasterizer.py`, `run_simready_validator_worker.py`,
  `write_scene_agents_api_project_guard.py`, `setup_simready_validator_env.sh`). By name: 33 ADP/Aura/
  Inpaint360/ArtiFixer/retained-render, 20 release/evidence/supply chain, 20 deploy/host, 15 paid
  authority/launch, 14 Isaac/Omniverse/measurement, 14 validate/verify, 12 scene configuration, 9
  G1/native/policy, 6 SAM, 34 other.

### 7. Tests and CI

- Test files: 1,754 `tests/**/test_*.py` (1,805 `.py` under `tests/`), 644,817 lines.
- By the package family each test mostly imports: other 586, task_evaluation 360, control_plane 159,
  no package import 151, website 105, native_task_arena 83, atlas 50, ADP/Aura 42, policy/trial 34,
  team/robot offer 31, G1 30, agent runtime 29, Isaac/render 16, public scene 16, task object 15, Astra
  14, measurement 8, episode compilation 7, rigid probe 7, capture bridge 4, content agents 3, RunPod 3,
  screening 1.
- **41 test files (7,933 lines) import only retired-family modules** (G1, trial, RunPod, Astra, screening),
  for example `test_unitree_groot_n17_sonic_*` (7 files), `test_native_g1_*` (11), `test_scripted_robot_*`
  (3), `test_groot_oscar_runpod_*` (2).
- 134 modules on the website path (20,320 lines) are imported by no test file.
- CI (`.github/workflows`, 11 files):
  - `ci.yml` on push to main and every PR: impact plan (2 min cap) then impacted tests and sentinels
    (10 min cap). Recent runs took 2 to 19 minutes (`gh run list --workflow ci.yml`, 2026-11-20/21).
  - `full-test-lane.yml` daily 08:17 UTC (runs observed 15:00-17:40 UTC): 12 shards; on 2026-11-21
    shards took 11 to 24 minutes, about 232 runner-minutes in all, roughly 2,800-3,500 tests per shard.
    **Failed 2026-11-18, 19, 20 and 21; passed 2026-11-14 to 11-17.** Failures: 11-21
    `test_registered_feature_linux.py::test_actual_registered_disk_diagnostic_delete_offload_and_restore`
    (`groupdel: group 'blueprint' does not exist`); 11-20 `test_scene_attempt_measured_compute.py` and
    `test_task_evaluation_scene_configuration_diagnostic_rejection.py`; 11-19 `test_test_job_matrix.py`
    plus one more; 11-18 `test_live_pipeline_setup.py`.
  - `impacted-wide-lane.yml` (53 min cap), `replay-set.yml` (daily 07:41 and PRs), `codeql.yml` weekly,
    `daily-research.yml`, `python-compatibility.yml`, `terraform-static.yml`, and three manual lanes
    (`critical-capability-lanes.yml` on self-hosted GPU/emulator runners, `production-release-provenance.yml`,
    `release-signature-verification.yml`).

### 8. What is live: the import graph

Method: Python `ast`, standard library only, over every module in `src/blueprint_pipeline`
(1,621 modules incl. subpackages, 715,431 lines). Edges are `import`/`from ... import`, including
imports inside functions, resolved to the module file and its parent packages. A second pass also
counts a string literal that is exactly a module name (`"blueprint_pipeline.x"`) as an edge; the
supervisor's worker list is built by string concatenation and is not counted, so each unit's worker is
rooted explicitly. Roots:

- **Website job path:** the 13 modules the W units start (listener, Atlas preview, intake, scene
  progression, launch preparation, activation, dispatcher, reconciler, team scene packet worker, scene
  stage maintenance, dispatcher cgroup cleanup, env guard, supervisor) plus the GPU runner script.
- **Guards, door and deploy:** the G and P unit modules, `scripts/gpu_spend_guard.py`,
  `scripts/deploy_control_plane_commit.py`, the continuous bootstrap, and every `blueprint_pipeline.*`
  name in the door code and door shell scripts.
- **Held lanes:** rigid probe runner, both remote collectors and conditions, terminal resource release,
  host episode compilation worker, SAM 3.1 preparation execution.

| Set | Modules | Lines | Source |
|---|---|---|---|
| Reachable from the website job path (static imports) | 1,317 | 581,873 | `reach.py` |
| same, counting exact-name string references | 1,370 | 604,740 | `reach.py` |
| Reachable from guards, door and deploy | 1,382 | 601,173 | `reach.py` |
| Live total (website path or guards) | 1,393 | 605,219 | `reach.py` |
| Reachable only from held/paused lanes | 5 | 3,062 | `reach.py` (`team_scene_packet_collector`, `..._remote_condition`, episode compilation collector and condition, terminal release) |
| Reached from any production file at all (units, door, all of `scripts/`, `functions/`, `tools/`, `deploy/`, `main.py`, console scripts) | 1,488 | 656,405 | `testonly.py` |
| plus every module with a `__main__` guard | 1,567 | 694,107 | `testonly.py` |
| Imported by nothing but tests | 44 | 20,028 | `testonly.py` |
| Imported by nothing at all | 10 | 1,296 | `testonly.py` |

The website closure is nearly the whole live system because a few hub modules import widely:
`vast_provider_adapter` (10,327 lines), `paid_resource_allocator`, `task_evaluation_launch_dispatcher`,
`team_scene_packet` and `task_evaluation_result_delivery` pull in the robot arena, the trial's policy
contracts, G1 and Astra.

#### 8.1 Biggest clusters (modules / lines; on the website path; not live)

| Family (by name) | Modules | Lines | On website path | Not live |
|---|---|---|---|---|
| other (shared, storage, contracts, misc.) | 500 | 205,681 | 361 / 148,982 | 115 / 48,551 |
| `task_evaluation_*` | 345 | 150,326 | 325 / 140,960 | 15 / 6,425 |
| `native_*` incl. `native_task_arena_*` (robot arena) | 129 | 74,832 | 103 / 56,759 | 26 / 18,073 |
| `website_*` | 119 | 48,553 | 115 / 47,229 | 2 / 613 |
| `control_plane_*` | 111 | 45,578 | 86 / 40,136 | 3 / 707 |
| ADP / Aura / Inpaint360 / ArtiFixer | 45 | 34,957 | 32 / 27,046 | 13 / 7,911 |
| Atlas / World Labs | 63 | 22,122 | 60 / 20,709 | 2 / 817 |
| policy / trial (excl. retry and selection policies) | 55 | 17,535 | 44 / 14,135 | 11 / 3,400 |
| episode compilation and episode evidence | 17 | 17,152 | 12 / 13,730 | 2 / 1,405 |
| team / robot offer / embodiment | 43 | 16,091 | 40 / 14,800 | 3 / 1,291 |
| G1 / Unitree / Sonic | 35 | 14,261 | 27 / 7,474 | 8 / 6,787 |
| public scene | 22 | 12,990 | 17 / 10,093 | 5 / 2,897 |
| Isaac / render | 21 | 11,139 | 13 / 5,934 | 8 / 5,205 |
| measurement (Chrono, Drake) | 10 | 8,017 | 10 / 8,017 | 0 |
| agent runtime / execution | 32 | 7,166 | 7 / 1,914 | 6 / 1,054 |
| Astra CAD | 13 | 5,268 | 11 / 4,914 | 2 / 354 |
| rigid robot-free probe | 12 | 4,403 | 12 / 4,403 | 0 |
| capture bridge / ARKit / V3.2 (historical name; `capture_bridge.CaptureDescriptor` is live) | 7 | 4,190 | 7 / 4,190 | 0 |
| RunPod | 4 | 3,524 | 1 / 1,127 | 3 / 2,397 |
| Lambda | 1 | 1,724 | 0 | 1 / 1,724 |
| screening (records kept for withdrawal and money) | 3 | 860 | 3 / 860 | 0 |

Families are by module name, so they are approximate: a name match is not proof of purpose.

### 9. Remains of retired systems

#### 9.1 The early trial of robot software (dropped 2026-11-14)

The big removal already happened: #3598 (2026-11-15, `45a99fbeb`) deleted 412 files and 109,638 lines,
including every `beta_policy_screening_*` module. What remains:

- 55 policy/trial modules (17,535 lines); 44 (14,135 lines) are on the website path.
- **Live module -> trial module imports (59 edges, 41 live importers, 22 trial modules).** The full list
  is in `boundary.json`; the ones on the main job path, with lines:

| Live module | Imports trial module | Where |
|---|---|---|
| `task_evaluation_launch_dispatcher` | `task_evaluation_policy_run_contract` (1,092 lines) | `task_evaluation_launch_dispatcher.py:61` |
| `task_evaluation_launch_activation_worker`, `task_evaluation_launch_preparation_worker`, `task_evaluation_launch_preparation_contract`, `task_evaluation_scene_configuration_publication`, `task_evaluation_run_webapp_sync` | `task_evaluation_policy_run_contract` | (graph) |
| `task_evaluation_scene_progression` | `task_evaluation_scene_policy_capability` (a gate on the trial's frozen checkpoint inventory) | `task_evaluation_scene_progression.py:725` |
| `website_robot_fit` | `droid_policy_canary_embodiment` (constants) | `website_robot_fit.py:99` |
| `website_rigid_feasibility` (docstring only) | names `config/beta_policy_candidates.v1.json`, which no code reads | `website_rigid_feasibility.py:25` |
| `task_evaluation_result_delivery` | `policy_canary_control_result_delivery`, `policy_canary_output_members`, `policy_paired_summary`, `droid_policy_canary_embodiment` | `task_evaluation_result_delivery.py:1458` |
| `vast_provider_adapter` | `vast_policy_canary_remote_progress`, `vast_structured_policy_canary_inspection`, `vast_wam_terminal_diagnostic`, `wam_provider_output`, `company_policy_network_lease` | `vast_provider_adapter.py:197` |
| `team_arm_reach` | `scripted_robot_runtime_dispatch` | `team_arm_reach.py:147` |
| `task_evaluation_embodiment_registry` | `droid_policy_canary_embodiment`, `task_evaluation_policy_candidate_registry` | (graph) |
| `task_evaluation_scene_terminal_reconciler`, `..._terminal_result_index`, `..._execution_authority`, `..._control_omission`, `task_evaluation_team_run_*` | `task_evaluation_scene_policy_binding`, `task_evaluation_policy_canary_result`, `task_evaluation_scene_policy_capability` | (graph) |
| 9 provider/output modules (`provider_output_*`, `adp_*_vast`, `native_task_arena_*`, scene configuration transports) | `wam_provider_object_store` (1,994 lines), `wam_provider_output`, `policy_canary_output_members`, `wam_async_runner_common` | (graph) |
| `vast_official_billing_extractor` | `policy_canary_official_billing` | (graph) |
| `job_capability_routing`, `team_candidate_quick10_registry`, `native_task_arena_bundle` | `task_evaluation_policy_candidate_registry`, `policy_canary_scene_resolution`, `task_family_policy_execution` | (graph) |

- Records kept on purpose (AGENTS.md): `screening_retained_ledger` (still holds `SITE_LIMIT = 30`,
  `screening_retained_ledger.py:33`), `screening_site_withdrawal` (imported by `scene_stage_maintenance.py:79`),
  `website_capture_withdrawal_screening`.
- Disk: `/mnt/blueprint-work/beta-policy-screening-work/attempts` 9.4 GiB; policy canaries
  `/var/lib/blueprint/pipeline-control-plane/task-evaluation-policy-canaries` 15.9 GiB;
  `native-policy-canaries` 2.8 GiB; `controlled-policy-integration-20260928` 5.0 GiB.
- Money: $34.52 of November's metered spend is screening (Vast) on two captures.
- Config: `config/trial/` (5 files), `config/policy_runtimes/` (2), `config/beta_policy_candidates.v1.json` (none read by production code).
- Tests: 34 test files mostly about policy/trial modules.
- Docs: AGENTS.md "Spend limits" rows and "Hard stops" still name the screening per-site budget and the
  deleted `beta_policy_screening_coordinator.py`, `_plan.py`, `_capabilities.py`.

#### 9.2 Other retired or held systems

| System | Modules / lines | On website path | Still imported by (live, non-retired) | Timers that fire | Disk held (door `usage`) | Tests | Last change |
|---|---|---|---|---|---|---|---|
| RunPod (retired 2026-11-05) | 4 / 3,524 | 1 / 1,127 | `task_evaluation_dispatcher_cgroup_cleanup.py:24` and `vast_independent_watchdog_control` import `groot_oscar_runpod_watchdog` (for `EVIDENCE_NAME`) | the spend guard queries RunPod every run and fails (4,844 times) | none seen | 15 test imports | adapter 2026-11-14 |
| G1 / native humanoid lanes | 35 / 14,261 | 27 / 7,474 | 16 live modules, e.g. `website_locomotion_hold.py:95` -> `task_evaluation_g1_catalog`; `task_evaluation_embodiment_registry` -> `native_g1_beta_authority`; `native_task_arena_runtime` -> `native_g1_navigation_goal`; `control_plane_lane_experiment_*` -> `native_g1_registered_containment`; `website_capture_withdrawal_deletion` -> `website_capture_withdrawal_native_g1` | none | `g1-841757-development` 8.6 GiB, `g1-cuda-runtime-source-7c1f528-20260926` 4.3 GiB, `scene841757-autonomous-20260907` 2.0 GiB, `g1-841757-blueprint-runs` 0.36 GiB | 90 test imports; 35 failed transient units | configs 2026-09-24 |
| Astra CAD authoring (backend kept, "when that backend runs") | 13 / 5,268 | 11 / 4,914 | 19 live modules, incl. `website_task_preparation.py:1809`, `website_native_inputs.py:224`, `website_synthetic_cad.py:195`, `task_object_agent_*`, `claude_opus_*` | none | not separated | 63 test imports | |
| Episode compilation (robot-team) | 17 / 17,152 | 12 / 13,730 | `team_scene_packet.py:439` -> `task_evaluation_native_arena_episode_compiler`; `task_evaluation_launch_preparation_worker.py:72` -> `task_evaluation_episode_compilation_queue`; `team_scene_packet_remote` -> `task_evaluation_episode_compilation_remote` | remote timer 60 s + path (armed to drain); host lane disarmed | not separated | 68 test imports | |
| Rigid robot-free probe (lane kept, $1 cap) | 12 / 4,403 | 12 / 4,403 | `scene_stage_maintenance.py:251`, `scene_stage_holds.py:203`, `team_scene_packet.py:1429` -> `rigid_robot_free_probe_runner` | timer every 5 min + path; queue `pending: 0` | `/mnt/blueprint-work/rigid-robot-free-probe-work` (not in top list) | 64 test imports | runner 2026-11-14 |
| Team scene on Cloud Run | `team_scene_packet_collector` 957, `team_scene_packet_remote_condition` 66 (not live), `team_scene_packet_remote` 851 | partly | `team_scene_packet_worker` | timer 60 s + path, armed although SYSTEM_MAP calls it off | `/opt/blueprint/remote-cpu-runtime` 8.3 GiB (shared) | | 2026-11-05 |
| Configured controls / policy integration | (deleted lanes) | | | retired triggers stopped each release | `configured-controls` 9.1 GiB (newest change 2026-09-27) | | |
| Internal team diagnostic | `internal_team_evaluation_diagnostic` (CLI) | no | | none | `internal-team-evaluation-diagnostic-20261015` 5.5 GiB; 29 failed transient units | | |
| Capture app bridge / BlueprintCapture hand-off | 7 / 4,190 (`capture_bridge`, `capture_intake`, ARKit, V3.2 admission) | 7 / 4,190 | `website_capture_preparation.py:8` uses `capture_bridge.CaptureDescriptor` (live) | Cloud Function `storage-trigger` (live) | | 36 test imports | |
| Lambda Labs | 1 / 1,724 | 0 | nothing (console script only) | none | | 2 | |
| AWS (retired) | guard row `aws_provider_integration_removed` | | | | | | |

Retired-lane disk, lower bound from the survey (`usage survey: truncated`, 10,535 of 20,865 partitions
measured): 15.9 + 9.4 + 9.1 + 8.6 + 5.5 + 5.0 + 4.9 (`runtime-comparison-jobs`) + 4.3 + 2.8 + 2.0 =
**67.5 GiB**, plus experiment roots (`task-evaluation-control-plane-experiments` 2.6, `render-gate-canary`
1.4, `placement-preflight-candidates` 1.2). Host free space: `/` 85.1 GB of 165.3 GB,
`/mnt/blueprint-work` 102.0 GB of 316.5 GB (door `status.disk`).

Spend limits that still exist only for retired lanes: the screening per-site $30 (`screening_retained_ledger.SITE_LIMIT`,
WebApp `server/utils/betaPolicyScreeningContract.ts`), the rigid probe's $1/attempt reservation, the RunPod
refusal path. None reserves money today (`held_usd: 0`).

### 10. Owner, change date, coverage and production status per row

The tables above carry last change (`git log -1 --format=%cs`), test files importing each module, and
host state. Owner, where a row has one: website stages = owner direction 2026-11-12 (AGENTS.md mission);
money units = AGENTS.md "Spend limits" with owner decisions 2026-11-07, 2026-11-12, 2026-11-19, 2026-11-20;
withdrawal = privacy hard stop; door = D-08 (2026-11-02); paused lanes = owner frame 2026-11-12; trial
removal = owner 2026-11-14; RunPod retirement = owner 2026-11-05. Rows with no owner: the preflight timer
(D-04 says its count is not a signal), the Cloud Run team-scene timer, the remote episode-compilation timer,
the rigid probe timer, and the policy capability gate in scene progression.

Running in production means: unit installed and armed per `door units`, and code in release `cbff06b`
(HEAD differs by 22 files, none of them unit files; the code files are `atlas_privacy_screen.py`,
`website_company_simulation.py`, `website_packet_facts.py` and `scripts/operator_door.py`:
`git diff --name-only cbff06b HEAD`).

### Findings index

Full entries with evidence are in `inventory-pipeline.findings.json`.

| id | severity | dimension | title |
|---|---|---|---|
| IP-01 | P1 | broken | No company simulation package exists for any capture on the host |
| IP-02 | P1 | fragile | The GPU spend guard has failed 4,844 times since 2026-11-13 because retired RunPod is still queried |
| IP-03 | P1 | unseen | 207 failed units on the host, 206 of them stale experiment runs that hide real failures |
| IP-04 | P1 | vestigial | The website job path imports 81% of the package, retired lanes included |
| IP-05 | P1 | vestigial | Trial code is still imported by 41 live modules along 59 edges |
| IP-06 | P2 | over-gated | Scene progression still gates every intent on the retired trial's checkpoint inventory |
| IP-07 | P1 | fragile | Production blurs faces for jobs under the current Privacy Policy until the next deploy |
| IP-08 | P1 | untrue | SYSTEM_MAP says faces are blurred in every frame sent to World Labs |
| IP-09 | P2 | untrue | AGENTS.md and architecture docs cite files deleted on 2026-11-15 |
| IP-10 | P2 | vestigial | Retired lanes hold at least 67 GiB of host disk |
| IP-11 | P2 | vestigial | 44 modules are imported only by tests, including an entry point AGENTS.md names |
| IP-12 | P1 | fragile | The nightly full test lane has been red four nights running |
| IP-13 | P2 | vestigial | Three armed timers fire for lanes no website job feeds |
| IP-14 | P1 | unseen | The account's November spend cannot be fully verified and is forecast to hit the limit |
| IP-15 | P2 | unseen | The installed operator door is older than the repo's and its version never changes |
| IP-16 | P2 | vestigial | RunPod and Lambda adapters remain as console scripts after retirement |
| IP-17 | P2 | unseen | The chain preflight reports 108 blockers every 30 minutes that nobody acts on |
| IP-18 | P2 | fragile | Launch preparation, activation and dispatch keep their own retry rules |

### Firestore aggregates wanted

For the orchestrator's reviewed read-only script. Non-personal fields only; no site names, addresses,
contacts, job sentences or video references.

1. `taskEvaluationSceneIntakes`: count by status/outcome field, created in the last 30 days; median and p90
   of (first scene-intent forward time minus created time). Settles how many jobs reach row 5.
2. The collection the WebApp writes when the Pipeline reports a company simulation package (the signed
   `company-simulation` control operation; collection name per WebApp `server/routes`): count of jobs with
   a package recorded, ever and last 30 days; median time from upload complete to package recorded.
   Settles whether any company has ever had a downloadable simulation (finding IP-01).
3. `inboundRequests`: count created in the last 30 days, and how many have a capture upload completed.
4. `captureOutbox` (or `deliveryReceipts`): count by template/kind and status, last 30 days, to see which
   job-path emails actually go out.
5. Introduction / billable-event collection (WebApp name): count of introductions recorded, last 30 days.

### Not covered

- I did not open any site's state file, frames or media; job-level causes (why 4 captures have no team
  scene half) are left unverified.
- I did not run any test suite or CI job; test durations are from GitHub run metadata.
- Host env files (`/etc/blueprint/*.env`) were not read, so production values of commented switches
  are unknown.
- Cloud Run, GCP and B2 resources were not inventoried beyond what the door reports.
- The import graph is static. Code loaded by `runpy`, `importlib` with computed names, subprocesses or
  remote images may add edges; the unit roots cover the supervisor's workers explicitly.
- Flags were not re-classified one by one; the 2026-11-05 inventory is cited for that.
