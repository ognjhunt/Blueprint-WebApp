# Pipeline timing: video to packet

2026-11-22. Per stage: wall-clock time, cost, failure rate and what happens
on failure, each with its source. Then the slowest link and what would
shorten it.

**Read this first.** Only three jobs from November still have readable stage
records on the host: one real job (Blueprint's own capture) and two internal
test jobs. Every number below rests on one to three jobs. They are
observations, not averages. Nothing was paid for to get them.

## The short answer

| From upload to | Time | Jobs behind it |
|---|---|---|
| Sound-free video built | 55 and 65 minutes | 2 test jobs |
| Room ready | 5.9 hours and 26.7 hours; a third not reached after 70 hours | 3 |
| A simulation a company can open | never | 0 real jobs; 6 internal test jobs have one |
| Packet shown to a company | never | 0 |
| First company answer, introduction | never | 0 |

On the website side, the three jobs with a current listing were listed a
median of 2 minutes after they were created
(`evidence/production-counts/firestore-funnel.json`). The time for the first
look could not be measured: its 21 records carry no start or end time that
could be read.

**The slowest link** is the simulation build. On the one real job it took the
last 6.3 of 7 days and produced nothing.

**What would shorten it most:** ship the room as the simulation as soon as the
room is ready, and settle a launch that rented nothing at $0. Expected time
from upload to a simulation a company can open: about 6 to 7 hours. That is
an estimate from one job's room time, not a measurement.

## Corrections after checking

A second agent tried to refute each claim. These changed:

- **A fallback already exists.** The package builder already falls back from the built scene to the room, and to the room's floor. It still produced nothing for the four captures with no source. So the first step is to find out why, by replay, not to write a new source.
- **Deploys.** 153 deploy receipts in November, 146 of them from 11-01 to 11-20. About 12 a day early in the month, about 4 a day after 11-13, none since 2026-11-20 17:49Z. The door already holds a deploy while paid work is in flight.
- **The money guard.** Its failure count reached 4,984. The rented-machine checks for the providers in use still run and show zero machines. Deleting the retired RunPod key turns it green; no code change is needed.
- **The 10.5-hour hold.** An operator cleared it on 2026-11-12. Since then such a hold is re-run automatically once per release. It still asks the site to film again.
- **The "release admitted" check** is shown to have stopped only the two test jobs.
- **The disk gate** did hold the real job for the last three hours of its window. Nothing records which data caused it.
- **Cost.** The account counted $296.58 of its $400 November limit. Only $59.75 of that is tied to a job.

## Stage by stage

The rest of this file is the measuring agent's report, as written, apart
from the corrections above.

Measured 2026-11-22 between 15:05Z and 15:40Z through the operator door, read subcommands only
(`status` saved copy at 15:01Z, `ls`, `cat`, `journal`, `requests`). Only timestamps, states, codes,
sizes and money were read. No video, frame, site name, address, contact or job sentence was read or copied.
Scratch copies of the read-only pulls: `/tmp/claude-0/-home-user/e3989091-e008-5b78-a9cb-b7c31a5efdb8/scratchpad/agents/journey-C/`.

### How many jobs there are to measure

The host holds 23 scene folders (`door ls /var/lib/blueprint/pubsub-handoffs/blueprint-8c1ca.appspot.com/scenes`).
Only three website jobs from November still have readable stage records:

| Job (opaque id) | Kind | Hand-off | Furthest stage | Paid spend metered (door `spend_guard.account_monthly_spend.jobs`) |
|---|---|---|---|---|
| `capture-39ecdc97` | real website job, Blueprint's own capture (`permission_basis: blueprint_owned_capture` in its clip record) | 2026-11-11 18:44Z | simulation build; ended `authority_expired` 2026-11-18 18:44Z with no simulation | $8.46 (World Labs $6.02, OpenAI $2.44) |
| `itest-917ca852` | internal test job (WebApp `server/routes/internal-test-jobs.ts`) | 2026-11-19 17:27Z | scene preparation, `needs_input: website_atlas_source_pose_unavailable` at 2026-11-22 15:05Z | $8.41 |
| `itest-314bd4bc` | internal test job | 2026-11-19 17:17Z | reconstruction, `needs_input: website_atlas_pose_release_not_admitted` since 2026-11-19 17:18Z | $2.31 |

Six more test scenes were retired on 2026-11-21 and two older captures (`447ae4f4`, `5b067498`) on 2026-11-19.
The door refused their retirement receipts (`secret_content_refused:json_secret_field`), so they are not measured.
Every median below therefore rests on one to three jobs. Treat them as observations, not distributions.

### Stage table

| # | Stage | Median wall clock (n) | Worst (n) | Cost per job against the $40 cap | Failure rate (n) | Retry behaviour | Sources |
|---|---|---|---|---|---|---|---|
| 1 | Upload hand-off (Cloud Function, Pub/Sub, listener every 1 min) | under 1 s from listener start to `preflight` done (3) | 0.9 s (3) | $0 metered; GCP is a shared $61.07 this month, $0.12 attributed to jobs | 0 of 3 | Pub/Sub redelivery, then `website_preparation_retry` | `pipeline/run_summary.json` `stage_timings[preflight]`; door `spend_guard...providers.gcp` |
| 2 | Frames, normalisation, privacy gate, masks, clean plate (`materialization`) | 36 min to first stop (2 test jobs: 35.5 min to `needs_input`) | 16.3 h on the real job (979.5 min), of which about 10.5 h was a hold that ended only when an operator replayed it | Gemini and Meta SAM spend sits in the WebApp ledger: unverified per job. OpenAI settled $2.44 (real job) | 2 of 3 runs end `failed` (both test jobs, at the Atlas wait); 1 of 3 completed | `job_retry_policy` through `website_preparation_retry`; a recapture-coded stop holds and needs a new video or an operator replay | `run_summary.json`; `website_scene_preparation/held_handoff_replay.json` (`operator: true`, `recapture_code: website_registration_ambiguous`, replayed 2026-11-12 11:04Z); `.qualification_pipeline_failed.json` |
| 3 | Sound-free video (company clip) | 60 min from hand-off to built (2 test jobs: 55 and 65 min) | 25.3 h on the real job, which predates the clip code (shipped 2026-11-12, `git log --diff-filter=A website_company_clip.py` -> `05acac655`) | $0 (local ffmpeg) | Built 3 of 3; accepted by the WebApp 2 of 3 (both test jobs); the real job's clip refused `409 website_company_clip_not_permitted` and re-checked every window since | Every 60 s Atlas pass, no backoff (rights recheck once a window) | `pipeline/company_clip/company_clip.json` (`built_at_epoch`, `delivered`, `refused_by_webapp`); `statement_check.json` (last check 2026-11-22 15:24Z) |
| 4 | Reconstruction (World Labs Atlas: pose, refined splat, mesh) | 5.9 h (real job) | 26.7 h (`itest-917ca`, one retry `website_atlas_pose_release_not_admitted`); `itest-314bd` not reached after 70 h | $6.02 (real job), $5.83 (`itest-917ca`); November total $11.85 for 9 attempts (`capacity.provider_spend.world_labs`). Note: the account report counts $52.31 for World Labs against $11.85 metered | 1 of 3 reached ready without a release-admission stop | `job_retry_policy`; a release-admission refusal is `needs_input` | `pipeline/atlas/preview_job.json` (`enqueued_at_epoch`, `revised_at_epoch`, `retries`) |
| 5 | Object isolation and scene preparation (registration, collider, room package) | 6.2 min of compute on the real job (`capture_pipeline`) once released | 70 h to `needs_input` on `itest-917ca` | $0 on the host; SAM and Gemini in the WebApp ledger (unverified) | 1 of 3 reached `intake_ready` | `job_retry_policy`; non-wall blockers ship the room package flagged (retry doc section 8) | `website_scene_preparation/handoff.json` (`status`, `blockers`) |
| 6 | Scene intent and preparation ($0 control plane) | about 1.5 to 3 min per preparation attempt | 28 preparation attempts on one job in 6.3 days; 26 were superseded by a new release | $0 | 26 of 28 attempts ended by a release, 1 by capacity recovery | progression every 1 min; preparation every 2 min | `task-evaluation-scene-intents/scene-8ae57e…/progression.json` (`release_predecessors: 26`, `recovery_predecessors: 1`); `preparation-attempts/` listing |
| 7 | Simulation build (Vast GPU + ARTISAN object modelling on OpenAI) | never completed (0 of 1 job that reached it) | 8 attempts in 26 h on 7 different release commits, all without renting anything | Metered $0. Held: 7 blocked launches each kept $18 (`terminal_launch_unreconciled`), $126 of phantom holds; scene ceiling raised 5 times by `standing_policy` from $20 to $89.60 before 2026-11-19 | 8 of 8 attempts failed (7 `blocked`, 1 `launch_never_queued`); job ended `authority_expired` | intent `max_retries` and `task_evaluation_scene_launch_recovery` (six timed retries) | `cancelled-unstarted-controls/*.json` (`settled_spend`, `provider_mutation_performed: false`); `standing-budget-extensions/*.json`; `outcome.json` |
| 8 | Company simulation package | never made (0 jobs) | n/a | $0 (local `pxr`) | Atlas pass at 15:30Z: `company_simulation_no_source: 4, company_simulation_not_permitted: 2`, zero current | every 60 s pass, forever | `door journal blueprint-website-atlas-preview.service` (last aggregate line) |
| 9 | First look on paper (WebApp, Gemini site assessment) | unverified | unverified | WebApp overhead $6.01 OpenAI in November across all jobs (`overhead:webapp.site_assessment`) | unverified | WebApp | Firestore `siteAssessmentJobs` (21 docs, baseline counts); aggregate wanted below |
| 10 | Packet shown to companies (WebApp `teamJobAccess`, `companySends`) | never (0 sends) | n/a | $0 | `companySends: 0`, `introductions: 0` | n/a | baseline `firestore-collection-counts.json` |

Deploy pauses (they hit every stage above): a door deploy pauses all job triggers for a median 425 s
(max 757 s) and runs a median 813 s end to end (max 2,413 s), over 146 deploys from 2026-11-01 to
2026-11-20 (`trigger_pause_seconds.all_triggers` and `stage_timings_seconds` in each
`deploy-receipts/iteration_<sha>_door.json`).

Background cost of waiting: the Atlas pass ran 400 times between 07:52Z and 15:30Z today (one every
68 s) for 5 jobs with nothing to buy, 2.8 s CPU each (`journal`, `Consumed … CPU time`), about an hour of
CPU a day on a 4-CPU host.

### End-to-end cycle times

| From upload to | Value | Jobs behind it |
|---|---|---|
| Sound-free video built | 55 and 65 min | 2 (test jobs); the real job's 25.3 h predates the code |
| Sound-free video available to a company | never | 0 of 3: test jobs are never shown to a company; the real job's clip is refused |
| First look | unverified | needs the Firestore aggregate below |
| Room reconstruction ready | 5.9 h and 26.7 h; third not reached in 70 h | 3 |
| Room package ready (scene preparation) | 16.4 h | 1 of 3 |
| Simulation a company can open | never | 0 of 3 |
| Packet shown to companies | never | 0 (`companySends: 0`) |

### The slowest link

The simulation build (stages 6 to 8). On the only real job it took the last 6.3 of the job's 7 days and
produced nothing. What made it slow, in order of time lost, from the job's progression events
(`progression-events/`, 1,164 records, sampled every 12th):

1. Money holds that are not spending. `website_native_construction_budget_exceeds_authority` held 4.3 h
   (2026-11-12 13:42Z to 17:40Z). Seven launches that rented nothing then kept $18 each, and on
   2026-11-16 07:27Z the job hit `scene_intake_spend_cap_exhausted` while its metered spend was $8.46.
2. Releases. 29 door deploys (31 requests, 2 blocked) landed inside the job's window. 26 of its 28 preparations were superseded by a
   new release; its 8 launch attempts ran on 7 different commits.
3. Disk gates. `preallocation_capacity_not_recovered` (2026-11-12 20:42Z to 22:42Z) and
   `control_plane_disk_budget_exceeded` (2026-11-18 15:32Z until the window closed at 18:44Z). Each new
   launch needs a new sealed bundle (`successor_requires_new_sealed_bundle: true`, about 6.1 GB,
   `next_bundle_overhead_bytes` in the capacity-recovery record).
4. Re-preparation loops: about 600 progression events in `factory/preparing` from 2026-11-17 19:59Z to
   2026-11-18 07:02Z (11 h).

Before the simulation build, the single longest wait was a person: the recapture-coded hold
(`website_registration_ambiguous`) sat 10.5 h until an operator replayed it on a new release.

What would shorten it most: build the company simulation package straight from the room package the
scene preparation already makes (Atlas mesh and splat, the isolated object, the success rule), and take
the GPU object-modelling build off the critical path. That removes stages 6 and 7 from the wait, and
with them the release supersessions, the $18 phantom holds and the 6 GB bundles. Second: settle a launch
that rented nothing at $0. Third: deploy once a day as policy already says.

### Unverified, and what would measure it

- Per-stage Gemini and Meta SAM spend per job: Firestore `inboundRequests/<id>.website_preparation_reservations`.
- First look time: Firestore aggregate 1 below.
- Failure rates with more than three jobs: more jobs. The retired scenes' receipts are refused by the door's secret scan.
- The launch blockers of the seven blocked launches: their launch folders are offloaded
  (`*.offloaded.v1.json`, `terminal_receipt: launch_receipt.json` not inline); `door pull` of the off-host
  copy was not used (rule 5 allows only the listed read subcommands).

### Firestore aggregates wanted

1. `inboundRequests` where `createdAt >= 2026-11-01`: count; for each, the durations (seconds) from
   `createdAt` to the first time each of these exists: the site assessment result (`siteAssessmentJobs`
   doc for the request, its completion timestamp), the company clip record (`captureUploadSessions/<capture>`
   stored company clip `updated_at_epoch`), the scene preview, the company simulation record. Report
   median, max and count per measure. Non-personal fields only.
2. `siteAssessmentJobs`: count by `status`; median and max of completion minus creation.
3. `companySends`, `introductions`, `billableEvents`: count (baseline already shows 0, 0, n/a), and the
   median of first send minus the request's `createdAt` where any exists.
4. `inboundRequests.website_preparation_reservations`: per request, sum of settled USD by provider
   (gemini, meta_sam, world_labs, openai) and sum of still-held USD. Shows where the per-job meter on the
   host is blind.
5. `inboundRequests` grouped by recorded `privacy_policy_version` (the value the grant carries) for jobs
   since 2026-11-17: tells how many jobs fall outside the Pipeline's hand-kept version lists.
