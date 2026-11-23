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

## What still needs the owner

- Done 13:21Z: Approve on the test company's application.
- The upload hand-off function (`extractFrames`) lives in the
  `BlueprintCapture` repository, which this session may not read (adding it
  was refused by the session's permissions). If a job under the new statement
  stops at the hand-off, the cause may be there.
- One other company is approved and has never signed in. If it signs in and
  accepts the Terms while the test job is listed, it sees the test job and is
  emailed about it.
