# Fragility and retries (agent `dim-fragile`)

Audit date 2026-11-22. WebApp at `0ee5df6` (live). Pipeline at HEAD `7d8b532`; the host runs `cbff06b`.
Findings `F-01` to `F-18` are in `dim-fragile.findings.json`. This report builds on the inventories
(`IW-*`, `IP-*`) and journeys A and B (`A-*`, `B-*`), and cites them instead of repeating them.

Nothing here read a site's video, frames, name, address, contact details or job sentence.
Door use was read-only (`cat` of one unit-failure record, `journal` of one unit, the saved `status`).
Every local server ran with the Firebase credential blanked, on ports 4411 to 4416.
Scratch files: `/tmp/claude-0/-home-user/e3989091-e008-5b78-a9cb-b7c31a5efdb8/scratchpad/agents/dim-fragile/`.

## The short version

- The WebApp side is sturdier than the Pipeline side. The WebApp ends every job itself when its window
  passes, its sends are idempotent and catch up after downtime, and it notices within two hours when an
  upload never reaches the Pipeline.
- The one Pipeline host keeps every job state and money record with **no backup**. The backup unit is
  skipped every 15 minutes because its bucket file was never installed, and the alarm treats "never set
  up" as quiet (F-01).
- Some failures end work for good: a provider key or billing refusal fails every in-flight room build
  (F-02); a 36-hour email outage cancels introductions the site can never ask for again (F-03).
- Some failures stop silently: outcome questions skip a job the site closed (F-04); one heartbeat
  covers seven worker loops (F-11); the spend guard has paged the same failure about 200 times (F-07).
- Several stuck states still have only an operator command or a deploy as the exit (F-10).
- Of the two known red browser tests, **both are wrong tests, not product bugs** (F-13, F-14). The core
  journey test checks emails only as queued, which is how the Reply-To bug (A-01) passed (F-15).

## 1. Every stage, worker and loop: failure, deadline, exit

Pipeline stage numbers follow `inventory-pipeline.md` section 1.

| Stage / loop | On failure | Deadline | Can a job sit forever with no retry and no message? | Exit today |
|---|---|---|---|---|
| P1 Upload hand-off (`extractFrames`, third repo) | Pub/Sub redelivery, then host retry | none in either repo | No: the WebApp's watch pages after 2 h with no Pipeline status (`websitePreparationWatch.ts:62-63`) | automatic; F-18 |
| P2 Preparation (listener + `website_preparation_retry`) | outage or money: every 2 min growing to 1 h; other: six retries (15 min to 24 h), then "left as it is" (`beta-operations.md:136-140`) | the grant's window | It sits after six retries until the window ends; the WebApp window sweep then ends it with a message | WebApp sweep, or `door selected-handoff --resume-preparation` (F-10) |
| P3 Room build (`website_atlas_preview`) | `job_retry_policy`; a 4xx other than 408/409/425/429 fails now (`job_retry_policy.py:176,192-200`) | 7 days (`MAXIMUM_JOB_SECONDS`) | A failed or parked job is never stepped again and never pages (`beta-operations.md:64-73`) | `door selected-handoff --atlas-retry`, per job (F-02, F-10) |
| P4 Object isolation | inside P2/P3 | job window | as P2/P3 | as P2/P3 |
| P5 Scene intent intake (always-on service) | WebApp re-POSTs until the window ends | job window | No | automatic |
| P6 Launch preparation worker | own rule (IP-18) | intent window | 9 intents sit in `execution_window`, 30 in `rights` (door stall section) | `door extend-scene-execution-window` (owner) for expiry (F-10) |
| P7 Activation and dispatcher (paid GPU) | intent's `max_retries`, $0 recovery up to six times | `TimeoutStartSec` 255 min / 9 h | `spend_unproven` is never retried; `dispatcher_lost` needs a person (`beta-operations.md:114-115`) | by hand (F-10) |
| P8 Reconciler (teardown proof) | exit 2 while proving | none | Not blocked by the RunPod failure: a launch's narrower provider scope is accepted (`task_evaluation_launch_evidence_contracts.py:66-79`) | automatic |
| P9 Team scene half | `job_retry_policy` | none found | queue empty today | automatic |
| P11 Company clip and simulation | counted, re-checked every pass | none | Yes: `no_source` stays a count for ever (`website_company_simulation.py:1919-1921`) | none (F-17) |
| P12 Held-job sentences | n/a | job window | No | automatic |
| W-T1 Email outbox (web process) | backoff 1 min to 1 h; failed after 36 h; "unknown" rows never re-sent | 36 h / provider window | No: failures alert once (`betaOpsMonitor.ts`) | automatic, but a failed introduction is final (F-03) |
| W-T6 Job window sweep (worker) | next pass | n/a | No | automatic |
| W-T7 Automatic send (worker) | next pass (sweep with cursor) | none needed | No, but a hung pass is invisible (F-11) | automatic |
| W-T8 Outcome questions (worker) | next pass, every 15 min | 14/45/90 days | Yes, silently, when the job is no longer listed (F-04) | none |
| W-T4/T5 Withdrawal and deletion (worker) | next pass | none | Pipeline deletion waits on an owner approval (A-08) | owner |

### Operator commands that are today the only way forward

Doctrine: "never make a deploy or an operator command the only way to retry". These break it (F-10):

1. A failed or parked room build: `door selected-handoff --atlas-retry --atlas-status-digest <d>`.
   Includes every job failed by a 401/402/403 from a provider (F-02).
2. An expired scene execution window: `door extend-scene-execution-window` (plan, then `--apply`,
   with an owner approval reference). Nine intents are in that state now.
3. `scene_configuration_launch_result_missing_spend_unproven`: "Settle by hand only with a provider bill."
4. `scene_configuration_launch_dispatcher_lost`: read the journal and the inventory by hand.
5. `website_preparation_blueprint_fault`: "Fix the cause in a release"; the fix must be live before the
   window's last two hours. A deploy is the only retry.
6. A preparation from before the retry release with no kept message bytes:
   `door selected-handoff --resume-preparation`.
7. Turning on release adoption: only SSH from the owner's Mac can edit the host env file.
8. Withdrawal deletion in the Pipeline: waits on an owner standing approval (A-08).

## 2. The WebApp worker loops if the worker is down for a day

- **Automatic send.** Caught up, not skipped, not duplicated. The send at listing time runs in the web
  process (`sendJobToCompaniesIfListed`); the worker sweep catches anything missed. A transaction plus the
  `company_auto_send` marker makes it once only (`jobAutoSend.ts:37-86`).
- **Outcome questions.** Caught up. Each question has a fixed outbox id by job, company, side and day
  (`jobOutcomeGate.ts:79-81`). A gap longer than a whole step sends only the latest due question
  (`dueOutcomeQuestionDay`), which is fine. The real gap is F-04: a job that is no longer listed is skipped.
- **Job-window sweep.** Caught up, 25 jobs a minute with a cursor. Idempotent: the ending is written once.
- **Email outbox.** Runs in the **web** process, not the worker (`server/index.ts:530`). Rows wait and
  are sent later; after 36 hours undelivered they fail (`captureOutboxRetry.ts:29`). A failed company
  introduction email cancels the introduction for good (F-03).
- **Heartbeat.** One heartbeat for seven loops (F-11).

**IW-03, what breaks if someone trusts the deploy config (F-12).** `render.yaml:31-33` says the worker is
"constrained to Task Evaluation launch reconciliation". The flag it sets only changes a log line
(`worker.ts:36-45`). Someone who trusts it might suspend the worker to save money. That would stop
withdrawals and Storage deletions (privacy), job endings, automatic sends and outcome questions. Two
processes cannot run the same loop at once, because the lease falls back to Firestore without Redis
(`automationLeaderLease.ts:148-171`). So a second worker would not double-send.

## 3. Single points of failure and who is told

| Point | What is monitored | Who is told | What the site sees meanwhile |
|---|---|---|---|
| Control-plane host (one droplet) | Render cron probes the intake `healthz` every 10 min; the capacity controller and unit-failure notifier post to `BLUEPRINT_OPERATOR_ALERT_WEBHOOK_URL` | the operator webhook (configured: the guard record shows hourly posts) | "taking longer than it should" after 2 h; an ending after the window. **No state backup (F-01).** |
| `extractFrames` (BlueprintCapture) | nothing directly | ops, through the WebApp's 2-hour first-status watch | the same |
| Pub/Sub | nothing directly | the same watch | the same |
| Render web | Render health check `/health`; the uptime cron (Slack); the GitHub uptime workflow (every few hours) | Slack (webhook configured: unknown) | the site is down; **email also stops**, because the outbox runs here |
| Render worker | heartbeat stale after 5 min, checked by the web process | Slack and ops email | sends and endings pause and then catch up |
| Redis | not used (waived, `render.yaml:23-29`) | n/a | n/a |
| Resend | outbox backlog alert (count or age) | Slack and **ops email, which also goes through Resend** | emails wait; after 36 h, failed (F-03) |
| Firebase | readiness check | deploy workflow, monitor | everything stops |

## 4. Provider errors

- **World Labs, Gemini, Meta SAM, OpenAI.** All go through `job_retry_policy`. Outages (429, 5xx,
  timeouts) wait and retry until the job's deadline. Statuses 408, 409, 425 and 429 retry later. Any
  other 4xx means "cannot succeed": the step fails now (`job_retry_policy.py:192-200`). A revoked key
  (401), an unpaid account (402) or a lost permission (403) is a Blueprint-side outage treated as
  permanent. Every job that hits it ends, and none pages. Only a per-job door command reopens them (F-02).
- **Vast.** The runbook's $0 recovery classes (no offer, staging error, inventory query error, watchdog,
  stale spend report) wait and make a $0 successor, up to six times. A launch whose spend cannot be
  proven is never retried (F-10). I did not trace the 10,327-line adapter.
- **What the site reads.** The room build's failure sentence is "A 3D preview could not be made from
  this recording." (`websiteAtlasPreview.ts:122-127`). That blames the recording for a Blueprint key
  problem. I found no client component that renders it today (`grep statusText`, no match), so the site
  most likely sees the general job status until the window sweep ends the job. Unverified.

## 5. The deploy window

- A deploy retires and rebuilds every in-flight website attempt that has not launched paid work.
  That costs about 15 minutes of preparation plus about an hour of activation (`beta-operations.md:671-676`).
- The door parks a deploy while paid work is in flight: up to 285 minutes for paid stages, 60 minutes
  for unpaid ones. Each paid call keeps its receipt, so a rebuild buys nothing twice. That part is good.
- What a job loses: time. On 2026-11-19/20 the host took five deploys in 21.5 hours (door receipts:
  20:16Z, 20:59Z, 23:16Z, 03:09Z, 17:49Z). Only `docs/launch-readiness/` is exempt from the rebuild
  (`operator_door.py:98`). The next deploy (`cbff06b..HEAD`) changes 22 files, 18 of them tests or docs.
  Adoption across a deploy is off, and only the owner's Mac can turn it on (F-09).
- What can go wrong: a `website_preparation_blueprint_fault` needs its fix deployed before the window's
  last two hours. Fast deploys help that and hurt every other job.

## 6. Tests

### e2e/site-intake-durability.spec.ts, A-IDB-04: the test is wrong (F-13)

`npx playwright test -c <scratch>/pw.idb.config.ts -g A-IDB` against my own dev server on port 4414 gave
9 passed and 1 failed. A-IDB-04 expected `{refused: true, localUnchanged: true, mirrorUnchanged: true}`
and received all `false`. Root cause: #1286 (`7079338e`, 2026-11-13) deliberately changed hydration.
When the localStorage copy and the IndexedDB mirror disagree, it now resets both to a fresh draft instead
of refusing (`siteCaptureDraft.ts:194-201`). The commit message gives the reason: the old refusal left
"clear this browser's draft" as the only way out. The test was not updated because the suite never runs
in CI (IW-06).

### e2e/cookie-consent.spec.ts line 53: the test is in the wrong config (F-14)

- Default config, development server (port 4413): 3 passed, 1 failed at line 72
  (`expect.poll(requests.length) > 0`, received 0).
- Default config with `BLUEPRINT_E2E_STATIC=1`, as CI runs it (port 4412): 4 passed. With
  `--repeat-each=4 --workers=2` it also passed 4 out of 4.
- A copy of the privacy config (`VITE_ENABLE_ANALYTICS=1`, port 4411): 4 passed.

Root cause: `analytics.ts:53-55` turns analytics off in development builds unless
`VITE_ENABLE_ANALYTICS` is set. The privacy config sets it; the default config does not. So the product
is right, and the test fails only when run locally under the default config. Also note that the test's
"stays off" checks wait a fixed 2.8 s. A late analytics load after that would pass unseen.

### Other tests

- Three site-intake suites never run in CI (IW-06). One of them already rotted (A-IDB-04).
- The Pipeline's nightly full lane: red on 2026-11-18, 19, 20 and 21 (runs 44356749345, 44576571521,
  44778664583, 44923019149), green 11-14 to 11-17. Each night a different single test fails.
  Iteration deploys skip this lane (`OPERATOR_DOOR.md:441-449`), and the workflow notifies nobody. So it
  guards nothing (F-16).
- **Tests that pass while the product fails.**
  - The core journey checks introduction and outcome emails as queued outbox rows, never sent. The
    scheduler is off, and the outcome sweep is called through a test route (F-15). Journey A found
    that `capture-outbox.test.ts:209-216` pins the Reply-To override (A-01).
  - `server/tests/job-outcomes.test.ts:137-142` pins the silent skip of a job that is no longer
    listed (F-04).
  - `e2e/site-answer.spec.ts` (15 route mocks) and `site-private-link-reliability.spec.ts` (14) test
    the site's page mostly through `page.route` mocks. The emulator-backed core journey covers the main
    path, so this is a smaller risk.
  - `e2e/job-outcomes.spec.ts` checks only the confirm and thank-you pages with a hand-made token.

## 7. Uploads from phones

- **Filming in the page** (`CaptureRecorder.tsx`). A part is sent every 4 s. Each part gets 4 attempts
  with backoff and a 60 s timeout, then the page asks the site to press resume. The parts already sent
  are safe on the server. Parts still waiting live only in page memory. A closed tab or a discarded
  background tab loses them. Nothing reacts to the camera track ending when the phone locks. After a
  reload there is no way to continue: `GET /:token/parts` exists on the server but has no caller (F-06).
- **Picking a saved video** (`selfCaptureVideo.ts:115-160`). The whole file goes in one request, with no
  parts and no resume. The client gives up after 15 minutes. The server does not set `requestTimeout`,
  so Node 22's default of 300 s applies: the server drops any request not fully received within
  5 minutes. Measured: a 408 after 330 s (details at the end of this section). At 10 Mbit/s that caps an upload at about 375 MB, and at
  5 Mbit/s about 190 MB. Above that the upload fails and restarts from zero (F-05). This adds to A-05
  (1 GB to 2 GiB accepted, then never processed).
- **The IndexedDB draft** keeps the form fields (task, place, ids, retry token), never the video, and
  never a signed URL (A-IDB-05 passes). After #1286 a conflict between the two copies starts a fresh
  draft. A pending create in flight could then lose its retry token and make a second job. Unverified.

Measured server cut: a default `http.createServer` on Node v22.23.5 got a 400 MB POST at about
640 KB/s (about 5 Mbit/s). It answered `408` after 330.0 s, with about 210 MB received
(`slowpost.out` in the scratch folder). `server/index.ts:5` creates its server the same way and never
sets `requestTimeout`. Render's proxy in front was not measured.

## 8. Money and privacy guards that are failing

- **GPU spend guard (IP-02, F-07).** Still working: Vast, DigitalOcean and GCP are inventoried, orphans
  are reaped (`reap_mode: true`), paid admission stays open, and teardown proofs close on their narrower
  scope. Lost: the RunPod inventory, which is unimportant because RunPod launch is refused, and, more
  importantly, **the alarm's meaning**. The unit fails every run and pages once an hour (failure 4,855
  at 15:37Z, last post at 15:32Z), so a new real cause on the same unit would look the same. It also uses
  about 36 s of CPU every run on a 4-CPU host.
- **Privacy version list (IP-07, F-08).** A job started under Privacy 2026-11-21.1 (live since
  2026-11-21 01:45Z) is blurred, and that first decision is sealed for the capture
  (`atlas_privacy_screen.py:236-252`). So those jobs stay blurred even after HEAD deploys. This is safe
  for privacy, but it contradicts the doctrine sentence, and each new Privacy wording needs edits to two
  Python lists plus a deploy.

## Requirements ledger

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| WebApp job-window sweep | webapp:server/utils/websiteJobWindowSweep.ts | doctrine "everything else is flagged and keeps going"; owner 2026-11-19/20 | jobs wait for ever when the Pipeline goes quiet | KEEP | It is the only thing that guarantees every site gets an ending. |
| Upload first-status watch (2 h) | webapp:server/utils/websitePreparationWatch.ts:62 | beta L3/L6 | a lost upload is noticed only when a site complains | KEEP | It is the only monitor of extractFrames, Pub/Sub and the host from outside. |
| Automatic send sweep | webapp:server/utils/jobAutoSend.ts:106 | owner 2026-11-12 (package E4) | a job missed at listing time is never sent | KEEP | It is the catch-up for the one send the loop needs. |
| Outcome questions: listing condition | webapp:server/utils/jobOutcomeGate.ts:71-76 | nobody | nothing; questions would also reach closed jobs | DELETE | |
| Outcome sweep (14/45/90) | webapp:server/utils/jobOutcomes.ts:134 | doctrine | no follow-up | KEEP | It is in the core loop. |
| Outbox 36-hour age limit | webapp:server/utils/captureOutboxRetry.ts:29 | Resend quota reasoning in the comment | rows would retry for ever | KEEP | It bounds retries; the fix is to let an introduction be asked again (F-03), not the limit. |
| "Introduction never made again after a cancel" | webapp:server/utils/jobIntroductions.ts:118-121 | nobody (key reuse convenience) | a site could retry after Blueprint's email failure | DELETE | |
| One worker heartbeat | webapp:server/utils/workerHeartbeat.ts | comment worker.ts:57 | worker death unseen | SIMPLIFY | Replace with one record per loop (F-11). |
| `BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER` | webapp:render.yaml:53, server/worker.ts:22-45 | nobody | nothing | DELETE | |
| Single-request picked-file upload | webapp:client/src/lib/selfCaptureVideo.ts:115 | nobody | nothing; the parts route exists | MERGE | |
| `GET /:token/parts` with no caller | webapp:server/routes/self-capture-uploads.ts:1010 | nobody today | nothing | KEEP | It is the cheapest resume for F-05 and F-06; use it or delete it. |
| Control-plane state backup unit | pipeline:deploy/systemd/blueprint-control-plane-state-backup.service | AGENTS.md money records; runbook | host loss erases money and job records | KEEP | It is the only copy of the money records off the host. |
| Stall alarm "not_configured is quiet" | pipeline:src/blueprint_pipeline/control_plane_state_backup.py:556 | nobody | nothing; the owner would see the gap | DELETE | |
| 4xx = "cannot succeed" for 401/402/403 | pipeline:src/blueprint_pipeline/job_retry_policy.py:192 | nobody for 401/402 | jobs would wait as for an outage | SIMPLIFY | |
| Atlas per-job operator reopen | pipeline:docs/runbooks/beta-operations.md:64-73 | nobody (doctrine forbids it) | nothing once automatic retries exist | DELETE | |
| Scene execution window extension | pipeline door `extend-scene-execution-window` | owner approval reference | an expired job would end with what it has | DELETE | |
| Preparation "six retries, then left as it is" | pipeline:docs/runbooks/beta-operations.md:138 | nobody | nothing; the outage schedule runs to the grant end | SIMPLIFY | |
| Company package pass with no deadline | pipeline:src/blueprint_pipeline/website_atlas_preview.py:1121 | owner (packet has a simulation) | the package is never built | SIMPLIFY | Stop at the job window and say so (F-17). |
| RunPod required while its key exists | pipeline:scripts/gpu_spend_guard.py:2322-2337 | nobody since 2026-11-05 | an invisible RunPod orphan (none can be launched) | DELETE | |
| Hand-copied Privacy version lists (two) | pipeline:atlas_privacy_screen.py:49, artisan_provider_choice.py:39 | owner 2026-11-17 (the rule, not the list) | nothing once the grant carries the decision | DELETE | |
| Deploy rebuilds every in-flight attempt | pipeline:scripts/operator_door.py:98; release-binding.md | D-08 / release binding | a stale release could buy work; only for runtime files | SIMPLIFY | Keep for runtime files; exempt tests and docs (F-09). |
| Door parks a deploy during paid work | pipeline:deploy/operator-door/operator_door/activation_hold.py | money | a deploy could strand paid work | KEEP | It protects money already spent. |
| Nightly full test lane schedule | pipeline:.github/workflows/full-test-lane.yml:21 | nobody (production deploy uses workflow_call) | nothing; iteration deploys skip it | DELETE | |
| Three intake browser suites outside CI | webapp:playwright.intake*.config.ts | nobody runs them | nothing; one has already rotted | MERGE | Into CI or delete (F-13). |
| cookie-consent spec in the default config | webapp:playwright.config.ts | nobody (the privacy config runs it) | nothing | DELETE | |
| Core journey "queued" email assertions | webapp:e2e/site-answer-journey.spec.ts:359-390 | the journey's purpose | weaker coverage | SIMPLIFY | Assert sent payloads (F-15). |
| `extractFrames` in BlueprintCapture | webapp:README.md:11 | nobody (kept from the capture app) | the WebApp would write the hand-off itself | DELETE | |

Deletions I expect might come back: the execution-window extension, if the owner wants to rescue a
valuable job by hand; the nightly full lane, if regressions slip past the impacted set; and the
`GET /parts` route, if F-05 and F-06 are built another way.

## Firestore aggregates wanted

Non-personal fields only.

1. `inboundRequests/*/introductions` (collection group): count where `cancelledAtIso` exists, grouped by
   `cancelReason`. Settles how often F-03 has happened (today the introduction count is 0, so expect 0).
2. `captureOutbox`: count by `kind` and `status`, plus the count where `status == "failed"` and
   `lastError` starts with `delivery_retry_age_exceeded`. Settles F-03 and F-15.
3. `inboundRequests`: count where `website_run_closures` exists, and how many of those have an
   introduction. Settles F-04's size.
4. `inboundRequests`: count of website jobs created on or after 2026-11-21T01:45Z (only a count). Bounds
   F-08.
5. `opsHeartbeats`: document ids and `updatedAt` for the worker. Settles whether the heartbeat is fresh.
6. `automationState/companyAutoSendCursor`: `updatedAtIso`. Settles whether the send sweep is running.
7. `captureUploadSessions`: count by `status` and by size bucket (<200 MB, 200-400 MB, 400 MB-1 GB,
   >1 GB) with `upload_transport`. Settles how often F-05 bites.
