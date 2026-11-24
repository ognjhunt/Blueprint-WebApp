# First job run: one new job, end to end

Started 2026-11-23. One new job is sent the way a site sends it, through the
live start form, and followed until an approved deployment company sees it,
answers, and the site asks for an introduction. The job is a probe: every gap
it finds is fixed at its cause, for every job.

This file is the run log. It is written as the run goes, so later sections
are empty until their step has happened. Every claim names its source: a
command and its output, a file and line, a screenshot of the test job, or a
measured number. Anything else is marked unverified.

The audit this follows is in pull request 1374
(`docs/qa/first-principles-audit/` on its branch): `what-shipped.md`,
`journeys.md` and `pipeline-timing.md`. It is not repeated here.

## Resume note

For a session that picks this up. Newest first.

- 2026-11-24 01:30Z. **The host runs `8bcf6bf`** since 01:23:31Z: another
  operator deployed `main`'s newest commit, which contains 3708, 3709 and
  3710, so this session did not stack a deploy (`main`'s CI attested 3709's
  merge `6aad286` at 01:20:57Z). Merged since the last note: Pipeline 3709
  (gap 19, 00:49Z), 3714 (gap 22, `e70b35c`, 01:23Z; **not on the host
  yet**, it needs the next deploy); WebApp 1430 (gap 23, 01:06Z). Open:
  WebApp 1429 (gap 12; `main` merged in, one check rerunning), 1424 (held
  for the owner). Job 1 at 01:24Z: hand-off still `needs_input`
  (`website_atlas_source_pose_unavailable`) from the old release; its
  preparation has run 15 times, last at 00:46Z; the next run, under the new
  release, should write the room flagged "scale not measured" and the
  company pass should ship it. Background task `brn3hcwvb` watches its
  hand-off and `pipeline/company_simulation/` through the door. Then: as the
  company, download the simulation, open it, list its files; cost; timeline;
  the site withdraws. Not started: gaps 24, 25 and gap 17's build.
- 2026-11-24 00:35Z. The session was stopped by the usage limit from about
  19:20Z to 00:13Z (it reset at 22:50Z); two workers were cut off. **Job 1's
  first look was made by itself at 19:39:03Z**, after pull request 1421 went
  live: its record holds `capture_coverage_review { state completed,
  recovery_cause video_too_large }` (gap 20 verified). Merged since the last
  note: WebApp 1422 (gap 10), 1423 (gap 21), 1420 (gap 11, `2cb7a58`,
  00:15Z); Pipeline 3710 (gap 6), 3708 (gap 8, `7bb535b`, 00:15Z). The host
  still runs `3da38f4`. Open: Pipeline 3709 (gap 19; its failing tests
  compared the stored pose record exactly and the fix had added a `wall`
  field: now recorded for typed and text-only walls alike; 867 tests pass on
  current `main`; waiting on its two long test shards); WebApp 1429 (gap 12,
  finished by this session after its worker was cut off), 1424 (gap 18:
  green, **held for the owner**, see "What still needs the owner"). Running:
  workflow `fix-gap-22` again (task `w2ihm9xks`). Next: merge 3709 when
  green, wait for `main`'s CI to attest, deploy through the door, watch job
  1's room ship; then the download, cost, timeline and withdrawal.
- 2026-11-23 19:18Z. **The host runs `3da38f4`** (deploy finished
  19:11:43Z: 3702, 3703, 3707). **Job 1's room is built and archived**
  (18:59:32Z, 174 MB), but it has no scale: its scale step ended
  `source_pose { needs_input, atlas_scene_planner_output_invalid }`, which is
  the provider's no-credit answer recorded as an invalid answer (gap 22), and
  nothing ships until 3709 is merged and deployed (gap 19). Merged since:
  WebApp 1421 (gap 20, `3df99d4`, 19:07Z; website deploy pending, live is
  `e1fc832`). Open: Pipeline 3708 (waiting on its last test shard), 3709
  (review finding fixed: fail-closed list; one more commit of mine adds the
  two scale-review codes so a room like job 1's ships flagged); WebApp 1420
  (needs `main` merged in after 1423), 1422 (gap 10), 1423 (gap 21). Workers
  running: workflow `fix-gaps-5` (task `w3jakus9q`: gaps 18, 12, 6) and
  `fix-gap-22` (task `wm0vy8l4n`). Next: merge 3708 and 3709 when green,
  wait for `main`'s CI to attest, deploy through the door, then watch job 1
  ship its room by its own retries; after 1421's website deploy, confirm job
  1's reading is read by itself. The provider design (gap 17) is in the
  scratchpad at `wf/fix-gaps-4-results.json`; its staged plan is summarised
  under gap 17.
- 2026-11-23 19:05Z. **Pipeline deploy of `3da38f4` requested through the
  door at 18:59:47Z** (3702, 3703, 3707; `main`'s CI attested it at
  18:57:19Z; no other request was pending). Confirm with `door status`
  (`active_release.commit`). Merged since the last note: WebApp 1419 (gap 9,
  `e1fc832`, 18:51Z; its website deploy was triggered by `main`'s CI). Open
  and waiting on checks: Pipeline 3708 (gap 8; review finding fixed, one
  more commit of mine keeps a room floor-less while the site's correction of
  the job's object is still being applied); WebApp 1420 (gap 11; its `test`
  check failed on gap 21, not on its own change: after 1423 merges, merge
  `main` into its branch), 1421 (gap 20), 1423 (gap 21). Still running:
  workflow `fix-gaps-4` (gap 19, then the gap 17 design; gap 10). Not
  started: gaps 6, 12, 18.
  A mistake to know about: 1419 was merged while its `e2e` check was still
  running (the other checks were green and GitHub allowed it). `e2e` then
  passed on that commit and on `main` (`e1fc832`: all checks green). Since
  then every check is read as complete before a merge.
- 2026-11-23 18:45Z. Merged: WebApp 1418 (`5c654e4`, 18:36Z; its deploy
  follows), Pipeline 3707 (`26379aa`, 18:34Z) and 3703 (`3da38f4`, 18:38Z).
  **Not deployed yet on the host** (still `8feb4e9`): the door deploys a
  commit only after `main`'s CI has attested it; deploy `3da38f4` or later
  once it has, after `door status` shows no pending request. Open: Pipeline
  3708 (one review finding, real, a worker is fixing it on the branch).
  Job 1's first look: the real cause is gap 20 (the reading refuses a video
  over 64 MB), with a worker (workflow `fix-gap-20`, task `we244cd81`). Job
  1's room build tries again at 18:58:42Z on the old release; if that is
  refused, its next try is about 21:58Z, and from then the new release treats
  a no-credit answer as an outage and retries every 2 min doubling to 1 h.
- 2026-11-23 18:40Z. Four pull requests are open and waiting on checks and
  the automated review: Pipeline 3703 (gaps 5, 14), 3707 (gap 7), 3708 (gap
  8); WebApp 1418 (gap 15). Merge order for the Pipeline: 3703, then 3708,
  then 3707 (3707 and 3708 touch the same file, which sits at its 2,000-line
  budget: after each merge, merge `main` into the next branch and re-run
  `scripts/verify_source_governance.py`). Running: workflow
  `followups-3703-1418` (task `w9qtqgzwn`) and workflow `fix-gaps-4` (task
  `w96x1hf4x`, script in the session scratchpad under `wf/`): two lanes, one
  worker each: gap 19 then the gap 17 design; gaps 9, 11, 10. Job 1 at
  18:29Z: room build still at `source_pose`, refused three times for no
  credit, next try 18:58:42Z, then 3 h, 6 h, 12 h, 24 h and it ends unless
  3703 is deployed or credit is added first.
- 2026-11-23 18:15Z. Still stopped on money (OpenAI credit, owner). The host
  still runs `8feb4e9`; Pipeline `main` is `0f38c62` (3702, 3704 by another
  session, and 3706, which put `main`'s source-governance check back to green:
  one module was 2,001 lines against a 2,000-line budget after two merges
  met). Open pull requests: Pipeline 3703 (gaps 5 and 14; two checks failing,
  a worker is on it), WebApp 1418 (gap 15; three automated review findings,
  one about money, a worker is on it). Running, two workflows of two workers
  each: `followups-3703-1418` and the second pair of `fix-gaps-3` (gaps 7 and
  8). Correction to the 18:05Z note: the website's video reading uses Gemini,
  not OpenAI, so the OpenAI balance did not park job 1's first look; see gap
  15. Owner, about 18:10Z: yes to making the provider flexible (gap 17). Not
  started again yet: gaps 6, 9, 10, 11, 12, 17. Next: merge 3703 when green
  and deploy Pipeline `main` through the door (check `door status` and `door
  requests` first; the deploy restarts job 1's attempt); merge 1418 when its
  findings are answered and watch job 1's first look recover by itself.
- 2026-11-23 18:05Z. **Stopped on money: the OpenAI account has no credit**
  (the owner must add credit; see "What still needs the owner"). Job 1 is
  listed, its video is visible, the company answered and the introduction is
  made. Its room build waits on OpenAI, so there is no simulation yet, and its
  first look is parked (gap 15). The usage limit cut seven fix workers at
  about 15:45Z; it reset at 17:50Z. Merged since: Pipeline 3702 (gap 3 and 4),
  not deployed yet; the host still runs `8feb4e9`. Another session merged
  WebApp 1416 and Pipeline 3704 in between. Running now, workflow
  `fix-gaps-3`, two at a time: the room-build funding outage (extends Pipeline
  pull request 3703), the video reading that retries by itself (WebApp), then
  the two "room ships at once" fixes. Not started again yet: gaps 6, 9, 10,
  11, 12. Next: review and merge each pull request; deploy Pipeline `main`
  through the door once 3703 is merged (it restarts job 1's attempt); when the
  owner has added credit, watch job 1 recover by itself; then the simulation
  download, the cost, the withdrawal.
- 2026-11-23 15:40Z. Job 1 is on the host and its room build is in flight.
  Its sound-free video is not built yet (gap 3). Nine fixes are with workers
  in two workflows (`fix-preflight-gaps-1`: six; `fix-preflight-gaps-2`:
  three), branches `claude/dreamy-hamilton-qn8lm4-<slug>` in each repository,
  one pull request each; see "Gaps found before the job reached them". For
  each pull request: read the worker's report, check CI and the automated
  review, merge; a WebApp merge deploys; Pipeline merges deploy through the
  door as they land (owner, 15:04Z), and each Pipeline deploy restarts job 1's
  attempt in flight. Owner decisions at about 15:35Z ("yes to both"): a built
  room ships flagged at once in every case; a billable event counts only once
  the introduction is made. Watchers running in this session: job 1's clip,
  and internal test job `itest-917ca852…`'s first retry on the new release.
  Job 2 is not sent.
- 2026-11-23 15:24Z. **Job 1 is submitted** (15:21:20Z). Ids: request
  `capture-ceba4511-bfca-4a22-8fdc-0ffae40d27c3`, capture
  `walkthrough-capture-ceba4511-…`, scene `site-capture-ceba4511-…`. The host
  runs `8feb4e9`; the website runs `5c013b6` (1410, 1414 and 1415). Waiting
  for: the hand-off to reach the host, the job link email, the sound-free
  video, the listing and the new-job email to the company. Read the job on the
  host with the door, states and times only. Also running: the pre-flight
  workflow (four stretches), and a watch on internal test job
  `itest-917ca852…`, whose first retry on the new release was due 15:29Z: it
  shows whether a finished room now ships as the simulation.
- 2026-11-23 15:06Z. The Pipeline deploy of `8feb4e9` is running; another
  operator requested it at 15:00:09Z (door request
  `20261123T150009Z-deploy-556fb13c`), so this session did not stack a second
  one. The website is on `a65e3e8` with the gap 1 fix. Pull request 1415 (gap
  2) waits for its last check. A pre-flight workflow traces four stretches of
  the path on fixtures and emulators. Owner decisions at about 15:04Z, for
  this run only: Pipeline fixes may deploy as they merge, outside the window
  (the door still holds a deploy while a paid stage runs); workers may pull the
  internal test jobs' stored files (`itest-…`) for replays. Next: confirm the
  deploy; merge 1415 and 1410; confirm `/version.json`; recount; submit job 1
  with the Mixkit clip, place picked from the suggestions. Job 2 (the CC0
  warehouse walk-through, typed place) goes in only after job 1 is listed.
- 2026-11-23 14:32Z. Pull request 1414 (gap 1) is merged; its deploy to the
  website is not confirmed yet (`/version.json` still `043d2fc`). The owner
  said at about 13:45Z to merge pull request 1410 after the Pipeline deploy,
  and confirmed the Mixkit clip. Still to do in order: Pipeline deploy at
  15:00Z; answer 1410's review thread and merge it; confirm `/version.json`
  holds both; recount; submit.
- 2026-11-23 13:35Z. The test company is approved, signed in and has
  accepted the Terms. Nothing is submitted yet. Two workers are running: one
  looks for a Mixkit clip under its free licence, one fixes gap 1 on branch
  `claude/dreamy-hamilton-qn8lm4-place-city-state`. A check-in is scheduled
  for 15:00Z. Next steps in order: deploy `origin/main` through the door at
  15:00Z and confirm it; answer the open review thread on pull request 1410
  and merge it; merge the gap 1 fix once its checks are green; confirm
  `/version.json`; recount companies and listable real jobs; submit the job,
  picking the place from the suggestions so the city and state are stored.
  The company's browser profile and the scripts are in the session's
  scratchpad and do not survive the session: a new session asks for a fresh
  sign-in link on `/sign-in` (read from the company test address).

## Test values

| What | Value |
|---|---|
| Site account | the owner's Gmail, plus-address `+bpsite1123` |
| Company account | the owner's Gmail, plus-address `+bpco1123` |
| Company name on the application | Test Deployment Co (Blueprint first-job run 2026-11-23) |
| Company website on the application | `https://example.com` (a reserved test domain) |
| Place | Austin, Texas. **A test value**: the clip's real place is not known. |
| Job sentence | "Scrape the cake batter from the mixing bowl into each baking pan on the counter." |

No real site and no real company is part of this run. Production data beyond
the test job is read as counts and timings only.

## Footage

**The clip for the job.** One clip, used as downloaded, not edited.

| | |
|---|---|
| Source page | `https://mixkit.co/free-stock-video/woman-pastry-chef-pouring-a-mixture-into-baking-molds-50033/` |
| File | `https://assets.mixkit.co/videos/50033/50033-1080.mp4`, downloaded 2026-11-23 13:35Z |
| sha256 | `9287a931b2f0448e1712b5437823386a72b6f69a1f00f3fe5e813cb3d0ce140b` |
| Size, length, format | 76,974,681 bytes; 21.4 s; 1920x1080 H.264 mp4, 23.976 frames a second; no sound track (`ffprobe`) |
| What it shows | A commercial kitchen. A worker in a white jacket, seen from the shoulders down, scrapes cake batter from a steel mixing bowl into round baking pans lined up on a steel counter. One continuous shot (`ffmpeg` scene filter at 0.3: 0 changes). |
| Faces | None: the worker is framed from the shoulders down in all 12 frames looked at. |
| Names, logos, text | None seen in those frames. |
| Job sentence | "Scrape the cake batter from the mixing bowl into each baking pan on the counter." True of what is on screen. |
| Place | Austin, Texas: a test value. The clip's real place is not known. |

**Licence.** Mixkit Stock Video Free License. The item's own page marks it
`data-license="videoFree"` and carries no "Restricted" or "Personal Use only"
wording. The licence text, read on `https://mixkit.co/license/` on 2026-11-23
at 13:28Z: "Items under the Mixkit Stock Video Free License can be used in your
commercial and non-commercial projects, for free. You're permitted to
download, copy, modify, distribute, publicly perform and broadcast the Items.
Your rights are non-exclusive, worldwide, sub-licensable and ongoing.
Attribution is not required". The limits it points to, read in section 9 of
`https://mixkit.co/terms/` at 13:29Z: no selling unaltered copies, no offering
items as stock, no competing service, no removing watermarks, no mass
download. That section names no limit on analysing a clip with software.

Not read: Envato's Acceptable Use Policy, which those terms also apply. Its
page answered automated requests with a challenge (HTTP 403) and was left
alone. The site's own public sample job already uses a Mixkit clip under this
licence.

**How well it fits the brief.** It is a repetitive manual job with no face,
which the brief asked for. It is not a handheld walk through a work area: the
camera only drifts, and the room is seen from one side. No clip found under a
clean licence had both.

Looked at and not used, 2026-11-23 13:20Z to 13:30Z:

- **Coverr** (two stockroom clips that show the job). Its licence page says
  "Nothing from Coverr may be used to train, fine-tune, distill or evaluate AI
  models, or go into a dataset for that purpose." This run sends frames to
  model providers and is itself a test. Not used, so that no rights question
  is open.
- **Mixkit items under its "Stock Video Restricted License"** ("720p Version
  for Personal Use only"): not a reuse licence.
- **Pexels, Pixabay, the Wikimedia Commons API**: each refused an automated
  request from this network (HTTP 403, 403, 429). Not retried; no bot check
  was worked around.
- **Internet Archive, "Baggage unloading"** (CC0): filmed through a terminal
  window, an airline's name on every cart.
- **Internet Archive, "Warehouse of Old Electronics Equipment"** (CC0,
  uploaded by its author in 2011): a real handheld walk through a packed
  warehouse, 640x480 and very shaky, nobody doing a job. Kept as the fallback.

## Before the job was sent (read-only checks)

Read 2026-11-23 between 13:11Z and 13:20Z.

| Check | Result | Source |
|---|---|---|
| Release on the host | `cbff06b4409c`, deployed 2026-11-20. `origin/main` is `8feb4e9`. The 16 Pipeline pull requests merged after the audit are not on the host. | `python3 scripts/operator_door.py status`: `active_release.commit`, `deployed.commit_proven: true`, `deploys.recent_receipts[0]`; `git log origin/main -1` |
| Deploys or paid work in flight | none: no active deploy unit, 0 pending door requests, every paid-launch lock unheld | same status: `deploys.active_units: []`, `door_requests`, `paid_launch_locks` |
| WebApp pull request 1410 | open, not merged; checks green on `fcca7ea`; one automated review thread open | GitHub pull request 1410 |
| Live website | `a2afb48` (`main`); the start form shows the v4 sentence, without "the city and state it is in" | `https://tryblueprint.io/version.json`; the start form's text read in headless Chromium |
| Companies that may see jobs | 0. Records: 1 approved (no signed-in Terms acceptance) and, after 13:17Z, the test company's application | count over `robotTeamAccess` by `status` and `termsAcceptedByUid` present; the rule is `companyMaySeeJobs`, `server/utils/companyTerms.ts:37` |
| Real jobs an approved company could be shown | 0: no capture has a company video that is not an internal test (34 capture records: 26 with no clip, 8 internal test) | count over `captureUploadSessions` by `company_clip.permission_basis`; a job with no company video is not listed (`video_required`, `server/utils/teamJobAccess.ts`) |
| Sends, views, answers, introductions, billable events | 0 of each | counts over `companySends`, `companyViews`, `companyResponses`, `introductions`, `billableEvents` |
| Month to date | $301.99 counted of the $400 limit for 2026-11 (75.5%); admission allowed; $0 held | status: `spend_guard.account_monthly_spend` (`counted_usd`, `limit_usd`, `admission_allowed`, `held_usd`) |
| Spend guard | `blocked`, one blocker: `runpod_inventory_query_failed` (the retired RunPod key, an owner step). 0 live machines, $0 an hour. Admission is not stopped by it. | status: `spend_guard.status`, `blockers`, `live_instance_count`, `spend_admission_lock.admission_allowed: true` |
| Rehearsal on the emulators | `npm run test:core-journey`: 2 passed (27.6 s) | run in this session, 13:13Z |

The forecast in the same status says the account reaches its limit on
2026-11-30 at $13.39 a day with no job behind it. One job at its full $40 cap
would bring the count to $341.99.

The counts were read with a script that calls only Firestore's two read
endpoints (`runAggregationQuery` and `runQuery` with a field mask) and selects
status strings, version strings, booleans and timestamps. It selects no name,
address, contact, job text or media link.

## Timeline

Times are UTC.

| When | What | Source |
|---|---|---|
| 2026-11-23 13:17:50 | The test company applied through the live `/jobs` form: HTTP 202, "Your application is saved." | the form's own POST to `/api/robot-team-access/apply` and its response `Date` header; `evidence/company-application-receipt-1280.png` |
| 2026-11-23 13:21:39 | The owner approved it in one press. | the invitation's `revision` time in the approval email; count over `robotTeamAccess`: `approved: 2` at 13:22:21 |
| 2026-11-23 13:21:43 | The approval email reached the company address: "Your company is approved to see jobs on Blueprint". 3 min 53 s after the application. | Gmail, the message's `date` |
| 2026-11-23 13:23:05 to 13:23:09 | The company opened the link in that email, ticked "I agree to the Terms and Privacy Policy", pressed Create account, and was signed in with no password and taken to Find jobs: "No jobs yet. New jobs appear here when their video is ready." | browser log of the visit: `POST /api/account-invitations/redeem` 200, `POST /api/workspace/setup` 200, `GET /api/site-worlds/tasks` 200; `evidence/company-find-jobs-empty-1280.png` |
| 2026-11-23 13:24 | The company's record holds a signed-in acceptance of Terms 2026-11-21.1 and Privacy 2026-11-21.1. Companies that may see jobs: 1, the test company. | count over `robotTeamAccess`: `approved_with_signed_in_terms_uid: 1` |
| 2026-11-23 15:00:09 | Another operator requested the Pipeline deploy of `8feb4e9` (door request `20261123T150009Z-deploy-556fb13c`); this session did not stack a second one. | `door status` at 15:00:29: `deploys.active_units`; `door requests` |
| 2026-11-23 15:11:35 | The host runs Pipeline release `8feb4e9`: `commit_proven: true`, no blockers, hand-off listener timer active. 11 min 26 s from the request. | `door status` at 15:11:37: `active_release.commit`, `deployed`; receipt `iteration_8feb4e96112b_door.json`, mtime 1795446695 |
| 2026-11-23 15:13 | Pull request 1410 merged (`fc401e9`), then 1415 (`5c013b6`). | GitHub merge results |
| 2026-11-23 15:18:54 | The website serves `5c013b6`: the start form shows the sentence with "the city and state it is in". | `/version.json` `built_at_iso`; the form's text read at 15:21:16 |
| 2026-11-23 15:20:48 | Last checks before sending: companies that may see jobs 1 (the test company); real jobs a company could be shown 0; month $302.04 of $400, admission allowed, no deploy running, no lock held. | counts over `robotTeamAccess` and `captureUploadSessions`; `door status` at 15:20:50 |
| 2026-11-23 15:21:20 | **Submitted.** The site pressed Send on the live start form: HTTP 201. Recorded: statement and description authority `2026-11-23.v6`, Terms `2026-11-21.1`, Privacy `2026-11-23.1`, country `us`, place `{"source":"google_places","city":"Austin","state":"Texas","country":"US"}`. The hidden bot field was left empty and nothing refused the browser. | the form's own `POST /api/inbound-request` body and its response `Date` header |
| 2026-11-23 15:21:32 | The video was received: `POST /api/self-capture/uploads/<token>` 201; the page read "We have your video." at 15:21:33. 12 s for 77 MB. | browser log of the visit |
| 2026-11-23 15:21:57 | The site's job page: "Video received. We're preparing your job for posting." and, under First look, "We're watching your video." No sideways scroll at 390 px (`scrollWidth` 390). | `evidence/site-job-page-at-submit-1280.png`, `-390.png` |
| 2026-11-23 15:22:49 to 15:22:51 | The hand-off reached the host, 77 s after the video was received. | host files' times through the door: `deliveries/` 15:22:49, `pipeline_handoff.json` 15:22:51 |
| 2026-11-23 15:22:53 to 15:22:55 | The Pipeline run started; preflight took 1.1 s, materialization 0.8 s; the capture pipeline stage started 15:22:55. | `pipeline/run_summary.json` `stage_timings` |
| 2026-11-23 15:22:55 | The room build was queued; its first step was in flight from 15:22:58. | `pipeline/atlas/preview_job.json`: `enqueued_at_epoch`, `step_in_flight.since_epoch` |
| 2026-11-23 15:23:44 | "Your Blueprint job link" reached the site address, 2 min 24 s after Send. It tells a site that already sent its video that a video is required (gap 11). | Gmail, the message's `date` and text |
| 2026-11-23 16:11:19 | The sound-free video was built, 48 min 28 s after the hand-off (gap 3). | `pipeline/company_clip/company_clip.json` `built_at_epoch` 1795450279 |
| 2026-11-23 16:11:47 | **Video visible.** The clip was delivered to the website under `site_sharing_statement`, `2026-11-23.v6`; from then the job is shown to approved companies. | same file, `delivered.at_epoch` 1795450307; count of clips a company could be shown went from 0 to 1 |
| 2026-11-23 16:11:48 | **Listed and sent** to the one approved company, 50 min 28 s after Send. (The listing record itself was written at 15:21:16, with the submission.) | the job's `company_auto_send.sentAtIso`; `public_task_listing.wentLiveIso` |
| 2026-11-23 16:12:12 | "New job on Blueprint" reached the company address. It gives the country and the job's link; no kind of job, since no first look existed. | Gmail, the message's `date` and text |
| 2026-11-23 17:52 | The company's Find jobs card: "Automation job", the sentence, "Austin, Texas, United States", "Simulation not started yet". Its job page: the same place line, "Shared November 23, 2026", the video playing (1280x720, 21.4 s, no sound decoded), the response form, "Our first look is not ready yet.", "The simulation of the site is not finished yet." No sideways scroll at 390 px. | `evidence/company-find-jobs-1280.png`, `-390.png`, `evidence/company-job-page-1280.png`, `-390.png`; browser log of the visit |
| 2026-11-23 17:54 | The site's job page: "Posted for approved deployment companies", "Viewed by 1 company", "0 responses"; First look still "We're watching your video." | browser log of the visit |
| 2026-11-23 17:59:11 | **Answered.** The company chose Interested with a note: HTTP 200. | the page's own `POST /api/site-worlds/tasks/<id>/interest` and its `Date` header |
| 2026-11-23 17:59:27 | "A deployment company answered" reached the site address. | Gmail |
| 2026-11-23 17:59:40 | The site's job page: "1 response", "Time to first response: 2.6 hours.", "Company A", "Interested", "Answered November 23, 2026", the note in their words, and the Introduce us button. | `evidence/site-answer-shown-1280.png`, `-390.png` |
| 2026-11-23 18:00:15 | The site pressed Introduce us: HTTP 200. The page read "We are emailing you and Company A each other's contact details." | the page's `POST …/introductions`; the introduction record's `requestedAtIso` 18:00:15.343 |
| 2026-11-23 18:00:28 | **Introduced.** Both emails arrived: "A site wants to talk about its job" at the company address (the site's email and "Austin, Texas"), and "Meet Test Deployment Co …" at the site address (the company's contact name, email and website). | Gmail, both messages' `date` |
| 2026-11-23 18:00:28 | One billable event records when the introduction was made: `billableEvents/introduction-capture-ceba4511-…-246f01597c9c…`, kind `introduction`, status `recorded_no_price`, `madeAtIso` 2026-11-23T18:00:28.094Z. It is the only billable event in production. | read-only query over `billableEvents` (ids, states and times) |
| 2026-11-23 18:59:32 | Job 1's room is built and archived on the host (174 MB), with no measured scale: its scale step ended `atlas_scene_planner_output_invalid` (gap 22). | `door cat` of `pipeline/atlas/preview_job.json` (`state ready`, `stage archived`) and `result.json` (`source_pose`) |
| 2026-11-23 19:11:43 | The host runs Pipeline release `3da38f4` (pull requests 3702, 3703, 3707). 11 min 56 s from the request at 18:59:47. | the door's deploy result and `door status` `active_release.commit` |
| 2026-11-23 19:39:03 | **First look made.** Job 1's video reading completed by itself after the fix for videos over 64 MB went live (run started 19:37:36). 4 h 17 min 43 s after Send; with that fix a reading takes about 1.5 min. | job 1's own `agentRuns` rows for its review id; `capture_coverage_review { state completed, recovery_cause video_too_large }` |
| 2026-11-24 01:23:31 | The host runs Pipeline release `8bcf6bf`, deployed by another operator; it contains pull requests 3708, 3709 and 3710. | background watch on `door status` (`active_release.commit`): `3da38f4` at 01:21:22, `8bcf6bf` at 01:23:31, deploy unit gone at 01:24:34 |

## Gaps

Each gap gets: what, evidence, the fix (pull request), how it was verified.

### Gap 1. The start form drops the place's city and state

Found by reading, before the job was sent.

- **What.** A company can be shown "City, State, United States" only from the
  job's stored city and state. No form stores them, so every job shows a
  company the country alone, whatever statement the site accepted. Pull
  request 1410 alone would not change that.
- **Evidence.** `companyPlaceOf` reads only
  `request.siteLocationMetadata.state` and `.city`
  (`server/utils/companyJobPage.ts:117-128`). The start form's payload carries
  `siteName`, `siteLocation` and `captureRegion` and no `siteLocationMetadata`
  (`client/src/components/site/SiteCaptureStart.tsx:481-497`);
  `git grep -l siteLocationMetadata origin/main -- client/src` lists only
  `client/src/lib/firebase.ts` and `client/src/types/inbound-request.ts`, and
  the same on the 1410 branch. On the live form, picking "Austin, Texas"
  already asks Google for the place's parts (`GetPlace`) and keeps only the
  country (`LocationAutocomplete.tsx:103-104`).
- **Fix.** Pull request 1414, merged 2026-11-23 14:31Z (`a65e3e8`). A place
  picked from the suggestions, or "Use my location", stores its city, state
  and two-letter country from the provider's own parts. A typed place with no
  pick stores the state only, from a closed list of United States states,
  never a city from free text. The signed-in start route dropped the same
  fields silently; fixed in the same pull request. Tests: the mapping for each
  provider, the typed-state parser with adversarial inputs, the form's request
  body, and one server test from the start route's stored record to the
  company's view ("Austin, Texas, United States" for a pick; "Texas, United
  States" for typed "Acme Foods, 12 Main Street, Austin, TX").
- **Its checks.** The automated review found nothing. The first CI run failed
  the pull request's own new browser test: the form saves its draft a few
  milliseconds after a pick, under a cross-tab lock, and the test reloaded
  before that save ran. Under a 6x CPU throttle the test failed 5 of 60 runs
  before the change and 0 of 60 after. The test now waits for the stored draft
  to hold the pick. Not a product fault: writes never land out of order, and a
  person cannot reload that fast.
- **Left for the owner.** A hand-made request, not the form, can put any
  digit-free text of up to 60 characters in the city field; a company would be
  shown it once a statement allows the city. With a city stored, the existing
  redaction also removes the city's name from the site's sentence as companies
  read it, although the place line shows the city.
- **Verified.** On the live form at 14:49Z (release `a65e3e8`), with nothing
  sent: after picking "Austin, Texas" the form's own saved draft holds
  `{"source":"google_places","city":"Austin","state":"Texas","country":"US"}`.
  On job 1 at 15:21:20Z the form's request body carried the same four
  values. Still to verify: the place line a company reads.

### Gap 2. A new test on main failed at random

Found while test-merging pull request 1410 onto main after gap 1 merged.

- **What.** `server/tests/start-place-company-view.test.ts`, added by pull
  request 1414, failed about one run in five. A test that fails at random
  blocks any pull request, and a red main does not deploy.
- **Evidence.** It read the start route's development log at a fixed path
  under the temp folder (`start-place-company-view.test.ts:21`), and
  `server/tests/inbound-request.test.ts:302-303` deletes that same path in its
  set-up. Run together 25 times on `a65e3e8`: 4 failures, each
  `ENOENT … /tmp/blueprint-dev-inbound-requests.jsonl`.
- **Fix.** Pull request 1415: the test points `TMPDIR` at its own fresh folder
  before it loads the route. One test file; no product code; no assertion
  changed.
- **Verified.** The same 25 runs after the change: 0 failures. Merge pending
  its last check.

### Gaps found before the job reached them (pre-flight, 15:05Z to 15:28Z)

Four workers each took one stretch of the path and ran the real code on
fixtures and emulators. A finding counted only with a failing test, a command
and its output, or an exact file and line. Each row gets its own pull request;
"Verified" is filled when the fix is seen working.

| # | What | Evidence | Fix | Status |
|---|---|---|---|---|
| 3 | The sound-free video is built last in the room-build unit, behind every job's paid room steps. | `website_atlas_preview.py` `main()` order (about :1203-1208); `OnUnitInactiveSec=60s`. Live on job 1: hand-off 15:22:51Z, clip built 16:11:19Z, 48 min 28 s later. | Pipeline pull request 3702: the cheap, rights-gated passes run first and again after the room steps; an error in the room steps no longer skips them. Tests fail before (5), pass after (665 in the four files). | merged 17:57Z (`7b0e562`); **deployed 19:11:43Z** (release `3da38f4`) |
| 4 | A finished job's simulation package is built at the very end of the same unit. | same file; estimated 10 to 30 min typical, about 2 h worst | same pull request as 3 (one cause) | merged with 3; deployed 19:11:43Z |
| 5 | A provider's own 500, 504 or 429 is read as a refusal: the job waits 15 min, then 1 h. | failing test, 5 cases (`…-pf-provider-500-waits`); `website_preparation_retry.py:68-69` | Pipeline pull request 3703 (`…-provider-5xx-outage`) | merged 18:38Z (`3da38f4`, pull request 3703); **deployed 19:11:43Z** |
| 6 | The hand-off listener runs up to six other jobs' re-runs before it pulls a new job. | `pubsub_handoff_scene_operations.py:485-518`, pull at about :531 | Pipeline, `…-listener-new-first` | merged 19:16Z (`a8bccc9`, pull request 3710); on the host since 2026-11-24 01:23:31Z (release `8bcf6bf`). |
| 7 | A built room never ships when the object path is unclear (no scene intent, build never queued, block with no hold): nothing for 24 h, then only a log line. | failing test, 6 cases (`…-pf-floor-never-ships`); `website_company_simulation.py:433-500` | Pipeline pull request 3707 (`…-floor-ships-unclear`): these cases now ship the room flagged at once, as an object still being built already does; 6 tests fail before, 58 pass after. Owner: yes, 15:35Z. | merged 18:34Z (`26379aa`, pull request 3707); automated review: no findings; **deployed 19:11:43Z** |
| 8 | When preparation stops on a blocker that is not privacy, rights or money, the built room ships only after the first retry cycle, about 46 h. | `website_scene_handoff.py` `first_retry_cycle_spent`; `job_retry_policy.py:60` (166,500 s). Live example: internal test job `itest-917ca852…`, room built 2026-11-20, 74 failed preparations, no simulation. | Pipeline pull request 3708 (`…-floor-on-blocked-preparation`): a preparation blocked after the room was built writes the room flagged with its blockers, and the company pass ships it at once; 11 tests fail before, 685 pass after. It does not cover the live example, whose cause is gap 19. Owner: yes, 15:35Z (replaces the timing approved 2026-11-22). | merged 00:15Z (`7bb535b`, pull request 3708); on the host since 01:23:31Z. One exception, the owner's to flip: no room ships while a site's correction of the job's object is being applied. |
| 9 | The site's page says "You were introduced to …" and shows the company's details at the press, before the company's email is sent. | failing test (`…-pf-introduced-before-made`); `server/utils/jobCompanies.ts:417-446` | WebApp, `…-introduced-when-made` | merged 18:51Z (`e1fc832`, pull request 1419): the page says "You were introduced…" and shows the company's details only once the company's email is sent; until then it shows the existing line "We are emailing you and … each other's contact details." Automated review: no findings. |
| 10 | A billable event counts before the introduction is made; an introduction whose company email has an unknown outcome, on a job then withdrawn, stays counted for good. | emulator run; `server/utils/billableEvents.ts:70`, `ownerTotals.ts:66-67` | WebApp, `…-billable-when-made`: count only events with a made time, list the others separately. Owner: yes, 15:35Z. | merged 19:16Z (`7c93469`, pull request 1422); live on the website (`ea30446`). |
| 11 | The job link email tells a site that already sent its video "A video is required to post your job." | read in the test site's mailbox, 15:23:44Z; `server/utils/taskLifecycleNotifications.ts` | WebApp, `…-job-link-email-video` | merged 00:15Z (`2cb7a58`, pull request 1420); website deploy pending. |
| 12 | A company's video stops seeking 15 min after the page loads: the ticket in its address expires and the player never asks for a new one. | `taskEvaluationResultDownloadTicket.ts:3`, `company-media.ts:94-95`, `CompanyJob.tsx:139` (read; the worker confirms with a test first) | WebApp, `…-video-ticket-refresh` | open, pull request 1429: the page asks for fresh tickets a minute before they end, through the same authorised page request, and the video continues from the same place. The ticket's life is unchanged. |
| 13 | The hand-off listener works on one job at a time. It was inside job 1's preparation from 15:22:39Z, so another job's retry due 15:28:59Z had not run by 15:31Z, and a second upload would wait the same way. | `door journal blueprint-pubsub-handoff-listener.service`: started 15:22:39Z, no "Finished" by 15:31Z; the other job's ledger still at attempt 74 | Needs a design: jobs side by side touch paid admission and the host's 4 CPUs. Not assigned. | measuring |
| 14 | **Money.** The OpenAI account ran out of prepaid credit and nothing told anyone. In the room build the provider's answer is read as a refusal: waits of 15 min, 1 h, 3 h and on, then the job ends. | Host journal 17:47:27Z: `openai.RateLimitError: Error code: 429 … 'You have no credits remaining …' 'insufficient_quota'`; job 1's `preview_job.json`: `refusal_retries_total 2`, `last_refusal_reason atlas_preview_ratelimiterror`; `website_atlas_preview.py` `_outage` (about :217-229). OpenAI has no balance to read (`docs/runbooks/beta-operations.md` section 2a). | Pipeline, on pull request 3703's branch: a funding refusal or a provider 429/5xx waits as an outage in both classifiers, never ends the job, and pages the owner. **The owner adds the credit.** | merged 18:38Z with gap 5 (pull request 3703); deployed 19:11:43Z. The credit itself is the owner's. |
| 15 | The website's reading of the video gave up within minutes and parked the job for a person. The first look never comes and the site is told "We're watching your video." for good. First read as a provider failure; the record says otherwise: the reading ran three times in 3 min 22 s, each time ending `waiting_prerequisite` (it was waiting for something the job did not have yet, not for a provider), and each wait was counted as a failed attempt. The lane uses Gemini (`server/agents/provider-config.ts:502`), so the OpenAI balance is not the cause. What the prerequisite is: being traced by the worker, unverified here. | Job 1's record: `capture_coverage_review: { state: "review_required", reason: "automatic_review_attempts_exhausted" }`, `capture_coverage_pending: false`; its `captureCoverageReviews` record: `attempts 3`, `state "waiting_prerequisite"`, first claimed 15:22:21Z, last started 15:25:43Z, source kind `browser_pending`; the site's page at 17:54Z, 2 h 33 min after Send. | WebApp pull request 1418 (`…-video-reading-retries`): a provider failure is an outage, the reading retries by itself, parked jobs are picked up again, the owner is alerted once. Being extended: a wait for a prerequisite is not an attempt and never parks a job. | merged 18:36Z (`5c654e4`, pull request 1418); live on the website by 19:00Z. **Verified live on job 1:** its parked reading was requeued by itself (`capture_coverage_review { state requeued, reason automatic_parked_reading_recovery }`) and ran at 19:02:40Z, 19:04:11Z and 19:06:11Z, each ending `video_too_large` (gap 20, whose fix was not live yet). |
| 16 | The company's note reaches the site with a common word changed: the company wrote "Test answer from the first-job run…", the site read "The company answer from the first-job run…". The redaction that removes the company's name replaced the first word of its name wherever it stood. A company whose name starts with an everyday word would have its notes garbled. | The answer sent at 17:59:11Z and the site's page at 17:59:40Z (`evidence/site-answer-shown-1280.png`). | Not assigned. It errs on the safe side (the name stays hidden); the owner decides whether to narrow it. | noted |
| 17 | One provider's empty balance stops every job's room build: the room-build planner names one provider in code (`atlas_scene_planner.py:1209`, `provider="openai"`), and the rule that lets a second provider take text work (`artisan_provider_choice.py`) covers one lane only and its privacy list stops at statement `2026-11-18.1`. | Job 1, 17:47:27Z (gap 14); the two files named. | Two pull requests to scope: Pipeline, a second provider for the room-build planner under one shared choice rule; WebApp, the video reading and first look through the adapter that exists. A statement version joins the privacy list only after its provider rows are checked. Keys and accounts on the host and on Render are the owner's. Owner: yes, about 18:10Z. | designed 19:10Z (read-only pass), not built. No single change in one repository can move a call to the second provider: the website's spend admission refuses that provider today, and that money check must stay. Staged plan: (A) gap 22; (C) the website admits the second provider for jobs under Privacy 2026-11-13.1 or later, on the same $40 cap; (D) one route rule and an "unfunded" marker in the Pipeline, and the three newer Privacy versions added to its list after their rows were read; (E) the planner on the second provider, web search off, quality to be compared on fixtures first. Owner set-up: the key in an owner-only file on the host, a terms digest on Render, a spend limit on that account. |
| 18 | **Money.** The website's video reading was not counted in the job's $40 ledger: it checked only the account's daily limit. Pull request 1418 now makes the reading check the job's cap before each paid call; the other direction is still open: the room preparation's admissions do not count what the reading has spent, so a job could reach $40 plus the reading's cost. | Automated review on pull request 1418 (verified by the worker: `captureCoverageInferenceBudget.ts`, `reserveCaptureCoverageInference`); the worker's reply on the thread, 18:25Z. | WebApp: a ledger reader for the reading's budget records, keyed by request, used by the job's other admissions. After 1418 merges. | open, pull request 1424, green, **held**: it counts the reading's spend for every admission of the job's $40 cap. A code comment records an owner decision of 2026-11-20 that the first look and brief reading stay outside every job's cap (`server/utils/accountSpendOverhead.ts:1-8`); pull request 1418 already put the reading's own admission on the cap. The owner decides which rule stands. |
| 19 | A room that is built but has no source pose and no measured scale never ships: the hand-off returns "needs input" before the room counts as ready, with no error, and the job retries about hourly for good. Job 1 is at the same room-build stage. | Internal test job `itest-917ca852…`: `pipeline/atlas/result.json` `source_pose.status needs_input` (`website_atlas_pose_attempt_failed`), `scene_measurements.status relative_sizes_only`, scale not measured, background splat and mesh completed; `website_atlas_scene_source.py:344-346`; more than 75 preparations since 2026-11-20. Replay by 3708's worker: no package before or after 3707 and 3708. | Pipeline, `…-unscaled-room-ships`: find why the pose attempt fails every time; ship the built room flagged with its scale stated as not measured, never an invented one. | merged 00:49Z (`6aad286`, pull request 3709); on the host since 01:23:31Z. A room ships unscaled and flagged only for reasons on an explicit list (the provider failing the pose attempt; the scale review ending without a scale); a recorded wall or any other code ships nothing. New README sentences: "Sizes in this room are relative; its scale was not measured." and a units line saying 1 unit is stated as 1 metre only so tools can open the file. |
| 20 | **The website's video reading refuses any video over 64 MB.** The start form accepts up to 2 GiB, and a phone records roughly 60 to 400 MB a minute, so most real jobs never get a first look: the reading fails the same way three times within minutes, the job is parked for a person, and the site reads "We're watching your video." for good. This, not a provider, is why job 1 has no first look. | Job 1's own three reading runs (15:22:22Z, 15:24:44Z, 15:25:44Z): `video_too_large: Task video is 73MB; the limit is 64MB`. `server/agents/adapters/gemini-video.ts:54` (`MAX_VIDEO_BYTES`); `server/routes/self-capture-uploads.ts:129` (2 GiB). Counts only, all of production: 67 reading runs, 24 completed, 43 failed (24 `video_fetch_failed`, 16 `gemini_video_failed`, 3 `video_too_large`: job 1's); 6 jobs parked for a person, 7 pending. | WebApp, `…-reading-any-size`: a smaller sound-free reading copy for a video over the limit; a read that can never succeed ends with its reason and the job goes on, and the page stops saying it is watching; readings parked as too large are read after the deploy with nobody pressing anything. | merged 19:07Z (`3df99d4`, pull request 1421). **Verified live on job 1:** its reading was requeued for the cause by itself and completed at 19:39:03Z (run started 19:37:36Z). |
| 21 | A Find jobs page test fails at random: it waits for the job list and then reads the page's heading in the same tick, but the heading follows the list one render later. It turned pull request 1420's `test` check red although that change touches no client code. | CI job 137930803652: `client/tests/pages/Contact.test.tsx:128`, with a page dump showing the list ready and the heading and fine print not yet updated; `TaskBrowse.tsx:60-63`, `Contact.tsx:27-30`. Not reproduced locally in 18 runs. | WebApp pull request 1423 (test only): the two tests await the heading. | merged 19:16Z (`d58f4d9`, pull request 1423). |
| 22 | **Money.** A provider's refusal of the room-build planner is settled on the job's ledger as if it were paid, and after two of them the call ends as "invalid output": job 1's scale was never measured for that reason, not because of its video. | Job 1: OpenAI answered "no credits remaining" at 17:47Z, about 17:58Z and 18:58Z; the job's settled OpenAI spend on the host's meter went $2.79 (15:40Z), $3.088 (18:15Z), $3.383 (19:11Z), about $0.295 per refused attempt (`door status`, `spend_guard.account_monthly_spend.jobs`); at 18:59:32Z `pipeline/atlas/result.json` held `source_pose { needs_input, atlas_scene_planner_output_invalid }`. Design pass: `atlas_scene_planner.py` about :1150-1166, :839. | Pipeline, `…-planner-refusal-unbilled`: an unbilled refusal settles $0, spends no repair and waits as an outage; the built room ships unscaled meanwhile and the measured room replaces it. The amounts already settled are the owner's to correct. | merged 01:23Z (`e70b35c`, pull request 3714); **not deployed yet**. A refusal known to bill nothing (402, no credit, a spend limit, a refused key) settles $0, spends no repair and waits as an outage; the built room ships unscaled meanwhile and the scale step is asked again every 2 min doubling to 1 h. Confirmed on job 1: two planner receipts with no completion, each settled at $0.294758 (`cost_basis reserved_upper_bound`, `cost_is_actual false`), $0.589516 in all; not rewritten. |
| 23 | The intake reliability spec fails at random: it reloads the start form before the draft is saved. It turned pull request 1429's `core-journey` check red although that change touches only the company's job page. | CI job 138122917845: case A-J-006, `#start-email` empty after the reload; the draft is written under a cross-tab lock (`client/src/lib/siteCaptureDraft.ts`). | WebApp pull request 1430 (test only): the spec waits for the saved draft, as `e2e/description-first-intake.spec.ts` already does. | merged 01:06Z (`d44d8f3`) |
| 24 | A room already built and archived never gets its scale measured later, and a better room does not replace a shipped one by itself: nothing runs a ready job's scale step again after the planner call reopens, and a new Atlas result is replayed into a shipped package only by an operator. Job 1 is in this state. | The gap 22 worker's trace: `website_atlas_preview._reopen_parked_after_release` covers failed and needs-input jobs only; `website_held_handoff_replay.superseded_atlas_result` ("Only the operator replays it"). | Pipeline: a once-per-release re-ask for ready jobs whose scale step ended without an answer; a measured result rebuilds the shipped package by itself. | not started |
| 25 | **Money.** Two other paid calls of the room build keep their full hold when the provider refuses for no credit: the image completion stays "submitting" with its hold and asks for reconciliation; the object research retires a refusal only when no reservation was recorded. | Read by the gap 22 worker: `website_image_completion.py:717-727`; `website_object_spec_research.py:781-787, 862-865`. Not seen live. | Pipeline: the same unbilled-refusal rule for both. | not started |

Run by the pre-flight and found working: the Pipeline's real clip for a job
under `2026-11-23.v6` is accepted by the website's real route (two sources,
landscape and portrait); a 10-bit HEVC portrait `.mov` with rotation and sound
comes out as a sound-free H.264 clip; the emulator journey on the 1410 branch.

## What still needs the owner

- Done 13:21Z: Approve on the test company's application.
- Decided 15:04Z, this run only: Pipeline fixes deploy as they merge; workers
  may pull internal test jobs' files for replays.
- Decided 15:35Z: a built room ships flagged at once in every case; a billable
  event counts only once the introduction is made.
- Decided about 18:10Z: providers are to be flexible (gap 17); one empty
  account must not stop every job.
- Decided by this session under the 15:35Z rule, yours to flip: a room ships flagged when its scale step ended without a scale (pull request 3709); no room ships while a site's correction of the job's object is still being applied (pull request 3708).
- Money, to decide: job 1's ledger holds about $0.59 settled for three planner calls the provider refused and did not bill (gap 22).
- Render: the website's service is on the starter plan; reading a large video now re-encodes it there (gap 20).
- **Money, to decide (gap 18):** does the video reading's spend count on the job's $40 cap? Your decision of 2026-11-20, as the code records it, says the first look and brief reading stay outside every job's cap and count as account overhead. Pull request 1418 (merged 2026-11-23, to stop unbounded paid re-reads) made the reading's own admission check the job's cap, and pull request 1424 would make every other admission count it too. Stricter either way, but both cannot be the rule.
- **Now: add credit to the OpenAI account** (or switch on automatic
  recharge). Job 1's room build and first look wait on it. Found 17:47Z.
- **To void:** the test introduction's billable event,
  `billableEvents/introduction-capture-ceba4511-bfca-4a22-8fdc-0ffae40d27c3-246f01597c9c…`
  (made 2026-11-23T18:00:28Z, status `recorded_no_price`). It is between the
  two test accounts.
- Open: gap 16, the company's name taken out of its note word by word.
- Open: whether an introduction whose company email has an unknown outcome is
  ever settled once the job is withdrawn (the second half of gap 10).
- Open: gap 13, jobs handled one at a time by the listener.
- The upload hand-off function (`extractFrames`) lives in the
  `BlueprintCapture` repository, which this session may not read (adding it
  was refused by the session's permissions). If a job under the new statement
  stops at the hand-off, the cause may be there.
- One other company is approved and has never signed in. If it signs in and
  accepts the Terms while the test job is listed, it sees the test job and is
  emailed about it.
