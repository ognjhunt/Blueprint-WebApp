# Journey C: the Pipeline, from video to packet (agent `journey-C`)

Audit date 2026-11-22. Pipeline HEAD `7d8b532`; the control plane runs `cbff06b` (door `status.active_release`).
WebApp HEAD `0ee5df6`, live.

Everything host-side was read through the operator door with read subcommands only (`status` saved copy,
`ls`, `cat`, `journal`, `requests`). Only timestamps, states, codes, sizes and money were taken. No site
video, frame, name, address, contact or job sentence was read, pulled or copied. No paid call was started.
Tests run: `pytest tests/test_website_company_simulation.py tests/test_atlas_preview_replay.py
tests/test_website_company_clip.py` -> `495 passed in 127.23s`, credentials blanked.

The stage-by-stage numbers live in `raw/pipeline-timing.md`. This report traces the one real website job
that November left readable on the host, `capture-39ecdc97` (Blueprint's own capture), and two internal test
jobs, and questions each stage.

The short version, for a phone:

- No website job has ever produced a simulation a deployment company can open. Zero company simulation
  packages exist. Zero packets have been sent to a company (`companySends: 0`).
- The simulation a company would open is built from the old robot-team machinery: a GPU job on Vast that
  models the object with ARTISAN, then a "team scene half" made for the dropped trial. That chain is the
  slowest link and it has never finished for a website job.
- The only real job lost its whole 7-day window there. Its launches rented nothing, yet each kept an $18
  hold, so the job hit its spending cap having spent $8.46.
- Deploys ran 146 times in 20 days, not once a day. 26 of that job's 28 preparations were thrown away
  by a new release.
- The room itself (World Labs) is ready in about 6 hours, and the sound-free video in about an hour. The
  room plus the isolated object plus the success rule is already a simulation package. Build it from there.

## 1. The journey today

One job, `capture-39ecdc97`, handed off 2026-11-11 18:44:49Z. Waits are measured from host records unless
marked. Friction is 0 (none) to 5 (job stops).

| # | Step | Screen or email | What the user (site, company, owner) does | Wait (source) | Failure modes seen | Friction |
|---|---|---|---|---|---|---|
| C.1 | Upload hand-off: Cloud Function -> Pub/Sub -> listener (every 1 min) | none (site already saw "uploaded") | nothing | under 1 min to `preflight`; preflight 0.9 s (`run_summary.json`) | none seen | 0 |
| C.2 | Frames, normalisation, privacy gate, masks and clean plate (Gemini, Meta SAM) | none | nothing | stage ran 16.3 h; about 10.5 h of it was a hold (`run_summary.json`, `held_handoff_replay.json`) | `meta_sam_http_413` retried once; recapture-coded hold `website_registration_ambiguous` | 4 |
| C.3 | Operator replay of the held hand-off | none | the owner or an agent replays it on a new release (`operator: true`, 2026-11-12 11:04Z) | 10.5 h waiting for a person | without a person the job would have waited for a new video | 5 |
| C.4 | Sound-free video (company clip) | none; WebApp would show it to companies | nothing | built 25.3 h after hand-off on this job (code shipped that day); 55 and 65 min on two test jobs (`company_clip.json`) | WebApp refused it `409 website_company_clip_not_permitted`; the Pipeline re-checks every window (last 2026-11-22 15:24Z) | 3 |
| C.5 | Reconstruction: World Labs pose, refined splat, mesh; OpenAI planner and reviews | the site's job page shows the scene preview | nothing | 5.9 h (`preview_job.json` enqueued 18:44Z, ready 00:36Z) | on test jobs: `website_atlas_pose_release_not_admitted` stopped one for 26.7 h and another for 3 days so far | 2 |
| C.6 | Object isolation and scene preparation (registration, collider, room package, robot-fit table) | none | nothing | 6.2 min of compute after the replay (`capture_pipeline`) | `needs_input` on both test jobs | 2 |
| C.7 | Scene intent: WebApp signs it, Pipeline intake stores it | none | nothing | 2 min (`intent.json` 11:10:36Z) | none | 0 |
| C.8 | Scene preparation, $0, every 1-2 min | none | nothing | 28 attempts over 6.3 days; 26 ended by a new release (`progression.json`) | release supersession; `control_plane_disk_budget_exceeded`; 11 h re-preparation loop | 4 |
| C.9 | Simulation build: Vast GPU, ARTISAN object modelling on OpenAI | none | nothing | 8 attempts in 26 h (11-12 11:17Z to 11-13 13:05Z) on 7 commits; never succeeded | 7 `blocked`, 1 never queued; `website_native_construction_budget_exceeds_authority` 4.3 h; `preallocation_capacity_not_recovered`; `scene_intake_spend_cap_exhausted` 11-16 07:27Z | 5 |
| C.10 | Teardown proof (reconciler every 2 min) | none | nothing | n/a here (nothing rented) | none | 0 |
| C.11 | Team scene half (robot-team packet) | none | nothing | never reached | queue empty (`stall.checks.team_scene_packets: {}`) | 5 |
| C.12 | Company simulation package (`scene.usda` + `success_rule.json` zip) | companies would download it | nothing | never made | `company_simulation_no_source: 4, not_permitted: 2` (atlas journal 15:30Z) | 5 |
| C.13 | First look on paper (WebApp Gemini) | site's job page | site reads it | unverified (Firestore) | unverified | ? |
| C.14 | Packet shown to companies (WebApp `teamJobAccess`) | company's Find jobs | company reads and answers | never: `companySends: 0` | | 5 |
| end | Job window closes | site's job page and one email (WebApp window sweep) | site learns the job ended | 7 days (`outcome.json` `authority_expired` 2026-11-18 18:44Z) | | 5 |

Totals for the Pipeline part: 14 steps (C.1 to C.14). Site clicks 0, fields 0, sign-ins 0 inside the
Pipeline. Waits: 7 automatic waits plus 1 wait for a person (C.3). Emails: 0 from the Pipeline; the WebApp
sends the window-end email. Paid providers touched: Gemini, Meta SAM, World Labs, OpenAI (Vast reserved,
never rented). Wall clock: 7 days, ending with no simulation and no company having seen anything.

## 2. The journey as proposed

| # | Step | What happens | Wait (expected; basis) | Hard stop it carries |
|---|---|---|---|---|
| P.1 | Upload hand-off | as today | under 1 min (measured) | rights and privacy: consent and withdrawal, unchanged |
| P.2 | Sound-free video | made from the upload as soon as it lands, before any other stage | minutes (encode of a 10-15 s clip; today's 55-65 min is mostly waiting for normalisation, unverified split) | rights: the WebApp's sharing check, one authority |
| P.3 | Reconstruction | World Labs room, as today, no per-call release check | about 6 h (measured, n=1) | money: the job's $40 ledger; privacy: face blur by version, one shared rule |
| P.4 | Room package = company simulation package | the isolated object (SAM masks and points), the room mesh and splat, and the success rule written straight into `scene.usda` + `success_rule.json`; anything missing is flagged, never held | minutes after P.3 (the package build is local CPU) | rights: the same sharing check as the clip |
| P.5 | Packet published | WebApp shows sentence, clip, first look and the package to approved companies | as soon as P.4 lands | none new |

Step count: 14 before, 5 after. Upload to a simulation a company can open: never today; about 6 to 7 hours
proposed (the reconstruction time measured on the one real job, plus minutes). The first look stays in the
WebApp, in parallel.

Deleted from the critical path: C.3 (operator replay), C.7-C.11 (scene intent, $0 preparation, the Vast and
ARTISAN build, teardown proof, team scene half), the robot-fit table and the rigid robot-free probe.

Deletions I expect might come back, and why:

- ARTISAN object modelling, for jobs whose object moves in parts (a drawer, a door, a lid). A box or a
  scanned mesh may not be enough for a company to test such a job. Bring it back as an optional upgrade to
  a package that already exists, never as the gate in front of it.
- The scene intent hand-shake, if the WebApp needs a signed record of what the Pipeline will spend on a
  later upgrade. Today the job ledger and the $40 cap already carry that.

## Requirements ledger

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Upload hand-off (Cloud Function, Pub/Sub, listener) | `functions/storage_trigger.py`; `deploy/systemd/blueprint-pubsub-handoff-listener.timer` (1 min) | owner mission (AGENTS.md "Mission") | nothing reaches the Pipeline | KEEP | It is the only door from upload to processing and costs under a minute. |
| Consent, withdrawal and rights check at every paid step | `job_retry_policy.py`; retry doc lines 24-27 | hard stop: privacy and rights | a withdrawn site keeps being processed | KEEP | Privacy and rights are hard stops. |
| Face blur of frames sent to World Labs, by Privacy version | `atlas_privacy_screen.py:49-50` (HEAD) | owner decision 2026-11-17; privacy hard stop | earlier-version jobs lose the blur they were promised | SIMPLIFY | (one rule "versions from 2026-11-17.1 are not blurred", not a hand-kept list; finding C-09) |
| Normalisation of the video before anything else | `website_company_clip.py:9-16` | nobody named; technical need for the clip and frames | clip and frames have no common source | SIMPLIFY | (keep, but run it first and alone so the clip does not wait for masks) |
| Clean plate (Gemini object removal analysis) | `pipeline/clean_plate/*`; `clean_plate_removal_analysis_gemini` | nobody named for website jobs; trial-era scene repair | the room scene keeps the job's object baked in; the object is then also placed separately | SIMPLIFY | (keep only what the room package needs; unverified whether a company sees any difference) |
| Candidate ranking and task target choices | `pipeline/website_candidate_ranking.json`, `website_task_target_choices/` | nobody named | object picked from the site's sentence alone | KEEP | The job's object must be found in the video for the package to hold it. |
| Recapture-coded hold (`website_registration_*`) | retry doc lines 239-248 | guard in `website_scene_handoff` | nothing: the real job was released by an operator replay on new code, not a new video | DELETE | (finding C-04) |
| Operator `selected-handoff` / held hand-off replay | `website_held_handoff_replay.py`; door requests (4 `selected-handoff` on 2026-11-20) | nobody; a workaround | a held job waits forever | DELETE | (goes with C-04) |
| Sound-free video built by the Pipeline | `website_company_clip.py` | owner decision 2026-11-12 | companies see no video | KEEP | It is one of the four things a company decides on, and it is ready in an hour. |
| Pipeline's own "Blueprint-owned capture" sharing basis | `sharing_statement.py:5,32-33` | nobody on the WebApp side | the Pipeline stops sending clips the WebApp refuses anyway | DELETE | (finding C-10) |
| Reconstruction with World Labs | `website_atlas_preview.py`; `website_atlas_pipeline.py` | owner direction 2026-11-12 (simulation is how a job is testable) | no room | KEEP | The room is the simulation's body and it is ready in about 6 h. |
| Release-admission check before each paid Atlas call | `paid_resource_allocator.py:350-352`; `website_atlas_pose.py:1159-1161` | guard, no named owner line; the door already deploys only commits on `origin/main` (runbook `cloud-scene-runs.md` step 6.3) | paid calls could start from an unpushed checkout on the host | SIMPLIFY | (move to deploy time; finding C-05) |
| Atlas planner and automation reviews (OpenAI) | `atlas/scene_planner`, `atlas/automation` | nobody named | unverified: the reviews pick views and catch bad frames | KEEP | They cost under $1 a job (cost model section 2) and steer a $5 splat. |
| Robot-fit table and precheck in the hand-off | `handoff.json` `robot_fit_table` (fits 0, unknown 29), `robot_fit_precheck` | commit `05acac655` "the first look says what each robot can do" | unverified whether a site or company sees it | DELETE | (finding C-13; unverified reader) |
| Scene intent intake (signed intent per job) | `task_evaluation_scene_intake.py`; WebApp `taskEvaluationSceneIntake.ts` | trial-era robot evaluation | the GPU build has no authority | DELETE | (from the critical path, with C-01) |
| $0 scene preparation bound to the release commit | progression `release_predecessors` | retry doc section 5.1 (known gap) | nothing: it is redone after each deploy anyway | DELETE | (finding C-02) |
| Simulation build on Vast + ARTISAN (OpenAI) | `task_evaluation_launch_*`; `vast_provider_adapter.py` | owner direction 2026-11-02 for ARTISAN cap; trial-era chain | the object is a scanned shape, not a modelled one | DELETE | (from the critical path; might come back as an upgrade, C-01) |
| Full $18 hold for a launch that rented nothing | `task_evaluation_terminal_scene_attempt_settlement.py:242-244` | nobody; conservative default | phantom spend ends jobs at the cap | DELETE | (finding C-03) |
| Three dollar figures per grant ($25 + $5 + $20) beside the one $40 cap | WebApp `websiteSceneSponsorship.ts:382-385`; `website_scene_sponsorship.json` of 11-19 jobs | retired multi-cap design | nothing: the $40 ledger already binds | MERGE | (finding C-11) |
| One $40 cap per job, the $400 month limit | `config/website_job_spend_cap.v1.json`; AGENTS.md lines 53-56 | owner decisions 2026-11-19, 2026-11-20 | uncapped spend | KEEP | Money is a hard stop. |
| Teardown proof (reconciler) | `task_evaluation_launch_reconciler.py` | money hard stop | a rented GPU could run on | KEEP | While anything rents a GPU, proof it stopped protects money. |
| Team scene half (robot-team packet) | `team_scene_packet_worker.py`; `website_company_simulation.py:7-8` | trial ("the simulation the trial itself runs") | the company package has no source today | DELETE | (finding C-01) |
| Company simulation package | `website_company_simulation.py` | owner decision 2026-11-12 | a company cannot test without a visit | KEEP | It is one of the four things a company decides on. |
| Rigid robot-free probe lane, timer every 5 min | `blueprint-rigid-robot-free-probe-runner.timer`; `rigid_robot_free_probe_lane.py` | trial-era check | nothing measured: queue 0, never ran (cost model section 7) | DELETE | (inventory finding; noted in C-13) |
| Company clip and simulation pass every 60 s, forever | `website_atlas_preview.py:1106,1121`; journal 400 passes in 7.6 h | nobody | packages appear a minute later | SIMPLIFY | (run on change, not on a clock; low value, not a finding) |
| Progression tick every 1 min writing an event each time | 1,164 event files for one job | nobody | less disk and noise | SIMPLIFY | (not a finding) |
| Deploy window: once a day at 15:00Z | AGENTS.md lines 138-153 (D-08, 2026-11-02) | owner delegation 2026-11-02 | releases retire in-flight work all day | KEEP | Until attempts survive a release, batching deploys is the only protection; finding C-02 shows it is not followed. |
| Deploy hold for work in flight | `deploy/operator-door/operator_door/activation_hold.py` | retry doc section 3 | a deploy retires a paid stage | KEEP | It protects money already committed. |
| Job window as the deadline (7 days) | WebApp `websiteJobWindowSweep.ts`; `outcome.json` `authority_expired` | retry doc section 4 | jobs never end | KEEP | A job must end by itself. |
| Disk-budget gates (`control_plane_disk_budget_exceeded`, preallocation capacity) | progression events 11-12, 11-18 | guard, host stability | host disk fills | SIMPLIFY | (keep the guard, delete what fills the disk; finding C-12) |
| Anthropic provider choice for object modelling | `artisan_provider_choice.py` (284 lines) | owner consent design 2026-09-24 | nothing in production: it can never choose Anthropic | DELETE | (finding C-06) |
| Six timed retries (15 min to 24 h) | `job_retry_policy.py`; retry doc line 22 | AGENTS.md "After a failed step a job retries by itself" | stuck jobs need a person | KEEP | It is what lets a job heal without a person. |
| GPU spend guard (RunPod still queried) | `scripts/gpu_spend_guard.py:2322-2337`; door `spend_guard.status: blocked` | money hard stop | the GPU fleet is unwatched | KEEP | Money guard; fix its RunPod failure (finding C-14). |
| Runbook step 13 "robot team picks its saved setup" and "raise the preparation cap" | WebApp `docs/runbooks/cloud-scene-runs.md:199-220, 285-296` | retired trial; manual amendment | agents follow dead steps | DELETE | (finding C-15) |
| `run_e2e` skipped stages (`robot_eval`, `agent_review`, …) in every ledger | `run_e2e.py:52-66` | kept only so old ledgers resume byte-identical | nothing | KEEP | Already trimmed to a frozen record; deleting it would break resume of old ledgers for no gain. |

## 4. Findings

Each finding is in `raw/journey-C.findings.json` with its full fields. The evidence in short:

**C-01 (P0, broken): no simulation a company can open has ever been made.** `website_company_simulation.py:7-8`
says its source is "the job's compiled team scene half, the simulation the trial itself runs". That half
comes only after the Vast and ARTISAN build. Atlas pass 2026-11-22 15:30Z: `company_simulation_no_source: 4,
company_simulation_not_permitted: 2`, none current. The real job's 8 build attempts all failed. Yet the
room package already exists after scene preparation (`website_scene_preparation/`: `scene_preview.ply`,
`collider/`, `base_scene.json`, `task_masks.geometry.json`). Proposal: write the company package from the
room package; keep the GPU build as an optional later upgrade. Fixture tests for the package builder pass
(495 passed), so the builder works; its source is the problem.

**C-02 (P0, slow): deploys run 3.75 to 7 a day, not once.** 146 door deploys from 2026-11-01 to 2026-11-20
(`iteration_<sha>_door.json` receipts, `status: deployed`); 30 from 11-14 to 11-21; 31 of 146 between
15:00Z and 18:00Z. 29 landed inside the real job's 7-day window; 26 of its 28 preparations were superseded
(`progression.json` `release_predecessors: 26`) and its 8 launches ran on 7 commits. Each deploy pauses
every job trigger for a median 7.1 min. No paid work was repeated on this job (all `provider_mutation_performed:
false`; Atlas reuses retained receipts), but in October the same churn left 9 of capture-447's 18 rows
"never queued; superseded by a newer release", each blocking $17 to $30 of ceiling for 39 min to 6 h 47 min
(cost model section 3). Removal: the door refuses a non-fix deploy outside the window; then let the old
release drain its own attempts (retry doc section 5.1).

**C-03 (P0, broken, money): a launch that rented nothing keeps an $18 hold.** `task_evaluation_terminal_scene_attempt_settlement.py:242-244`:
a scene-configuration launch with status `blocked` falls to `terminal_launch_unreconciled` with
`retained_spend_usd = cap`. Seven such rows on the real job, each `provider_mutation_performed: false`,
`retained_spend_usd: 18.0` = $126 held for $0 spent. The job hit `scene_intake_spend_cap_exhausted`
(2026-11-16 07:27Z) at $8.46 metered. Before 2026-11-19 a `standing_policy` raised the ceiling five times
($20 -> $89.60, `standing-budget-extensions/`); since then nothing raises it
(`task_evaluation_scene_intake.py:222-236`), so today one blocked launch can end a job's build.

**C-04 (P1, over-gated): a "film again" hold that a person cleared.** `website_registration_ambiguous` is a
"only a new video can clear it" code (retry doc lines 239-248). The real job sat on it 10.5 h, then an
operator replayed the same video on a new release (`held_handoff_replay.json`: `operator: true`,
`release_commit 92775024`) and the job went on. The code protects none of privacy, rights or money. Ship
the best fit, flagged, as section 8 of the same doc already does for other blockers.

**C-05 (P1, over-gated): paid Atlas calls wait for a "release admitted" check.** `paid_resource_allocator.py:350-352`
feeds `website_atlas_pose.py:1159-1161`. Test job `itest-314bd` has been `needs_input:
website_atlas_pose_release_not_admitted` since 2026-11-19 17:18Z; `itest-917ca` lost 26.7 h to the same
retry. The door already deploys only commits on `origin/main`. Check once at deploy, not per paid call.

**C-06 (P1, vestigial): Anthropic can never model a website job's object.** The host choice needs
`authoring_providers` with both providers (`artisan_provider_choice.py:58-61,114-115`). The WebApp never
sends that field (`grep -rn authoring_providers` over WebApp `*.ts` -> no hits) and sends `authoring_provider:
"anthropic"` only with a typed consent whose box renders in development builds only
(`SiteCaptureStart.tsx:51,522`, `websiteSceneSponsorship.ts:351-352`). So `PRIVACY_POLICY_VERSIONS` stopping at
2026-11-18.1 (`artisan_provider_choice.py:39`) changes nothing: every job uses OpenAI ARTISAN under the $12
object cap. What Anthropic would change in cost or quality is unknown (open cost question).

**C-07 (P1, unseen): the per-job meter sees a fifth of the month's spend.** Door `spend_guard.account_monthly_spend`:
counted $296.58 of $400; jobs metered $59.75. OpenAI $85.25 counted vs $13.25 metered; GCP $61.07 vs $0.12;
World Labs $52.31 vs $11.85; DigitalOcean $63.43 unattributed. Forecast reaches the limit on 2026-11-30.
$34.52 of the metered amount is Vast screening for the dropped trial (captures 447 and 5b067498). With one
real job this month, the $40 cap governs a small slice of what a job really costs.

**C-08 (P2, slow): the sound-free video waits for normalisation inside the preparation stage.** Built 55 and
65 min after hand-off on the two test jobs (`company_clip.json` `built_at_epoch`); the module says "a new
capture waits for normalization" (`website_company_clip.py:12-15`). A 10-15 s clip encodes in seconds to
minutes (unverified exact time). Make it first.

**C-09 (P2, fragile): two hand-kept Privacy version lists.** Live release `cbff06b` lists no-blur versions up
to 2026-11-20.1 (`git show cbff06b:src/blueprint_pipeline/atlas_privacy_screen.py`), while the site publishes
2026-11-21.1 (`client/src/lib/legalAcceptance.ts:175-180`). Until HEAD deploys, jobs started today are
blurred (safe side, no privacy risk). The Anthropic list stops at 2026-11-18.1. Every legal edit needs a
Pipeline commit and a deploy.

**C-10 (P2, broken): the real job's clip is built and refused.** The Pipeline shares on
`blueprint_owned_capture` (`sharing_statement.py:5`); the WebApp accepts only `RECORDING_VERSIONS_THAT_SHARE`
or `internal_test` (`websiteCompanyClip.ts:92-93`) and answers 409. The Pipeline re-checks every window
(`statement_check.json` 2026-11-22 15:24Z). One authority for sharing: the WebApp.

**C-11 (P2, over-gated): three spend figures still sealed in every grant.** The 2026-11-19 test grants carry
`preparation_max_total_spend_usd: 25`, `upstream_max_spend_usd: 5`, `max_total_spend_usd: 20`
(`website_scene_sponsorship.json`), written by `websiteSceneSponsorship.ts:382-385`. The $20 scene figure
(`min(20, 40)`, `task_evaluation_scene_intake.py:235`) is what one $18 phantom hold exhausts.

**C-12 (P1, fragile): disk gates stopped the real job twice.** `preallocation_capacity_not_recovered`
(2026-11-12 20:42Z to 22:42Z) and `control_plane_disk_budget_exceeded` (2026-11-18 15:32Z to window end).
Each new launch needs a new sealed bundle of about 6.1 GB (`next_bundle_overhead_bytes: 6084009787`). The host
holds at least 67 GiB of retired-lane data (inventory section 9.2). Deleting retained data needs the owner.

**C-13 (P2, vestigial): robot-fit table and rigid probe still ride the website path.** `handoff.json`
`robot_fit_table.counts: fits 0, doesnt_fit 4, unknown 29`; `robot_fit_precheck.counts: unavailable 124`.
Who reads it is unverified. The rigid probe timer fires every 5 min with an empty queue.

**C-14 (P1, fragile): the GPU spend guard is blind since 2026-11-13.** Door `spend_guard.status: blocked`,
`blockers: ["runpod_inventory_query_failed"]`, `provider_zero_verified: false`; inventory counts 4,844 failures.
Cause `scripts/gpu_spend_guard.py:2322-2337`: a RunPod key file still exists. Whether paid admission refuses
while the guard is blocked is unverified.

**C-15 (P2, vestigial): the cloud scene runbook still walks the trial.** WebApp
`docs/runbooks/cloud-scene-runs.md:285-296` ("Step 13: the robot team picks its saved setup ... start the
evaluation") and `:199-220` (raise the preparation cap by hand before a run).

Loose ends the task named:

- (a) Confirmed with a twist: the list does stop at 2026-11-18.1, but no production job can reach that check
  (C-06). Jobs use OpenAI ARTISAN, $12 cap per object (AGENTS.md "Spend limits").
- (b) Trial imports on the website job path: the inventory lists 59 edges from 41 live modules
  (`raw/inventory-pipeline.md` section 9.1). On the path this journey walked: `website_company_simulation`
  takes its source from the trial's team scene half (`website_company_simulation.py:7-8`);
  `task_evaluation_scene_progression.py:725` imports `task_evaluation_scene_policy_capability`;
  `task_evaluation_launch_dispatcher.py:61` imports `task_evaluation_policy_run_contract`;
  `website_robot_fit.py:99` imports `droid_policy_canary_embodiment`.
- (c) 207 failed units: 206 one-off `systemd-run` experiment units from 2026-09-26 to 2026-10-27 never reset
  (by name prefix: `g1-*` 35, `internal-team-*` 15, `scene*` 23, `native-*` 13, `paired-policy-*` 6, `atlas-*` 23
  and others), plus the spend guard failing every run (C-14). None is a website stage. Timers still armed for
  retired lanes: rigid probe (5 min), team scene remote (60 s), episode compilation remote (60 s)
  (deploy receipt `activated_timer_units`).

## 5. What works well and should be left alone

- **The retry policy.** One pure module, timed retries, no attempt counts on outages, the window as the
  deadline (`job_retry_policy.py`; retry doc section 1). The real job did end by itself at its window.
- **Retained receipts for paid calls.** A replayed or re-prepared step reuses a paid answer instead of buying
  it again. Across 26 release supersessions the real job bought nothing twice (all settlements
  `provider_mutation_performed: false`).
- **The room reconstruction.** World Labs ready in 5.9 h for $6.02 on the real job, with one SAM retry handled
  by itself (`preview_job.json`).
- **The sound-free clip builder.** Video only, metadata and side data stripped, every frame checked
  (`website_company_clip.py:17-22`). It is the safest artefact in the packet; just make it sooner.
- **The deploy receipts.** Every deploy writes timings, paused triggers and paid runs in flight; that is how
  this audit could count them.
- **The company package builder's outbound scan and deterministic zip** (`website_company_simulation.py:31-37`);
  495 fixture tests pass. Point it at the room package and keep it.
