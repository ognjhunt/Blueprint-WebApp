# WebApp inventory (first-principles audit, agent inventory-webapp)

Audit date 2026-11-22. Repository `Blueprint-WebApp` at commit `0ee5df63` (2026-11-21), the commit the live site runs.
This is the map the later audit phases hunt over. Every list below was derived from the code, then cross-checked.
Findings that were already clear while mapping are in `inventory-webapp.findings.json` (ids `IW-xx`).

## How this was built

- Client routes: parsed `client/src/app/routes.tsx` and `client/src/data/minimalPublicSite.ts`.
- API routes: parsed every `router.<method>(...)` in `server/routes/*.ts`, joined to the mount prefixes in `server/routes.ts`. Nested routers (`account-deletion-admin.ts`, `owned-capture-atlas.ts`) were added by hand.
- Callers: every `/api/...` string in `client/src`, the Pipeline repo, `scripts/` and `e2e/`, matched against each route pattern. Routes with no literal match were then searched by their last path word in client, Pipeline (non-test) and server code. A route marked `NONE found` had no hit in any of them.
- Reachability: a scratch import-graph script from the three entry points `client/src/main.tsx`, `server/index.ts` and `server/worker.ts`, resolving relative and `@/` imports. It was run twice: counting every import, and counting only runtime imports (`import type` ignored, since TypeScript erases it). Scripts: scratchpad `agents/inventory-webapp/reach.mjs` and `reach_rt.mjs`.
- Last change: `git log -1 --format=%cs -- <path>` per file.
- Production: the live site runs this commit. Server env values are managed in the Render dashboard and are not in the repo, so a flag's production value is `unknown` unless `render.yaml` sets it.
- Production counts: aggregate document counts from the orchestrator's read-only baseline (`scratchpad/baseline/firestore-collection-counts.json`). No document content was read.

Owner column: an owner direction or doctrine line quoted from a code comment near the thing, a guard, or `nobody found`. Most server routes carry no owner line (157 of 170).

## 1. Client routes

The router (`client/src/main.tsx` -> `appRoutes`) has **150 entries**: 25 routes that render a page component, 1 fallback (404), and 124 redirect routes (69 in `routes.tsx`, 55 from `minimalMarketingRedirects`).
The server keeps a second, overlapping list of 301 redirects in `server/index.ts` (`legacyPublicRedirects`, about 50 entries) and serves the SPA for every pattern in `appRoutePatterns()`.

### 1a. Routes that render a page

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

### 1b. Redirect routes

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

### 1c. Cross-check against `docs/qa/launch-copy-audit/inventory.md`

That file lists 95 captured screens (96 table rows; one row is `llms.txt`). Every page route above has at least one captured screen except four: `/admin/jobs` and `/admin/robot-team-access` (staff pages, outside its customer scope), `/signup` (only `/signup/business` was captured; same component) and `/partners` (same component as `/jobs`). No recording state of `/capture-upload/:token` was captured (camera blocked).
It also lists two things the code no longer matches:
- `/onboarding` 'reachable from header Finish onboarding when onboarding unfinished'. Since 2026-11-20 the page only forwards (`client/src/contexts/AuthContext.tsx:318`) and no component links `/onboarding` (grep of `client/src` finds only the route and the AuthContext pattern).
- `/refunds` is listed as a screen. It is now a redirect to `/terms` (`client/src/data/minimalPublicSite.ts:66`, owner 2026-11-21).

### 1d. Screens and states

Counting each page route's distinct states from the table above (approximate where marked 'about'): Home 1, How it works 1, Find jobs 4, Questions 1, site job page about 40, outcome thanks 3, claim 5, company library about 12, site start about 10, company job page about 12, sign-in 5, signup 4, onboarding 1, forgot password 3, legal 4, settings 6, admin access 8, admin jobs 7, your jobs 6, captures 12, 404 1. **About 146 states across 23 distinct page components.** The site job page alone holds over a quarter of them.

## 2. Emails

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

## 3. API routes

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

### 3a. Routes with no caller (35)

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

## 4. Crons, timers, schedulers, workers

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

## 5. External providers and services

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

## 6. Feature flags and environment switches

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

## 7. Admin and operator pages

| Page | Who | What it shows | What it does (API) | Last change | Test | Live |
|---|---|---|---|---|---|---|
| /admin/jobs (AdminJobConsole.tsx) | admin, ops | every job: state, workflow evidence, the companies it went to, sends, responses, robot fit, site measurements, simulation download, scene preview, account deletion queue | GET /api/admin/jobs[/:id]; record a send / void it; record an emailed response; hold (stop showing to companies); robot-fit ranking (paid model call); site measurements source document; job-workflow evidence questions; account-deletion review | 2026-11-17 | e2e/job-companies.spec.ts via npm run qa:operator (CI) | yes |
| /admin/robot-team-access (AdminRobotTeamAccess.tsx) | admin, ops | company applications and their status; invitation delivery status; a reviewed job recommendation | approve / decline (sends approval email); invite a team you spoke with; refresh invitation link; decide a robot-team recommendation | 2026-11-19 | client/tests/admin-team-invitation-status.test.tsx | yes |
| /app/captures (app/Captures.tsx) | admin, ops (staff tool since 2026-11-20, routes.tsx:332) | staff capture uploads (phone, 360, mesh), their lifecycle and 3D scene plans with estimated and actual cost | create upload, upload parts, complete, process, delete; plan / authorize / execute a reconstruction (forwards to Pipeline: paid compute) | 2026-11-14 | none found | yes |
| /admin/leads, /admin/leads/:id, /ops, /ops/supply, /ops/evidence, /ops/handoff | admin, ops | redirect to /admin/jobs | - | 2026-11-21 | e2e/redirects.spec.ts (partly) | yes |
| Account deletion queue (components/admin/AccountDeletionQueue.tsx) | admin, ops (inside /admin/jobs) | privacy requests | GET/POST /api/account-deletion/admin | see git | e2e/account-deletion.spec.ts (requester side) | yes |
| Admin robot-team registry API (no page) | admin | - | GET /api/admin/robot-teams, proposals, supply agreements: no page calls them (section 3a) | see git | server/tests | yes (API only) |

## 8. Firestore collections and Storage paths

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

## 9. Tests

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

## 10. Remains of retired systems

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

## 11. Code not reachable from the entry points

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

## Firestore aggregates wanted

For the orchestrator's one reviewed read-only script. Counts and durations only, no personal fields.

1. `captureOutbox`: count grouped by `kind` and `status`; for `status=sent`, median and p90 of `sentAt - createdAt`. Shows which of the 13 kinds ever went out and how many retired kinds sit `cancelled`.
2. `companySends`, `introductions`, `billableEvents`, `robotTeamAccess`: count; `robotTeamAccess` grouped by `status` (applied / approved / declined). Baseline already shows companySends 0, introductions 0, robotTeamAccess 1.
3. `inboundRequests`: count grouped by `request.buyerType` and by job outlook phase (the field read by `server/utils/jobOutlook.ts`); median of first-company-send time minus `createdAt` where a send exists.
4. `taskEvaluationLaunches` (524 docs) and `taskEvaluationPolicyRuns` (121): count with `createdAt` after 2026-11-14 (the trial drop date). Non-zero means trial-era writers still run.
5. `marketplaceEntitlements` (39 docs): max `createdAt`, and count with an unexpired expiry field. Tells whether the paid-evaluation data can be retired.
6. `agentRuns` (2,478): count per `task` name and per month since 2026-10-01, and the sum of any recorded cost field. Tells which paid model tasks still run.
7. `growthCampaigns` (58) / `growth_campaign_events` (403): max `createdAt`. Tells whether outreach campaigns are still writing.
8. `users` (456): count with `onboardingStep` set, grouped by value (old onboarding checklist residue).

## Totals

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

