# Onboarding time-to-value audit: site and robot-team funnels (2026-09-19)

Review status: the initial P0 implementation below was amended before merge. See
[the P0 review and P1 integration record](design/onboarding-p0-review-2026-09-19.md) for the reviewed payment, evidence, concurrency and executor requirements.


First-principles audit of both public onboarding funnels, on laptop and on phone,
measured against one question: how fast does each side reach something they
would forward to a colleague, and how much of the proof-of-tech (PoT) stage
happens without a person at Blueprint.

Evidence: local dev server walked with Playwright at 1440x900 (desktop) and
390x844 with an iPhone user agent (phone). Every write endpoint was mocked, so
nothing reached Firestore, SendGrid, Slack, or Stripe. Code references are to
this repo unless stated. Screenshots: `docs/design/onboarding-audit-2026-09-19/`
(curated) and `output/onboarding-audit/` (all 25, gitignored).

Not verified here: how many sites are runnable in production today, whether the
BlueprintCapture extract-frames function is deployed with the WebApp base URL
set, real email delivery, and agent settlement in production.

## Verdict

Both funnels now have the right front door and no back half.

- A site goes from landing to a live capture link in about 90 seconds with four
  fields and one checkbox. A robot team goes from landing to a ranked, priced
  plan in about 60 seconds with five fields. That part is good and should be
  protected.
- After that, neither side reaches value. The site's first "artifact" is its
  own sentence echoed back as a "brief" with the same five dropdowns re-asked.
  The status ladder deliberately stops at "assessing". The operator never sees
  the scene, the candidates, the results, or the pilot recommendation the home
  page promises in steps 02 and 03.
- The robot team's most likely first screen is "We do not have a match yet".
  When there is a match, the rows are labelled "Site". Buying a run writes a
  record nothing executes; the money hold expires after six hours and the run
  is marked abandoned.
- The automated PoT the site is promised does not exist yet as a product
  output. The pieces exist across three repos (privacy screen, coverage read,
  reconstruction, pipeline sync, ranking, funding), but no artifact comes out
  the other end that either side can approve.

The fix is not more or fewer form fields. It is to make the PoT exit statement
the product, put it on one dated status timeline both sides can see, and wire
the run loop so that statement is produced without a person.

## 1. Where time-to-value lands today

### Site operator, public self-capture path (US)

| # | Step | Device | They give | They get back | Automated? | Evidence |
|---|------|--------|-----------|---------------|------------|----------|
| 1 | Land, click "Start a task assessment" | either | one click | form | n/a | `client/src/pages/Home.tsx:20` |
| 2 | Form: job text, country (defaults US), where (autocomplete), work email, rights checkbox. Optional: existing-footage flag, filmer email, name, company | either | 4 fields + 1 checkbox, ~90 s | capture link; QR on desktop; "Open the camera" on phone; status line | yes, instant | `client/src/components/site/SiteCaptureStart.tsx:290-462`, `m-site.png`, `site-desktop-success.png` |
| 3 | "Task brief we draft from your job description" | either | nothing | their own sentence as the summary, plus five gates marked "we could not tell from what you sent" | deterministic assembly, no model reads anything | `server/utils/siteTaskBrief.ts:126-135`, `server/routes/inbound-request.ts:1835-1870`, `capture-desktop-brief.png` |
| 4 | Film and upload | phone | 30 to 90 s video, optional item photos | "Your capture is saved" | privacy screen (Gemini, fails closed to a Slack alert) then coverage read (Gemini); a shortfall email if views are missing | `server/routes/self-capture-uploads.ts:371-455`, `server/utils/captureCoverageReview.ts:170-200` |
| 5 | Confirm the brief (the attestation) | either | 5 dropdowns + name | email "we have your task brief" | yes | `server/routes/site-task-brief.ts:370-450` |
| 6 | Scene build | none | nothing | nothing visible; status stays "assessing" | extract-frames cloud function (BlueprintCapture) posts to `world/reconstruct`, WebApp calls World Labs, hands off to the Pipeline. Hands-off if deployed and configured | `BlueprintCapture/cloud/extract-frames/README.md`, `server/routes/internal-capture-worlds.ts:1-13` |
| 7 | Pipeline sync marks the site qualified | none | nothing | email "your site's scene is ready. Claim it." | yes | `server/routes/internal-pipeline.ts:1571-1615` |
| 8 | Claim, create account | either | email + password or Google, terms | workspace task page reading "No team results yet" | yes | `client/src/pages/ClaimSite.tsx`, `client/src/pages/workspace/TaskDetail.tsx:271-273` |
| 9 | Robot-team screening results | none | nothing | not surfaced. The results table reads the legacy job-request collection, not agent runs | not wired | `server/routes/workspace.ts:369,543` |
| 10 | Shortlist, pilot recommendation, failure points, physical test plan | none | nothing | not built | not built | `server/utils/taskStatusProjection.ts:16-24` says so explicitly |

Time to first forwardable artifact: never on the link page. A claim email
after an unstated delay is the first thing with durable value, and it shows a
site name, a task sentence, and a qualification state.

### Robot team, public path

| # | Step | Device | They give | They get back | Automated? | Evidence |
|---|------|--------|-----------|---------------|------------|----------|
| 1 | Land, click "Robot teams" | either | one click | form under ~1,800 px of prose on a phone | n/a | `m-robot.png` |
| 2 | Plan form: email, team, embodiment (6 options), task family (6), runtime (3), checkpoint reference, optional label | either | 5 fields, ~60 s | ranked plan with $25 rows and a rationale each, or "You are in. We do not have a match yet." | yes; arithmetic over match findings | `client/src/components/site/RobotTeamPlanPreview.tsx`, `server/utils/evalSelection.ts`, `robot-desktop-plan.png`, `robot-desktop-nomatch.png` |
| 3 | Bearer key | either | nothing | key behind a disclosure, shown once | yes | `RobotTeamPlanPreview.tsx:273-290` |
| 4 | Start the runs (human path) | none | nothing | "We will be in touch to start them" | a person | `RobotTeamPlanPreview.tsx:238-240` |
| 4b | Start the runs (agent path): fund via Stripe, `POST /runs confirm:true` | agent | money | a run record and a hold | nothing executes it; no consumer of `evaluationRuns` in this repo or in BlueprintCapturePipeline; hold expires after 6 h, run marked abandoned | `server/routes/agent-team.ts:634-856`, `server/utils/agentEvalRuns.ts:1-60` |
| 5 | Results | agent | nothing | `awaiting_result`, then `never_reported` | not wired | `server/routes/agent-team.ts:908-936` |
| 6 | Pilot introduction | none | nothing | not built on this path. The workspace "Openings" feed is a separate, gated path | not built | `server/routes/pilot-opportunities.ts` |

## 2. Findings, ranked

### P0: the loop does not close

**F1. Purchased runs go nowhere.** `POST /api/agent-team/runs` reserves money
and writes an `evaluationRuns` document. Nothing in this repo dispatches it,
and the Pipeline repo has no reference to `evaluationRuns`, the settlement
endpoint, or the run id format. The Pipeline posts only to
`capture-task-evaluation-runs` and `openai-inference-usage`. The agent-surface
doc lists "the Pipeline does not call settlement yet" as open; the real gap is
one step earlier. Effect: the fastest path on the site is a UI in front of
nothing, and the honest path is "we will be in touch", which is a queue.

**F2. The site never sees an outcome.** The status projection stops at
`assessing` by design, because the Pipeline "does not yet" report run outcomes
(`server/utils/taskStatusProjection.ts:16-24`). The only later touch is the
claim email. After claiming, the workspace results table reads
`robotEvalJobRequests`, which the agent path never writes. Steps 02 and 03 on
the home page (compare candidates, choose the pilot) have no surface.

**F3. The "brief we draft" is an echo.** `draftBrief` is "deliberately not a
model call". At submit it copies the task statement into `summary` and turns
any gate answers into proposals; in the capture-first flow there are none, so
every gate is "we could not tell from what you sent" and the operator fills
the same five dropdowns the old screen asked (`capture-desktop-brief.png`).
The `site_video_evidence` reader exists and scores footage against gates, but
its observations never flow into the brief as proposals. The questions moved
behind a disclosure; they did not disappear.

### P1: the first screen after submit misleads or under-delivers

**F4. "Open the camera" on a laptop.** The desktop success state's primary
button opens the capture page on the laptop, which then says "This step
happens on your phone" (`site-desktop-success.png`, `capture-desktop.png`).
The label promises a camera the device does not have. The QR is secondary and
unlabelled as the main action.

**F5. Plan rows read "Site $25".** `siteLabel` falls back to
`targetSiteType || "Site"` (`server/utils/teamEvalCandidates.ts:220`), and
the site forms never set `targetSiteType` (`Contact.tsx` sends null,
`SiteCaptureStart.tsx` omits it). A real plan is a list of identical
"Site $25" rows distinguished only by rationale. For a fresh team every
rationale says an unknown constraint, so the ranking carries no information a
buyer can act on: no task, no objects, no site type, no region, no cycle
target, no thumbnail. The mocked screenshot is kinder than production.

**F6. The empty library is a dead end.** `loadRunnableSites` requires a
qualified disposition, a confirmed brief, a built scene, and an internal
runnability proof (`teamEvalCandidates.ts:99-160`). That gate is right. The
resulting screen offers nothing: no view of what is in capture, no way to say
what the team wants, no history, no link to the public catalog. The team's
next event is an email that may never come.

**F7. The desktop capture page is disorganised.** "Where this stands" renders
twice (inside the handoff box and again as a card). "Upload the file below" sits
700 px above the upload button. There is no brand, no back link, no
what-happens-next. It is the page an operator lives on for the whole
assessment.

**F8. No time expectation anywhere.** `nextUpdateIso` is null unless an owner
sets it, so every rung reads "we will email you when there is something to
say". For a service positioned as replacing two to six weeks of scoping, the
site never learns whether that is two days or two months.

### P2: friction and fragmentation

**F9. Prose walls on phone.** On a 390 px phone the first input on the site
page is about 1,400 px down; on the robot page about 1,800 px, including raw
`POST /api/...` endpoints in monospace (`m-site.png`, `m-robot.png`). Each
page has three explanatory paragraphs before the thing the visitor came to do.

**F10. Three funnels, three design systems.** Seven paths use the minimal
cream layout; everything else, including `/sites`, `/claim` error states and
the legacy header, renders in the dark "runway" system with its own sign-up
dropdown and "Prepare a deployment" CTA (`sites-desktop.png`,
`client/src/components/site/SiteLayout.tsx`). `/sites` is the only public
view of the library and is off the nav.

**F11. Two interviews per robot team, and the hard constraint is asked in
neither.** The plan form stores embodiment as a free string glued into
`capabilityDescription` (`RobotTeamPlanPreview.tsx:134`). The six-question
application posts to a different collection, cross-linked only by email.
Geography is a hard constraint in matching (`client/src/lib/robotMatch.ts`,
`compareGeography`) and neither the plan form nor registration asks it, so
every match is provisional.

**F12. Sign-up bypasses capture.** `/signup/business` sends a site to
`/app/tasks/new`, a nine-field form with budgets and success rates that writes
a separate task record and never issues a capture link
(`client/src/pages/workspace/TaskRequest.tsx`). Robot teams land on an
"Openings" feed fed by a third projection. Someone who signs up first gets a
worse product than someone who does not.

**F13. Country before place.** The country select precedes the location
autocomplete; the autocomplete result could set the country and only ask when
it is not the US.

**F14. Three emails, ever.** Only `coverage_shortfall`, `brief_confirmed` or
`input_needed` on confirm, and `assessment_ready` are enqueued. No "we have
your video", no "scene is building", no "screening started". Lifecycle
cadences are drafted into a human-gated ledger, so they are not a substitute.

## 3. The PoT map: what is automated, what is not

The four PoT steps from the brief this audit was asked against, against what
the code does today.

| PoT step | Today | Gap |
|----------|-------|-----|
| Observe the job and agree what passing means | One line of job text. No pass criteria, allowed human help, or variations anywhere in the public flow. The success-rate question lives in the collapsed spec tier and the account form. The brief has no pass mark. | Draft pass criteria from video + text; site approves in one tap. This is the test specification the first joint call should start from. |
| Rule out physical mismatches | `robotMatch` compares payload, proximity, cycle, lighting, object handling, geography. Site-side values come from the spec tier the capture-first flow never asks; robot-side values are unknown at registration. Every match is provisional. | Extract object size and weight from item photos and the brief; parse the robot's datasheet or manifest instead of asking; then a real ruled-out list. |
| Recreate the task with the site's parts and geometry | World Labs scene from the walkthrough, items panel with photos for sim-ready objects, pipeline handoff. Hands-off across three repos when deployed. Never shown to the operator. | Show the scene on the link page the moment it exists. It is the first real "wow" and the proof the site's time was worth it. |
| Test the policy, fixed version, fresh trials under variation | Ranking and a 50-episode screening quote exist. Execution is not wired from the agent path. A legacy control plane exists behind the ops Captures page. | Dispatch and settle runs; produce k/N with conditions and failure clips. |
| PoT exit statement | Not produced. The public evaluation example says its controls were not verified. | One page: what works, under which conditions, measured how, what remains. Both sides approve asynchronously. That page is the product. |

What talking remains after this is exactly the PoC agenda: safety, IT,
facilities, operators, commercial owner. The site's timeline, access window,
and budget questions belong there, not in front of a camera. The robot-team
doc already argues this for its own gates.

## 4. The redesign: fewest steps to value

Principles applied:

- One artifact is the product. Every screen either moves toward the PoT exit
  statement or shows progress toward it.
- Camera before questions. Questions only after footage, only the ones footage
  cannot answer, and only at the moment they change the next action.
- The device decides the screen. A laptop describes, hands off, and watches. A
  phone films and confirms. Nobody runs evaluations from a phone; a phone gets
  the verdict.
- Never a dead end. An empty state becomes a signal about supply or demand.
- One record, one status timeline, one design system.

### Site operator

Laptop:

1. One screen: "What is the job?" plus work email plus rights. Location by
   autocomplete; country inferred and confirmed only when not US. Name and
   company deferred to the brief confirmation, where a name is needed anyway.
2. Success state: the QR is the primary action, labelled "Point your phone at
   this". Secondary: "Email me the link". No camera button on a laptop.
3. The link page becomes a dated timeline: Received, Filmed, Scene built (show
   it), Task spec approved, Screening N teams, Results, Pilot plan. Each rung
   carries a committed next-update time set by the pipeline stage, not by an
   owner.

Phone:

1. Same three fields, no prose above them. The explanatory paragraphs move
   behind "Why we need this".
2. After submit: the camera, with the shot list. Nothing else above the fold.
3. After upload: "We watched it. Here is what we saw." Footage-observable gates
   arrive pre-filled from `site_video_evidence` with their basis shown; the
   operator corrects two things and taps confirm. Timeline and access window
   are asked later, at the PoC gate, when they decide something.

Account moment: when results exist. "Claim your site to see which teams cleared
the screen and to receive pilot offers." Not before, and not at sign-up.

### Robot team

Laptop:

1. Checkpoint-first, as now, minus the API prose (move it to a "For agents"
   link). Drop the label field.
2. The plan shows real rows: anonymised task sentence, objects, site type,
   region, cycle target, pilot budget and timeline where the site gave them, a
   scene thumbnail, and the price. "Run all" with Stripe inline. A dry run is
   still free.
3. The team's facts come by import, not interview: a datasheet URL or a
   checkpoint manifest fills embodiment, gripper, payload, reach, proximity
   rating; the team confirms three things. Geography and hardware maturity are
   two taps, because matching treats them as hard.
4. Empty library: "What is in capture now" (anonymised pipeline by stage), "Tell
   us what you want" (site type x region x task family, two taps), and an
   alert toggle. Past tasks stay visible as a track record of what the market
   asked for.
5. Results page per run: k/N with intervals, conditions, failure clips, the
   PoT statement, and a "propose a PoC" action that drafts the agenda.

Phone:

Notification-first. The plan, the verdict, and "approve this run" as single
screens with one action each. No forms.

### Both

Delete list:

- The six-question site screening form on the public page; keep "Talk to a
  person" as a mail or calendar link.
- The robot application form on the public page; ask those questions at the
  PoC gate.
- `/app/tasks/new` as a second site intake; sign-up attaches to an existing
  submission or sends the visitor to the capture form.
- The dark `/sites` page as a separate design; fold an anonymised library view
  into the minimal system and link it from the robot page and the empty state.
- The duplicate status card and the orphaned "upload below" hint on the
  capture page.
- "Open the camera" on desktop.

## 5. Prioritised work list

P0, close the loop:

1. Execute purchased runs. A dispatcher lane hands `evaluationRuns` in state
   `requested` to the Pipeline's task-evaluation control plane and the
   Pipeline calls `internal-agent-run-settlement`. Until it ships, remove
   "start runs" from the public panel and state the real lead time.
2. Project agent-run outcomes to the site: extend `projectTaskStatus` with
   `screening`, `results`, `pilot_plan` rungs fed from `evaluationRuns`, and
   feed the workspace results table from the same source.
3. Make the brief real: pass `site_video_evidence` observations and a model
   read of the description into `draftBrief` as `observation` and
   `description` proposals. The operator corrects, never fills.

P1, the first screen after submit:

4. Desktop success: QR primary, "email me the link" secondary, no camera
   button. Capture page: one status card, upload control beside its hint,
   minimal-site shell with brand and timeline.
5. Plan rows: carry task sentence, objects, site type, region, cycle target,
   thumbnail. Populate `targetSiteType` (or a new `siteType`) from the brief.
6. Empty-library state: supply-by-stage view, two-tap preference capture,
   alerts. Store the preference on the team record and use it in ranking.
7. Committed next-update times per pipeline stage; three more transactional
   emails (video received, scene ready with a view link, screening started).

P2, friction and fragmentation:

8. Phone: form above the prose on both pages; API paragraph off the human
   page.
9. One design system for `/sites` and `/claim`; retire the runway header.
10. Country inferred from the location autocomplete.
11. Sign-up routes attach to the public submission instead of opening a second
    intake.
12. Robot facts by datasheet or manifest import; geography and maturity as two
    taps on the plan form.

## 6. P0 status, same day

Implemented on 2026-09-19 (design in
`docs/superpowers/specs/2026-09-19-p0-onboarding-loop-design.md`):

- F1: the Pipeline can now list queued runs and mark them started
  (`GET /api/internal/pipeline/agent-runs`, `POST .../agent-runs/:runId/started`),
  a started run's hold clock restarts, teams see queued versus running on
  `GET /api/agent-team/results`, and the public plan panel funds and confirms
  the runs instead of promising a call. The Pipeline-side puller is still to be
  written in `BlueprintCapturePipeline`.
- F2: the status ladder gained `screening` and `results`, the account-free
  page offers the claim link at that moment, and the workspace results table
  includes agent runs as anonymised simulation rows.
- F3: a model reads the description into quoted proposals after submit
  (lane flag `BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED`), and footage
  observations that name a gate option become proposals once a capture clears
  the privacy screen. The operator confirms or corrects; nothing is filled in
  for them.

## 7. Note on the uncommitted change in the working tree

`client/src/lib/device.ts` and the `isLikelyPhone` call sites in
`SiteCaptureStart.tsx`, `Contact.tsx`, and `SelfCaptureUpload.tsx` behave as
intended: the QR renders on the desktop success state and is absent on the
phone success state (verified with an iPhone user agent, `m-site-success.png`).
They were not modified by this audit.
