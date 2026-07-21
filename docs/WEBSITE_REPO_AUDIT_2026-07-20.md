# Website & Repo Deep Audit — 2026-07-20

Perspective: an investor doing pre-Series-A diligence, and three first-time users
(robot-team buyer, capturer, site-ops coordinator/site lead) landing on
https://tryblueprint.io with no prior context.

Scope: live site (tryblueprint.io, verified up with prerendered titles, sitemap,
robots.txt), full client route graph, all public copy vs. `PLATFORM_CONTEXT.md`
doctrine, all three persona flows end-to-end through the code, data provenance
(real vs. fabricated), and repo hygiene. Evidence is cited as `file:line` at
HEAD `e6c3e20`.

Verification state: `npm run check` = 0 errors; `npm run build` = green
(client + prerender + sitemap + server bundles); 224 test files (~79k lines,
real assertions); live routes spot-checked against production.

---

## Executive summary

**The bones are strong.** The visible nav is disciplined (4 top-level items),
the live homepage tells the right story ("Test robot policies before field
time"), typecheck/build/tests are green, SEO/prerender/llms.txt are done
properly, and most live pages label illustrative numbers honestly.

**Three things would end an investor conversation today, and all three are
fixable in days:**

1. **The site violates its own #1 rule ("no fake supply, no fabricated
   operational states") on its highest-traffic supply page and inside the paid
   product.** `/sites` (sitemap priority 0.9) renders 8 fictional facilities
   marked "Ready to evaluate" with no disclaimer, and the logged-in
   `/dashboard` fabricates engagement analytics with `Math.random()`.
2. **A borrowed research metric is presented as a first-party product result.**
   "The ~0.929 rank fidelity **we report**" (Vision) and an unattributed
   "0.929 — Sim-to-site fidelity" KPI tile (About) both borrow SC3-Eval's
   published correlation. One diligence question — "show me the eval behind
   0.929" — has no answer in the repo.
3. **Live API keys are committed in client source.** A Lindy webhook bearer
   token ships in the production bundle today; Perplexity and Firecrawl keys
   sit in committed (dead) code and in git history.

**The structural story:** the repo carries **three abandoned positionings**
(world-model-first, qualification-first, readiness-first) as dead code under a
correct current one. ~46 of ~80 page files are unreferenced, ~120 registered
paths collapse to ~14 real destinations, 4 signup paradigms coexist, and 3
different logged-in "homes" compete. Meanwhile the two most important *real*
things are missing: **Policy Improvement Runs** (half the stated product
wedge) appear nowhere in the live funnel, and **a paying buyer cannot find
their run after a page refresh** because `/app/runs` intentionally renders
nothing and the existing status endpoint has zero client consumers.

KISS verdict: the site doesn't need more pages — it needs ~60% of its pages
deleted, one buyer loop completed, and one product (Policy Improvement)
surfaced.

---

## Part 1 — Trust & truth violations (P0: fix before anything else)

### 1.1 Committed secrets (rotate first, then purge)

| Secret | Where | Live exposure |
| --- | --- | --- |
| Lindy webhook bearer token | `client/src/utils/lindyWebhook.ts:4`, `client/src/pages/Workspace.tsx:169`, `TeamMembers.tsx:392` | **Ships in prod bundle** — `lindyWebhook.ts` is imported by `OffWaitlistSignUpFlow.tsx` (routed at `/off-waitlist-signup`) |
| Second Lindy token (commented) | `Workspace.tsx:120`, `TeamMembers.tsx:334` | In git history |
| Perplexity API key (`pplx-…`) | `client/src/components/FeatureConfigScreens.jsx:2214` | Dead code, but committed |
| Firecrawl key (`fc-…`) ×6 | `FeatureConfigScreens.jsx` (6 call sites) | Dead code, but committed |

Action: revoke/rotate all four credentials at the provider, then delete the
files (all are on the dead-code removal list anyway, except `lindyWebhook.ts`
whose one live consumer is itself a legacy flow to retire). Keys remain in git
history — rotation is the real fix; history rewrite optional.

### 1.2 Fake supply rendered as real (live pages)

- **`/sites` is 100% fictional with zero disclaimer.** `client/src/data/siteLibrary.ts:324-628`
  hardcodes 8 invented sites ("Motor City Battery Staging Cell", "Piedmont
  Hospital supply hallway"…) with fabricated operational states:
  `readiness: "Ready to evaluate"`, `scenarioCount: 500/440/320`, "Capture
  complete · operator approval needed". `Sites.tsx:165,296` renders the array
  directly — no fetch, no "sample" label. This page is prerendered, in the
  sitemap at priority 0.9, and linked from the footer. It is the single
  clearest violation of the platform doctrine, on the page an investor or
  buyer is most likely to use to gauge traction.
- **Production fallback catalog of 12 invented facilities with real street
  addresses.** `client/src/data/siteWorlds.ts:698-1116` ("Harborview Grocery
  Distribution Annex, 1847 W Fulton St, Chicago"… with `scenePrice: "$2,400"`).
  The comment at `:1118-1120` says this is intentional: when the live API
  returns empty, production renders these. The server side correctly disables
  static fixtures in prod (`server/utils/site-worlds.ts:37-40`); the client
  fallback undoes that discipline. Also note `server/utils/site-worlds.ts:4`
  imports this client data file directly — one env flag
  (`BLUEPRINT_ENABLE_DEMO_SITE_WORLDS`) re-enables fixtures in the production
  API.
- **Capture jobs: invented listings with real cities and Apply buttons.**
  `Capture.tsx:101-199` — six named facilities in Durham, Austin, Phoenix,
  Chicago, Denver, Seattle with payout dollar bands and per-job "Apply for
  this job". It *is* labeled "mock … representative examples" (`:441,447-450,692-694`),
  which is better than /sites — but city filters + payout filters + apply
  buttons over invented supply is still the fake-supply pattern; a capturer in
  Durham will reasonably believe that dock exists. Replace per-job Apply with
  a single honest "join the waitlist for your city" flow, or drive listings
  from the real launch-status API.

### 1.3 Fabricated operational states (live, logged-in)

- **`/dashboard` invents analytics on every reload.** `Dashboard.tsx:682-716`
  ("Add random engagement metrics for demo purposes") attaches
  `Math.random()` engagement/growth/visitors to *real Firestore records*;
  `:753` randomizes "active blueprints %". Sign-in sends every non-capturer
  here (`AuthContext.tsx:251`). A paying customer or investor demo hits this
  immediately.
- **`/join` fakes a provisioning pipeline.** `JoinBlueprint.tsx:383-390`
  writes nothing, then shows fabricated reference IDs "CAP-2049"/"RUN-2049"
  (`:1022`) and "We'll provision your workspace" (`:1006`).
- **`/portal` shows hardcoded "Protected Request 01-03"** cards with fake
  trust scores and a decorative "New request" button (`Portal.tsx:15-37,114`).
- **(Dead but loaded gun)** `data/pilotExchange.ts:645-1267`: invented operator
  briefs with `openSlots`, fake team leaderboards ("Dexter Robotics Beta"
  94%), and fake network traction ("420 Active Capture Contributors",
  "9,000+ Policy Evaluations / Month"); submit handler claims "Evaluation
  queued successfully. We will email your scorecard." Route now redirects, but
  prerender still emits `dist/public/pilot-exchange/index.html`, and the file
  is one nav change from resurrection.
- **(Dead)** fabricated named humans: `components/sections/CaseStudies.tsx:5-25`
  ("Sarah Chen, Digital Innovation Director" with pravatar.cc avatars) and
  invented revenue tiles in `sections/BusinessDashboard.tsx:6-30`.

### 1.4 Borrowed metric presented as first-party

- `Vision.tsx:26`: "The ~0.929 rank fidelity **we report** sits squarely in
  that regime" — SC3-Eval's published correlation phrased as Blueprint's own
  measurement. Fix: "the ~0.929 rank correlation **SC3-Eval reports**…".
- `About.tsx:16`: bare stat tile "Rank correlation 0.929 — Sim-to-site
  fidelity" with **no attribution** — styled as a company KPI. Attribute or
  remove.
- `Pricing.tsx:119-120` "Validated data package" and `Proof.tsx:127` "Validated
  packs": "validated" is exactly the word the doctrine gates behind
  request-scoped owner-system proof — on the two pages meant to demonstrate
  claim discipline. Rename ("Provenance-checked export" or similar).

---

## Part 2 — The story a first-time visitor gets (what's missing)

### 2.1 Half the product wedge is invisible

**Policy Improvement Runs appear nowhere in the live funnel** — not on Home,
ForRobotTeams, Pricing, or HowItWorks (whose pipeline ends at "Decide", no
improvement loop). Doctrine (`PLATFORM_CONTEXT.md` 2026-06-05 overlay) defines
the public wedge as *both* eval runs and sim-only policy improvement runs. For
an investor this halves the story; for a buyer who wants black-box improvement
there is no page, tier, or CTA. Add: a section on ForRobotTeams + a Pricing
tier + a HowItWorks pipeline step, written source-access-optional (black-box
supported; never promise an improved artifact for black-box-only customers).

### 2.2 The supply side is invisible on the homepage

For a two-sided marketplace, capturers get zero homepage presence — only a
small utility-nav link. A capturer landing on `/` has no header-level signal
that "get paid to capture real sites" exists. One homepage section with the
`/capture` value prop fixes this.

### 2.3 Headers don't carry the story everywhere (the "don't read body text" test)

Pass: Home, ForRobotTeams, Capture, Pricing — headers alone communicate.
Fail:

- `ForSiteOperators` H1 "Supply a real site **without losing the boundary**" —
  an operator can't tell from headers that money flows *to them* or what "the
  boundary" is.
- `/proof` H1 "Proof stays scoped" + hero about "the 0.929 research result"
  assumes context no first-timer has — and since `/faq` redirects here, the
  most common secondary-nav intent lands on the least self-explanatory page.
  **The site currently has no FAQ at all.**
- Jargon-before-definition on Home/ForRobotTeams heroes: "task pack", "proof
  boundaries", "rank fidelity", "proof-gated verdicts". Definitions exist but
  live one click away on HowItWorks. Add one-line tooltips/parentheticals at
  first use, or a 3-term strip under the hero.

### 2.4 Copy contradictions

- **The $5k contradiction:** ForSiteOperators frames "$5k/site" as *payout to
  operators* ("Payout & monitoring", `:344`), while Pricing's "Site supply —
  $5k / site" tier (`Pricing.tsx:66-77`) reads as a *fee operators pay*.
  Public unit-economics ambiguity; pick a direction.
- `HowItWorks.tsx:186`: pipeline tile "Capture" links to `/for-site-operators`
  instead of `/capture` — would-be capturers get routed to the operator page.
- `Capture.tsx:707` invites "join the waitlist if your city is not open" but
  the honest, API-backed city-status page (`LaunchMap.tsx` — ironically the
  most truthful data page in the repo) was unrouted; capturers can't check
  status anywhere.
- `Vision.tsx:270-271` publicly calls Blueprint "a data-acquisition strategy
  disguised as a product" — candid internally, quotable-against-you on a
  public page.

---

## Part 3 — Persona flows: where each user's job breaks

### Robot-team buyer — *can pay; cannot see what they paid for*

Works end-to-end: `/sites/:slug` → Stripe Checkout (`sessionType:
"robot-eval-run"`) → webhook → `marketplaceEntitlements` → auto-submitted
`robotEvalJobRequests` → pipeline forward. Real, tested, gated.

Broken around it:

1. **No durable run surface.** `app/Runs.tsx` deliberately shows "no run
   records"; `app/RunDetail.tsx` always renders "Run record not available";
   the status endpoint (`server/routes/robot-eval-job-requests.ts:616`) has
   **zero client consumers**. Post-purchase status lives only in ephemeral
   page state — refresh and it's gone. This is the single highest-leverage
   product gap in the repo: the loop is 90% built and the last 10% is a read
   view.
2. **The marketing funnel bypasses the working checkout.** Every CTA on
   ForRobotTeams/Pricing/HowItWorks terminates at `/contact/robot-team`; the
   self-serve path is only discoverable inside site detail pages.
3. **Split-brain logged-in home.** Sign-in routes to legacy `/dashboard`
   (`AuthContext.tsx:251`) — the AR-era theater with random metrics — while
   Header and onboarding-finish route to `/app`. Pick `/app`, delete
   `/dashboard`.
4. Onboarding checklist actions just open contact forms and self-attest
   completion (`OnboardingChecklist.tsx:420-433`).

### Capturer — *funnel ends the moment it starts*

1. Application writes `capturerApplicationStatus: "pending_review"`
   (`CapturerSignUpFlow.tsx:355-366`) — **no approval workflow exists
   anywhere**; nothing ever flips the status; the only consumer is a scorecard
   metric.
2. Logged-in capturer experience is a QR-code placeholder
   (`CaptureAppPlaceholder.tsx`); no assignment, upload, or status surface.
3. Payout rails exist server-side (Stripe Connect, `/v1/stripe`, `/v1/creator`)
   with **no UI**; `amountEarned` is written once as 0 and never updated.

Minimum honest fix: an admin approve/reject action + a capturer status page
("applied → approved → assigned → paid") even if assignment stays manual.

### Site operator — *a contact-form relay wearing a product costume*

1. Post-onboarding they land on the legacy AR `/dashboard` — acknowledged in
   code as a stopgap (`OnboardingChecklist.tsx:444-446`).
2. Rights/privacy/commercialization data collected at signup has no live
   surface: no site status, no evidence review, no buyer interest, no revenue
   share. The pages that would do it (`pages/ops/EvidenceReview.tsx`,
   `BuyerHandoff.tsx`) are orphaned mocks with disabled buttons.
3. Every checklist action loops back to `/contact/site-operator`.

Decision needed: either build a thin real operator status page, or honestly
frame the operator lane as concierge ("we run this with you over email") and
stop simulating a self-serve surface.

---

## Part 4 — What to remove, and why

### 4.1 Dead page code (~46 of ~80 page files; ~58% of `pages/`)

The router (`client/src/app/routes.tsx`) and grep confirm these have **zero
routes and zero importers**. They are three abandoned positionings preserved
as code — world-model-first (`SiteWorlds`, `SiteWorldDetail`, `FAQ`ʼs "What is
a Blueprint world model?"), qualification-first (`PilotExchange`,
`Solutions`), readiness-first (`ReadinessPack`), plus the AR/Blueprint-era
product (`CreateBlueprint`, `ClaimBlueprint`, `Onboarding`, `Workspace`,
`TeamMembers`, `ManagePlan`, `Profile`, `AcceptInvite`). Delete:

- Top-level (34): `Analytics, BookExactSiteReview, BusinessSearch, Blog,
  BlueprintAiStudio, BenchmarkDetail, CaseStudies, EmbedCalendar,
  EmbedDashboard, CreateBlueprint, Docs, ExactSiteHostedReview, LaunchMap*,
  Onboarding, PilotExchange, PilotExchangeGuide, OutboundSignUpFlow,
  SampleEvaluation, SiteWorlds, SiteWorldDetail, Profile, ReadinessPack,
  SampleDeliverables, Solutions, Support, TeamMembers, WebXR, Workspace,
  CityLanding, Careers, ClaimBlueprint, FAQ, Help` — plus dead data
  (`data/pilotExchange.ts`, fabricated sections components) and
  `AcceptInvite.jsx`, `ManagePlan.jsx`.
- Entire dead subdirs (12 files): `pages/analytics/` (6),
  `pages/ops/` (6 — the `/ops/*` routes point at Admin pages, not these).

\* `LaunchMap` is the exception worth **salvaging, not deleting** — it's the
one honest API-backed coverage page; re-route it if city status should be
public, else delete with the rest.

Exclusion: `Agents.tsx` stays even though it is unrouted —
`scripts/agent-access/agent-access-drift-guard.test.ts` reads it in four
assertions to keep the agent-access surface aligned with llms/docs. Deleting
it requires migrating that guard first (flagged by Codex review on PR #417).

Why remove rather than keep "just in case": they contain the worst doctrine
violations in the repo (fabricated leaderboards, fake success states, world-
model vocabulary), they resurface in repo-level diligence, several still get
prerendered into `dist/`, and every future copy migration has to sweep them.
Git history preserves them.

### 4.2 Route/redirect table

~120 registered paths → ~45 are pure redirects (8 capture aliases, 4
site-worlds aliases, world-models, pilot-exchange, readiness, faq, blog,
careers, solutions, marketplace, partners, environments, help ×4…). Keep only
redirects for URLs that were ever shared externally or indexed (check Search
Console); delete the rest along with their wrapper components. Also remove
prerendering of dead routes (`/pilot-exchange`, `/marketplace`, `/launch-map`
still emit HTML).

### 4.3 Flow consolidation (pick one of each)

| Concept | Keep | Retire |
| --- | --- | --- |
| Business signup | `BusinessSignUpFlow` (`/signup`) | `OffWaitlistSignUpFlow` (routed; legacy AR writes + the live Lindy token path), `OutboundSignUpFlow`, `JoinBlueprint` (theater; fake refs) |
| Capturer entry | `CapturerSignUpFlow` | `JoinBlueprint` capturer track, `ApplyForm.tsx` (its fetch is commented out; orphaned `/api/apply` server endpoint too), fold `CaptureLaunchAccess` waitlist into the signup flow |
| Logged-in home | `/app/*` | `/dashboard` (`Dashboard.tsx` — random metrics, links to 404 route families `/blueprints/:id/ai-studio`, `/blueprint-editor/:id`), `/portal`, `Workspace` |
| Eval entry | `RobotEvalJobRequestPanel` (paid path) + one clear CTA | `RobotTeamEval` (zero inbound links) — either link it as the configurator or delete; hosted-session setup reachable only via legacy `/world-models/:slug/start` URLs — re-home or remove |
| Ops console | `Admin*` pages | `pages/ops/*` mocks |

Also: both live signup flows write ~80 legacy AR fields to `users/{uid}`
(`BusinessSignUpFlow.tsx:637-765`) that nothing reads — trim the schema.

### 4.4 Repo hygiene (Series A diligence readability)

~383 MB tracked, 4,733 files; at least ~160 MB is committed generated output
and ~2,300 files are a separate autonomous-ops platform living inside the
product repo.

1. `git rm -r --cached output/ outputs/ tmp/ issue-updates/` (+ gitignore
   entries; `issue-updates/` is already gitignored but tracked — classic
   drift). Removes ~160 MB: 108 MB Playwright/imagegen artifacts, 34 MB QA
   screenshots in a committed `tmp/`, 18 MB incl. a 7.6 MB pitch pptx, 196
   ticket-status dumps.
2. Extract the ops/agent layer to its own repo: `ops/` (2,005 files, the
   "paperclip" harness incl. vendored external skill packs), `labs/` (166),
   `knowledge/` (135), `knowledge-artifacts/`. This is what makes the repo
   read as an autonomous-org monorepo instead of a product. It also carries
   most of the 107 npm scripts (`autonomy:*`, `city-launch:*`, `autoagent:*`)
   — the product needs ~15.
3. Delete Replit-era leftovers: `replit.md`, `replit.nix`, `.replit` (which
   names a *third* deploy target, cloudrun, contradicting Render),
   `attached_assets/` (Replit pasted dumps; filenames contain U+202F chars
   that break cross-platform checkouts), `paperclip-desktop/`, stray 0-byte
   files `attempted_models`, `failed_attempts`, `model`.
4. Root ops artifacts → out of the repo (or `docs/archive/`):
   `founder-brief-*.md`, `daily-accountability-*.md`,
   `demand_intel_weekly_*.md`, `market-intel-*.md`,
   `MARKETING_AUDIT_REPORT.md` (see 4.5), `THUMBNAIL-QUICKSTART.md`.
5. docs/ triage: 190 files, ~111 date-stamped (58 from April 2026 alone —
   completed one-off specs never pruned). Create `docs/archive/YYYY-MM/`;
   keep `docs/architecture/*` + current 2026-06/07 operational docs live.
6. Large binaries → LFS/CDN: 73 MB `.ply` + 16 MB `.spz` under
   `client/public/world-model-previews/`.

### 4.5 Stale/contradictory governing docs (this is how the drift happened)

- **`CLAUDE.md` mandates "capture-first, *world-model-product-first*
  positioning" while `PLATFORM_CONTEXT.md` (newer, 2026-06-05 overlay) says
  world models are explicitly *not* the primary public offer.** Any agent
  following CLAUDE.md literally is pushed toward the abandoned positioning.
  Fix CLAUDE.md's wording to match PLATFORM_CONTEXT.
- **`MARKETING_AUDIT_REPORT.md` (2026-05-24) is actively misleading**: it
  instructs future agents to preserve `/world-models` and `/product` as the
  current surface — both routes are gone from live (verified: no prerendered
  titles). Archive it with a superseded banner.
- CLAUDE.md/AGENTS.md reference required reading via absolute
  `/Users/nijelhunt_1/...` paths — broken for CI and every other machine;
  make repo-relative.
- CLAUDE.md's graphify rule requires reading `graphify-out/GRAPH_REPORT.md`,
  which is gitignored and absent on every fresh clone — unsatisfiable as
  written; change to "generate if absent" or commit a snapshot.

---

## Part 5 — What to add

1. **Run status/result view in `/app/runs`** wired to the existing
   `GET /api/robot-eval/job-requests/:jobId/status` — closes the paid loop.
   (Highest product leverage per line of code in the repo.)
2. **Policy Improvement Run surface**: ForRobotTeams section + Pricing tier +
   HowItWorks pipeline step, source-access-optional wording per doctrine.
3. **A real FAQ page** (rewrite the dead one in current vocabulary — it
   contains a genuinely good honest answer pattern already) instead of
   `/faq → /proof`.
4. **Capturer status ladder** (applied → approved → assigned → paid) + minimal
   admin approve action; surface city status by re-routing the honest
   LaunchMap data.
5. **Homepage capturer section** (one band: "Get paid to capture real sites" →
   `/capture`).
6. **Self-serve CTA from Pricing/ForRobotTeams** into the working checkout
   (at minimum "Browse sites with runnable task packs" → the *real* subset of
   `/sites`).
7. **Real supply truth on `/sites`**: drive from the live API; clearly badge
   any sample cards "Sample — not live supply"; empty state should say "N
   sites live, request yours" backed by the launch-status API rather than
   fictional inventory.

---

## Part 6 — Prioritized plan

**P0 — truth & safety (hours-to-days, do immediately)**
1. Rotate Lindy/Perplexity/Firecrawl credentials; delete the files carrying
   them (1.1).
2. `/sites`: label or replace fictional inventory; remove the prod fallback
   catalog in `siteWorlds.ts` (or hard-gate + badge it) (1.2).
3. Delete `Math.random()` metrics — retire `/dashboard`, point sign-in at
   `/app` (1.3, 3.1).
4. Fix 0.929 attribution on Vision/About; rename "Validated" SKU (1.4).
5. Unroute/delete `/join` and `/portal` theater (1.3).

**P1 — one story, one funnel (days)**
6. Delete the ~46 dead pages + dead data/components + dead subdirs; prune
   redirects and prerender list (4.1–4.2).
7. Consolidate signups (keep `BusinessSignUpFlow` + `CapturerSignUpFlow`) and
   logged-in home (`/app`) (4.3).
8. Ship the run-status view (5.1). Add Policy Improvement surface (5.2).
9. Fix copy bugs: $5k direction, HowItWorks capture link, ForSiteOperators H1,
   FAQ restoration, jargon-at-first-use (2.3–2.4).
10. Reconcile governing docs: CLAUDE.md wedge wording, archive
    MARKETING_AUDIT_REPORT.md, repo-relative paths (4.5).

**P2 — diligence-grade repo (a focused cleanup PR + one migration)**
11. Un-commit generated output (~160 MB), extract `ops/labs/knowledge` to
    their own repo, delete Replit leftovers, archive dated docs, move heavy
    binaries to LFS/CDN, collapse npm scripts (4.4).
12. Capturer approval workflow + status page; operator lane decision (build
    thin status page vs. honest concierge framing) (Part 3).
13. Client unit-test gap: truth-labeling badges ("Sample", "Illustrative") are
    the compliance mechanism but are guarded by only 2 client unit tests +
    e2e; add coverage so labels can't silently disappear.

---

*Full route table, orphaned-file inventory, and per-page copy findings were
generated during this audit and are summarized above; file:line citations are
at HEAD `e6c3e20`.*

---

## Implementation status — 2026-07-21

Implemented on this branch (see individual commits for detail):

- **P0.1 partial** — secret-bearing files deleted (`lindyWebhook.ts`,
  `FeatureConfigScreens.jsx`, `Workspace.tsx`, `TeamMembers.tsx`).
  **OWNER ACTION STILL REQUIRED: revoke/rotate the Lindy, Perplexity, and
  Firecrawl credentials at the providers — assume they may remain valid and
  they remain in git history until rotated.**
- **P0.2 done** — `/sites` + `/sites/:slug` now accept only current
  Pipeline-backed public records; static fixture responses fail closed and the
  empty state routes to real capture/intake instead of inventing supply.
- **P0.3 done** — `/dashboard` deleted (Math.random metrics gone); sign-in
  routes both personas to `/app`, whose overview selects the buyer or
  request-backed operator surface.
- **P0.4 done** — 0.929 attributed to SC3-Eval on Vision/About; "Validated"
  SKU renamed; "disguised as a product" line removed.
- **P0.5 done** — `/join` and `/portal` theater removed (redirects remain).
- **P1.6 done** — ~46 dead pages/components/data deleted (including the dead
  Agents surface; FAQ.tsx kept and rewritten); orphaned
  deployment-marketplace SVGs removed; prerender/build expectations updated.
- **P1.7 done** — signups consolidated (Business + Capturer flows only);
  single logged-in home (`/app`); the orphaned `/api/apply` endpoint is
  removed, legacy buyer-profile duplicates are no longer written, and
  capturer signup no longer creates synthetic plan or earnings fields.
- **P1.8 done** — durable run view (`/app/runs` + buyer-scoped list
  endpoint); Policy Improvement Run surfaced on ForRobotTeams, Pricing,
  HowItWorks, FAQ.
- **P1.9 done** — copy fixes: $5k fee-vs-payout resolved as an operator-side
  review fee, HowItWorks capture link, ForSiteOperators H1, FAQ restored and
  in footer/sitemap, homepage jargon strip + capturer band. ForRobotTeams and
  Pricing now expose the self-serve site-record path, and the policy-input
  configurator is linked from the robot-team journey.
- **P1.10 done** — CLAUDE.md wedge wording + repo-relative paths + graphify
  rule; AGENTS.md paths; MARKETING_AUDIT_REPORT archived with banner.
- **P2.11 partial** — Replit files, attached assets, stray files, `tmp/`,
  `output/`, `outputs/`, and `issue-updates/` are no longer tracked; the
  claims guard writes ignored runtime reports and recipient recovery now uses
  explicit playbook evidence. Ten dated accountability, founder, demand, and
  market reports have moved from the repository root to `docs/archive/`.
  The two large world-preview `.ply` and `.spz` binaries called out by the
  audit are already stored through Git LFS.
  Remaining: ops/labs/knowledge extraction needs an approved destination;
  broader media CDN migration needs deployment-owner confirmation. The root
  package still exposes 106 scripts because 458 retained docs/code references
  depend on the autonomous-ops, city-launch, GTM, research, and Paperclip
  commands. Collapsing that surface is coupled to the same extraction: moving
  commands without their owning code and runbooks would create a misleadingly
  small product manifest while leaving a broken ops platform in-tree.
- **P2.12 done** — capturer approval, account history, earnings, and Stripe
  payout setup are routed; site operators receive a thin request-backed
  `/app` status surface instead of the legacy AR dashboard. `/capture` no
  longer advertises invented jobs, cities, or payout bands, and `/launch-map`
  now resolves to the API-backed, fail-closed launch-access status surface.
- **P2.13 done** — Sites tests reject static fixture supply and require live
  proof boundaries; homepage tests pin illustrative labels and the generated-
  media-not-real-world-proof boundary so those compliance labels cannot
  silently disappear.
- **Residual truth hardening done** — production now refuses the opt-in
  Pipeline placeholder-request fallback, and any non-production record marked
  `autoCreatedByPipeline` is excluded from public site-world supply. Operator
  status fields remain null when the owning request has not recorded them;
  capturer application, capture, Stripe, and payout views preserve absent
  owner records as unrecorded, while the admin capturer list no longer assigns
  a review state to missing application data. The private buyer request room
  and admin lead APIs no longer turn missing opportunity, rights, capture,
  quote, policy, preview, region, or next-action data into operational-looking
  defaults. Local robot-eval entitlement proof now fails closed unless
  `access_state` is explicit, and buyer run summaries no longer synthesize a
  status for incomplete stored records.
  Settings links to authenticated buyer APIs instead of inventing payment or
  purchase state; the unimplemented public error-statistics endpoint is
  removed; and remaining public copy no longer calls QA acceptance
  "validation" or describes illustrative imagery as placeholder supply.

External launch gates that remain after the code remediation:

- Rotate/revoke the exposed Lindy, Perplexity, Firecrawl, and Render
  credentials; replacement values must stay out of source and chat.
- Choose positive production beta invite/daily limits. Production is healthy
  but `/health/ready` currently returns 503 because both capacity variables
  are absent and the intake contract fails closed.
- Configure `RENDER_DEPLOY_HOOK_URL` in GitHub Actions and disable Render
  automatic deploys so a merge cannot bypass the verified-main workflow.
- Review and merge PR #418, then verify the resulting main CI, Render deploy,
  live build SHA, readiness, canonical routes, and production bundle.
- Decide whether `ops/paperclip`, `labs`, and `knowledge` move to an approved
  operations repository or are formally retained as a monorepo.
