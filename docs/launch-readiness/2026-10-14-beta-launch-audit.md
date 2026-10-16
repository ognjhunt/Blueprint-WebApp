# Beta launch audit — 14 October 2026

Scope: Blueprint-WebApp and BlueprintCapturePipeline, audited against what the
public site promises after the founder's 2026-10-13 decision. Read-only audit:
no deploys, provider calls, sends, payments, or production writes. WebApp
`main` at `6e49314`; Pipeline `main` at `25946c9`.

> **Embodiment scope superseded, 2026-10-16:** the Franka-only findings and
> proposed example replacements below describe the October 14 baseline, not
> current application or illustration policy. Owner direction implemented in
> [PR #1049](https://github.com/ognjhunt/Blueprint-WebApp/pull/1049) on October 15
> lets a team declare its own robot of any form using
> `blueprint.robot_embodiment.v1`; the Pipeline checks its model, interface,
> scene, and task before execution. This does not prove universal task support
> or a successful live run. The owner reaffirmed on October 16 that the exact
> original Warehouse, Laundromat, Factory, and Hotel animations must remain,
> alongside Café and Lab. Historical findings are retained for traceability;
> they are not instructions to remove approved embodiments. Use the current
> [supply runbook](../beta/ROBOT_TEAM_SUPPLY_AGREEMENTS.md) for team admission.

## Verdict

**The front door is ready. The engine behind it is not, so the beta cannot yet
deliver what the site promises.**

What is ready:

- The public pages are honest and consistent.
- Intake is durable.
- Consent is checked before storage.
- Deploys are CI-gated and roll back on their own.
- Every repo check passes.

What is not ready. Today a site that signs up gets, at best, as far as a scene
preview, and only if an engineer drives its scene by hand. Then it waits with
no end date. There are four reasons:

1. No robot team can request an evaluation on a job started from the public
   form (§3, P0-5).
2. No runtime can run a team's *own* policy for the 10 episodes a
   recommendation requires (L5).
3. No policy has ever succeeded at a website task, and the simulation has
   never been the captured room itself (L3, L5).
4. No willing team on a supported robot is on record (L4).

Separately, three security and privacy findings must be fixed before sign-up is
promoted. One of them is an exploitable data exposure.

Recommendation: fix the security, consent and communications items this week;
they are small. Then close the evaluation engine with one friendly team on one
Franka-feasible site before telling sites that teams will evaluate their job.
Until then, either keep the beta founder-invited, or change the public promise
to match what is delivered. §6 sets out the options.

**What is already solid, and should not be reworked:**

- **Deploys:** CI-gated Render deploys with exact-SHA verification and
  automatic predecessor restore.
- **Tests:** 1,146 passing client tests; the claims guard and brand-polish
  sweep are both green.
- **Intake and consent:** intake retry tokens and the durable outbox; consent
  checked before storage; owner-link withdrawal.
- **Free-run admission:** founder approval, a ≤$20 cap and one attempt
  (`server/utils/freeBeta.ts`).
- **The recommendation evidence rule:** a passing run is required, the job's
  targets are frozen at request time, and at least 10 episodes are needed
  (`server/utils/pilotRecommendationEvidence.ts`).
- **The team-policy sandbox:** runsc, network-denial probes and KMS leases
  (`docs/robot-team-policy-live-proof-20260928/`).
- **Results:** signed result ingest.
- **Public figures:** sourced, with evidence grades.
- **Web hardening:** CSP and HSTS headers; zero production dependency
  vulnerabilities; Firestore default-deny.

## Fix status, 14–15 October 2026

Fixed on the `claude/website-beta-launch-audit-tku220` branches. Nothing below
is live until the three pull requests merge and deploy. Merge order:

1. BlueprintCapture #86 first. WebApp CI checks the shared Firebase rules byte for byte against
   its `main`.
2. Pipeline #2713, deployed before the WebApp's new Terms and Privacy text goes live, so the
   sound-removal statements are true when they are published. Its results now carry a
   `scoring` statement that a WebApp older than #1048 rejects; the Pipeline keeps such a
   report pending and retries it, so nothing is lost while #1048 deploys.
3. WebApp #1048.

On 15 October 2026 BlueprintCapture #86 merged (`6124b09`), and so did Pipeline #2713
(`f635f96`, main CI green). The Pipeline control plane deploys a merged commit only through
`door deploy <sha> --wait`. Until that runs, it stays on `25946c9`.

| Item | Status | What changed | Still needed |
|---|---|---|---|
| P0-1 | fixed in code | Every `/api/admin` mount requires an admin or ops role, plus a regression test that reads every admin mount from `routes.ts` and checks that an ordinary account is refused. | Founder: check Render logs for past use (details in the private report). |
| P0-2 | open | — | Founder: rotate the credentials in the blocker doc; decide D6. |
| P0-3 | fixed in code | Sound is removed before any model or reconstruction provider receives site video (WebApp site review and World Labs; Pipeline privacy-processed walkthroughs and provider uploads). Removal is verified and fails closed. Terms `2026-10-14.2` and Privacy `2026-10-14.1` disclose it, and the upload form shows a recording notice. | Counsel review; the Terms notice email; the deploy order above; the founder's call on shipping the `ffmpeg-static` binary (GPL-3.0). |
| P0-4 | fixed in code | The start form shows the exact anonymized job card and a "Keep this job private instead" choice. | — |
| P0-5 | fixed in code | One rule, `teamJobAccess`, decides whether an approved team may open a job and request an evaluation. The `/sites` card, the opening page and its email link, `POST /api/workspace/evaluations`, free admission, the agent candidate list, self-serve admission and the site's published status all use it. The retired pilot-dossier gate is gone. A test starts from the start form's exact submission through real intake, brief confirmation and the signed Pipeline sync; a 16-case matrix checks that every surface refuses the same jobs. | Founder: confirm three defaults: old dossier restrictions close a job to everyone; a job is offered only with a current recording grant (site-visit jobs need one first); three requests per team per 15 minutes. |
| P0-6 | fixed in code up to a live run | A team's own HTTP verdict never counts as success, and a missing one is never read as success. Every result states who scored it; only a simulator-scored team-candidate result with every binding present counts toward a recommendation, frozen into its evidence. The robot-free success probe is mandatory before a team evaluation, for articulated and now rigid pick/place scenes; passed receipts are retained beside the launch when scene preparation completes, and a team run is bound to the success contract the probe proved. The Pipeline launch path is built and rehearsed end to end without spend: the offer lists the team-candidate runtime (ten episodes) only while the scene is eligible, and this WebApp stores it; the executor admits the run from an operator registry and the funding capsule, claims the job-bound bearer credential, seals a team bundle with no token in it, launches through the canonical allocator within the $20 cap with the token only in the provider's secret channel, and reports a simulator-scored result only after teardown and provider-zero. | A paid Isaac recording of each rigid scene's physics probe (until then rigid receipts read `probe_unavailable`). Operator setup per scene: the team-candidate registry (frozen Quick-10 inputs, retained probe, approvers, hourly rate, TTL). Founder: licence-to-run terms per checkpoint, host-level egress limits (today only the client enforces one origin), and the token's exposure in the provider environment. Then one live proof with a friendly team, a founder dispatch release and approved spend. |
| P0-7 | process fixed in code; supply still the founder's | A team counts as willing supply only with all three recorded agreements (supported interface, a free evaluation on a real job, the pilot if it passes), each with a date, an evidence reference and the recording operator. A typed `engaged` without them is read back as the earlier status; recommendations, the site's team count and the site-assessment agent ignore such teams. Runbook: `docs/beta/ROBOT_TEAM_SUPPLY_AGREEMENTS.md`. | Founder: contact teams (a sourced prospect packet and outreach draft were given privately) and record agreements. No team is recorded as willing today. |
| P0-8 | fixed in code | Screening email, robot-team result emails, the agent API and OpenAPI, CLI help, outreach templates and the workspace "potential matches" line now describe the free beta. `claims:guard` covers the server message surfaces. | — |
| P1-5 | mostly fixed in code | Durable daily caps (Firestore, all or nothing, idempotent, subjects stored only as HMAC keys) on intake (global, per IP, per mailbox; `BLUEPRINT_INTAKE_DAILY_LIMIT=0` is the kill switch), first-touch emails and filmer handoffs, upload bytes (per job and global), and model-review spend (per review and daily). Uploads must carry a real MP4 or QuickTime header. Firebase App Check is staged, off by default. Storage owner paths and client telemetry are bounded in the shared rules. | Run `scripts/apply_firestore_ttl_policies.sh`; set the App Check site key, run `monitor`, then `enforce` (`docs/runbooks/beta-monitoring.md`); set provider-side budget caps; iOS bundle routes need App Attest before App Check can cover them. |
| D1 | done | The shared doctrine names two active programs, the free beta's evaluated, recommended pilot and Arm Decision Proof v1, in all three repos. | — |
| Hardening | fixed in code | Lead-enrichment fetches are pinned to the resolved public address; the client IP is read through a configured proxy-hop count (`BLUEPRINT_TRUST_PROXY_HOPS`); admin access granted only by a profile document is logged. | Founder: turn off the profile-document fallback once the log check is clean. |

## 1. The promise, reduced to what must be true

The home page makes three promises: *show us the task*; *invited teams test it
in a simulation built from your site*; *book the recommended pilot*. The
`/beta` page adds that everything is free and that a site is told when no team
has passed. For that to be true for a site that signs up today, every link in
this chain must hold:

| # | Link | Must be true |
|---|---|---|
| L1 | Understand | A site owner understands the offer, its limits, and what they will get, from the public pages alone. |
| L2 | Submit | They can describe one recurring job and share footage, with consent they actually chose. |
| L3 | Build | Blueprint turns that footage into a simulation of *their* site and a scoreable version of *their* task. |
| L4 | Supply | Invited robot teams exist, are willing, and run a robot the simulator supports. |
| L5 | Evaluate | A team's own policy runs in that simulation for enough episodes to be judged against the job's pass mark. |
| L6 | Recommend | When one passes, the site sees one recommendation with honest limits; when none passes, it is told so. |
| L7 | Book | "Book this pilot" reaches the team, and the physical pilot is arranged. |
| X | Operate | Each site is supported by a human with bounded cost, monitored systems, sound security, and legal terms that match behavior. |

A chain is as strong as its weakest link. The rest of this document grades each
link from code and retained evidence.

## 2. Link by link

### L1 — Understand the offer: **rendered pages good; the surfaces around them still sell the old model**

The rendered public pages match the 2026-10-13 decision.

- `npm run claims:guard` scanned 770 files with 0 findings.
- `e2e/brand-polish.spec.ts` passed 54/54 route-viewport checks and 18/18
  internal links.
- `/beta` is plain and honest: it says what you provide, what you receive, and
  that it costs nothing. It also says what happens when no team passes.
- No public page shows an unsourced figure.
- `/sites/:id` renders Pipeline records only.
- Illustrations are labelled.
- The September 30 missing-H1 issue is fixed
  (`client/src/pages/app/TaskEvaluationResultDetail.tsx`).

The guards only scan `client/src/pages`
(`scripts/claims/cross-source-claims-guard.ts:549`) and rendered routes
(`scripts/qa/brand-polish.ts`). Every surface outside that scope still
describes the paid or matching model.

| Surface | What it says | Evidence |
|---|---|---|
| Public agent "ask" API (unauthenticated, listed in `llms.txt`) | "a limited, invited beta for real sites"; new work "scoped and quoted"; asks for a budget | `server/retrieval/agentAsk.ts:65,117,196`; `server/routes/agent-access.ts:28` |
| Public OpenAPI for robot teams (linked from `/sites` and `/contact/robot-team`) | "buy runs", "paying and running", "run is bought", "scoped and quoted"; the `team fund --amount 100` and `runs start --budget 100` CLI examples; the `blueprint.team.funding.start` tool | `client/public/agent-access.openapi.json:34,78,176,978`; `server/utils/robot-agent-contract.ts:42,58-62` |
| Robot-team run result email (every run, including free ones) | "See this run, every other run, and your balance"; "the rest of the hold returns to your balance". The link `/settings?tab=agent` falls back to the Account tab. | `server/utils/robotTeamNotifications.ts:35-42` |
| Site screening email, sent when the brief is confirmed | Subject "no match on today's list"; "the budget band you gave us" (the public form never collects one: `SiteCaptureStart.tsx` sends `siteTaskSpec: {}`). "N further teams might also fit" counts `provisional` teams, which includes `prospect` companies that never opted in (`robotTeamRegistry.ts:167`). "Reply with an Austin visit date". | `server/utils/qualificationEmails.ts:270-330`; `server/routes/site-task-brief.ts:750-775` |
| Booking acknowledgement (site email and job page) | "Blueprint owns that next step"; "Blueprint must confirm provider and site agreement". The public pages say the site and team agree dates and terms directly. The route itself "records proposal acceptance, not a physical booking". | `server/utils/taskLifecycleNotifications.ts:109`; `client/src/components/site/RecommendedPilot.tsx:94`; `server/routes/task-listings.ts:124`; versus `Home.tsx`, `Beta.tsx`, `Terms.tsx` |
| Outbound outreach prompts (v4 framing jobs) | a "DISCOVERY AND MATCHING WORKFLOW" section; "the pilot booking fee"; "before Blueprint promises a match" | `server/agents/tasks/outbound-outreach.ts:126-131`; `server/agents/outreach-review.ts:125` |
| Lifecycle cadence emails (all intakes enrolled; sending off by default) | "hosted review", "package", "exact-site proof path" | `server/utils/lifecycle-cadence.ts:144-250,409-508`; `render.required.env.example:160`, but `DEPLOYMENT.md:556` says to enable it |

Product scope is also not stated where people decide to apply.

> **Superseded for embodiment policy:** the examples below do not establish
> compatibility for every depicted task, but approved illustrations must not be
> replaced merely because the engineering default is a fixed arm. See the
> October 16 context note above and PR #1049's own-robot contract.

- `/for-robot-teams` invites any team to "Tell us what your robot can do".
- The home example card shows a humanoid walking totes, and the other example
  tabs (towel folding, hotel linen carts) are tasks the Pipeline cannot score
  (`client/src/components/site/PilotPreview.tsx:330-334`).
- `/how-it-works` itself says to start with rigid objects in a fixed work area.
- None of the public pages say that today's evaluations run on one Franka
  rigid-object or open/close task.

Other items:

- `/beta` gives no timeline for when a site hears back.
- The cookie banner still covers mobile form controls
  (`client/src/components/CookieConsent.tsx:124`; first reported 09-30).
- The robot-team CTA has four different labels.
- The "Already approved? Create your account" link loops back to the
  application without the emailed invitation token
  (`RobotTeamEarlyAccess.tsx:19`; `RobotTeamSignUpFlow.tsx:81-86`).

### L2 — Submit a job and footage with chosen consent: **works, with three consent defects**

What works:

- Home → `/contact/site-operator` → `SiteCaptureStart.tsx` →
  `POST /api/inbound-request`. That route creates the encrypted request, the
  `task_received` outbox row, the ops notice, the listing and a pending brief
  review.
- Briefs are drafted at intake and read by a worker with three attempts
  (`captureReviewRecovery.ts`).
- Browser upload checks consent before storage
  (`captureUploadAuthorization.ts`).
- Upload completion is published to the Pipeline.
- Owner-link withdrawal works (`2510157`), and the WebApp deletion worker runs
  in the worker process (`48bba87`).

The defects:

1. **Sites cannot decline the public listing, and cannot see what is
   published.**
   - Commit `0acbf5d` (10-09, "Simplify intake disclosures") removed the
     "Keep this job private instead" checkbox and the preview of the generated
     summary.
   - The form now says "By starting, you authorize publication of the
     generated summary". No UI path sets `privateHandling` to true
     (`SiteCaptureStart.tsx:293,411,720`).
   - The Terms still describe a choice ("unless you previously chose private
     handling", `Terms.tsx:12,33`), and the site guide says "You can decline
     listing".
2. **The audio track is analysed without disclosure.**
   - The Gemini video lane exists to read "the audio track"
     (`server/agents/adapters/gemini-video.ts:15-18`).
   - "Audio" appears nowhere in `Privacy.tsx`, `Terms.tsx`,
     `SelfCaptureUpload.tsx` or `SiteCaptureStart.tsx`.
   - Phone footage of a workplace records employees' conversations. In
     all-party-consent states this is a legal exposure, not a copy nit.
   - The upload consent checkbox does not mention people in the work area.
3. **Withdrawal overstates deletion.**
   - The owner sees "Your stored footage has been deleted"
     (`OwnerRecordingWithdrawal.tsx:42`) once WebApp storage is deleted and
     the Pipeline *acknowledges* (`websiteCaptureWithdrawal.ts`).
   - The Pipeline handoff "never deletes bytes", and operator cleanup does not
     assert that provider copies are gone
     (`website_capture_withdrawal.py:1-5`).
   - The privacy page also promises a retention schedule (jobs close after 12
     months, footage is deleted 180 days after close, temporary files after 14
     days, requests after 90 days; `Privacy.tsx:65-110`). No time-based
     deletion job implements it.

Other items:

- **Guest uploads followed by sign-in strand the footage.** The Pipeline
  refuses an unsigned claim. The fix is the draft pair WebApp
  [#1035](https://github.com/ognjhunt/Blueprint-WebApp/pull/1035) and Pipeline
  [#2696](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2696). It
  was held for a replay and because a paid run was in flight.
- **Native iOS capture has no live website receipt yet.** The browser path is
  the real path.
- **Site-visit jobs are Austin-only in emails, and nothing enforces it.**
  - A visit job anywhere gets "Plan your Austin capture visit"
    (`site-task-brief.ts:775,789`).
  - It never sees an acknowledgement (`SiteCaptureStart.tsx:586` versus the
    dead branch at `:669`).
  - The job console shows it as waiting on the site to film
    (`jobConsoleStage.ts:123`).

### L3 — Build a simulation of *their* site: **partial, engineer-driven, never the captured room**

What works, with live website-origin evidence
(`docs/website-task-pipeline-completion.md`, steps 1–10):

- browser video → confirmed task digest;
- MapAnything depth and cameras on Vast;
- Gemini task, coverage and object analysis, then SAM 3.1 tracking;
- GPT Image removal of the task object, then a Marble reconstruction;
- an authored replacement USD for the task object.

The gaps:

- **The captured room has never been the simulation.** Step 11 (register the
  base to the original references) is *pending*. The Marble collider lacks
  support beneath the registered object (`website-task-pipeline-completion.md`
  step 11). The policy run therefore used an authored development surface, and
  `captured_scene_integration` is still `"pending"` in Pipeline
  `website_object_local_frame.py` and `website_development_test.py`. The drawer
  attempt was blocked by `website_registration_anchor_frame_missing`
  (`docs/drawer-scene-website-e2e-completion.md`). The home page's "a simulation
  built from your site" is today a simulation of *the task object from your
  site* on a Blueprint-authored surface.
- **Only two task families score.**
  - `rigid_pick_place`/`planar_push` and `articulated_open_close` are the only
    families in Pipeline `adp_task_scoring.py`.
  - Every other job a site can type into the form has no scorer.
  - Per Pipeline `scene_placement/robot_profile.py` (after `1f91cce`),
    humanoid, mobile and wheeled set-ups are
    `requirements_only_no_registered_adapter_or_asset`.
    **October 16 update:** that robot-profile finding is historical. PR #1049
    added declarations for fixed and free bases, position/velocity joints, and
    other robot forms. Admission still checks the actual setup and the job's
    scoreable task; accepting a form does not add a task scorer.
- **Every scene needs people.**
  - A Claude Code cloud session drives each stage through the operator door
    (`docs/runbooks/cloud-scene-runs.md`).
  - Articulated construction is quoted at $21–35, above the $20 native
    ceiling, so each scene needs an owner budget grant (Pipeline `e44ced5`,
    `c01d0de`).
  - Attempt allowances are amended by hand.
  - Host env edits (the development-surface allowlist) still need the
    founder's Mac (`cloud-scene-runs.md` § "What still needs the Mac").
- **Throughput is about one scene at a time.**
  - Blue object: 3 days to a published result.
  - Drawer: more than 5 days, incomplete, with $81.72 of an $84 cap held.
  - Dishwasher (the founder's own test site): more than 3 weeks, still in
    articulated construction as of 10-12, after more than 10 fix PRs.
  - Constraints: three Vast launch slots shared with other lanes
    (`vast_launch_slots.py`); one control-plane droplet with a 100 GB volume,
    whose rebuild drill has never been run (Pipeline
    `docs/CONTROL_PLANE_CAPACITY_PLAN.md`); and Marble as the only
    reconstruction provider (Atlas is unavailable).
- **Actual per-site provider cost is unknown.** Quotes, holds and settled
  spend are recorded separately, and no billing reconciliation joins them.
  - **Quoted caps:** preparation ≤$5; articulated construction quoted at
    $21–35.
  - **Posted spend:** a 10-cell, two-policy run posted $0.91–$1.25 (blue
    object).
  - **Held exposure:** the incomplete drawer retained $81.72 against an $84
    cap across 16 attempts.
  - Vast billing coverage was "incomplete" on 09-30, and AWS is outside the
    spend lock.

  Until settled spend is reconciled, size the beta budget from the caps and
  the held exposure, not from the quotes. The binding constraint observed in
  these records is engineering time per scene, not spend.

### L4 — Willing robot teams on a supported robot: **unproven, and narrower than the page implies**

- **No admitted partner on record.** Pipeline
  `docs/arm_decision_proof_v1/ADP_010_BLOCKER_ACTION_PACKET.md` records
  "admitted partner count: `0`". It names ten missing pieces of partner
  evidence, among them two runnable candidates, task owner, and integration
  inventory. The file has not changed since. The beta acceptance packet says
  "Neither a registry entry nor a fixture proves a team is willing for a live
  pilot" (`docs/beta/INVITED_BETA_ACCEPTANCE.md`).
- **The registry seed is prospects, correctly.**
  - `server/data/robotTeamSeed.ts` lists real companies as `status: "prospect"`
    with quoted, sourced figures.
  - `matchRobotTeam` returns `provisional` for all of them.
  - No relationship is implied. That is the right design, but it is not
    supply.
- **Only one robot can be evaluated.**
  **Superseded October 15 by PR #1049:** teams can declare their own robot of
  any form, subject to per-run compatibility checks. The following bullets
  record the audited October 14 baseline, not a current blanket exclusion.
  - The website runtime supports a Franka arm with a Robotiq 2F-85 on the
    DROID interface.
  - Unitree G1 exists as a development registry for one retained scene
    (Pipeline `docs/arm_decision_proof_v1/G1_TEAM_CAMPAIGN_REGISTRY.md`).
  - `/for-robot-teams` says "Tell us what your robot can do", and the home
    page example shows a humanoid moving totes. A mobile-manipulator,
    AMR or humanoid team that applies today cannot be evaluated, and nothing
    tells them so before they invest time.
- **The team-discovery work is unmerged.** WebApp PRs #831 and #834 (weekly
  robot-team discovery and directory refresh) have been open since 10-03.

Supply is a founder task more than a code task. For the beta to deliver even
one recommendation, a small number of named teams must agree to:

1. run a policy on the supported interface;
2. accept a free evaluation on a real job;
3. take the pilot if they pass.

Those agreements should be recorded before sites are told teams will
evaluate their job.

### L5 — A team's own policy runs long enough to be judged: **missing**

This is the link the whole promise rests on, and no path through it exists
today.

**The request step breaks first.**

- `/sites` shows an approved team "Request a free invited evaluation" using
  one readiness rule (`isRunnableTask`, `server/utils/taskBrowse.ts:18-20`).
- The opening page and `POST /api/workspace/evaluations` use another:
  `pilotOpportunityPassedGates`
  (`server/utils/pilot-opportunity-projection.ts:71-93`;
  `server/routes/workspace.ts:1210-1220`).
- That gate needs `request.pilotOpportunity.requested`, a five-field dossier,
  and `site_operator_claim_outcome === "site_claim_access_boundary_ready"`. The
  last one requires access, privacy and commercialization boundary text
  (`client/src/lib/structuredIntake.ts:372-387`).
- The public site form sends none of these. `SiteCaptureStart.tsx` has no
  `pilotOpportunity` reference, and `PilotOpportunityFields.tsx` is rendered
  nowhere.
- So every team lands on "Opening unavailable"
  (`client/src/pages/app/OpeningDetail.tsx:36-44`), and so does the link in
  the team notification email.
- Free admission requires `workspace_evaluation`
  (`freeEvaluationHandoff.ts:30-32`). Without it there is no run, no
  recommendation and no booking.
- Tests miss this because they build records with these fields set by hand,
  and the browser specs mock `/api/pilot-opportunities`
  (`e2e/workspace-design.spec.ts:191`).

**Run admission has one usable door, and it trusts the team.**

- Customer-hosted, container, controller and model runtimes all need the
  Pipeline offer to list `controlled_observation_v1`
  (`selfServeAgentExecution.ts:156-160`). The capture offer does not
  publish it (Pipeline `capture_orchestrator.py:466`).
- Only a plain, unauthenticated `policy_endpoint` passes. That path is
  labelled `http_policy_api_observation_probe`.
- On that path each attempt's `success` is read from the team's own HTTP
  response. If the field is absent, `status` defaults to `"completed"`, which
  counts as success (Pipeline `robot_eval_execution.py:2148-2161`).
- This audit could not confirm whether that value reaches the result the
  recommendation rule reads. Until it is shown to be simulator-scored, block
  that path for recommendation evidence.

**What the runtimes allow.**

- **The website scene runtime runs only Blueprint's two frozen public
  policies.** Pipeline `task_evaluation_policy_canary_model_rights.py:22` is
  `CANDIDATES = ("pi05_droid", "groot_n17_droid")`. Anything else fails
  closed. The only preset is `quick_10`; `standard_100` and `deep_500` are
  "coming later".
- **The path built for external team policies runs exactly one episode.**
  Pipeline `controlled_native_queue.py:121` raises
  `controlled_native_execution_budget_or_episode_scope_invalid` unless
  `episodes == 1`. It runs HTTPS policies on the one sealed Franka rigid task.
- **The recommendation rule needs at least 10 episodes at the job's pass
  mark.** That is `MINIMUM_EVIDENCE_EPISODES = 10` and a default pass mark of
  90% (`server/utils/pilotRecommendationEvidence.ts:57-59,234-237`). These are
  correct guards, but no runtime can currently satisfy them for a team.
- **The team-policy plumbing is real but has never run a task.**
  `docs/robot-team-policy-live-proof-20260928/README.md` proves these live:
  - private model upload;
  - sandboxed container inference (runsc, nine network-denial probes);
  - authenticated HTTPS policy transport;
  - KMS credential leases;
  - outbox forwarding.

  It also states "automated native task execution was not exercised", and
  "registration does not prove execution".
- **No policy has ever succeeded at a website task.** The only website-origin
  run to finish end to end (blue object, 09-19 to 09-22) ran all 10 cells and
  20 outcomes. Step 13 says "Neither policy succeeded at the task". Eight π0.5
  cells were joint-limit rejections. The drawer fixture run collided with the
  cabinet (π0.5) and failed reset parity (GR00T). Zero-shot generalist
  policies at a 90% pass mark will not produce a recommendation. Only a team
  policy tuned for the embodiment and task can.
- **Controls are paused by owner decision** (Pipeline
  `docs/website-controls-pause-2026-09-21.md`), so results are "diagnostic".
  The robot-free success-contract probe added 10-12 (`7d85948`, `b656175`) is
  the natural replacement admission check, but it is not yet mandatory.
- **The founder dispatch stop: live state unknown.** On 10-05 the Pipeline
  agent-run dispatcher was recorded with a founder stop,
  `require_explicit_release: true` (Pipeline `docs/OPERATOR_DOOR.md`;
  `docs/free-beta-readiness-2026-10-05.md` item 2). Neither repo records a
  release since. A static document cannot show whether the stop is still
  engaged, so read `door status` before treating it as a blocker or as
  released.
- **Spend lock coverage was incomplete.** `PAID_SPEND_ADMISSION_LOCK` needs
  current billing reconciliation. Vast coverage was "incomplete" on 09-30
  (`docs/launch-readiness/2026-09-30.md` LR-05), and AWS is uncovered.

Smallest path to close L5: let the existing `quick_10` policy-canary runtime
accept one *team* candidate in place of the frozen pair. Begin with a team's
fine-tuned π0.5-DROID or GR00T-N1.7 checkpoint, or an HTTPS policy on the same
DROID Franka interface, reusing the proven sandbox and lease. Then do one live
proof with a friendly team on a scene that passed the robot-free probe. No
task breakdown exists yet, so this work is unestimated; produce one before
committing to a date.

### L6 — Recommend one team, or say none passed: **the rule is sound; the waiting states are missing**

What works:

- The admin form picks a passing run.
- The server re-verifies it against the pass mark frozen at request time. That
  pass mark comes from the job terms, else the brief, else 90%.
- It requires at least 10 episodes (`admin-robot-teams.ts:200-330`;
  `pilotRecommendationEvidence.ts:56-59,126-240`).
- The site card and the team email are queued in the same transaction.

The gaps:

- **No end date while the site waits.**
  - Between "scene ready" and the first run, the site sees "We are preparing
    the job for simulation" with no end (`taskStatusProjection.ts:281-287`).
  - `nextUpdateIso` is forced to `null` (`site-task-brief.ts:944`).
  - No email covers "waiting for teams" or "no team passed", although `/beta`
    promises "If no team has passed yet, we tell you so".
- **Team interest is not recorded before a site sees the recommendation.** It
  is not checked before the site is emailed (`admin-robot-teams.ts:258-301`).
  A team can only commit after a recommendation exists (`site-worlds.ts:37-40`).
- **The card shows a point estimate without its uncertainty.**
  - It reads, for example, "9/10, meeting the 90% pass mark"
    (`RecommendedPilot.tsx:34-42`).
  - At n = 10 even 10/10 has a Wilson 95% lower bound of about 0.72, so the
    band shown elsewhere cannot be claimed (`successRateConfidence.ts`).
  - The copy should say how few trials stand behind the result.

### L7 — Book, and the pilot actually happens: **the click works; nothing follows it**

What works: `POST /owner/:token/book` writes `pilot_booking` with
`amountUsd: 0`, then emails the site and the team and alerts Slack
(`server/routes/task-listings.ts:125-209`).

The gaps:

- **The public copy and the product disagree about who arranges the pilot.**
  - Public pages say the site and team "agree the dates and terms directly"
    (`Home.tsx`, `Beta.tsx`, `Contact.tsx:77`, `Terms.tsx:36`).
  - The product says "Blueprint owns that next step"
    (`taskLifecycleNotifications.ts:109`; `RecommendedPilot.tsx:94`;
    `pilotCoordination.ts:17-22`).
  - The route says it "records proposal acceptance, not a physical booking".
- **Neither side is introduced.** Teams never receive site contact details
  (`robotTeamPilotNotifications.ts:12-13,71`).
- **The ops alert is unreliable.** It is not retried, it is skipped when the
  webhook is unset, and it links to a page that ignores its parameter
  (`pilotOpsAlerts.ts`).
- **Booking is accepted after the site withdraws recording permission.** There
  is no consent check in the route.
- **Neither workspace ever shows the booking.**
  - `/app/tasks` never reads `pilot_recommendation` or `pilot_booking`
    (`workspace-projection.ts:130-172`), so a booked job still says "Book it
    on your task page".
  - The team workspace never shows "recommended" or "booked"
    (`workspace.ts:717-724`).

### X — Operate: **deploy is ready; security, abuse bounds, legal and staffing are not**

| Area | Status | Evidence / gap |
|---|---|---|
| Web deploy and rollback | ready | Production `/version.json` = `6e49314` = `main`. The deploy workflow requires `/health/ready` 200 and restores the predecessor on failure (`.github/workflows/deploy.yml`). |
| Pipeline release | unknown | The last recorded door deploy was blocked by `deploy_scene_retirement_runtime_unproven` (Pipeline `docs/audit-remediation-2026-10-05.md`). Later merges suggest recovery; confirm with `door status`. |
| Security | **not ready** | P0-1 (a data exposure reachable by any signed-in account) and P0-2 (open credential rotation). The P0-1 specifics and the abuse-path details went to the founder privately, because both repositories are public. |
| Abuse and spend bounds on anonymous intake | **not ready** | Gemini site-assessment calls have no dollar cap (`site-assessment-budget.ts`: `cap = null`, `spending_gated: false`). The cohort caps (`BLUEPRINT_BETA_INVITE_CAP`, `BLUEPRINT_BETA_COHORT_DAILY_LIMIT`) are enforced only in `robot-eval-job-requests.ts`, not at intake or upload, although `blockers/2026-07-20-production-beta-capacity.md` says "the caps still bound intake". Further abuse-path specifics went to the founder privately. |
| Monitoring | partial | Intake-notice sweep, terminal-outbox, crash and 5xx alerts exist (`docs/runbooks/beta-monitoring.md`). The uptime cron is `*/10`, but GitHub ran it about every 5 hours on 10-14. There is no worker heartbeat, and no alert on a growing pending outbox. `docs/monitoring.md` is stale. |
| Legal | partial | Terms and Privacy match the free beta, but `docs/legal/*` are scaffolds "awaiting counsel". **Notice:** Terms `2026-10-14.1` took effect the day notice was sent, although §12 promises notice before material changes take effect. **Missing terms:** robot-team policy and checkpoint confidentiality and licence-to-run; liability for *recommending* a pilot Blueprint is not party to. **Inaccurate disclosures:** the Privacy subprocessor list names Sentry, PostHog, GA and Redis, which the bundle does not use, and omits Twilio. The audio and retention gaps are in L2. |
| Support and staffing | partial | hello@ and support@ are published, but there is no response expectation beyond privacy requests. The founder is the sole approver, incident commander, budget granter and Mac holder (`beta-ops-incident-runbook-2026-07-08.md`; `cloud-scene-runs.md`). Paperclip was retired as an approver. |
| Legacy paid paths | partial | Paid plan, run and top-up APIs refuse correctly (`agent-team.ts`, `freeBeta.ts`). `POST /api/create-checkout-session` still creates live Stripe sessions in its default `onboarding` mode for any signed-in user (no UI calls it). The configured-scene path returns 402 with "Funding required". The G1 page asks for a "Maximum provider cost (USD, up to $12)". `/api/site-worlds/tasks` returns `costUsd: 99`. `launch-env-audit.mjs` still *requires* Stripe and Firehose env. |
| Repo hygiene | partial | At least 30 open PRs in each repo (the listing was capped at 30), many weeks stale; 5 of the Pipeline's are dependabot bumps. Among them: #858 "Enforce free beta admission…", which the 10-13 work may have superseded, and the #1035/#2696 guest-claim pair. |

## 3. Ranked launch blockers

**P0** means the beta cannot work, or would be unsafe or dishonest. **P1**
means significant risk or friction. **P2** means polish. Each item names its
smallest fix.

### P0: fix before promoting sign-up or inviting another site

| # | Blocker | Smallest fix | Rough scale (author's judgement, not an estimate) |
|---|---|---|---|
| P0-1 | **Security: an authenticated endpoint exposes other customers' data.** Sign-up is open, so anyone can reach it. Details were reported to the founder. | Apply the missing authorization check, plus a regression test that enumerates every privileged route. | hours |
| P0-2 | **Security: the credential-rotation blocker is still open while both repos are public** (`docs/launch-readiness/blockers/2026-07-20-provider-credential-rotation.md`). | Rotate and record evidence; then decide on repo visibility (D6). | hours (founder) |
| P0-3 | **Privacy/legal: workplace audio is analysed without disclosure,** and the consent text does not cover people in the work area (L2). | Strip audio at upload, or send Gemini a muted stream. Update Privacy and the upload consent; get counsel review. | 1–2 days + counsel |
| P0-4 | **Consent: sites cannot decline, or even see, the public listing** (regression `0acbf5d`). | Restore the "Keep this job private" control and the summary preview. Keep Terms and the site guide consistent. | hours |
| P0-5 | **Robot teams cannot request an evaluation on any job started from the public form** (L5). | Gate the opening page and `POST /api/workspace/evaluations` on the same readiness rule as `/sites`. Add a test that starts from real `/api/inbound-request` output. | 1–2 days |
| P0-6 | **No runtime can evaluate a team's own policy for ≥10 episodes.** The one admissible door trusts team-reported success (L5). | Let the `quick_10` policy-canary runtime accept one team candidate on the DROID Franka interface. Block the HTTP probe path from recommendation evidence. Make the robot-free success probe mandatory. Do one live proof with a friendly team. | multi-week, unestimated; needs a task breakdown, plus one live run |
| P0-7 | **No willing team on a supported robot is on record** (L4). | Founder signs up 2–3 teams that can run a DROID/Franka-interface policy and would take a pilot. Record it in the registry as `engaged`. | founder |
| P0-8 | **Customer messages contradict the free beta or invent supply** (L1 table). Affected: the site screening email ("no match", budget band, prospect counts, Austin); team run emails (balance, hold); the public agent API and OpenAPI ("buy runs", invited-only sites, quotes). | Rewrite these surfaces. Extend `claims:guard` and the brand-polish banned patterns to `server/utils/*Notification*`, `qualificationEmails.ts`, `server/retrieval/`, `server/agents/`, `client/public/*.json\|txt` and `client/src/components/`. | 1–2 days |

### P1: fix before the first cohort of sites

> **P1-2 embodiment recommendation superseded:** retain the original finding
> and proposed fix below as audit history. The owner-directed resolution is to
> preserve approved examples, accept own-robot declarations of any form, and
> explain concrete task/model/interface incompatibilities. It is not to swap
> all public examples to fixed arms.

| # | Blocker | Smallest fix |
|---|---|---|
| P1-1 | "A simulation built from your site" is today a simulation of the *task object* on an authored surface (L3). | Qualify registration (anchor frame, Marble support), or change the copy to "a simulation of your task, built from your footage". |
| P1-2 | Scope is unstated. Only Franka rigid pick/place and open/close can be scored. The home examples show tasks outside that scope, and `/for-robot-teams` invites any robot (L1, L4). | State the current envelope on `/beta`, `/how-it-works` and `/for-robot-teams`. Swap the out-of-scope examples. Screen at intake and tell out-of-scope sites at once. |
| P1-3 | Sites wait indefinitely (L6). | Add "awaiting robot-team evaluations" and "no team passed" states, with emails. Set a real `nextUpdateIso`. Publish an expected first-response time on `/beta`. |
| P1-4 | Nothing follows a booking, and copy and product disagree on who arranges the pilot (L7). | Decide (D3). Then send a consented introduction email to both parties, or change the copy. Refuse booking after withdrawal. Show the booking in both workspaces. Retry the ops alert and fix its link. |
| P1-5 | Anonymous intake can spend money and send email without bound (X). | Add daily caps (Firestore counters, as in `inboundQualificationGate.ts`) on intakes, upload admissions and model reviews; one intake kill switch; Firebase App Check; provider-side budget caps. Close the storage and email items in the private appendix. |
| P1-6 | Withdrawal and retention claims exceed what the code does (L2). | Say "footage stored by our website" until Pipeline deletion is verified. Build the retention sweeper, or reword `Privacy.tsx` to match. |
| P1-7 | Every scene needs an engineer and the founder (L3). | Raise the native construction ceiling to about $40 in the sponsorship config. Move the development-surface allowlist and registry profile from host env to signed records. Add `BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON` to the env examples and a readiness check, and alert on `authority_ended`. |
| P1-8 | Guest upload, then sign-in, strands footage. | Finish the replay and merge WebApp #1035 and Pipeline #2696 together. |
| P1-9 | Legal review is outstanding (X). | Counsel reviews: recording/audio consent; robot-team policy confidentiality and licence; recommendation liability; the entity and address; the Terms notice timing; the subprocessor list. |
| P1-10 | Monitoring gaps (X). | Add an external uptime probe that actually runs every 10 minutes, Render health notifications, a worker heartbeat, and a pending-outbox-age alert. Verify `SLACK_WEBHOOK_URL`. |
| P1-11 | The robot-team setup surface does not tell a team what to build (L5). | Publish a per-job interface contract on the opening page: robot and gripper preset, observation/action schema, rate, timeout, episodes. Hide runtimes that can never be admitted. Support an authenticated `policy_endpoint`. Show and prefill the offer's episode count in `/admin/jobs`. Tie the 6-hour admission expiry to dispatch release. |
| P1-12 | A single person holds every approval (X). | Name a backup approver and incident commander, and publish a support response expectation. |

### P2: polish and hardening

- Retire the legacy paid paths:
  - the `onboarding` checkout (return 410 while `FREE_BETA_ONLY`);
  - the 402 "Funding required" response;
  - the G1 "$12" field;
  - `costUsd: 99` on cards;
  - `/me` balance;
  - the commerce entries in the OpenAPI spec;
  - the Stripe and Firehose requirements in `launch-env-audit.mjs`.
- Show the recommendation's uncertainty and the pass mark the team was judged
  against.
- Give team results media, failure labels and cycle time. Route the evidence
  panel to `evaluationRuns`; today it 404s for free runs.
- Fix the "Already approved? Create your account" loop. Remove the redundant
  second email verification. Let one approval cover a whole team.
- Cookie banner covers mobile form controls (`CookieConsent.tsx:124`).
- Unify the four robot-team CTA labels.
- Explain the gated `/sites` "Job library" to anonymous visitors.
- Rename `/beta/buyer-guide` and use one support address.
- The home example card contains a fake "Book this pilot" button
  (`PilotPreview.tsx:438`).
- Remove wording that hints at future pricing: "None during the beta", "free
  within the approved scope".
- Remove the API's legacy `invite` pilot action, which skips the evidence
  check (`workspace.ts:1382-1480`).
- Update stale docs: the site guide's withdraw-by-email text,
  `docs/monitoring.md`, and the `/Users/...` links in `DEPLOYMENT.md`.
- Retire or rewrite the lifecycle cadence templates.
- Remove the "Whole Foods" CLI example from the public manifest.
- Close or rebase the stale PR backlog in both repos.

## 4. Decisions only the founder can make

> **D4 resolved by later owner direction:** PR #1049 on October 15 permits a
> team's own declared robot of any form. October 16 direction preserves the
> exact original four non-Café/non-Lab animations. The D4 row below records the
> earlier open question; compatibility and execution evidence remain specific
> to the model, interface, scene, and task.

| # | Decision | Why it blocks |
|---|---|---|
| D1 | **Reconcile Pipeline doctrine with the beta.** Pipeline `AGENTS.md` makes Arm Decision Proof v1 the sole program, freezes multi-site, throughput and marketplace work, and keeps the fixed-arm rigid-object envelope as the build target. | P0-6, P1-7 and any second concurrent site are exactly that frozen work. Without an amendment (cross-repo, through `BlueprintCapturePipeline/doctrine/` and the lock in all three repos), Pipeline lanes are correct to decline them. |
| D2 | **What the beta promises now:** keep it founder-invited until the engine is proven, or reword the open public promise (§6). | Sign-up is open today for an outcome no site can yet reach. |
| D3 | **Who arranges the pilot after booking:** Blueprint introduces and coordinates, or the site and team agree directly. | Public copy says one thing and the product the other (P1-4). |
| D4 | **Robot forms in scope for the beta:** Franka-only, stated publicly, or an owner focus decision to fund another form. | Determines the copy, the intake screen and which teams to sign (P1-2, P0-7). |
| D5 | **Open robot-team self-registration through the agent API.** `/api/agent-team/register` accepts anyone. | Contradicts "robot teams join by invitation". |
| D6 | **Repository visibility.** Both repos are public and publish runbooks, service IDs and security posture. | Every future audit and incident note becomes public (P0-2). |
| D7 | **Beta release policy for the Pipeline dispatcher's founder stop** (recorded engaged on 10-05; confirm with `door status`). For example: release dispatch, but keep per-run founder admission, which `/admin/jobs` already enforces. | The free-admission run expires after 6 hours unless dispatch is released in that window. |
| D8 | **The claim a 10-episode pass supports.** 9/10 "meets 90%", but its lower confidence bound is far below 90%. | The site books a physical pilot on this number (L6). |

## 5. What a concierge beta can do today, by hand

Use founder-picked sites, one or two at a time, each with a Franka-feasible
rigid pick/place or open/close job on a clear surface:

1. An engineer drives the scene with `docs/runbooks/cloud-scene-runs.md`. The
   founder grants about $35–40 per scene and raises attempts to 32. The
   development-surface allowlist is edited on the host. The robot-free probe
   validates the success contract.
2. Deliverable today: a prepared scene plus **Blueprint-baseline diagnostic**
   results from the two frozen public policies. For scale, the records
   show: the blue object took 3 days to a published result, the drawer was
   still incomplete after more than 5 days, and the dishwasher after more than
   3 weeks. Provider spend per site is unknown; see L3.
3. **A team evaluation and a recommendation are not reachable** until P0-5 and
   P0-6 land. Even with P0-5 patched by hand in Firestore, the steps per team
   are:
   1. fill the dossier and gate fields;
   2. have the team expose an unauthenticated HTTPS endpoint;
   3. allowlist its origin and enable policy execution on the host;
   4. read the capture offer's episode count;
   5. admit with that exact count and a cap of $20 or less;
   6. if `door status` shows the founder stop still engaged, release it within
      6 hours;
   7. read the result;
   8. record the recommendation;
   9. confirm the team's interest by email.

   No newly submitted external policy has completed this path.

## 6. Recommended launch shape

**Option A — staged concierge beta (recommended).**

1. **This week:** close P0-1 to P0-4 and P0-8. These are small and
   independent of the engine. Pick D2 and D3. Under Option A, change `/beta`
   and the home page to say evaluations begin as the first teams are onboarded,
   and give an expected first reply time.
2. **Next, once P0-6 has a task breakdown and date:** close P0-5 and P0-6 and sign 2–3 teams (P0-7). Make the
   robot-free probe mandatory. Run one friendly team end to end on one
   Franka-feasible site, from the public form to a booked pilot, and retain the
   receipts under `docs/launch-readiness/`.
3. **Then:** invite 3–5 founder-picked sites with P1-1 to P1-6 closed and
   honest waiting states. Open promoted sign-up only after P1-5 caps are live
   and one recommendation has been made from real evidence.

**Option B — hold the public promise.** Keep the pages up but make sign-up a
waitlist until stage 2 above is done. This is safer for trust, but slower to
learn from real sites.

Either way, the decisive milestone is the same: **one team's own policy, scored
by the simulator for at least 10 episodes on a scene built from a site's
public-form footage, passing that job's frozen pass mark.** Until that receipt
exists, nothing else on this list makes the core promise true.

## 7. Checks run for this audit

| Check | Result |
|---|---|
| `npm run check` | pass |
| `npm run doctrine:verify` | pass (all three shared blocks match the lock) |
| `npx vitest run client/tests` | 143 files, 1,146 tests passed |
| `npm run claims:guard` | 770 files scanned, 0 findings (its scope is `client/src/pages`; see L1) |
| `e2e/brand-polish.spec.ts` | 54/54 route-viewport checks, 18/18 internal links |
| GitHub Actions on `main` | WebApp CI, deploy and uptime green on `6e49314`; Pipeline CI, full test lane and provenance green on `25946c9` |

Method:

- Five parallel read-only traces: the site journey, the robot-team journey,
  the public surface, the Pipeline capture-to-evaluation path, and operations.
- Every claim graded P0 in this document was re-read in source before
  inclusion.
- Live state that only the operator door or Render can show is marked unknown
  rather than inferred: the dispatcher hold, the Pipeline release,
  `BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON`, the Slack, calendar and send
  flags, and whether the deployed Firebase rules match the repo.
- No deploy, provider call, send, payment, production write or `/health/ready`
  call was made.
