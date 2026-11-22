# Dimension: gates that protect none of the three hard stops

Agent: dim-gates. Date: 2026-11-22. WebApp at `0ee5df6` (live). Pipeline HEAD `7d8b532`; the control plane runs `cbff06b` (door status copy, 15:01Z).

Doctrine: the only hard stops are privacy, rights and money. Everything else is flagged and keeps going (Pipeline `AGENTS.md:44-65`; WebApp `CLAUDE.md`). This report lists every place I found where the product or the Pipeline stops, holds, refuses, waits or asks a person. Each one has to show which of the three it protects, and how.

## How I worked

- I read the code paths in both repositories, building on the inventories and on journeys A, B, C and D. I cite their finding ids where I build on them and do not repeat their evidence.
- Door reads only: `whoami`, `ls`, `cat`, `journal`, `requests`, plus the saved `status` copy. From the scene-intent store I took aggregates only: status, phase, blocker codes, whether `revoked.json` exists, and file dates. Scripts and outputs: `/tmp/claude-0/-home-user/e3989091-e008-5b78-a9cb-b7c31a5efdb8/scratchpad/agents/dim-gates/` (`intents.py`, `intents.json`, `intent_dirs.txt`, `ext_dates.txt`, `j-*.txt`).
- I opened no site's video, frames, name, address, contact details or job sentence. I made no paid call, started no server, wrote nothing to production and changed nothing in either repository.

## The short version

1. **Blueprint's own 7-day work window can hide a finished job from every company and cancel Introduce us** (G-01). When the window passes, the grant read answers `consent_expired`. That is a time limit, but it carries a consent name. The Pipeline turns it into `authority_ended`. `teamJobAccess.ts:237` then closes the job for every company, and the introduction gate re-checks the same rule (`jobIntroductionGate.ts:56-58`). No privacy, rights or money reason is involved: the $40 cap is the money bound, and `websiteJobWindow.ts:17` says "Only time is set here."
2. **A job reaches companies only after Blueprint's paid preparation is admitted** (G-02). The free, sound-free clip is required for listing (`teamJobAccess.ts:253`). It is made inside the preparation run, which starts only after the WebApp issues a paid-preparation grant (`website_assessment_resume.py:154-206`, `pubsub_handoff_scene_operations.py:355-364`). So a money admission and the control-plane host stand between the site's video and the companies.
3. **Quality checks still stop jobs instead of flagging them.** Three recapture codes besides the registration codes in C-04 throw away a room that was already built (G-03). Any unknown or bookkeeping blocker holds the job until 2 hours before its 7-day window ends (`LAST_CALL_SECONDS`, G-04). Today 9 scene intents are held on an internal receipt code (journal).
4. **The alarm's "30 rights holds" are not rights holds** (G-05). They are 30 revocations, 29 of them from 2026-09-07 to 09-16. The store keeps no reason, so revocations Blueprint made for its own bookkeeping are also counted as rights.
5. **Money has about 25 limits; four do the work** (G-07): the $40 job cap on the WebApp job ledger, the account monthly limit, the GPU orphan reaper, and the first-look caps (that spend is not on the job ledger). The rest are retired, duplicated, or alert lines set above the monthly limit.
6. A person at Blueprint must still act in at least 9 places for a job to move. Approving each company is the only one doctrine asks for.

## 1. Every gate, with its proof

Columns: what it blocks and for whom; who asked for it; which hard stop and how; what the user sees when it trips; how often it trips in production; my verdict. "Door" means the saved status copy unless a journal is named.

### 1a. The site's side (WebApp)

| Gate | file:line | Blocks / delays | Who asked | Hard stop, mechanism | When it trips | Production | Verdict |
|---|---|---|---|---|---|---|---|
| Honeypot | `server/routes/inbound-request.ts:1032-1040` | bots | guard | money (each job is paid preparation) | silent fake success | unknown (logged only) | KEEP |
| 15-minute limiter: 10 per IP, 3 per email | `inbound-request.ts:330-335` | a burst of starts | nobody named | money, weakly | 429 | unknown | MERGE into the daily cap (G-08) |
| Daily intake cap: 5 a day in all, 20 per IP, 5 per email | `server/utils/betaAbuseCaps.ts:44-52`, `inbound-request.ts:1751-1766` | the 6th new job of the UTC day | owner D-13 (global) | money: bounds a day of paid preparation | 429 "We have reached today's limit", draft kept | `durableDailyCaps` collection: Firestore aggregate 1 | KEEP the global cap; DELETE the per-IP and per-email caps. At the defaults they can never trip before the global one (G-08) |
| Intake email caps: 40 a day, 2 per recipient | `betaAbuseCaps.ts:115-160` | confirmation emails to unverified addresses | Resend free plan | money / provider term | the email is skipped, the link stays on screen | unknown | KEEP (provider term) |
| Upload byte caps: 20 GiB a day in all, 4 GiB per job | `betaAbuseCaps.ts:164-215` | uploads | nobody named | money (storage) | 429, "keep the original file" | unknown | SIMPLIFY: keep the global cap only |
| US-only capture | `client/src/data/captureResidency.ts:43-58` | non-US video | Privacy Policy (transfer terms) | privacy / law | no camera link | see A-02 | KEEP (A-02 fixes the consent leak) |
| Recording statement v4 or later | `teamJobAccess.ts:198-203,249` | jobs started under an older statement | owner 2026-11-12 (sharing is the service) | rights: the site's agreement to share | silent: never listed | Firestore aggregate 2 | KEEP |
| Job sentence required (not the placeholder) | `teamJobAccess.ts:211-215,252`; Pipeline `website_capture_preparation.py:15-27` | jobs with no sentence | owner 2026-11-20 (form); incident capture-98a79ce3 (Pipeline) | none on the WebApp; money in the Pipeline (no paid reading of a job with no task) | job page asks for one sentence | the form requires it now, so it trips only on older jobs | KEEP the WebApp rule. The Pipeline copy is harmless and cheap |
| "Confirm your job description" (brief confirmation) | `taskStatusProjection.ts:732-737`; `websiteSceneSponsorship.ts:279`; revoking code at `taskEvaluationSceneIntake.ts:351` | the full scene grant; the card's "Ready" label | owner 2026-11-07 | none. Typing the sentence on the form is already the confirmation | site sees a confirm step; a paid scene intent is revoked and cannot be restored | the only path that clears a confirmation today, `POST /:token/follow-up` (`site-task-brief.ts:736-741`), has no caller in the client | DELETE for jobs started with a sentence (A's ledger agrees) |
| 7-day wait on the site (first video, smaller video, held step) | `websiteJobWindowEnding.ts:104-111`; `teamJobAccess.ts:244` | a job with nothing to share | owner 2026-11-20 | none needed: nothing is spent while waiting | job ends and is not listed | Firestore aggregate 3 | KEEP (owner direction; nothing listable exists) |
| Blueprint's 7-day work window | `websiteJobWindow.ts:1-26`; `websiteSceneSponsorship.ts:327`; `teamJobAccess.ts:237` | further paid work, **and** listing and introductions once preparation ends `authority_ended` | owner 2026-11-03 (length) | **none**. The file says "Only time is set here" (`:17`); the $40 cap bounds money | the job disappears from companies; Introduce us is cancelled | 7 scene intents ended `scene_intake_authority_expired`, 9 counted by the alarm (door) | SIMPLIFY: the window may end paid work but must never close listing or introductions (G-01) |
| Owner-approved window extension and grant renewal | `sceneExecutionWindowExtension.ts:1-9`; `websiteSceneSponsorship.ts:523` | jobs that outlive the window | nobody beyond "owner approval" | none (the $40 cap is unchanged by design) | silent until a person acts | 8 window extensions, last 2026-11-03 (`ext_dates.txt`) | DELETE the approval step (G-10) |
| Pre-2026-11-11 jobs need triage "qualified"; "unclaimed" jobs | `teamJobAccess.ts:131-134`; `websiteSceneSponsorship.ts:332-351` | older jobs' scene grants and the card's "Ready" label | owner 2026-11-11 ("until the owner decides") | none | silent hold | Firestore aggregate 4 | owner question (G-14) |
| Operator listing hold ("Stop showing this job") | `teamJobAccess.ts:234`, `jobCompanies.ts:273` | one job | nobody dated | privacy, only as an emergency brake | silent | 0 uses (D-09) | DELETE (D-09) |
| Rights review hold (`rights_review_status` needs_review or blocked) | `teamJobAccess.ts:176-182,235` | listing | Pipeline report | rights | silent | Firestore aggregate 5 | KEEP `blocked`. `needs_review` should flag, not hide, unless the Pipeline names a rights cause |
| The card's "Ready" stage | `teamJobAccess.ts:136-162`, `taskBrowse.ts:20-24` | the label only | retired trial (runnable proof) | none | card says "preparing" | all jobs | DELETE: derive it from the simulation download (G-09) |
| Large video (over 1 GB) | `websiteLargeVideoBlock.ts` | frames, so no clip and no listing | nobody chose the number | none | asks for a smaller video after the sweep notices | A-05 | FIX as in A-05 |

### 1b. The company's side (WebApp)

| Gate | file:line | Who asked | Hard stop | Production | Verdict |
|---|---|---|---|---|---|
| Blueprint approves each company | `admin-robot-team-access.ts:65-97` | doctrine "Blueprint approves a company once" | privacy: the site agreed to share with approved companies | 1 application ever (`robotTeamAccess` 1) | KEEP (B, D-08 simplify the screen) |
| Application Terms tick (never counts) | `companyTerms.ts:31-41` | planner G2 | none | — | DELETE (B-07) |
| Invitation link: email-bound, 7 days | `accountInvitations.ts:13-16` | privacy | privacy (binds approval to the address) | — | KEEP |
| Password at sign-up | `RobotTeamSignUpFlow.tsx:97` | nobody | none | — | DELETE (B-07) |
| Signed-in acceptance of the current Terms **and** current Privacy Policy | `companyTerms.ts:36-41`; `legalAcceptance.ts:339-370` | planner 18:50Z | rights: makes the Terms promise to the site true | Privacy changed 4 times in 9 days (2026-11-13.1 to 11-21.1) | KEEP one acceptance. A new version re-asks only when its text changes what a company may do (G-13) |
| Introduction re-checked at dispatch | `jobIntroductionGate.ts:41-59` | planner H2 | privacy (withdrawal); otherwise none | introductions 0 | SIMPLIFY: re-check only withdrawal and suspension (G-06) |
| Note required for "Need more details" | `companyResponses.ts:58-60` | site needs words | none, but it is the content | — | KEEP (B) |
| New-job email only to companies that accepted Terms before the job went out | `jobAutoSend.ts:50-52` | E4 | none | companySends 0 | FIX (B-03) |

### 1c. The Pipeline

| Gate | file:line | Blocks | Who asked | Hard stop | When it trips | Production | Verdict |
|---|---|---|---|---|---|---|---|
| Paid-preparation grant before anything runs (browser delivery) | `website_assessment_resume.py:154-206` | the whole preparation run, including normalization and the company clip | metered spend design | money, for the paid stages only | silent, retried | Atlas pass: clip current 2, no source 1 (journal 08:01Z) | SIMPLIFY: make the clip before the grant (G-02) |
| Privacy post-processing gate | `site_package_orchestrator.py:135-166`; `website_capture_preparation.py:124-133` | preparation, unless privacy processing verified | PIPE-03 | privacy | stage pending, retried | unknown | KEEP. It is the single place that proves the processing ran |
| Face blur for jobs before Privacy 2026-11-17.1 | `atlas_privacy_screen.py:49-50,178-196` | frames to World Labs | owner 2026-11-17 | privacy (the promise to those sites) | blurs (fails safe) | jobs under 2026-11-21.1 are blurred on `cbff06b` (IP-07) | KEEP, but list the closed set of versions that need blurring instead of the open set that do not (C-09, IP-07) |
| Recapture stops (8 codes) | `website_recapture_required.py:39-55`; `website_scene_handoff.py:530-536` | the room package; asks the site for a new video | nobody (review 2026-11-12) | none: "Nothing is bought" (`website_recapture_required.py:14-16`) | site asked to film again | 10.5 h hold on the real job (C-04) | DELETE as a stop; ship the room flagged (C-04 for 5 codes, G-03 for the other 3) |
| "Hold until 2 hours before the window ends" for unknown and bookkeeping codes | `website_scene_handoff.py:362-374,464,508-546` | the room package for up to about 7 days | owner 2026-11-17 (goes on) | none | job waits; Blueprint is paged | 9 intents held on `installed_source_installation_receipt_unavailable` (scene-progression journal, 06:35Z) | SIMPLIFY: ship flagged after one failed retry cycle (G-04) |
| Early task hold ("we can't simulate this kind of job yet") | WebApp `taskPreparationOutcome.ts:394-410` | the paid room and scene | review | money (no scene bought for a kind that cannot be simulated) | site told the simulation is held | Atlas `needs_input` 1 (reason unverified) | owner question: ship the room as filmed anyway? |
| Scene intake: $40 room for the intent | `internal-capture-worlds.ts:376-389`; `task_evaluation_scene_intake.scene_spend_budget` | paid scene work | owner 2026-11-19 | money | ships what it has, flagged `spending_cap_reached` | C-03 (an $18 phantom hold) | KEEP (load-bearing) |
| Scene progression: revoked or expired intent | `task_evaluation_scene_progression.py:684-686` | further paid attempts | rights or window | rights for `source_revoked`; none for window or bookkeeping causes | silent | rights 30, window 9, terminal 13 (door) | SIMPLIFY (G-05) |
| Scene progression: policy capability (trial checkpoints) | `task_evaluation_scene_progression.py:725` | intents | retired trial | none | `policy_canary_blocked` | 2 intents (`intents.json`) | DELETE (IP-06) |
| Company clip and simulation permission | `company_share_permission.py:1-45`; `website_company_simulation.py:1630-1645` | delivery to companies | owner 2026-11-12 | rights / privacy | not made, or taken back | clip not permitted 2, refused 1; simulation not permitted 2 | KEEP. The WebApp's check on every request is the load-bearing layer (G-11) |
| Deploy activation hold | AGENTS.md `:141-147` | deploys while paid work runs | D-08 | money (an in-flight paid attempt is retired by a deploy) | the deploy parks | `deploy_activation_hold: null` now | KEEP. Drop the time window (D-06) |
| Chain preflight | `blueprint-control-plane-preflight.service`; door `preflight` | nothing: it is a report, not a gate | D-04 says "not a health signal yet" | none | 108 "blockers" every 30 min | 108 blockers, 305 warnings | DELETE or make it a real alert (IP-17) |
| Owner success contract | `task_evaluation_owner_success_confirmation.py:1-30` | nothing on the website path | none | none | — | 1 record (2026-11-03) | DELETE (D-13) |
| Withdrawal deletion standing approval | `website_capture_withdrawal_automatic.py:24-31` | Pipeline deletion | Pipeline design | privacy, inverted: the approval delays deletion | copies stay | approval absent, 0 withdrawals | owner signs once (A-08, D-14) |
| Paid-resource admission (account monthly limit) | `account_monthly_spend.py` via `paid_resource_admission` | every paid call | owner 2026-11-07 / 11-12 / 11-20 | money | refused `account_monthly_spend_limit_reached` | $296.54 of $400, 74% (inventory) | KEEP (load-bearing) |
| GPU spend guard | `scripts/gpu_spend_guard.py:2322-2337` | orphaned GPUs | AGENTS.md | money (the reaper) | fails on retired RunPod | 4,844 failures (IP-02, D-01) | KEEP the reaper; delete the RunPod key (owner step) |

## 2. Doctrine sentence 1: what must be true before a company sees a job

Doctrine: "The job reaches companies once its description and playable, sound-free video are available."

Today all of the following must hold (`teamJobAccess.ts:222-262`, `loadCompanyJobAccess` `:268-291`, and the company gates):

On the job:

1. It is not an internal test job, is a site job and is not a Pipeline placeholder (`:226-229`).
2. The site has not withdrawn (`:233`). (Privacy: needed.)
3. No Blueprint operator hold (`:234`).
4. No rights hold: neither `blocked` nor **`needs_review`** from the Pipeline's report (`:235-236`).
5. The job's preparation did not end `authority_ended`. That includes **Blueprint's own 7-day window running out** while preparation was still retrying (`:237`, G-01).
6. The site has not closed or archived it (`:241`).
7. It did not end after the 7-day wait on the site (`:244`).
8. It is not development-only evidence and has no older dossier restriction (`:245-248`).
9. The recording grant is v4 or later and still stands (`:249`). (Rights: needed.)
10. The shared listing record `job-shared-2026-11-12` exists (`:250-251`).
11. The brief holds a real sentence (`:252`). (Doctrine: needed.)
12. A stored company clip exists for the **current** capture and is not internal-test only (`:253`, `:286-290`). Behind that one line, all of these must be true:
    - the video is under the 1 GB frame limit (A-05);
    - the storage trigger, Pub/Sub and the host's listener are up;
    - the WebApp issued the **paid-preparation grant**. That needs the grant policy to be configured and readable, the rights to stand, the task-context digest to match, and no no-grant ending (`website_assessment_resume.py:165-206`, G-02);
    - normalization ran inside the preparation run (`site_package_orchestrator.py:238-251`);
    - the next 60-second Atlas pass ran the clip step (`website_company_clip.py:57-60`). It "stops between captures for a hold, a quiesce or a new release", and deploys run about seven times a day (D-06);
    - the clip encoded under its size cap and its timeout;
    - the Pipeline's own live permission check said yes, and the takedown gate was open (`company_share_permission.py`);
    - the WebApp accepted the signed `company-clip` operation. One real job's clip was refused with `409 website_company_clip_not_permitted` (C-10).

On the company:

13. It applied and **a person at Blueprint approved it** (doctrine).
14. It opened the email-bound invitation within 7 days and created an account with a password (B-07).
15. Signed in, it accepted the **current** Terms **and** the current Privacy Policy. Each new version re-asks everyone unless someone writes an exemption entry (`legalAcceptance.ts:339-345`, G-13).
16. It is a deployment company, not a technology partner (`companyTerms.ts:36-41`).
17. To be emailed about the job, it must have accepted the Terms before the job was first listed, and must not have turned job emails off (`jobAutoSend.ts:50-52`, B-03).

Of these, 2, 9, 11, 13 and 15 trace to a hard stop or a doctrine line. Item 12 is doctrine. The rest of its chain, and items 4 (`needs_review`), 5 and 14, protect none of the three.

## 3. Doctrine sentence 2: where a person at Blueprint must act

Doctrine: "No person at Blueprint stands between a site's video and an introduction."

1. **Approving each company** (`admin-robot-team-access.ts:65-97`). Doctrine asks for it. Nothing reminds the approver (B-09).
2. **Extending a job's window or renewing its grant** through the door, with an owner approval reference (`sceneExecutionWindowExtension.ts`; `websiteSceneSponsorship.ts:523`). Used 8 times, last on 2026-11-03. Without it, a slow job ends `authority_ended` and leaves the companies' view (G-01, G-10).
3. **Fixing a fault while the job waits.** A wait on Blueprint pages the ops monitor and then "ends held" (`websiteJobWindowSweep.ts:31-33`, `betaOpsMonitor.ts:359`). A preparation fault holds the job until 2 hours before its window ends, with a page, waiting for a person to fix the cause (`website_scene_handoff.py:518-521`, G-04).
4. **Replaying a held job.** A recapture-coded hold needed an operator replay (C-04).
5. **Deploying.** A person requests every Pipeline deploy (D-08). Each new Privacy Policy version also needs a Pipeline code change and a deploy, or jobs are blurred and Anthropic object modelling is refused (`atlas_privacy_screen.py:42-50`, `artisan_provider_choice.py:36-39`, C-09).
6. **Reading replies to introduction emails.** They reach hello@ (A-01, B-01).
7. **Signing the withdrawal deletion approval** (A-08, D-14).
8. **Deciding about pre-2026-11-11 jobs.** Their scene grant still needs triage "qualified" "until the owner decides" (`websiteSceneSponsorship.ts:332-345`, G-14).
9. **Removing the RunPod key.** Until then the money guard reports blocked on every run (IP-02, D-01, C-14). Whether that also blocks paid teardown proofs is unverified.

Nudges that are not required for the job to move: a site's "this is wrong" on its success thresholds alerts Blueprint's team (`website_owner_success_confirmation.py:31-37`); the owner success contract (D-13); the operator listing hold and the hand-recorded sends (D-09).

## 4. Money: which layer is load-bearing

Pipeline `AGENTS.md:87-110` lists 21 rows. The WebApp adds the intake, email, upload and first-look caps, and the grants carry their own figures (C-11). For the same dollar:

| Layer | Value | Load-bearing? | Why |
|---|---|---|---|
| Job cap on the WebApp job ledger | $40 | **yes** | Every preparation reservation and scene intake is checked in one transaction (`websiteJobCeiling.ts:1-18`, `internal-capture-worlds.ts:376-389`) |
| Account monthly limit at paid admission | $300 ($400 in Nov) | **yes** | The only bound across jobs and overhead (`config/account_monthly_spend_limit.v1.json`) |
| GPU orphan reaper (spend guard) | fleet caps | **yes, as a reaper** | Kills instances no ledger knows about. Its $10/h, $100/day and $5,000 totals duplicate the monthly limit |
| First-look caps | $10 per review, $50 a day | **yes** | The first look reserves only on this daily cap (`betaAbuseCaps.ts:219-262`). `websiteJobCeiling.ts` reads scene intakes and screening runs, not site assessments, so "everything a job spends" (`AGENTS.md:92`) is not literally true. This is from code; whether another path also counts it is unverified |
| Intake cap: 5 a day | 5 jobs | partly | Stops one day of junk from using the month; per-IP and per-email are dead (G-08) |
| Scene budget per intent | ≤ $40 | no | A slice of the $40, enforced by the same ledger. Make it read the room left (C-11) |
| Grant figures: $25 preparation, $5 upstream, $20 scene; Atlas grant `maximum_cost_usd` and `maximum_requests` | — | no | "No longer read as money" (`AGENTS.md:94`), but sealed (C-11) |
| Atlas review per review | ≤ $5 | no | Inside the $40 |
| ARTISAN per object | $12 | no | Inside the $40 |
| GPU attempt | $6, $0.80/h | no | Inside the $40 |
| Astra per stage | $5–25 | no | That backend does not run for website jobs |
| Rigid robot-free probe | $1 | no | No website job feeds the lane (IP-13) |
| Screening per site and per candidate | $30, $4 | no | Trial dropped 2026-11-14; the `$4` module is deleted |
| Google Cloud project | $100/month | duplicate | Already counted in the account month |
| RunPod refusal | — | no | Provider retired; the guard still queries it |
| Vast credit page and launch check | $11; cap + $1 | no (operational) | Prepaid credit cannot overspend; this only avoids a failed launch |
| OpenAI page: $75/day, **$560/month** | alert | the month line is dead | $560 is above the $400 account limit (`provider_spend_alerts.py:92-93`) |
| World Labs page: $60/24 h, **$450/month** | alert | the month line is dead | $450 is above the $400 account limit (`provider_spend_alerts.py:94-95`) |
| Upload bytes | 20 GiB/day, 4 GiB/job | partly | Storage spend; keep the global cap |

## 5. Checks in CI and tests that pin things nobody asked for

- `server/tests/durable-daily-caps.test.ts:152` pins `{ global: 5, perIp: 20, perEmail: 5 }`. That keeps two caps that cannot trip at these defaults (G-08).
- `server/tests/capture-outbox.test.ts:209-216` pins the Reply-To override that puts Blueprint between the two sides (A-01).
- `e2e/onboarding-p1.spec.ts:190,213` and `client/tests/pages/SelfCaptureUpload.test.tsx:1631` pin the filler "Blueprint will update this job as the work progresses." (A-10).
- `tests/test_website_scene_handoff.py:1441` pins `LAST_CALL_SECONDS` equal across two modules. That pins the near-7-day hold rule (G-04).
- `tests/test_control_plane_stall_alarm.py:272` keeps the alarm's mirrored constants equal to the workers'. The mirror itself is fine. It would also pin the "every revocation is rights" mapping if a reason were never added (G-05).
- `client/tests/legalAcceptance.terms-current.test.ts` fails on every new Terms version until someone writes an exemption entry, and the default re-asks every company. This is a protected decision for the owner, not an edit (G-13).
- Protected guards I list only as owner questions, never as edits: `client/tests/publicClaims.guard.test.ts`, `client/tests/recordedStatements.guard.test.ts`, the bundle sentinels in `client/tests/build-output.test.ts`.

## Requirements ledger

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict (DELETE / MERGE / SIMPLIFY / KEEP) | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Honeypot | `inbound-request.ts:1032` | guard | bot jobs spend preparation money | KEEP | It protects money at no cost to people. |
| 15-minute intake limiter | `inbound-request.ts:330-335` | nobody named | nothing the daily cap does not cover | MERGE | |
| Daily intake cap, global 5 | `betaAbuseCaps.ts:46` | owner D-13 | one day of junk could use the month | KEEP | It is the cheapest bound on open-intake spend. |
| Daily intake cap per IP (20) and per email (5) | `betaAbuseCaps.ts:49-51` | nobody | nothing: they cannot trip before the global cap | DELETE | |
| Intake email caps | `betaAbuseCaps.ts:115-121` | Resend free plan | provider quota breach | KEEP | Provider term. |
| Upload cap per job | `betaAbuseCaps.ts:169` | nobody | nothing the global cap does not cover | MERGE | |
| Upload cap global | `betaAbuseCaps.ts:167` | nobody named | unbounded storage spend | KEEP | Money. |
| First-look caps $10 / $50 | `betaAbuseCaps.ts:221-231` | nobody named | first-look spend unbounded (it is not on the job ledger) | KEEP | Load-bearing until the first look is on the job ledger. |
| US-only capture | `captureResidency.ts:43` | Privacy Policy | collection without a transfer basis | KEEP | Privacy and law. |
| Recording statement v4 gate | `teamJobAccess.ts:249` | owner 2026-11-12 | sharing without the site's agreement | KEEP | Rights. |
| Shared listing record | `teamJobAccess.ts:250` | owner 2026-11-12 | duplicates the v4 grant | MERGE | |
| Job sentence (WebApp) | `teamJobAccess.ts:252` | owner 2026-11-20 | a packet with no job | KEEP | Doctrine. |
| Job sentence (Pipeline `require_task_named`) | `website_capture_preparation.py:15` | incident 2026-10-29 | paid reading of an unnamed job | KEEP | Money, and the form makes it unreachable for new jobs. |
| Brief confirmation step | `taskStatusProjection.ts:732` | owner 2026-11-07 | nothing for jobs typed on the form | DELETE | |
| `website_task_context_not_confirmed` as a revoking code | `taskEvaluationSceneIntake.ts:351` | nobody | a paid intent survives an unconfirmed brief | DELETE | |
| `/follow-up` success_target re-confirmation | `site-task-brief.ts:736-741` | owner 2026-11-07 | nothing (no client caller) | DELETE | |
| 7-day wait on the site | `websiteJobWindowEnding.ts:111` | owner 2026-11-20 | drafts wait forever (costs nothing) | KEEP | Owner direction. |
| Blueprint's 7-day window as a listing stop | `teamJobAccess.ts:237` | nobody | nothing; the $40 cap bounds money | DELETE | |
| Blueprint's 7-day window as a retry deadline | `websiteJobWindow.ts:26` | AGENTS.md (window is the deadline) | endless retries (bounded by $40 anyway) | KEEP | Doctrine names it as the retry deadline. |
| `consent_expired` code name for a time limit | `websiteSceneSponsorship.ts:327` | nobody | nothing | SIMPLIFY | |
| Window extension with owner approval | `sceneExecutionWindowExtension.ts:1` | nobody beyond approval | nothing; the cap is unchanged | DELETE | |
| Expired grant renewal by the owner | `websiteSceneSponsorship.ts:523` | nobody | nothing once the window no longer hides jobs | DELETE | |
| Pre-11-11 triage "qualified" | `teamJobAccess.ts:131` | owner 2026-11-11 (pending) | old jobs stay held | owner decides | |
| `website_scene_site_unclaimed` | `websiteSceneSponsorship.ts:349` | nobody (new jobs always have an owner id) | nothing | DELETE | |
| Operator listing hold | `teamJobAccess.ts:234` | nobody dated | nothing (0 uses) | DELETE | |
| Rights hold `blocked` | `teamJobAccess.ts:179` | Pipeline rights review | sharing a capture whose rights failed | KEEP | Rights. |
| Rights hold `needs_review` | `teamJobAccess.ts:180` | nobody named | an unreviewed state hides a job | SIMPLIFY | |
| Card "Ready" from runnable proof | `teamJobAccess.ts:136-162` | retired trial | a label | DELETE | |
| Company approval | `admin-robot-team-access.ts:65` | doctrine | sharing with anyone who signs up | KEEP | Privacy: what the site agreed to. |
| Email-bound invitation | `accountInvitations.ts:13` | privacy | a forwarded link opens jobs | KEEP | Privacy. |
| Company Terms + Privacy acceptance (signed in) | `companyTerms.ts:36-41` | planner 18:50Z | the Terms promise to the site is untrue | KEEP | Rights. |
| Re-acceptance on every new version by default | `legalAcceptance.ts:339-345` | nobody | companies keep jobs across a cosmetic change | SIMPLIFY | |
| Introduction dispatch re-check of Terms and listing | `jobIntroductionGate.ts:54-58` | planner H2 | an introduction the site pressed goes out | SIMPLIFY | |
| Introduction dispatch re-check of withdrawal | `jobIntroductionGate.ts:52-53` | doctrine | contact details sent after a withdrawal | KEEP | Privacy. |
| Paid-preparation grant before the company clip | `website_assessment_resume.py:154-206` | nobody for the clip | the free clip waits on a money admission | SIMPLIFY | |
| Company clip permission (Pipeline, 6 h recheck) | `company_share_permission.py:37-39` | owner 2026-11-12 | a taken-back basis lingers up to 12 h | KEEP | Rights; it also triggers take-back of stored copies. |
| WebApp per-request listing check on media | `teamJobAccess.ts:222` | doctrine | sharing after a withdrawal | KEEP | The load-bearing privacy layer. |
| Privacy post-processing gate | `site_package_orchestrator.py:135` | PIPE-03 | unverified processing reaches providers | KEEP | Privacy. |
| Face blur for older jobs | `atlas_privacy_screen.py:49` | owner 2026-11-17 | the promise to older sites breaks | KEEP | Privacy (simplify the list, C-09). |
| Recapture stops (8 codes) | `website_recapture_required.py:39-55` | nobody | nothing; the room is built | DELETE | |
| Hold until 2 h before window end | `website_scene_handoff.py:464,518-521` | owner 2026-11-17 | a fix gets the week | SIMPLIFY | |
| KEEP_HOLDING integrity suffixes | `website_scene_handoff.py:370-374` | nobody | a bookkeeping fault holds a job | SIMPLIFY | |
| Early task hold | `taskPreparationOutcome.ts:394-410` | review | room bought for an unsimulatable kind | owner decides | |
| Scene $40 room per intent | `internal-capture-worlds.ts:376` | owner 2026-11-19 | spend past the cap | KEEP | Money (load-bearing). |
| Trial policy capability gate | `task_evaluation_scene_progression.py:725` | retired trial | nothing | DELETE | |
| Stall alarm "rights" mapping by word | `control_plane_stall_alarm.py:160-169,547` | nobody | wrong counts | SIMPLIFY | |
| Revocation receipt without a reason | `task_evaluation_scene_intake.py:542-548` | nobody | the owner cannot tell a rights stop from bookkeeping | SIMPLIFY | |
| Account monthly limit | `config/account_monthly_spend_limit.v1.json` | owner 2026-11-07/12/20 | no cross-job bound | KEEP | Money (load-bearing). |
| GPU orphan reaper | `gpu_spend_guard.py` | AGENTS.md | runaway GPUs | KEEP | Money (load-bearing). |
| GPU fleet dollar caps | `blueprint-gpu-spend-guard.service` | AGENTS.md | nothing the monthly limit does not cover | DELETE | |
| Screening $30 / $4 | `screening_retained_ledger.py:33` | retired | nothing | DELETE | |
| Astra $5–25 | `task_evaluation_scene_configuration_runtime_budget.py:62-67` | backend not live | nothing | DELETE | |
| Rigid probe $1 | `rigid_robot_free_probe_lane.py:77` | lane unfed | nothing | DELETE | |
| ARTISAN $12, GPU attempt $6 / $0.80/h, Atlas review $5 | `AGENTS.md:93-98` | owner 2026-11-02 (ARTISAN) | one stage could use the job's $40 | MERGE into the $40 | |
| Grant dollar figures and attempt counts | `websiteSceneSponsorship.ts` (C-11) | none | nothing | DELETE | |
| GCP $100 guard | `gcp_monthly_budget_guard.py` | owner 2026-10-23 | duplicates the monthly limit | MERGE | |
| OpenAI $560 and World Labs $450 month pages | `provider_spend_alerts.py:93,95` | cost model | nothing (above the $400 limit) | DELETE | |
| Vast credit page and launch check | `provider_credit_admission.py` | AGENTS.md | a launch fails for credit | SIMPLIFY (alert only) | |
| Deploy activation hold | AGENTS.md `:141-147` | D-08 | a deploy retires a paid attempt | KEEP | Money in flight. |
| Deploy window 15:00 UTC | AGENTS.md `:141` | D-08 | nothing (D-06) | DELETE | |
| Chain preflight | preflight unit | D-04 | nothing: it gates nothing | DELETE | |
| Owner success contract | door kind | none | nothing (D-13) | DELETE | |
| Withdrawal deletion approval | `website_capture_withdrawal_automatic.py:24` | Pipeline design | deletion waits for a person | SIMPLIFY | |
| Note required for "Need more details" | `companyResponses.ts:58` | site's need | an empty answer | KEEP | The site can act only on words. |

## 6. Findings

Ids match `dim-gates.findings.json`.

### G-01 (P0, over-gated): Blueprint's 7-day work window hides a job from every company and cancels Introduce us

- The grant read answers `consent_expired` once the window passes (`websiteSceneSponsorship.ts:327`, `:854`). The window is time only: "Only time is set here. Caps, attempt counts, rights and consent are unchanged." (`websiteJobWindow.ts:17`).
- The Pipeline treats `consent_expired` as a permanent authority ending (`pubsub_handoff_listener.py:577`). It ends a preparation that was still retrying as `authority_ended` (`website_preparation_terminal.py:9-14`).
- `teamJobAccess.ts:237` closes such a job for every company (`authority_ended`). The comment five lines below says the opposite was intended: "A wait on Blueprint that ran out holds only the simulation; the job stays listed" (`:242-243`). The introduction transaction and the dispatch gate re-check the same rule (`jobIntroductions.ts:109`, `jobIntroductionGate.ts:56-58`), so Introduce us is refused too.
- Who trips it: any job whose preparation was still retrying when Blueprint's window ran out. That is Blueprint's slowness, not the site's choice. The real job in journey C spent 16.3 hours in preparation, 10.5 of them in a hold.
- Production: 7 scene intents end `scene_intake_authority_expired`; the alarm counts 9 as `execution_window` (door). How many listings are closed for `authority_ended` needs Firestore aggregate 6.
- Journey A's ledger kept the window "because it bounds spend". The file says otherwise; the $40 cap is the money bound.
- Fix: remove the `authority_ended` stop from `teamJobAccess` (keep withdrawal and rights). Rename the window's code from `consent_expired` to `job_window_ended` in both repositories, so that a time limit never reads as consent.

### G-02 (P1, over-gated): A job reaches companies only after Blueprint admits paid preparation

- Listing needs the stored company clip (`teamJobAccess.ts:253`, `:286-290`).
- The clip is local ffmpeg at no cost (`website_company_clip.py:1-60`). But it waits for normalization, and normalization runs inside the preparation run (`site_package_orchestrator.py:238-251`).
- For a browser delivery, that run starts only after `admit_browser_preparation` gets the paid-preparation grant from the WebApp (`website_assessment_resume.py:154-206`, called at `pubsub_handoff_scene_operations.py:355-364`). The grant needs, among other things, a readable grant policy (`website_scene_sponsorship_not_configured`, `websiteSceneSponsorship.ts:138`) and a matching task context.
- So a money admission, a configuration read and the host's preparation queue stand between a sound-free video and the companies. Journey C measured the wait: 55 to 65 minutes on test jobs and 25.3 hours on the real one (C-08).
- Fix: build the clip from the raw upload at hand-off, before any grant. Do it in the listener or in the storage Cloud Function, under the same rights check. That is C-08's proposal, plus moving it ahead of the grant.

### G-03 (P1, over-gated): Three more recapture codes throw away a built room

- C-04 covers the five registration codes. The others in `CODES` are `website_front_normal_undetermined` (the object was filmed only from above), `website_task_object_not_observed` and `website_capture_frames_unusable` (`website_recapture_required.py:39-55`).
- Each ends the preparation at once and asks the site for a new video. "Nothing is bought: the stop is found after the scene is built" (`:14-16`). `goes_on` refuses to ship the room for any recapture code (`website_scene_handoff.py:530-536`).
- Doctrine says the room step "ships the room as filmed, flagged, for anything else" (`AGENTS.md:29-31`).
- Fix: route all eight codes to the ship-flagged rule. Keep the new-video request as an optional line on the job page. Exception: `frames_unusable`, where nothing usable exists; it stays a request, and the job stays listed meanwhile.

### G-04 (P1, slow): Any unknown or bookkeeping blocker holds the job until 2 hours before its 7-day window ends

- `goes_on` ships at once only for scene or wording facts. For "everything else, an unknown code included (a configuration fault, a missing key or profile, a website refusal, an outage, a defect)", it waits until the window "ends within `LAST_CALL_SECONDS`" (2 hours) (`website_scene_handoff.py:512-521`, `:464`).
- Integrity suffixes (`_changed`, `_mismatch`, `_pending`, `_not_ready` …) and five named codes keep holding for good (`:362-374`).
- Production: the scene-progression journal shows 9 intents held on `installed_source_installation_receipt_unavailable` / `scene_configuration_submission_input_file_invalid`, every pass (06:35Z line). That is a Blueprint record fault, not a fact about the job.
- None of these protects privacy, rights or money. The wait gives a person up to a week to fix the cause.
- Fix: ship flagged after the first failed retry cycle of `job_retry_policy`, page as today, and rebuild if a fix lands. The test pin `tests/test_website_scene_handoff.py:1441` moves with it.

### G-05 (P1, unseen): The alarm's "30 rights holds" are September revocations, and a revocation never says why

- The stall check counts scene progression as `execution_window 9, rights 30, terminal 13` (door).
- Aggregated from the intent store: all 30 "rights" rows are `blocked/authority/scene_intake_authority_revoked` with a `revoked.json`. Their dates: 2026-09-07 (18), 09-08 (7), 09-09 (1), 09-12 (2), 09-16 (1), 11-02 (1) (`ext_dates.txt`).
- The alarm calls any revocation "rights" (`control_plane_stall_alarm.py:160-169`, `:547-548`). The WebApp revokes for its own reasons too: `website_task_context_not_confirmed`, `task_brief_missing`, `task_context_capture_mismatch`, `supplement_not_requested`, binding failures and a confirmed grant change (`taskEvaluationSceneIntake.ts:343-352`, `:819-833`). "A revocation receipt carries no reason" (`:819-821`), and the Pipeline receipt has no reason field (`task_evaluation_scene_intake.py:542-548`).
- So the owner reads 30 rights stops when the true count of site withdrawals is unknown. The journal repeats the code 3,694 times in 2,000 lines over 7 days.
- Fix: send the cause with the revoke (`source_revoked` versus Blueprint's own codes), count only `source_revoked` as rights, and retire intents older than their window.

### G-06 (P1, over-gated): An introduction the site pressed is cancelled if the company's Terms went stale or the job left the list for a non-privacy reason

- At dispatch, `introductionMayProceed` refuses `company_not_approved` when the company's acceptance is no longer current. It also refuses `job_not_shared` when `teamJobAccess` no longer lists the job (`jobIntroductionGate.ts:54-58`).
- A Privacy Policy version bump makes every acceptance stale unless an exemption entry is written (`legalAcceptance.ts:339-345`). The listing can drop for Blueprint's window (G-01), a clip take-back or a `needs_review`.
- The company already agreed to share its details when it answered (`companyResponses.ts:72-76`), and the site pressed the button. A withdrawal or a suspension are the privacy reasons to stop. The others are not.
- Fix: at dispatch, re-check only withdrawal and a revoked approval.

### G-07 (P1, business): About 25 spend limits protect the same dollars; four are load-bearing

See section 4. Load-bearing: the $40 job ledger, the account monthly limit, the GPU orphan reaper, and the first-look caps. The first look is outside the job ledger (`websiteJobCeiling.ts:42-60` reads scene intakes and screening runs; `betaAbuseCaps.ts:219-262` reserves the first look on a daily cap). So `AGENTS.md:92` "everything a job spends" is not literally true; that part is unverified beyond the code read.

Dead or duplicate:

- screening $30 and $4;
- Astra $5–25;
- rigid probe $1;
- ARTISAN $12, GPU attempt $6 and $0.80/h, Atlas review $5;
- the grant figures (C-11);
- fleet $10/h, $100/day and $5,000;
- the GCP $100 guard;
- RunPod;
- the OpenAI $560 and World Labs $450 month pages, both above the $400 limit;
- the Vast credit checks.

This needs the owner: every change is a money decision.

### G-08 (P2, over-gated): Two of the three daily intake caps can never trip, and a test pins them

- Defaults: global 5, per IP 20, per email 5 (`betaAbuseCaps.ts:44-52`). With a global cap of 5, a per-IP cap of 20 can never trip first, and the per-email cap of 5 trips only together with the global one.
- On top sits a 15-minute limiter of 10 per IP and 3 per email (`inbound-request.ts:330-335`).
- `server/tests/durable-daily-caps.test.ts:152` pins the three numbers.
- Fix: keep the global cap (owner D-13) and the honeypot. Delete the per-IP and per-email daily caps and the per-IP limiter. Keep the 3-per-15-minutes email limiter only if the owner wants it.

### G-09 (P2, vestigial): The card's "Ready" stage still comes from the retired trial's runnable proof

- `evaluationAvailable` comes from `isRunnableTask`: the screen's "qualified" disposition, brief confirmation, gate answers, a built world manifest, and `sceneRunnableReadiness` ("an internal proof that our harness can load and step it") (`teamJobAccess.ts:97-162`).
- `taskBrowse.ts:20-24` turns that into the card's `stage: "ready"`. The filter uses `simulationDownloadAvailable` instead (`TaskBrowse.tsx:83`). So the same card can disagree with itself.
- Fix: derive "Ready to test" from the simulation download only, and delete `isRunnableTask`.

### G-10 (P1, friction): A person must approve each window extension, though an extension moves only time

- Extensions need an owner approval reference through the door (`sceneExecutionWindowExtension.ts:1-9`). An expired grant is renewed by the owner (`websiteSceneSponsorship.ts:523`).
- Neither changes a cap ("Nothing here changes a spend cap", `:8-9`).
- Production: 8 window extensions (2026-09-08 to 11-03). There are also 52 budget-extension records on 12 intents (last 2026-11-02) and 5 standing-budget extensions (2026-11-12/13), all before the 2026-11-19 rule that nothing extends the cap (`ext_dates.txt`).
- Fix: once G-01 lands, a window ending only stops paid work, which the $40 cap bounds anyway. Delete the extension request kind and the renewal path, or make renewal automatic while the job is under its cap.

### G-11 (P2, over-gated): Three layers protect the same consent for the company clip; one is load-bearing

1. The WebApp checks `teamJobAccess` on every company request, media included (`teamJobAccess.ts:217-221`). This is the **load-bearing** layer: a withdrawal closes it in the same transaction (A).
2. The Pipeline re-reads the live rights every 6 hours and takes copies back (`company_share_permission.py:37-39`).
3. The Pipeline checks a delivery-time takedown gate (`website_company_simulation.py:1640-1641`).

Layers 2 and 3 also decide whether a clip is made at all. That is where the real job's clip ended `not_permitted` (C-10). Recommendation: keep 1. Keep 2 only as the trigger that deletes stored copies after a withdrawal. Ask the owner whether 3 is needed. Privacy: this needs the owner.

### G-12 (P2, fragile): Tests pin gates and wording nobody asked for

See section 5. The new items are the cap-defaults pin (G-08) and the `LAST_CALL_SECONDS` pin (G-04). The others are in A-01 and A-10. Protected guards are owner questions only.

### G-13 (P2, over-gated): By default every new Terms or Privacy version locks every company out of every job

- `companyMaySeeJobs` needs both current versions (`companyTerms.ts:36-41`). A new Terms version inherits no exemption, so "everyone, deployment companies included, is asked again" until someone writes an entry (`legalAcceptance.ts:339-345`). The same applies to Privacy (`:336-337`).
- Until the company presses "I agree", it sees no jobs and gets no new-job email (B-07 notes the prompt).
- The Privacy Policy changed 4 times between 2026-11-13 and 2026-11-21. With one approved company the impact is small today; it grows with every company.
- Fix (owner): the default for a new version should be "counts unless it changes what a company may do". This is a legal decision; do not edit the guard test.

### G-14 (P2, over-gated): Jobs from before 2026-11-11 still wait for an owner decision

- `screenAllowsSupply` and `website_scene_site_not_qualified` keep needing triage "qualified" for jobs uploaded before the owner's 2026-11-11 decision, "until the owner decides" (`teamJobAccess.ts:115-134`, `websiteSceneSponsorship.ts:332-345`).
- `website_scene_site_unclaimed` (`:349`) can only trip on jobs from before every job got a synthetic owner id (`websiteCaptureOwner.ts:12-15`).
- How many jobs are affected needs Firestore aggregate 4.
- Recommendation: apply the 2026-11-11 rule to every job, or close those jobs. Needs the owner.

## Deletions I expect might come back

- **The recapture stops (G-03).** A company may reject rooms with a misplaced object, and the owner may want the new-video request back as a stop for `frames_unusable`.
- **The per-email intake limiter (G-08).** If an outreach burst triggers abuse.
- **The Pipeline's 6-hour consent recheck (G-11).** If the owner wants stored copies taken back without waiting for a withdrawal event.
- **Window extensions (G-10).** If the owner wants a hard end to retries for cost reasons beyond the $40.

## Firestore aggregates wanted

Read-only, non-personal fields only.

1. `durableDailyCaps` (collection named by `DURABLE_DAILY_CAPS_COLLECTION` in `server/utils/durableDailyCaps.ts`): for scope `inbound_intake`, count of days on which each cap (`intake_global`, `intake_ip`, `intake_email`) reached its limit, since 2026-11-01. Same for `model_review_spend_micro_usd` and `upload_bytes_*`.
2. `inboundRequests` where `request.buyerType == "site_operator"`: count by `request.consent_attestation.statement_version` (and how many lack a `public_task_listing`).
3. `inboundRequests`: count where `website_job_no_grant_ending` exists, grouped by `.waiting_on` and `.reason`.
4. `inboundRequests` where `site_task_triage.disposition != "qualified"` and the scene-screen-gate-ended marker is absent: count. (G-14)
5. `inboundRequests`: count by `evaluation_readiness.rights_review_status` and `pipeline.rights_review_status`.
6. `captureUploadSessions`: count by `website_preparation.status.state`, and for `authority_ended` the count by terminal code if stored. (G-01)
7. `taskEvaluationSceneIntakes`: count by `state` and by `revocation_cause` (null counts separately). (G-05)
8. `inboundRequests/*/introductions`: count where `cancelledAtIso` exists, grouped by stop reason (0 introductions exist today, so expect 0).

## What works well and should be left alone

- **One predicate for company visibility** (`teamJobAccess`), checked on every surface and inside the introduction transaction. Fixing G-01 and G-06 is a two-line change because of it.
- **The $40 cap is enforced in one WebApp transaction** with the job ledger (`internal-capture-worlds.ts:376-389`). At the cap the job ships flagged and waits for no one (`website_scene_handoff.py:542-543`).
- **Face blur fails safe** for any version it does not know (`atlas_privacy_screen.py:178-196`).
- **The withdrawal path** closes the listing in the same transaction as the withdrawal (A).
- **Owner success thresholds no longer hold anything**: "nothing waits for the owner" (`website_owner_success_confirmation.py:1-8`).

## Not covered

- Production counts that need Firestore (aggregates above): how often the intake caps tripped, how many listings are closed per reason, how many jobs hold older statements.
- The reason of the one Atlas `needs_input` job (it would mean reading the job's state file).
- Whether the spend guard's blocked status also blocks the reconciler's teardown proofs (`task_evaluation_launch_reconciler.py:375-392` reads its own receipts). Unverified.
- Host env overrides (`/etc/blueprint/*.env`, Render values), so the deployed values of the WebApp caps and the Atlas review cap are unverified.
- I ran no tests or servers. Everything comes from code reads and door reads.
- Journey E (investor demo) had not reported when I wrote this.
